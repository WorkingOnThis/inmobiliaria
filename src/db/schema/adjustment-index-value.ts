import { pgTable, text, decimal, timestamp, unique } from "drizzle-orm/pg-core";
import { agency } from "./agency";
import { user } from "./better-auth";

/**
 * Adjustment Index Value
 *
 * Stores historical values for standard adjustment indices (ICL, IPC, CER, UVA).
 * One row per agency + index type + period.
 * Loaded from BCRA API or manually entered by user.
 */
export const adjustmentIndexValue = pgTable(
  "adjustment_index_value",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agencyId: text("agencyId")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    indexType: text("indexType").notNull(), // "ICL" | "IPC" | "CER" | "UVA"
    period: text("period").notNull(), // "YYYY-MM"
    value: decimal("value", { precision: 8, scale: 4 }).notNull(), // e.g. 2.0000 = 2%
    loadedAt: timestamp("loadedAt").notNull().defaultNow(),
    loadedBy: text("loadedBy")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (t) => [unique().on(t.agencyId, t.indexType, t.period)]
);

export type AdjustmentIndexValue = typeof adjustmentIndexValue.$inferSelect;
export type NewAdjustmentIndexValue = typeof adjustmentIndexValue.$inferInsert;
