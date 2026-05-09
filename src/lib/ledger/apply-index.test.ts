import { describe, expect, test } from "bun:test";
import {
  calculateFactor,
  nextTramoStart,
  requiredMonthsForTramo,
} from "./apply-index";

describe("calculateFactor", () => {
  test("un solo mes", () => {
    expect(calculateFactor([2])).toBeCloseTo(1.02);
  });

  test("tres meses compuesto — ejemplo del spec", () => {
    // 1.02 × 1.03 × 1.02 = 1.071612
    expect(calculateFactor([2, 3, 2])).toBeCloseTo(1.071612, 4);
  });

  test("tres meses segundo tramo — ejemplo del spec", () => {
    // 1.05 × 1.01 × 1.04 = 1.102920
    expect(calculateFactor([5, 1, 4])).toBeCloseTo(1.10292, 4);
  });

  test("array vacío devuelve 1 (sin ajuste)", () => {
    expect(calculateFactor([])).toBe(1);
  });
});

describe("nextTramoStart", () => {
  test("contrato trimestral — calcula el primer tramo futuro desde hoy", () => {
    // startDate = 2024-01-01, freq = 3
    // Si today es 2024-05-15 → monthsFromStart=4, currentTramoIndex=1, next=2024-07-01
    const result = nextTramoStart("2024-01-01", 3, new Date("2024-05-15T00:00:00"));
    expect(result).toBe("2024-07");
  });

  test("contrato anual — calcula el primer tramo futuro", () => {
    // startDate = 2024-01-01, freq = 12
    // today = 2024-06-01 → monthsFromStart=5, currentTramoIndex=0, next=2025-01
    const result = nextTramoStart("2024-01-01", 12, new Date("2024-06-01T00:00:00"));
    expect(result).toBe("2025-01");
  });

  test("exactamente al inicio de un tramo nuevo", () => {
    // startDate = 2024-01-01, freq = 3
    // today = 2024-07-01 → monthsFromStart=6, currentTramoIndex=2, next=2024-10
    const result = nextTramoStart("2024-01-01", 3, new Date("2024-07-01T00:00:00"));
    expect(result).toBe("2024-10");
  });
});

describe("requiredMonthsForTramo", () => {
  test("trimestral — devuelve los 3 meses anteriores al tramo", () => {
    const result = requiredMonthsForTramo("2024-04", 3);
    expect(result).toEqual(["2024-01", "2024-02", "2024-03"]);
  });

  test("trimestral — cruza año", () => {
    const result = requiredMonthsForTramo("2025-01", 3);
    expect(result).toEqual(["2024-10", "2024-11", "2024-12"]);
  });

  test("semestral — devuelve 6 meses", () => {
    const result = requiredMonthsForTramo("2024-07", 6);
    expect(result).toEqual([
      "2024-01", "2024-02", "2024-03",
      "2024-04", "2024-05", "2024-06",
    ]);
  });
});
