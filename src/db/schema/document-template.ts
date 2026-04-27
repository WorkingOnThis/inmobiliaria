import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { agency } from "./agency";

export const documentTemplate = pgTable("documentTemplate", {
  id: text("id").primaryKey(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  source: text("source").notNull().default("custom"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const documentTemplateClause = pgTable("documentTemplateClause", {
  id: text("id").primaryKey(),
  templateId: text("templateId")
    .notNull()
    .references(() => documentTemplate.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  order: integer("order").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  category: text("category").notNull().default("general"),
  isOptional: boolean("isOptional").notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
