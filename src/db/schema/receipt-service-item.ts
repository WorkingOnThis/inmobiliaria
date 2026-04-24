import { pgTable, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { cajaMovimiento } from "./caja";
import { servicio } from "./servicio";

export const receiptServiceItem = pgTable("receipt_service_item", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  movimientoId: text("movimientoId")
    .notNull()
    .references(() => cajaMovimiento.id, { onDelete: "cascade" }),
  servicioId: text("servicioId")
    .references(() => servicio.id, { onDelete: "set null" }),
  period: text("period").notNull(), // "YYYY-MM"
  monto: decimal("monto", { precision: 15, scale: 2 }), // null = constancia sin cobro
  etiqueta: text("etiqueta").notNull(), // snapshot del tipo+empresa del servicio
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ReceiptServiceItem = typeof receiptServiceItem.$inferSelect;
export type NuevoReceiptServiceItem = typeof receiptServiceItem.$inferInsert;
