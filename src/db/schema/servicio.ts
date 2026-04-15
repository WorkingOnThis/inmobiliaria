import { pgTable, text, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { property } from "./property";

/**
 * Servicio
 *
 * Configuración de un servicio (luz, gas, agua, etc.) asociado a una propiedad.
 * Cada propiedad puede tener múltiples servicios configurados.
 */
export const servicio = pgTable("servicio", {
  id: text("id").primaryKey(),
  propertyId: text("propertyId")
    .notNull()
    .references(() => property.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(), // "luz" | "gas" | "agua" | "expensas" | "abl" | "inmobiliario" | "seguro" | "otro"
  empresa: text("empresa"), // Nombre de la empresa prestadora
  numeroCuenta: text("numeroCuenta"), // Primer identificador (N° cuenta / póliza / catastral). Se mantiene en sincronía con el primer campo de metadatos para mostrarlo en listas.
  metadatos: jsonb("metadatos").$type<Record<string, string>>(), // Campos específicos por tipo de servicio (ej: {numeroCuenta, numeroContrato})
  titular: text("titular"), // Nombre del titular del servicio
  titularTipo: text("titularTipo").notNull().default("propietario"), // "propietario" | "inquilino" | "otro"
  responsablePago: text("responsablePago").notNull().default("propietario"), // "propietario" | "inquilino"
  vencimientoDia: integer("vencimientoDia"), // Día del mes en que vence la boleta (1-31)
  activaBloqueo: boolean("activaBloqueo").notNull().default(true), // Si true: vencimiento sin comprobante bloquea el alquiler
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * ServicioComprobante
 *
 * Registro de un comprobante cargado para un servicio en un período dado (YYYY-MM).
 * Permite saber si el servicio está "al día" o si tiene días sin comprobante.
 */
export const servicioComprobante = pgTable("servicioComprobante", {
  id: text("id").primaryKey(),
  servicioId: text("servicioId")
    .notNull()
    .references(() => servicio.id, { onDelete: "cascade" }),
  periodo: text("periodo").notNull(), // "YYYY-MM" ej: "2025-05"
  monto: decimal("monto", { precision: 12, scale: 2 }), // Opcional — monto del comprobante
  archivoUrl: text("archivoUrl"), // URL del archivo adjunto (nullable por ahora)
  cargadoPor: text("cargadoPor")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  cargadoEl: timestamp("cargadoEl").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/**
 * ServicioOmision
 *
 * Registro de una omisión de bloqueo realizada por el staff para un período.
 * Permite cobrar el alquiler aunque no haya comprobante cargado para ese mes.
 * La omisión es por período (no permanente) y queda auditada.
 */
export const servicioOmision = pgTable("servicioOmision", {
  id: text("id").primaryKey(),
  servicioId: text("servicioId")
    .notNull()
    .references(() => servicio.id, { onDelete: "cascade" }),
  periodo: text("periodo").notNull(), // "YYYY-MM"
  motivo: text("motivo").notNull(), // Justificación escrita por el staff
  omitidoPor: text("omitidoPor")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Tipos inferidos para usar en la aplicación
export type Servicio = typeof servicio.$inferSelect;
export type NuevoServicio = typeof servicio.$inferInsert;
export type ServicioComprobante = typeof servicioComprobante.$inferSelect;
export type NuevoServicioComprobante = typeof servicioComprobante.$inferInsert;
export type ServicioOmision = typeof servicioOmision.$inferSelect;
export type NuevaSservicioOmision = typeof servicioOmision.$inferInsert;
