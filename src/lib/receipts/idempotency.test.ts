import { describe, expect, test } from "bun:test";
import { isValidIdempotencyKey } from "./idempotency";

describe("isValidIdempotencyKey", () => {
  test("acepta UUID v4 válido", () => {
    expect(isValidIdempotencyKey("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });
  test("rechaza string vacío", () => {
    expect(isValidIdempotencyKey("")).toBe(false);
  });
  test("rechaza string que no es UUID", () => {
    expect(isValidIdempotencyKey("not-a-uuid")).toBe(false);
  });
  test("rechaza UUID con espacios", () => {
    expect(isValidIdempotencyKey(" 123e4567-e89b-12d3-a456-426614174000 ")).toBe(false);
  });
});
