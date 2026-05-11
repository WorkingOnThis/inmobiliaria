import { pgTable, text, decimal, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { contract } from "./contract";
import { property } from "./property";
import { agency } from "./agency";

/**
 * Caja General — Movimientos
 *
 * Registra todos los flujos de dinero de la agencia:
 *   - tipo: "income" | "expense"
 *   - source: "manual" (cargado por staff) | "contract" (generado automático) | "settlement"
 *
 * Las vinculaciones son todas opcionales. Un movimiento puede estar
 * ligado a un contrato, un propietario, un inquilino o una propiedad,
 * o a ninguno (ej: gasto operativo de la inmobiliaria).
 */
export const cajaMovimiento = pgTable("cash_movement", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),

  date: text("date").notNull(), // ISO "YYYY-MM-DD"

  description: text("description").notNull(),

  tipo: text("tipo").notNull(), // "income" | "expense"

  categoria: text("categoria"), // texto libre, ej: "Plomería", "Operativo", "Honorarios"

  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),

  source: text("source").notNull().default("manual"), // "manual" | "contract" | "settlement"

  // Vinculaciones opcionales
  contratoId: text("contratoId").references(() => contract.id, { onDelete: "set null" }),
  propietarioId: text("propietarioId").references(() => client.id, { onDelete: "set null" }),
  inquilinoId: text("inquilinoId").references(() => client.id, { onDelete: "set null" }),
  propiedadId: text("propiedadId").references(() => property.id, { onDelete: "set null" }),

  // Conciliación — verificación contra comprobante externo
  reconciled: boolean("reconciled").notNull().default(false),
  reconciledAt: timestamp("reconciledAt"),

  // Fecha en que el movimiento entró a una liquidación cerrada (para TTL de 90 días)
  settledAt: timestamp("settledAt"),

  // Comprobante adjunto (PDF o imagen). Storage: private-uploads/movimientos/<id>/<filename>; URL: /api/files/movimientos/<id>/<filename>.
  comprobanteUrl: text("comprobanteUrl"),
  comprobanteMime: text("comprobanteMime"),
  comprobanteTamano: integer("comprobanteTamano"),

  // Campo legacy — texto libre (URL o descripción manual). Mantener para no romper datos existentes.
  comprobante: text("comprobante"),

  // Nota interna (solo visible para staff, no aparece en informes al cliente)
  note: text("note"),

  // Número correlativo de recibo (solo para ingresos formales de alquiler)
  reciboNumero: text("reciboNumero"),

  // Modalidad de pago al momento de emitir el recibo ("A" | "B") — congelada para no depender del contrato vivo
  paymentModality: text("paymentModality"),

  // Período de alquiler al que corresponde el pago, formato "YYYY-MM"
  period: text("period"),

  // Fund segregation
  tipoFondo: text("tipoFondo").notNull().default("agencia"),
  // "agencia"     — money that belongs to the agency (fees, commissions)
  // "propietario" — in-transit money from an owner (rent collected, pending settlement)
  // "inquilino"   — in-transit money from a tenant (deposit, advance payments)

  // Link to the tenant_ledger entry that originated this movement (nullable for manual entries)
  ledgerEntryId: text("ledgerEntryId"),
  // No FK here — would create circular import: caja.ts → tenant-ledger.ts → ... → caja.ts.

  // Quién registró el movimiento
  createdBy: text("createdBy").references(() => user.id, { onDelete: "set null" }),

  // Anulación — solo para movimientos con source="contract"
  anuladoAt: timestamp("anulado_at"),
  anuladoPor: text("anulado_por").references(() => user.id, { onDelete: "set null" }),
  annulmentId: text("annulment_id"),
  // Sin FK para evitar import circular. La integridad se mantiene en la transacción de anulación.

  // Idempotencia: evita duplicar movimientos cuando la misma operación de
  // emisión se reintenta (doble click, network blip). Mismo valor en todos
  // los movimientos de un mismo recibo/liquidación.
  idempotencyKey: text("idempotencyKey"),

  // Liquidación al propietario: agrupa los movimientos incluidos en una
  // misma corrida de liquidación. NULL hasta que el período se liquida.
  settlementBatchId: text("settlementBatchId"),
  liquidadoAt: timestamp("liquidadoAt"),
  liquidadoPor: text("liquidadoPor").references(() => user.id, { onDelete: "set null" }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CajaMovimiento = typeof cajaMovimiento.$inferSelect;
export type NuevoCajaMovimiento = typeof cajaMovimiento.$inferInsert;
