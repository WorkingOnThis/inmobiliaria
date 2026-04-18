import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { property } from "./property";
import { contract } from "./contract";
import { client } from "./client";

export const tarea = pgTable("task", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // "urgent" | "high" | "medium" | "low"
  status: text("status").notNull().default("pending"),    // "pending" | "in_progress" | "resolved"
  tipo: text("tipo").notNull().default("manual"),         // "auto" | "manual" — not renamed (enum value, not column)
  categoria: text("categoria"),                           // "rent" | "services" | "contracts" | "onboarding"

  dueDate: timestamp("dueDate"),

  propertyId: text("propertyId").references(() => property.id, { onDelete: "set null" }),
  contractId: text("contractId").references(() => contract.id, { onDelete: "set null" }),
  tenantId: text("tenantId").references(() => client.id, { onDelete: "set null" }),
  ownerId: text("ownerId").references(() => client.id, { onDelete: "set null" }),
  clientId: text("clientId").references(() => client.id, { onDelete: "set null" }),

  assignedTo: text("assignedTo").references(() => user.id, { onDelete: "set null" }),
  createdBy: text("createdBy").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const tareaHistorial = pgTable("task_history", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references(() => tarea.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  tipo: text("tipo").notNull().default("auto"), // "auto" | "manual"
  createdBy: text("createdBy").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tareaComentario = pgTable("task_comment", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references(() => tarea.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdBy: text("createdBy").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const tareaArchivo = pgTable("task_file", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull().references(() => tarea.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  tipo: text("tipo"),
  size: integer("size"),
  createdBy: text("createdBy").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Tarea = typeof tarea.$inferSelect;
export type NuevaTarea = typeof tarea.$inferInsert;
export type TareaHistorial = typeof tareaHistorial.$inferSelect;
export type NuevaTareaHistorial = typeof tareaHistorial.$inferInsert;
export type TareaComentario = typeof tareaComentario.$inferSelect;
export type NuevaTareaComentario = typeof tareaComentario.$inferInsert;
export type TareaArchivo = typeof tareaArchivo.$inferSelect;
export type NuevaTareaArchivo = typeof tareaArchivo.$inferInsert;
