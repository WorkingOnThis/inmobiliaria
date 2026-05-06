import { pgTable, text, timestamp, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { property } from "./property";

/**
 * Contract Schema
 *
 * Vincula una propiedad con uno o más inquilinos y un propietario.
 * Los inquilinos se vinculan a través de la tabla intermedia contract_tenant.
 * status: "draft" | "pending_signature" | "active" | "expiring_soon" | "expired" | "terminated"
 * contractType: "residential" | "office" | "commercial" | "other"
 * paymentModality: "A" (inmobiliaria recibe y liquida) | "split" (inquilino paga dividido a propietario y administración)
 * adjustmentIndex: "ICL" | "IPC" | "CER" | "UVA" | "manual" | "none"
 */
export const contract = pgTable("contract", {
  id: text("id").primaryKey(),
  contractNumber: text("contractNumber").notNull().unique(), // "CON-0001"

  propertyId: text("propertyId")
    .notNull()
    .references(() => property.id, { onDelete: "restrict" }),
  ownerId: text("ownerId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),

  status: text("status").notNull().default("draft"),
  contractType: text("contractType").notNull(),

  startDate: text("startDate").notNull(), // ISO string "YYYY-MM-DD"
  endDate: text("endDate").notNull(),
  ledgerStartDate: text("ledgerStartDate"), // "YYYY-MM-DD" — overrides startDate for ledger generation

  monthlyAmount: decimal("monthlyAmount", { precision: 12, scale: 2 }).notNull(),
  depositAmount: decimal("depositAmount", { precision: 12, scale: 2 }),
  agencyCommission: decimal("agencyCommission", { precision: 5, scale: 2 }),
  managementCommissionPct: decimal("managementCommissionPct", { precision: 5, scale: 2 }).default("10"),

  paymentDay: integer("paymentDay").notNull(),
  paymentModality: text("paymentModality").notNull().default("A"),
  adjustmentIndex: text("adjustmentIndex").notNull().default("none"),
  adjustmentFrequency: integer("adjustmentFrequency").notNull().default(12), // meses entre actualizaciones

  graceDays: integer("graceDays").notNull().default(0),
  electronicPaymentFeePct: decimal("electronicPaymentFeePct", { precision: 5, scale: 2 }),
  lateInterestPct: decimal("lateInterestPct", { precision: 5, scale: 2 }),
  isRenewal: boolean("isRenewal").notNull().default(false),

  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
