import { pgTable, text, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { property } from "./property";
import { agency } from "./agency";

export const servicio = pgTable("service", {
  id: text("id").primaryKey(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  propertyId: text("propertyId")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(), // "electricity" | "gas" | "water" | "hoa" | "abl" | "property_tax" | "insurance" | "other"
  company: text("company"),
  accountNumber: text("accountNumber"),
  metadata: jsonb("metadata").$type<Record<string, string>>(),
  holder: text("holder"),
  holderType: text("holderType").notNull().default("propietario"), // "propietario" | "inquilino" | "otro"
  paymentResponsible: text("paymentResponsible").notNull().default("propietario"), // "propietario" | "inquilino"
  dueDay: integer("dueDay"),
  triggersBlock: boolean("triggersBlock").notNull().default(true),
  // Whether the owner is responsible for this service (so it appears in tenant_ledger charges)
  propietarioResponsable: boolean("propietarioResponsable").notNull().default(false),
  // How the agency manages this service
  tipoGestion: text("tipoGestion").notNull().default("comprobante"),
  // "comprobante"                — staff uploads receipt; if missing and triggersBlock=true, blocks rent collection
  // "pago_agencia"               — agency pays the service and recovers from tenant
  // "pago_propietario_recuperar" — owner paid; agency collects from tenant and returns to owner
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const servicioComprobante = pgTable("service_receipt", {
  id: text("id").primaryKey(),
  servicioId: text("servicioId")
    .notNull()
    .references(() => servicio.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // "YYYY-MM" ej: "2025-05"
  monto: decimal("monto", { precision: 12, scale: 2 }),
  archivoUrl: text("archivoUrl"),
  uploadedBy: text("uploadedBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  uploadedAt: timestamp("uploadedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const servicioOmision = pgTable("service_skip", {
  id: text("id").primaryKey(),
  servicioId: text("servicioId")
    .notNull()
    .references(() => servicio.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // "YYYY-MM"
  reason: text("reason").notNull(),
  skippedBy: text("skippedBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Servicio = typeof servicio.$inferSelect;
export type NuevoServicio = typeof servicio.$inferInsert;
export type ServicioComprobante = typeof servicioComprobante.$inferSelect;
export type NuevoServicioComprobante = typeof servicioComprobante.$inferInsert;
export type ServicioOmision = typeof servicioOmision.$inferSelect;
export type NuevoServicioOmision = typeof servicioOmision.$inferInsert;
