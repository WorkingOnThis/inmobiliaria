import { pgTable, text, timestamp, integer, decimal } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { property } from "./property";

/**
 * Contract Schema
 *
 * Vincula una propiedad con un inquilino y un propietario.
 * status: "draft" | "pending_signature" | "active" | "expiring_soon" | "expired" | "terminated"
 * contractType: "vivienda" | "oficina" | "local" | "otro"
 * paymentModality: "A" (inmobiliaria recibe y liquida) | "B" (pago directo al propietario)
 * adjustmentIndex: "ICL" | "IPC" | "CER" | "UVA" | "manual" | "sin_ajuste"
 */
export const contract = pgTable("contract", {
  id: text("id").primaryKey(),
  contractNumber: text("contractNumber").notNull().unique(), // "CON-0001"

  propertyId: text("propertyId")
    .notNull()
    .references(() => property.id, { onDelete: "restrict" }),
  tenantId: text("tenantId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),
  ownerId: text("ownerId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),

  status: text("status").notNull().default("draft"),
  contractType: text("contractType").notNull(),

  startDate: text("startDate").notNull(), // ISO string "YYYY-MM-DD"
  endDate: text("endDate").notNull(),

  monthlyAmount: decimal("monthlyAmount", { precision: 12, scale: 2 }).notNull(),
  depositAmount: decimal("depositAmount", { precision: 12, scale: 2 }),
  agencyCommission: decimal("agencyCommission", { precision: 5, scale: 2 }),

  paymentDay: integer("paymentDay").notNull(),
  paymentModality: text("paymentModality").notNull().default("A"),
  adjustmentIndex: text("adjustmentIndex").notNull().default("sin_ajuste"),

  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
