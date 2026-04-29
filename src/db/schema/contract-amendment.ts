import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { contract } from "./contract";

export const contractAmendment = pgTable("contract_amendment", {
  id:               text("id").primaryKey(),
  contractId:       text("contractId").notNull().references(() => contract.id, { onDelete: "restrict" }),
  type:             text("type").notNull(),
  // erratum | modification | extension | termination | guarantee_substitution | index_change

  sequenceNumber:   integer("sequenceNumber").notNull(),
  // correlativo global por contrato (1, 2, 3…)

  status:           text("status").notNull().default("registered"),
  // registered | document_generated | signed

  title:            text("title").notNull(),
  description:      text("description"),

  fieldsChanged:    jsonb("fieldsChanged").notNull().$type<Record<string, { before: unknown; after: unknown }>>(),
  contractSnapshot: jsonb("contractSnapshot").notNull().$type<Record<string, unknown>>(),

  effectiveDate:    text("effectiveDate"),
  // ISO "YYYY-MM-DD" — obligatorio para modification, extension, termination, index_change

  documentContent:  text("documentContent"),
  // HTML del instrumento generado (se sirve via GET /api/.../document)

  signedAt:         timestamp("signedAt"),

  createdBy:        text("createdBy").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt:        timestamp("createdAt").notNull().defaultNow(),
  updatedAt:        timestamp("updatedAt").notNull().defaultNow(),
});
