import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { contract } from "./contract";
import { client } from "./client";

/**
 * ContractTenant — Tabla intermedia (many-to-many)
 *
 * Un contrato puede tener múltiples inquilinos (cotitulares).
 * Un inquilino puede estar en múltiples contratos.
 *
 * role: "primary" | "co-tenant"
 *   - primary: el inquilino firmante principal
 *   - co-tenant: inquilino adicional en el contrato
 */
export const contractTenant = pgTable(
  "contract_tenant",
  {
    contractId: text("contractId")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    clientId: text("clientId")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    role: text("role").notNull().default("primary"),
  },
  (table) => [primaryKey({ columns: [table.contractId, table.clientId] })]
);

export type ContractTenant = typeof contractTenant.$inferSelect;
