import { pgTable, text, timestamp, integer, decimal, smallint, boolean } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { agency } from "./agency";

/**
 * Property Schema
 *
 * Represents a real estate property in the system.
 */
export const property = pgTable("property", {
  id: text("id").primaryKey(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  title: text("title"), // Opcional, se puede completar luego en la ficha
  type: text("type").notNull(), // casa, depto, terreno, local, etc.
  rentalStatus: text("rentalStatus").notNull().default("available"), // available, rented, reserved, maintenance
  saleStatus: text("saleStatus"), // null | "for_sale" | "sold"
  rentalPrice: decimal("rentalPrice", { precision: 15, scale: 2 }),
  rentalPriceCurrency: text("rentalPriceCurrency").notNull().default("ARS"),
  salePrice: decimal("salePrice", { precision: 15, scale: 2 }),
  salePriceCurrency: text("salePriceCurrency").notNull().default("USD"),
  zone: text("zone"), // Barrio / Zona
  floorUnit: text("floorUnit"), // Piso / Unidad
  rooms: integer("rooms"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  floors: integer("floors").notNull().default(1),
  surface: decimal("surface", { precision: 10, scale: 2 }),
  surfaceBuilt: decimal("surfaceBuilt", { precision: 10, scale: 2 }),
  surfaceLand: decimal("surfaceLand", { precision: 10, scale: 2 }),
  yearBuilt: smallint("yearBuilt"),
  condition: text("condition"),
  keys: text("keys"),
  // Responsabilidad de servicios e impuestos: "inquilino" | "propietario" | "na"
  ownerRole: text("ownerRole").notNull().default("ambos"),
  serviceElectricity: text("serviceElectricity").notNull().default("inquilino"),
  serviceGas: text("serviceGas").notNull().default("inquilino"),
  serviceWater: text("serviceWater").notNull().default("inquilino"),
  serviceCouncil: text("serviceCouncil").notNull().default("inquilino"),
  serviceStateTax: text("serviceStateTax").notNull().default("inquilino"),
  serviceHoa: text("serviceHoa").notNull().default("na"),

  addressStreet: text("addressStreet").notNull(),
  addressNumber: text("addressNumber"),
  city: text("city"),
  province: text("province"),

  // Destino del inmueble: "vivienda" | "comercial" | "mixto" | "oficina"
  destino: text("destino"),

  // Confección del inmueble (descripción por planta y observaciones)
  plantaPB: text("plantaPB"),
  plantaPA: text("plantaPA"),
  observacionesConfeccion: text("observacionesConfeccion"),

  // Datos registrales
  registryNumber: text("registryNumber"),
  cadastralRef: text("cadastralRef"),

  // Expensas: si tiene expensas (serviceHoa distinto de "na" es heurística; este campo es explícito)
  tieneExpensas: boolean("tieneExpensas").notNull().default(false),

  // false when created as a guarantee property (not actively marketed/managed by the agency)
  isManaged: boolean("isManaged").notNull().default(true),

  ownerId: text("ownerId")
    .references(() => client.id, { onDelete: "cascade" }),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

