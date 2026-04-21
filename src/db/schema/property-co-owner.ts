import { pgTable, text, timestamp, decimal, unique } from "drizzle-orm/pg-core";
import { client } from "./client";
import { property } from "./property";

export const propertyCoOwner = pgTable(
  "property_co_owner",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("propertyId")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    clientId: text("clientId")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    vinculo: text("vinculo"),
    sharePercent: decimal("sharePercent", { precision: 5, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [unique().on(t.propertyId, t.clientId)]
);
