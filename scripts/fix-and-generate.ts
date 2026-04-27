import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { buildLedgerEntries } from "../src/lib/ledger/generate-contract-ledger";
import { tenantLedger } from "../src/db/schema/tenant-ledger";
import { contractTenant } from "../src/db/schema/contract-tenant";

// Data we know from tenant_charge
const CONTRACT_ID = "18e4d423-3426-4e82-a9b1-75186bd4ea4a";
const INQUILINO_ID = "3f0a0978-f93f-40f4-a2b4-a55ae52ef9b8";
const PROPIETARIO_ID = "eff7ff6b-c13b-4929-8caf-35ee1f3c31cc";

// 1. Check if contract_tenant already has this relationship
const existing = await db.execute(
  sql`SELECT * FROM contract_tenant WHERE "contractId" = ${CONTRACT_ID} AND "clientId" = ${INQUILINO_ID}`
);

if (existing.rows.length === 0) {
  console.log("Inserting missing contract_tenant relationship...");
  await db.insert(contractTenant).values({
    contractId: CONTRACT_ID,
    clientId: INQUILINO_ID,
    role: "primary",
  });
  console.log("Done.");
} else {
  console.log("contract_tenant already has this relationship.");
}

// 2. Get contract details
const contractRow = await db.execute(
  sql`SELECT id, "propertyId", "ownerId", "startDate", "endDate", "monthlyAmount", "paymentDay", "adjustmentIndex", "adjustmentFrequency"
      FROM contract WHERE id = ${CONTRACT_ID}`
);

if (contractRow.rows.length === 0) {
  console.error("Contract not found!");
  process.exit(1);
}

const c = contractRow.rows[0] as any;
console.log("Contract:", c.id, c.startDate, "→", c.endDate, "$" + c.monthlyAmount);

// 3. Check if ledger already has entries for this contract
const ledgerExisting = await db.execute(
  sql`SELECT COUNT(*) as n FROM tenant_ledger WHERE "contratoId" = ${CONTRACT_ID}`
);
const count = Number((ledgerExisting.rows[0] as any).n);

if (count > 0) {
  console.log(`Already has ${count} ledger entries. Skipping generation.`);
  process.exit(0);
}

// 4. Get property services
const services = await db.execute(
  sql`SELECT id, tipo, company, "tipoGestion", "propietarioResponsable" FROM service WHERE "propertyId" = ${c.propertyId}`
);

console.log("Property services:", services.rows.length);

// 5. Generate ledger entries
const entries = buildLedgerEntries(
  {
    id: c.id,
    propertyId: c.propertyId,
    ownerId: c.ownerId,
    startDate: c.startDate,
    endDate: c.endDate,
    monthlyAmount: String(c.monthlyAmount),
    paymentDay: c.paymentDay ?? 10,
    adjustmentIndex: c.adjustmentIndex ?? "ICL",
    adjustmentFrequency: c.adjustmentFrequency ?? 12,
  },
  INQUILINO_ID,
  services.rows as any[],
);

console.log("Generated", entries.length, "ledger entries");

if (entries.length === 0) {
  console.log("Nothing to insert.");
  process.exit(0);
}

// 6. Insert in batches
const BATCH = 100;
let inserted = 0;
for (let i = 0; i < entries.length; i += BATCH) {
  await db.insert(tenantLedger).values(entries.slice(i, i + BATCH));
  inserted += entries.slice(i, i + BATCH).length;
}

console.log(`Inserted ${inserted} entries into tenant_ledger`);
process.exit(0);
