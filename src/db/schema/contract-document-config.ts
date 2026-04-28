import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { contract } from "./contract";
import { documentTemplate } from "./document-template";

export const contractDocumentConfig = pgTable(
  "contract_document_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contractId: text("contractId")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    documentType: text("documentType").notNull(),
    appliedTemplateId: text("appliedTemplateId").references(
      () => documentTemplate.id,
      { onDelete: "set null" }
    ),
    appliedAt: timestamp("appliedAt").notNull().defaultNow(),
  },
  (t) => [unique("uq_contract_doctype").on(t.contractId, t.documentType)]
);

export type ContractDocumentConfig = typeof contractDocumentConfig.$inferSelect;
