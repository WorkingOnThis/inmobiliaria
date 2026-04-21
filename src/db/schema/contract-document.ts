import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { contract } from "./contract";

export const contractDocument = pgTable("contract_document", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contractId: text("contractId")
    .notNull()
    .references(() => contract.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  uploadedBy: text("uploadedBy").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow(),
});
