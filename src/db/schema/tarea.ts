import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { property } from "./property";
import { contract } from "./contract";
import { client } from "./client";

/**
 * Tarea
 *
 * Representa una tarea de gestión asignada a un miembro del staff.
 * Puede ser generada automáticamente por el sistema (ej: mora, vencimiento)
 * o creada manualmente por un agente.
 *
 * prioridad: "urgent" | "high" | "medium" | "low"
 * estado:    "pending" | "in_progress" | "resolved"
 * tipo:      "auto" | "manual"
 * categoria: "rent" | "services" | "contracts" | "onboarding" | null
 */
export const tarea = pgTable("tarea", {
  id: text("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  prioridad: text("prioridad").notNull().default("medium"),
  estado: text("estado").notNull().default("pending"),
  tipo: text("tipo").notNull().default("manual"),
  categoria: text("categoria"),
  fechaVencimiento: timestamp("fechaVencimiento"),

  // Entidades vinculadas (todas opcionales)
  propertyId: text("propertyId").references(() => property.id, {
    onDelete: "set null",
  }),
  contractId: text("contractId").references(() => contract.id, {
    onDelete: "set null",
  }),
  tenantId: text("tenantId").references(() => client.id, {
    onDelete: "set null",
  }),
  ownerId: text("ownerId").references(() => client.id, {
    onDelete: "set null",
  }),

  // Cliente vinculado genérico (propietario, inquilino, garante, contacto, etc.)
  clienteId: text("clienteId").references(() => client.id, {
    onDelete: "set null",
  }),

  // Responsable asignado y auditoría
  assignedTo: text("assignedTo").references(() => user.id, {
    onDelete: "set null",
  }),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * TareaHistorial
 *
 * Registro cronológico de eventos sobre una tarea.
 * Los eventos automáticos (cambios de estado, creación) tienen tipo "auto".
 * Las notas del staff tienen tipo "manual".
 */
export const tareaHistorial = pgTable("tareaHistorial", {
  id: text("id").primaryKey(),
  tareaId: text("tareaId")
    .notNull()
    .references(() => tarea.id, { onDelete: "cascade" }),
  texto: text("texto").notNull(),
  tipo: text("tipo").notNull().default("auto"), // "auto" | "manual"
  creadoPor: text("creadoPor").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/**
 * TareaComentario
 *
 * Comentarios internos del staff sobre una tarea.
 * Solo visibles para usuarios del sistema (no para propietarios/inquilinos).
 */
export const tareaComentario = pgTable("tareaComentario", {
  id: text("id").primaryKey(),
  tareaId: text("tareaId")
    .notNull()
    .references(() => tarea.id, { onDelete: "cascade" }),
  texto: text("texto").notNull(),
  creadoPor: text("creadoPor")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/**
 * TareaArchivo
 *
 * Archivos adjuntos a una tarea (imágenes, PDFs, etc.).
 * Se almacenan en /public/uploads/tareas/[tareaId]/.
 */
export const tareaArchivo = pgTable("tareaArchivo", {
  id: text("id").primaryKey(),
  tareaId: text("tareaId")
    .notNull()
    .references(() => tarea.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  url: text("url").notNull(),
  tipo: text("tipo"),
  tamaño: integer("tamaño"),
  creadoPor: text("creadoPor").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Tipos inferidos
export type Tarea = typeof tarea.$inferSelect;
export type NuevaTarea = typeof tarea.$inferInsert;
export type TareaHistorial = typeof tareaHistorial.$inferSelect;
export type NuevaTareaHistorial = typeof tareaHistorial.$inferInsert;
export type TareaComentario = typeof tareaComentario.$inferSelect;
export type NuevaTareaComentario = typeof tareaComentario.$inferInsert;
export type TareaArchivo = typeof tareaArchivo.$inferSelect;
export type NuevaTareaArchivo = typeof tareaArchivo.$inferInsert;
