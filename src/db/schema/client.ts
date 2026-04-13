import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Client Schema
 *
 * Represents a client in the real estate system.
 * Can be linked to a User (1:1 relationship) but can also be just a contact.
 *
 * type: "propietario" | "inquilino" | "garante" | "contacto"
 */
export const client = pgTable("client", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .unique() // Enforces 1:1 relationship if present
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("contacto"),
  firstName: text("firstName").notNull(),
  lastName: text("lastName"),
  phone: text("phone"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  dni: text("dni"),
  address: text("address"),
  profession: text("profession"),
  birthDate: text("birthDate"), // ISO string "YYYY-MM-DD"
  // Datos bancarios (propietarios)
  cbu: text("cbu"),
  alias: text("alias"),
  banco: text("banco"),
  tipoCuenta: text("tipoCuenta"), // "caja_ahorro" | "cuenta_corriente"
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
