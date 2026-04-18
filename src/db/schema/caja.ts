import { pgTable, text, decimal, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { contract } from "./contract";
import { property } from "./property";

/**
 * Caja General — Movimientos
 *
 * Registra todos los flujos de dinero de la agencia:
 *   - tipo: "ingreso" | "egreso"
 *   - origen: "manual" (cargado por staff) | "contrato" (generado automático)
 *
 * Las vinculaciones son todas opcionales. Un movimiento puede estar
 * ligado a un contrato, un propietario, un inquilino o una propiedad,
 * o a ninguno (ej: gasto operativo de la inmobiliaria).
 */
export const cajaMovimiento = pgTable("caja_movimiento", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  fecha: text("fecha").notNull(), // ISO "YYYY-MM-DD"

  descripcion: text("descripcion").notNull(),

  tipo: text("tipo").notNull(), // "ingreso" | "egreso"

  categoria: text("categoria"), // texto libre, ej: "Plomería", "Operativo", "Honorarios"

  monto: decimal("monto", { precision: 15, scale: 2 }).notNull(),

  origen: text("origen").notNull().default("manual"), // "manual" | "contrato" | "liquidacion"

  // Vinculaciones opcionales
  contratoId: text("contratoId").references(() => contract.id, { onDelete: "set null" }),
  propietarioId: text("propietarioId").references(() => client.id, { onDelete: "set null" }),
  inquilinoId: text("inquilinoId").references(() => client.id, { onDelete: "set null" }),
  propiedadId: text("propiedadId").references(() => property.id, { onDelete: "set null" }),

  // Conciliación — verificación contra comprobante externo
  conciliado: boolean("conciliado").notNull().default(false),
  conciliadoEn: timestamp("conciliadoEn"),

  // Fecha en que el movimiento entró a una liquidación cerrada (para TTL de 90 días)
  liquidadoEn: timestamp("liquidadoEn"),

  // Comprobante adjunto (PDF o imagen, almacenado en /public/uploads/movimientos/)
  comprobanteUrl: text("comprobanteUrl"),
  comprobanteMime: text("comprobanteMime"),
  comprobanteTamano: integer("comprobanteTamano"),

  // Campo legacy — texto libre (URL o descripción manual). Mantener para no romper datos existentes.
  comprobante: text("comprobante"),

  // Nota interna (solo visible para staff, no aparece en informes al cliente)
  nota: text("nota"),

  // Número correlativo de recibo (solo para ingresos formales de alquiler)
  reciboNumero: text("reciboNumero"),

  // Período de alquiler al que corresponde el pago, formato "YYYY-MM"
  periodo: text("periodo"),

  // Quién registró el movimiento
  creadoPor: text("creadoPor").references(() => user.id, { onDelete: "set null" }),

  creadoEn: timestamp("creadoEn").defaultNow().notNull(),
  actualizadoEn: timestamp("actualizadoEn").defaultNow().notNull(),
});

export type CajaMovimiento = typeof cajaMovimiento.$inferSelect;
export type NuevoCajaMovimiento = typeof cajaMovimiento.$inferInsert;
