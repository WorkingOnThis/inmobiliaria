import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { nextReciboNumero } from "@/lib/receipts/numbering";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";

const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
  montoOverrides: z.record(z.string(), z.string()).default({}),
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getEffectiveAmount(
  entryId: string,
  originalMonto: string,
  overrides: Record<string, string>
): number {
  const override = overrides[entryId];
  return override !== undefined ? Number(override) : Number(originalMonto);
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
    const parsed = emitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { ledgerEntryIds, fecha, honorariosPct, trasladarAlPropietario, montoOverrides } = parsed.data;

    const entries = await db
      .select()
      .from(tenantLedger)
      .where(inArray(tenantLedger.id, ledgerEntryIds));

    if (entries.length !== ledgerEntryIds.length) {
      return NextResponse.json({ error: "Uno o más ítems no fueron encontrados" }, { status: 404 });
    }

    const notReady = entries.filter(
      (e) => !["pendiente", "registrado", "pago_parcial"].includes(e.estado)
    );
    if (notReady.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes ítems no están listos: ${notReady.map((e) => e.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    const nullMonto = entries.filter((e) => e.monto === null);
    if (nullMonto.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes ítems no tienen monto definido: ${nullMonto.map((e) => e.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    // Validate that all overrides are positive amounts
    const invalidOverrides = entries.filter((e) => {
      const override = montoOverrides[e.id];
      if (override === undefined) return false;
      const num = Number(override);
      return isNaN(num) || num <= 0;
    });
    if (invalidOverrides.length > 0) {
      return NextResponse.json(
        { error: `Montos inválidos en los ítems: ${invalidOverrides.map((e) => e.descripcion).join(", ")}` },
        { status: 400 }
      );
    }

    const contratoIds = new Set(entries.map((e) => e.contratoId));
    if (contratoIds.size > 1) {
      return NextResponse.json(
        { error: "Todos los ítems deben pertenecer al mismo contrato" },
        { status: 422 }
      );
    }

    const first = entries[0];
    const contratoId = first.contratoId;
    const inquilinoId = first.inquilinoId;
    const propietarioId = first.propietarioId;
    const propiedadId = first.propiedadId;

    const [inquilinoRow] = await db
      .select({ firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(eq(client.id, inquilinoId))
      .limit(1);

    const nombreInquilino = inquilinoRow
      ? [inquilinoRow.firstName, inquilinoRow.lastName].filter(Boolean).join(" ")
      : "Inquilino";

    // Commission base = sum of entries where incluirEnBaseComision=true
    const totalRecibo = round2(
      entries.reduce((s, e) => s + getEffectiveAmount(e.id, e.monto!, montoOverrides), 0)
    );
    const baseComision = entries
      .filter((e) => e.incluirEnBaseComision)
      .reduce((s, e) => s + getEffectiveAmount(e.id, e.monto!, montoOverrides), 0);
    const montoHonorarios = round2(baseComision * honorariosPct / 100);

    const txResult = await db.transaction(async (tx) => {
      const now = new Date();
      const reciboNumero = await nextReciboNumero(tx);

      for (const entry of entries) {
        const effectiveAmount = getEffectiveAmount(entry.id, entry.monto!, montoOverrides);
        const prevPagado = Number(entry.montoPagado ?? 0);
        const newMontoPagado = round2(prevPagado + effectiveAmount);
        const isFullyPaid = newMontoPagado >= Number(entry.monto);

        await tx
          .update(tenantLedger)
          .set({
            estado: isFullyPaid ? "conciliado" : "pago_parcial",
            montoPagado: String(newMontoPagado),
            ultimoPagoAt: fecha,
            reciboNumero,
            reciboEmitidoAt: now,
            ...(isFullyPaid
              ? { conciliadoAt: now, conciliadoPor: session.user.id }
              : {}),
            updatedAt: now,
          })
          .where(eq(tenantLedger.id, entry.id));

        await tx.insert(receiptAllocation).values({
          reciboNumero,
          ledgerEntryId: entry.id,
          monto: String(effectiveAmount),
        });
      }

      // Agency income movement (total collected from tenant)
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
          tipoFondo: "agencia",
          source: "contract",
          createdBy: session.user.id,
        })
        .returning();

      if (trasladarAlPropietario) {
        // Owner in-transit income (to be settled later)
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
          tipoFondo: "propietario",
          source: "contract",
          createdBy: session.user.id,
        });

        // Agency commission expense
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
            tipoFondo: "agencia",
            source: "contract",
            createdBy: session.user.id,
          });
        }
      }

      return { reciboNumero, movimientoAgenciaId: movAgencia.id, totalRecibo, montoHonorarios };
    });

    return NextResponse.json(txResult, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/receipts/emit:", error);
    return NextResponse.json({ error: "Error al emitir el recibo" }, { status: 500 });
  }
}
