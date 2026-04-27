/**
 * Backfill receipt_allocation rows for existing tenant_ledger entries.
 *
 * For each tenant_ledger row that has a reciboNumero and montoPagado > 0,
 * inserts one receipt_allocation row attributing the full montoPagado to that receipt.
 *
 * Limitation: if a ledger entry was partially paid by multiple receipts before this
 * backfill, the entire montoPagado is attributed to the most recent reciboNumero.
 * Voiding older receipts for those entries will not work correctly — this is documented
 * and accepted for legacy data.
 *
 * Idempotent: skips entries that already have an allocation for that (reciboNumero, ledgerEntryId).
 *
 * Usage:
 *   bun scripts/backfill-receipt-allocations.ts
 *   bun scripts/backfill-receipt-allocations.ts --dry-run
 */

import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { isNotNull, and, gt, sql } from "drizzle-orm";

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(isDryRun ? "[DRY RUN] Backfill receipt allocations" : "Backfill receipt allocations");

  // Find ledger entries that have a receipt number and have been (at least partially) paid
  const entries = await db
    .select({
      id: tenantLedger.id,
      reciboNumero: tenantLedger.reciboNumero,
      montoPagado: tenantLedger.montoPagado,
      reciboEmitidoAt: tenantLedger.reciboEmitidoAt,
    })
    .from(tenantLedger)
    .where(
      and(
        isNotNull(tenantLedger.reciboNumero),
        isNotNull(tenantLedger.montoPagado),
        gt(sql`CAST(${tenantLedger.montoPagado} AS numeric)`, sql`0`)
      )
    );

  console.log(`Found ${entries.length} ledger entries with a receipt number and montoPagado > 0`);

  // Find which (reciboNumero, ledgerEntryId) pairs already have an allocation
  const existing = await db
    .select({
      reciboNumero: receiptAllocation.reciboNumero,
      ledgerEntryId: receiptAllocation.ledgerEntryId,
    })
    .from(receiptAllocation);

  const existingSet = new Set(existing.map((r) => `${r.reciboNumero}__${r.ledgerEntryId}`));
  console.log(`Found ${existingSet.size} existing allocations (will skip duplicates)`);

  const toInsert = entries.filter(
    (e) => !existingSet.has(`${e.reciboNumero!}__${e.id}`)
  );

  console.log(`Will insert ${toInsert.length} new allocation rows`);

  if (isDryRun) {
    for (const e of toInsert.slice(0, 10)) {
      console.log(`  [dry] reciboNumero=${e.reciboNumero} ledgerEntryId=${e.id} monto=${e.montoPagado}`);
    }
    if (toInsert.length > 10) console.log(`  ... and ${toInsert.length - 10} more`);
    console.log("Dry run complete — no changes made.");
    return;
  }

  if (toInsert.length === 0) {
    console.log("Nothing to insert.");
    return;
  }

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await db.insert(receiptAllocation).values(
      batch.map((e) => ({
        reciboNumero: e.reciboNumero!,
        ledgerEntryId: e.id,
        monto: e.montoPagado!,
        createdAt: e.reciboEmitidoAt ?? new Date(),
      }))
    );
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${toInsert.length}`);
  }

  console.log(`Done. Inserted ${inserted} allocation rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
