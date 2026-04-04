import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Client Schema
 * 
 * Represents a client in the real estate system.
 * Can be linked to a User (1:1 relationship) but can also be just a contact.
 */
export const client = pgTable("client", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .unique() // Enforces 1:1 relationship if present
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("firstName").notNull(), // Usado para el nombre completo si es solo uno
  lastName: text("lastName"), // Opcional
  phone: text("phone"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  dni: text("dni"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
