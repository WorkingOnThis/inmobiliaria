import { pgTable, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { contract } from "./contract";
import { property } from "./property";

export const tenantCharge = pgTable("tenant_charge", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  contratoId: text("contratoId")
    .notNull()
    .references(() => contract.id, { onDelete: "restrict" }),
  inquilinoId: text("inquilinoId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),
  propietarioId: text("propietarioId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),
  propiedadId: text("propiedadId")
    .notNull()
    .references(() => property.id, { onDelete: "restrict" }),

  period: text("period"), // "YYYY-MM"
  categoria: text("categoria").notNull(), // "alquiler" | "dias_ocupados" | "expensas" | "punitorios" | "otros"
  descripcion: text("descripcion").notNull(),
  monto: decimal("monto", { precision: 15, scale: 2 }).notNull(),

  estado: text("estado").notNull().default("pendiente"), // "pendiente" | "pagado" | "cancelado"
  reciboNumero: text("reciboNumero"), // null until receipt is emitted
  paidAt: timestamp("paidAt"),

  createdBy: text("createdBy").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantCharge = typeof tenantCharge.$inferSelect;
export type NewTenantCharge = typeof tenantCharge.$inferInsert;
