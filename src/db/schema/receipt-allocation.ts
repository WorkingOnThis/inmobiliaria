import { pgTable, text, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const receiptAllocation = pgTable(
  "receipt_allocation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reciboNumero: text("recibo_numero").notNull(),
    ledgerEntryId: text("ledger_entry_id").notNull(),
    monto: numeric("monto", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_receipt_alloc_recibo").on(t.reciboNumero),
    index("idx_receipt_alloc_entry").on(t.ledgerEntryId),
  ]
);

export type ReceiptAllocation = typeof receiptAllocation.$inferSelect;
export type NewReceiptAllocation = typeof receiptAllocation.$inferInsert;
