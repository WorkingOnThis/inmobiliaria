import { describe, expect, test } from "bun:test";
import { z } from "zod";

const schema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  movimientoIds: z.array(z.string().min(1)).min(1),
  honorariosPct: z.number().min(0).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});

describe("liquidacion emit schema", () => {
  test("payload mínimo válido", () => {
    const r = schema.safeParse({
      periodo: "2026-04",
      movimientoIds: ["a", "b"],
      honorariosPct: 7,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(true);
  });

  test("rechaza periodo mal formado", () => {
    const r = schema.safeParse({
      periodo: "abr-2026",
      movimientoIds: ["a"],
      honorariosPct: 7,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(false);
  });

  test("rechaza array vacío de movimientoIds", () => {
    const r = schema.safeParse({
      periodo: "2026-04",
      movimientoIds: [],
      honorariosPct: 7,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(false);
  });

  test("rechaza idempotencyKey ausente", () => {
    const r = schema.safeParse({
      periodo: "2026-04",
      movimientoIds: ["a"],
      honorariosPct: 7,
      fecha: "2026-04-30",
    });
    expect(r.success).toBe(false);
  });

  test("rechaza honorariosPct > 100", () => {
    const r = schema.safeParse({
      periodo: "2026-04",
      movimientoIds: ["a"],
      honorariosPct: 150,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(false);
  });
});
