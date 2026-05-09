import { pgTable, text, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { agency } from "./agency";
import { contract } from "./contract";
import { user } from "./better-auth";

/**
 * Adjustment Application
 *
 * Records each time an adjustment is applied to a contract's rent amount.
 * Stores the calculation details (periods used, factor, new amount) for auditability.
 * Periodic table: one row per adjustment event per contract.
 */
export const adjustmentApplication = pgTable("adjustment_application", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  contratoId: text("contratoId")
    .notNull()
    .references(() => contract.id, { onDelete: "restrict" }),
  // "YYYY-MM" — month from which the new value takes effect
  adjustmentPeriod: text("adjustmentPeriod").notNull(),
  previousAmount: decimal("previousAmount", { precision: 15, scale: 2 }).notNull(),
  newAmount: decimal("newAmount", { precision: 15, scale: 2 }).notNull(),
  // Compound product of factors, e.g. 1.07212000
  factor: decimal("factor", { precision: 12, scale: 8 }).notNull(),
  // JSON: ["2026-01","2026-02","2026-03"]
  periodsUsed: text("periodsUsed").notNull(),
  // JSON: [2.0, 3.0, 2.0] — corresponding values
  valuesUsed: text("valuesUsed").notNull(),
  // true if previous value was used due to missing index data
  isProvisional: boolean("isProvisional").notNull().default(false),
  appliedAt: timestamp("appliedAt").notNull().defaultNow(),
  appliedBy: text("appliedBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
});

export type AdjustmentApplication = typeof adjustmentApplication.$inferSelect;
export type NewAdjustmentApplication = typeof adjustmentApplication.$inferInsert;
