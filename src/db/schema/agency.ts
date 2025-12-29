import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Agency Schema
 * 
 * Represents a real estate agency in the system.
 * Each agency has exactly one owner (User) - one-to-one relationship.
 */
export const agency = pgTable("agency", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("ownerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(), // One-to-one relationship: each agency has one owner, each user can own one agency
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});










