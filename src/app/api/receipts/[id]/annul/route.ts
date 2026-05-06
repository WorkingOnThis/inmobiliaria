import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { receiptAnnulment } from "@/db/schema/receipt-annulment";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canAnnulReceipts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, eq, sum } from "drizzle-orm";

const annulSchema = z.object({
  motivo: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canAnnulReceipts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: reciboNumero } = await params;

    const body = await request.json();
    const parsed = annulSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { motivo } = parsed.data;

    const result = await db.transaction(async (tx) => {
      // 1. Buscar todos los movimientos de este recibo (scoped por agency)
      const movimientos = await tx
        .select()
        .from(cajaMovimiento)
        .where(
          and(
            eq(cajaMovimiento.reciboNumero, reciboNumero),
            eq(cajaMovimiento.agencyId, agencyId)
          )
        );

      if (movimientos.length === 0) {
        return { error: "No se encontró el recibo", status: 404 } as const;
      }

      // 2. Verificar que no estén ya todos anulados
      const allAnnulled = movimientos.every((m) => m.anuladoAt !== null);
      if (allAnnulled) {
        return { error: "Este recibo ya fue anulado", status: 422 } as const;
      }

      // 3. Detectar si alguno fue liquidado
      const teniaPagosLiquidados = movimientos.some((m) => m.settledAt !== null);

      // 4. Crear registro de anulación
      const now = new Date();
      const [annulment] = await tx
        .insert(receiptAnnulment)
        .values({
          reciboNumero,
          motivo: motivo ?? null,
          teniaPagosLiquidados,
          anuladoPor: session!.user.id,
          anuladoAt: now,
        })
        .returning();

      // 5. Marcar todos los movimientos como anulados (scoped por agency)
      await tx
        .update(cajaMovimiento)
        .set({
          anuladoAt: now,
          anuladoPor: session!.user.id,
          annulmentId: annulment.id,
        })
        .where(
          and(
            eq(cajaMovimiento.reciboNumero, reciboNumero),
            eq(cajaMovimiento.agencyId, agencyId)
          )
        );

      // 6. Obtener ledger entries afectadas antes de borrar allocations
      const allocations = await tx
        .select({ ledgerEntryId: receiptAllocation.ledgerEntryId })
        .from(receiptAllocation)
        .where(eq(receiptAllocation.reciboNumero, reciboNumero));

      const ledgerEntryIds = [...new Set(allocations.map((a) => a.ledgerEntryId))];

      // 7. Eliminar las allocations de este recibo
      await tx
        .delete(receiptAllocation)
        .where(eq(receiptAllocation.reciboNumero, reciboNumero));

      // 8. Recalcular montoPagado y estado por cada ledger entry afectada
      for (const entryId of ledgerEntryIds) {
        const [entry] = await tx
          .select({ monto: tenantLedger.monto })
          .from(tenantLedger)
          .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.agencyId, agencyId)));

        if (!entry || entry.monto === null) continue;

        const [sumaRow] = await tx
          .select({ total: sum(receiptAllocation.monto) })
          .from(receiptAllocation)
          .where(eq(receiptAllocation.ledgerEntryId, entryId));

        const montoPagado = Number(sumaRow?.total ?? 0);
        const montoTotal = Number(entry.monto);

        let estado: string;
        if (montoPagado <= 0) {
          estado = "pendiente";
        } else if (montoPagado < montoTotal) {
          estado = "pago_parcial";
        } else {
          estado = "conciliado";
        }

        await tx
          .update(tenantLedger)
          .set({
            montoPagado: String(montoPagado),
            estado,
            ...(estado !== "conciliado"
              ? { conciliadoAt: null, conciliadoPor: null, reciboNumero: null, reciboEmitidoAt: null }
              : {}),
            updatedAt: now,
          })
          .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.agencyId, agencyId)));
      }

      return { annulmentId: annulment.id, teniaPagosLiquidados };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST /api/receipts/[id]/annul:", error);
    return NextResponse.json({ error: "Error al anular el recibo" }, { status: 500 });
  }
}
