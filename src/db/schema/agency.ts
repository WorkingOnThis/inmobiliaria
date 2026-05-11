import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

export const agency = pgTable("agency", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("ownerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),

  // 1. Identidad y marca
  legalName: text("legalName"),
  tradeName: text("tradeName"),
  cuit: text("cuit"),
  vatStatus: text("vatStatus"),
  grossIncome: text("grossIncome"),
  activityStart: text("activityStart"),
  logoUrl: text("logoUrl"),

  // 2. Domicilio y contacto
  fiscalAddress: text("fiscalAddress"),
  city: text("city"),
  zipCode: text("zipCode"),
  province: text("province"),
  country: text("country"),
  phone: text("phone"),
  contactEmail: text("contactEmail"),
  website: text("website"),

  // 2b. Domicilio fiscal desglosado (complementa fiscalAddress)
  fiscalAddressStreet: text("fiscalAddressStreet"),
  fiscalAddressNumber: text("fiscalAddressNumber"),
  fiscalAddressZone: text("fiscalAddressZone"),   // barrio

  // 3. Matrícula profesional
  professionalAssociation: text("professionalAssociation"),
  licenseNumber: text("licenseNumber"),
  signatory: text("signatory"),
  signatoryTitle: text("signatoryTitle"),
  signatureUrl: text("signatureUrl"),

  // 4. Numeración y formato del recibo
  invoicePoint: text("invoicePoint"),
  nextNumber: text("nextNumber"),
  receiptType: text("receiptType"),
  settlementPrefix: text("settlementPrefix"),
  currency: text("currency"),
  decimals: integer("decimals"),
  liquidacionUltimoNumero: integer("liquidacionUltimoNumero").notNull().default(0),

  // 5. Datos bancarios de la agencia (para recibir de inquilinos)
  bancoNombre: text("bancoNombre"),
  bancoTitular: text("bancoTitular"),
  bancoCBU: text("bancoCBU"),
  bancoAlias: text("bancoAlias"),

  // 6. Cláusulas legales (JSON: [{id, texto}])
  clauses: text("clauses"),

  // 7. Preferencias de emisión
  prefShowQR: boolean("prefShowQR"),
  prefShowDetalle: boolean("prefShowDetalle"),
  prefEmailAuto: boolean("prefEmailAuto"),
  prefFirma: boolean("prefFirma"),
  prefBorrador: boolean("prefBorrador"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
