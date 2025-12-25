import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

/**
 * Clause Template Schema
 * 
 * Represents a reusable text template for contract clauses.
 * Each template can include variables/placeholders in the format {{variable_name}}.
 * Templates are created by users with authorized roles and can be used
 * to generate contract documents by selecting clauses and filling in variable values.
 */
export const clauseTemplate = pgTable("clauseTemplate", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  creatorId: text("creatorId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

