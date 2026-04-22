import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agency } from "./agency";

export const propertyFeature = pgTable("property_feature", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
