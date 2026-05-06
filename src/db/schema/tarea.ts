import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { property } from "./property";
import { contract } from "./contract";
import { client } from "./client";
import { agency } from "./agency";

export const tarea = pgTable("task", {
  id: text("id").primaryKey(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // "urgent" | "high" | "medium" | "low"
  status: text("status").notNull().default("pending"),    // "pending" | "in_progress" | "resolved"
  type: text("type").notNull().default("manual"),         // "auto" | "manual"
  category: text("category"),                             // "rent" | "services" | "contracts" | "onboarding"

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
  type: text("type").notNull().default("auto"), // "auto" | "manual"
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
  type: text("type"),
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
