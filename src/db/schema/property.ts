import { pgTable, text, timestamp, integer, decimal, smallint } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";

/**
 * Property Schema
 * 
 * Represents a real estate property in the system.
 */
export const property = pgTable("property", {
  id: text("id").primaryKey(),
  title: text("title"), // Opcional, se puede completar luego en la ficha
  address: text("address").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }), // Opcional, se puede completar luego en la ficha
  type: text("type").notNull(), // casa, depto, terreno, local, etc.
  status: text("status").notNull().default("available"), // available, rented, sold, reserved
  zone: text("zone"), // Barrio / Zona
  floorUnit: text("floorUnit"), // Piso / Unidad
  rooms: integer("rooms"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  surface: decimal("surface", { precision: 10, scale: 2 }),
  surfaceBuilt: decimal("surfaceBuilt", { precision: 10, scale: 2 }),
  surfaceLand: decimal("surfaceLand", { precision: 10, scale: 2 }),
  yearBuilt: smallint("yearBuilt"),
  condition: text("condition"),
  keys: text("keys"),
  // Responsabilidad de servicios e impuestos: "inquilino" | "propietario" | "na"
  serviceElectricity: text("serviceElectricity").notNull().default("inquilino"),
  serviceGas: text("serviceGas").notNull().default("inquilino"),
  serviceWater: text("serviceWater").notNull().default("inquilino"),
  serviceCouncil: text("serviceCouncil").notNull().default("inquilino"),
  serviceStateTax: text("serviceStateTax").notNull().default("inquilino"),
  serviceHoa: text("serviceHoa").notNull().default("na"),

  ownerId: text("ownerId")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  createdBy: text("createdBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

