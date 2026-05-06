import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { property } from "./property";
import { agency } from "./agency";

export const propertyRoom = pgTable("property_room", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  propertyId: text("propertyId")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  floor: integer("floor").notNull().default(1),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
