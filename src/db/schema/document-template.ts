import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agency } from "./agency";

export const documentTemplate = pgTable("documentTemplate", {
  id: text("id").primaryKey(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
