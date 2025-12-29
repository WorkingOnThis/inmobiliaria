import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Client Schema
 * 
 * Represents a client in the real estate system.
 * Acts as a detail table for the User entity (1:1 relationship).
 */
export const client = pgTable("client", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .unique() // Enforces 1:1 relationship
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  phone: text("phone"),
  dni: text("dni"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
