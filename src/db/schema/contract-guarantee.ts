import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { client } from "./client";
import { contract } from "./contract";
import { property } from "./property";

// type: "personal" | "real"
// personal: clientId required
// real: propertyId (internal) OR external* fields
export const contractGuarantee = pgTable("contract_guarantee", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contractId: text("contractId")
    .notNull()
    .references(() => contract.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  clientId: text("clientId").references(() => client.id),
  propertyId: text("propertyId").references(() => property.id),
  externalAddress: text("externalAddress"),
  externalCadastralRef: text("externalCadastralRef"),
  externalOwnerName: text("externalOwnerName"),
  externalOwnerDni: text("externalOwnerDni"),
  createdAt: timestamp("createdAt").defaultNow(),
});
