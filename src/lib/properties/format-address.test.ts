import { describe, test, expect } from "bun:test";
import { formatAddress } from "./format-address";

describe("formatAddress", () => {
  test("street + number + unit", () => {
    expect(
      formatAddress({
        addressStreet: "Godoy Cruz",
        addressNumber: "2814",
        floorUnit: "3B",
      })
    ).toBe("Godoy Cruz 2814 - 3B");
  });

  test("street + number, no unit", () => {
    expect(
      formatAddress({ addressStreet: "Godoy Cruz", addressNumber: "2814" })
    ).toBe("Godoy Cruz 2814");
  });

  test("street only", () => {
    expect(formatAddress({ addressStreet: "Av. Colón" })).toBe("Av. Colón");
  });

  test("null number and unit", () => {
    expect(
      formatAddress({
        addressStreet: "Av. Colón",
        addressNumber: null,
        floorUnit: null,
      })
    ).toBe("Av. Colón");
  });

  test("empty number string treated as missing", () => {
    expect(formatAddress({ addressStreet: "San Martín", addressNumber: "" }))
      .toBe("San Martín");
  });
});
