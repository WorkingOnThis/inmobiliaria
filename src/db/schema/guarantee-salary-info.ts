import { pgTable, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { guarantee } from "./guarantee";

// Satellite table for guarantee.kind = "salaryReceipt".
// Separated because it has its own lifecycle (employer can change over time).
export const guaranteeSalaryInfo = pgTable("guarantee_salary_info", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  guaranteeId: text("guaranteeId")
    .notNull()
    .unique()
    .references(() => guarantee.id, { onDelete: "cascade" }),
  employerName: text("employerName"),
  employerAddress: text("employerAddress"),
  employerPhone: text("employerPhone"),
  jobTitle: text("jobTitle"),
  jobStartDate: text("jobStartDate"), // "YYYY-MM-DD"
  employmentType: text("employmentType"), // e.g. "relacion_dependencia" | "monotributo"
  monthlyGrossSalary: decimal("monthlyGrossSalary", { precision: 15, scale: 2 }),
  cuitEmpleador: text("cuitEmpleador"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
