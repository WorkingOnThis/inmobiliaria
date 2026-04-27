import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Client Schema
 *
 * Represents a client in the real estate system.
 * Can be linked to a User (1:1 relationship) but can also be just a contact.
 *
 * type: "owner" | "tenant" | "guarantor" | "contact"
 */
export const client = pgTable("client", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .unique() // Enforces 1:1 relationship if present
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("contact"),
  firstName: text("firstName").notNull(),
  lastName: text("lastName"),
  phone: text("phone"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  dni: text("dni"),
  address: text("address"),
  profession: text("profession"),
  birthDate: text("birthDate"), // ISO string "YYYY-MM-DD"
  cuit: text("cuit"), // CUIT/CUIL (owners and tenants)
  status: text("status").notNull().default("active"), // "active" | "suspended" | "inactive"
  // Datos bancarios (owners)
  cbu: text("cbu"),
  alias: text("alias"),
  bank: text("bank"),
  accountType: text("accountType"), // "savings" | "checking"
  condicionFiscal: text("condicionFiscal"), // "responsable_inscripto" | "monotributista" | "exento" | "consumidor_final"
  // Datos de interés
  nationality: text("nationality"),
  occupation: text("occupation"),
  internalNotes: text("internalNotes"),
  // Domicilio desglosado (complementa address que queda como legado)
  addressStreet: text("addressStreet"),
  addressNumber: text("addressNumber"),
  addressZone: text("addressZone"),   // barrio
  addressCity: text("addressCity"),
  addressProvince: text("addressProvince"),

  // Emails para envío de recibos
  emailDefault: boolean("emailDefault").notNull().default(true),
  trustedEmails: text("trustedEmails"), // JSON: [{ email, label?, sendDefault }]

  // Persona de confianza
  confianzaNombre: text("confianzaNombre"),
  confianzaApellido: text("confianzaApellido"),
  confianzaDni: text("confianzaDni"),
  confianzaEmail: text("confianzaEmail"),
  confianzaTelefono: text("confianzaTelefono"),
  confianzaVinculo: text("confianzaVinculo"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
