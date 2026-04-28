import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { contract } from "./contract";
import { documentTemplateClause } from "./document-template";

export const contractClause = pgTable("contract_clause", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contractId: text("contractId")
    .notNull()
    .references(() => contract.id, { onDelete: "cascade" }),
  documentType: text("documentType").notNull().default("contract"),
  sourceClauseId: text("sourceClauseId").references(
    () => documentTemplateClause.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  isActive: boolean("isActive").notNull().default(true),
  order: integer("order").notNull(),
  fieldOverrides: jsonb("fieldOverrides")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ContractClause = typeof contractClause.$inferSelect;
export type ContractClauseInsert = typeof contractClause.$inferInsert;
