import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { agency } from "./agency";
import { user } from "./better-auth";

export const fieldNote = pgTable(
  "field_note",
  {
    id: text("id").primaryKey(),
    agencyId: text("agencyId")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    entityType: text("entityType").notNull(),
    entityId: text("entityId").notNull(),
    fieldName: text("fieldName").notNull(),
    comment: text("comment").notNull(),
    authorId: text("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    unique("field_note_unique").on(
      t.agencyId,
      t.entityType,
      t.entityId,
      t.fieldName,
      t.authorId
    ),
  ]
);
