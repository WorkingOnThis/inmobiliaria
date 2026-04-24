import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { tenantCharge } from "@/db/schema/tenant-charge";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { nextReciboNumero } from "@/lib/receipts/numbering";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

const emitSchema = z.object({
  chargeIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = emitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { chargeIds, fecha, honorariosPct, trasladarAlPropietario } = result.data;

    const charges = await db
      .select()
      .from(tenantCharge)
      .where(inArray(tenantCharge.id, chargeIds));

    if (charges.length !== chargeIds.length) {
      return NextResponse.json({ error: "Uno o más cargos no fueron encontrados" }, { status: 404 });
    }

    const cargosNoListos = charges.filter((c) => c.estado !== "pendiente");
    if (cargosNoListos.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes cargos ya fueron procesados: ${cargosNoListos.map((c) => c.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    const contratoIds = new Set(charges.map((c) => c.contratoId));
    if (contratoIds.size > 1) {
      return NextResponse.json(
        { error: "Todos los cargos deben pertenecer al mismo contrato" },
        { status: 422 }
      );
    }

    const contratoId = charges[0].contratoId;
    const inquilinoId = charges[0].inquilinoId;
    const propietarioId = charges[0].propietarioId;
    const propiedadId = charges[0].propiedadId;

    const [contractRow] = await db
      .select({ contractNumber: contract.contractNumber })
      .from(contract)
      .where(eq(contract.id, contratoId))
      .limit(1);

    const [inquilinoRow] = await db
      .select({ firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(eq(client.id, inquilinoId))
      .limit(1);

    const nombreInquilino = inquilinoRow
      ? [inquilinoRow.firstName, inquilinoRow.lastName].filter(Boolean).join(" ")
      : "Inquilino";

    const totalRecibo = round2(charges.reduce((s, c) => s + Number(c.monto), 0));
    const montoHonorarios = round2(totalRecibo * honorariosPct / 100);

    const result2 = await db.transaction(async (tx) => {
      const reciboNumero = await nextReciboNumero(tx);

      // Mark charges as paid
      await tx
        .update(tenantCharge)
        .set({ estado: "pagado", reciboNumero, paidAt: new Date(), updatedAt: new Date() })
        .where(inArray(tenantCharge.id, chargeIds));

      // Insert agency income movement (real cash received)
      const [movAgencia] = await tx
        .insert(cajaMovimiento)
        .values({
          tipo: "income",
          description: `Recibo ${reciboNumero} — ${nombreInquilino}`,
          amount: String(totalRecibo),
          date: fecha,
          categoria: "alquiler",
          reciboNumero,
          inquilinoId,
          propietarioId,
          contratoId,
          propiedadId,
          source: "manual",
          createdBy: session.user.id,
        })
        .returning();

      if (trasladarAlPropietario) {
        // Insert owner pending income (to be settled later)
        await tx.insert(cajaMovimiento).values({
          tipo: "income",
          description: `Ingreso inquilino — ${reciboNumero}`,
          amount: String(totalRecibo),
          date: fecha,
          categoria: "ingreso_inquilino",
          reciboNumero,
          propietarioId,
          contratoId,
          propiedadId,
          source: "manual",
          createdBy: session.user.id,
        });

        // Insert owner pending expense (agency commission)
        if (montoHonorarios > 0) {
          await tx.insert(cajaMovimiento).values({
            tipo: "expense",
            description: `Honorarios administración — ${reciboNumero}`,
            amount: String(montoHonorarios),
            date: fecha,
            categoria: "honorarios_administracion",
            reciboNumero,
            propietarioId,
            contratoId,
            propiedadId,
            source: "manual",
            createdBy: session.user.id,
          });
        }
      }

      return { reciboNumero, movimientoAgenciaId: movAgencia.id, totalRecibo, montoHonorarios };
    });

    return NextResponse.json(result2, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/receipts/emit:", error);
    return NextResponse.json({ error: "Error al emitir el recibo" }, { status: 500 });
  }
}
