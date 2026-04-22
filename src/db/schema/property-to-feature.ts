import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { property } from "./property";
import { propertyFeature } from "./property-feature";

export const propertyToFeature = pgTable(
  "property_to_feature",
  {
    propertyId: text("propertyId")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    featureId: text("featureId")
      .notNull()
      .references(() => propertyFeature.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.featureId] })]
);
