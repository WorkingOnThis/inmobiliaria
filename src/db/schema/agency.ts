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
  razonSocial: text("razonSocial"),
  nombreFantasia: text("nombreFantasia"),
  cuit: text("cuit"),
  condicionIVA: text("condicionIVA"),
  ingresosBrutos: text("ingresosBrutos"),
  inicioActividades: text("inicioActividades"),
  logoUrl: text("logoUrl"),

  // 2. Domicilio y contacto
  domicilioFiscal: text("domicilioFiscal"),
  localidad: text("localidad"),
  codigoPostal: text("codigoPostal"),
  provincia: text("provincia"),
  pais: text("pais"),
  telefono: text("telefono"),
  emailContacto: text("emailContacto"),
  sitioWeb: text("sitioWeb"),

  // 3. Matrícula profesional
  colegio: text("colegio"),
  matricula: text("matricula"),
  firmante: text("firmante"),
  firmanteCargo: text("firmanteCargo"),
  firmaUrl: text("firmaUrl"),

  // 4. Numeración y formato del recibo
  puntoVenta: text("puntoVenta"),
  proximoNumero: text("proximoNumero"),
  tipoComprobante: text("tipoComprobante"),
  prefijoLiquidacion: text("prefijoLiquidacion"),
  moneda: text("moneda"),
  decimales: integer("decimales"),

  // 5. Datos bancarios de la agencia (para recibir de inquilinos)
  bancoNombre: text("bancoNombre"),
  bancoTitular: text("bancoTitular"),
  bancoCBU: text("bancoCBU"),
  bancoAlias: text("bancoAlias"),

  // 6. Cláusulas legales (JSON: [{id, texto}])
  clausulas: text("clausulas"),

  // 7. Preferencias de emisión
  prefShowQR: boolean("prefShowQR"),
  prefShowDetalle: boolean("prefShowDetalle"),
  prefEmailAuto: boolean("prefEmailAuto"),
  prefFirma: boolean("prefFirma"),
  prefBorrador: boolean("prefBorrador"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
