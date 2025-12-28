import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Client Schema
 * 
 * Represents a client in the real estate system.
 * Clients can be of various types: seller, buyer, landlord, owner, tenant, or interested.
 */
export const client = pgTable("client", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  apellido: text("apellido").notNull(),
  tipo: text("tipo").notNull(), // vendedor, comprador, locador, dueño, inquilino, interesado
  telefono: text("telefono"),
  dni: text("dni"),
  email: text("email"),
  dueño_de: text("dueño_de"),
  alquila: text("alquila"),
  creado_por: text("creado_por")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

