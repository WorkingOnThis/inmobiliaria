import { describe, expect, test } from "bun:test";
import { z } from "zod";

const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
  montoOverrides: z.record(z.string(), z.string()).default({}),
  splitBreakdowns: z.record(z.string(), z.object({ propietario: z.number(), administracion: z.number() })).optional(),
  idempotencyKey: z.string().uuid().optional(),
  observaciones: z.string().max(500).optional(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});

describe("emit schema", () => {
  test("acepta sin idempotencyKey (compatible hacia atrás)", () => {
    const r = emitSchema.safeParse({
      ledgerEntryIds: ["a"], fecha: "2026-05-11", honorariosPct: 7,
    });
    expect(r.success).toBe(true);
  });
  test("acepta payload completo", () => {
    const r = emitSchema.safeParse({
      ledgerEntryIds: ["a"], fecha: "2026-05-11", honorariosPct: 7,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      observaciones: "Pago parcial", action: "email",
    });
    expect(r.success).toBe(true);
  });
  test("rechaza observaciones > 500 chars", () => {
    const r = emitSchema.safeParse({
      ledgerEntryIds: ["a"], fecha: "2026-05-11", honorariosPct: 7,
      observaciones: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
  test("rechaza idempotencyKey mal formado", () => {
    const r = emitSchema.safeParse({
      ledgerEntryIds: ["a"], fecha: "2026-05-11", honorariosPct: 7,
      idempotencyKey: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });
});
