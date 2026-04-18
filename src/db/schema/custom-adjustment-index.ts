import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Custom Adjustment Index
 *
 * Permite a la agencia agregar índices de ajuste propios
 * además de los estándar (ICL, IPC, CER, UVA, manual, sin_ajuste).
 * El campo "code" es lo que se guarda en contract.adjustmentIndex.
 */
export const customAdjustmentIndex = pgTable("customAdjustmentIndex", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // valor que se guarda en contract.adjustmentIndex
  label: text("label").notNull(), // nombre que ve el usuario
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
