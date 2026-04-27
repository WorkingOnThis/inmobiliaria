import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { eq, and, inArray, ne } from "drizzle-orm";

/**
 * POST /api/receipts/[reciboNumero]/void
 *
 * Atomically voids a receipt:
 * 1. Reverts each affected tenant_ledger entry (montoPagado, estado, reciboNumero)
 * 2. Deletes all caja_movimiento rows with this reciboNumero
 * 3. Deletes all receipt_allocation rows for this reciboNumero
 *
 * Returns 422 if a subsequent receipt already touched any of the same ledger entries
 * (user must void newer receipts first).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ reciboNumero: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageClients(session.user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { reciboNumero } = await params;

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load all allocations for this receipt
      const allocations = await tx
        .select()
        .from(receiptAllocation)
        .where(eq(receiptAllocation.reciboNumero, reciboNumero));

      if (allocations.length === 0) {
        return { notFound: true };
      }

      const ledgerEntryIds = allocations.map((a) => a.ledgerEntryId);

      // 2. Load the corresponding ledger entries
      const entries = await tx
        .select()
        .from(tenantLedger)
        .where(inArray(tenantLedger.id, ledgerEntryIds));

      // 3. Validate: no entry may have a newer receipt (i.e. reciboNumero !== R)
      //    If it does, the user must void that newer receipt first.
      const blockedEntries = entries.filter(
        (e) => e.reciboNumero !== null && e.reciboNumero !== reciboNumero
      );
      if (blockedEntries.length > 0) {
        const blockedRecibos = [...new Set(blockedEntries.map((e) => e.reciboNumero))].join(", ");
        return {
          blocked: true,
          message: `Anulá primero los recibos posteriores que tocaron estos ítems: ${blockedRecibos}`,
        };
      }

      // 4. For each allocation, revert the ledger entry
      for (const allocation of allocations) {
        const entry = entries.find((e) => e.id === allocation.ledgerEntryId);
        if (!entry) continue;

        const prevMontoPagado = Number(entry.montoPagado ?? 0);
        const allocationMonto = Number(allocation.monto);
        const newMontoPagado = Math.max(0, Math.round((prevMontoPagado - allocationMonto) * 100) / 100);

        // Find the previous allocation for this entry (if any) to restore prior receipt info
        const prevAllocations = await tx
          .select()
          .from(receiptAllocation)
          .where(
            and(
              eq(receiptAllocation.ledgerEntryId, allocation.ledgerEntryId),
              ne(receiptAllocation.reciboNumero, reciboNumero)
            )
          );
        // Sort descending by createdAt to find the most recent prior allocation
        prevAllocations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const prevAlloc = prevAllocations[0] ?? null;

        await tx
          .update(tenantLedger)
          .set({
            montoPagado: newMontoPagado === 0 ? null : String(newMontoPagado),
            estado: newMontoPagado === 0 ? "pendiente" : "pago_parcial",
            reciboNumero: prevAlloc?.reciboNumero ?? null,
            reciboEmitidoAt: prevAlloc?.createdAt ?? null,
            ultimoPagoAt: prevAlloc ? prevAlloc.createdAt.toISOString().slice(0, 10) : null,
            conciliadoAt: null,
            conciliadoPor: null,
            updatedAt: new Date(),
          })
          .where(eq(tenantLedger.id, entry.id));
      }

      // 5. Delete caja_movimiento rows linked to this receipt
      const deletedMovimientos = await tx
        .delete(cajaMovimiento)
        .where(eq(cajaMovimiento.reciboNumero, reciboNumero))
        .returning({ id: cajaMovimiento.id });

      // 6. Delete all allocations for this receipt
      await tx
        .delete(receiptAllocation)
        .where(eq(receiptAllocation.reciboNumero, reciboNumero));

      return {
        ok: true,
        itemsRevertidos: allocations.length,
        movimientosCajaBorrados: deletedMovimientos.length,
      };
    });

    if ("notFound" in result && result.notFound) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
    }
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({ error: result.message }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error POST /api/receipts/${reciboNumero}/void:`, error);
    return NextResponse.json({ error: "Error al anular el recibo" }, { status: 500 });
  }
}
