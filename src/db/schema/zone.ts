import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agency } from "./agency";

export const zone = pgTable("zone", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
