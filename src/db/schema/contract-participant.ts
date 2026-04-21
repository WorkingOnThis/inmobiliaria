import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { client } from "./client";
import { contract } from "./contract";

// role: "owner" | "tenant" | "guarantor"
export const contractParticipant = pgTable(
  "contract_participant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contractId: text("contractId")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    clientId: text("clientId")
      .notNull()
      .references(() => client.id),
    role: text("role").notNull(),
    createdAt: timestamp("createdAt").defaultNow(),
  },
  (t) => [unique().on(t.contractId, t.clientId, t.role)]
);
