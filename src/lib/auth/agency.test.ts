import { describe, expect, test } from "bun:test";
import {
  AgencyAccessError,
  handleAgencyError,
  requireAgencyId,
} from "./agency";

describe("requireAgencyId", () => {
  test("tira 401 si no hay sesión", () => {
    expect(() => requireAgencyId(null)).toThrow(
      expect.objectContaining({ status: 401 })
    );
  });

  test("tira 401 si la sesión existe pero no tiene user", () => {
    expect(() => requireAgencyId({ user: null } as any)).toThrow(
      expect.objectContaining({ status: 401 })
    );
  });

  test("tira 403 si el user no tiene agencyId", () => {
    const session = { user: { id: "u1", agencyId: null } } as any;
    expect(() => requireAgencyId(session)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  test("tira 403 si agencyId es string vacío", () => {
    const session = { user: { id: "u1", agencyId: "" } } as any;
    expect(() => requireAgencyId(session)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  test("devuelve agencyId si todo está populado", () => {
    const session = { user: { id: "u1", agencyId: "agency-123" } } as any;
    expect(requireAgencyId(session)).toBe("agency-123");
  });
});

describe("handleAgencyError", () => {
  test("devuelve NextResponse con status correcto para AgencyAccessError", async () => {
    const err = new AgencyAccessError(403, "test message");
    const resp = handleAgencyError(err);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
    const body = await resp!.json();
    expect(body).toEqual({ error: "test message" });
  });

  test("devuelve null para errores que no son AgencyAccessError", () => {
    expect(handleAgencyError(new Error("otro error"))).toBeNull();
    expect(handleAgencyError("string error")).toBeNull();
    expect(handleAgencyError(null)).toBeNull();
  });
});
