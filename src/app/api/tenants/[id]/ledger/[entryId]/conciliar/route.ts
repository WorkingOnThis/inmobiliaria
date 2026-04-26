import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const conciliarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = conciliarSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [entry] = await db
      .select()
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!entry) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (entry.estado === "conciliado") {
      return NextResponse.json({ error: "El ítem ya está conciliado" }, { status: 422 });
    }
    if (entry.monto === null) {
      return NextResponse.json({ error: "No se puede conciliar un ítem sin monto definido" }, { status: 422 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      let cajaId: string | undefined;

      if (entry.impactaCaja) {
        const [mov] = await tx
          .insert(cajaMovimiento)
          .values({
            tipo: "income",
            description: entry.descripcion,
            amount: entry.monto!,
            date: result.data.fecha,
            categoria: entry.tipo,
            contratoId: entry.contratoId,
            propietarioId: entry.propietarioId,
            inquilinoId: entry.inquilinoId,
            propiedadId: entry.propiedadId,
            period: entry.period ?? undefined,
            tipoFondo: "propietario",
            ledgerEntryId: entry.id,
            source: "contract",
            createdBy: session.user.id,
          })
          .returning();
        cajaId = mov.id;
      }

      await tx
        .update(tenantLedger)
        .set({
          estado: "conciliado",
          conciliadoAt: now,
          conciliadoPor: session.user.id,
          ...(cajaId && { cajaMovimientoId: cajaId }),
          updatedAt: now,
        })
        .where(eq(tenantLedger.id, entryId));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error POST conciliar:", error);
    return NextResponse.json({ error: "Error al conciliar el ítem" }, { status: 500 });
  }
}
