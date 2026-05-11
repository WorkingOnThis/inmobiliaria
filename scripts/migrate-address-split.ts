// scripts/migrate-address-split.ts
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating property address → addressStreet...");
  const result = await db.execute(sql`
    UPDATE property
    SET "addressStreet" = address
    WHERE "addressStreet" IS NULL OR "addressStreet" = ''
  `);
  console.log("Migration complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
