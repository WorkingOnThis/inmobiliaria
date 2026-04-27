import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

export const receiptAnnulment = pgTable("receipt_annulment", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reciboNumero: text("recibo_numero").notNull(),
  motivo: text("motivo"),
  teniaPagosLiquidados: boolean("tenia_pagos_liquidados").notNull().default(false),
  anuladoPor: text("anulado_por").references(() => user.id, { onDelete: "set null" }),
  anuladoAt: timestamp("anulado_at").defaultNow().notNull(),
});
