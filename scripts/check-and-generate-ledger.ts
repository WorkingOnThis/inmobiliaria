import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { buildLedgerEntries } from "../src/lib/ledger/generate-contract-ledger";
import { tenantLedger } from "../src/db/schema/tenant-ledger";

const tenants = await db.execute(
  sql`SELECT role, "contractId", "clientId" FROM contract_tenant LIMIT 20`
);
console.log("contract_tenant rows:", tenants.rows.length);
tenants.rows.forEach((r: any) => console.log(" ", r));

const ledgerCount = await db.execute(sql`SELECT COUNT(*) as n FROM tenant_ledger`);
console.log("tenant_ledger rows:", (ledgerCount.rows[0] as any).n);

const contracts = await db.execute(
  sql`SELECT c.id, c."agencyId", c."propertyId", c."ownerId", c."startDate", c."endDate",
       c."monthlyAmount", c."paymentDay", c."adjustmentIndex", c."adjustmentFrequency",
       c."ledgerStartDate"
      FROM contract c LIMIT 10`
);
console.log("contracts:", contracts.rows.length);
contracts.rows.forEach((r: any) => console.log(" ", r.id, r.startDate, r.endDate, r.monthlyAmount));

// Try to generate for each contract
for (const contract of contracts.rows as any[]) {
  const existing = await db.execute(
    sql`SELECT id FROM tenant_ledger WHERE "contratoId" = ${contract.id} LIMIT 1`
  );
  if (existing.rows.length > 0) {
    console.log("SKIP (has entries):", contract.id);
    continue;
  }

  // Find primary tenant
  const tenantRow = tenants.rows.find(
    (t: any) => t.contractId === contract.id && t.role === "primary"
  );
  if (!tenantRow) {
    console.log("NO PRIMARY TENANT for:", contract.id, "- trying any tenant");
    const anyTenant = tenants.rows.find((t: any) => t.contractId === contract.id);
    if (!anyTenant) { console.log("NO TENANT AT ALL for:", contract.id); continue; }
  }

  const tenantId = (tenantRow as any)?.clientId ?? (tenants.rows.find((t: any) => t.contractId === contract.id) as any)?.clientId;
  if (!tenantId) { console.log("SKIP (no tenant):", contract.id); continue; }

  const entries = buildLedgerEntries(
    {
      id: contract.id,
      propertyId: contract.propertyId,
      ownerId: contract.ownerId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      ledgerStartDate: contract.ledgerStartDate ?? null,
      monthlyAmount: String(contract.monthlyAmount),
      paymentDay: contract.paymentDay ?? 10,
      adjustmentIndex: contract.adjustmentIndex ?? "ICL",
      adjustmentFrequency: contract.adjustmentFrequency ?? 12,
    },
    tenantId,
    [],
    contract.agencyId
  );

  console.log("Contract", contract.id, "→", entries.length, "entries");

  if (entries.length > 0) {
    await db.insert(tenantLedger).values(entries);
    console.log("INSERTED", entries.length, "entries for contract", contract.id);
  }
}

process.exit(0);
