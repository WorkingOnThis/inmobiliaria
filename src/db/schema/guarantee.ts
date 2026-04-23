import { pgTable, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { client } from "./client";
import { contract } from "./contract";
import { property } from "./property";

// kind: "propertyOwner" | "deposit" | "salaryReceipt"  (see src/lib/guarantees/constants.ts)
// status: "active" | "replaced" | "released"
//
// Field usage by kind:
//   propertyOwner  → propertyId required
//   salaryReceipt  → personClientId required (client with type="guarantor"); salary info in guarantee_salary_info
//   deposit        → depositAmount, depositCurrency, depositHeldBy, depositNotes
export const guarantee = pgTable("guarantee", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tenantClientId: text("tenantClientId")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  contractId: text("contractId")
    .notNull()
    .references(() => contract.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("active"),
  replacedByGuaranteeId: text("replacedByGuaranteeId"),

  // kind = "propertyOwner"
  propertyId: text("propertyId").references(() => property.id),

  // kind = "salaryReceipt"
  personClientId: text("personClientId").references(() => client.id),

  // kind = "deposit"
  depositAmount: decimal("depositAmount", { precision: 15, scale: 2 }),
  depositCurrency: text("depositCurrency"),
  depositHeldBy: text("depositHeldBy"),
  depositNotes: text("depositNotes"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
