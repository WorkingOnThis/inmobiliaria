import { test, expect, describe } from "bun:test";
import { migrateBody } from "../../src/lib/document-templates/path-migration-map";

describe("migrateBody", () => {
  test("renames simple system variables", () => {
    const input = "El locador es [[locador.apellido]], [[locador.nombres]].";
    expect(migrateBody(input)).toBe(
      "El locador es [[apellido_locador]], [[nombres_locador]]."
    );
  });

  test("renames variable inside [[if:]] block", () => {
    const input = "[[if:locador.cuit]]CUIT: [[locador.cuit]][[/if]]";
    expect(migrateBody(input)).toBe(
      "[[if:cuit_locador]]CUIT: [[cuit_locador]][[/if]]"
    );
  });

  test("renames fiadora variables with index", () => {
    const input = "[[fiadora1.apellido]] [[fiadora1.nombres]] (DNI: [[fiadora1.dni]])";
    expect(migrateBody(input)).toBe(
      "[[apellido_fiador_1]] [[nombres_fiador_1]] (DNI: [[dni_fiador_1]])"
    );
  });

  test("handles nested if with multiple var types — main acceptance case", () => {
    const input = [
      "# Contrato",
      "El locador [[locador.apellido]], [[locador.nombres]] ([[locador.dni]])",
      "[[if:locador.cuit]]CUIT: [[locador.cuit]][[/if]]",
      "[[if:fiadora1.apellido]]Fiador: [[fiadora1.apellido]] [[fiadora1.nombres]][[/if]]",
    ].join("\n");

    const expected = [
      "# Contrato",
      "El locador [[apellido_locador]], [[nombres_locador]] ([[dni_locador]])",
      "[[if:cuit_locador]]CUIT: [[cuit_locador]][[/if]]",
      "[[if:apellido_fiador_1]]Fiador: [[apellido_fiador_1]] [[nombres_fiador_1]][[/if]]",
    ].join("\n");

    expect(migrateBody(input)).toBe(expected);
  });

  test("does not touch free-text vars {{name}}", () => {
    const input = "Monto: {{monto [000]}} pesos, locador: [[locador.apellido]]";
    expect(migrateBody(input)).toBe(
      "Monto: {{monto [000]}} pesos, locador: [[apellido_locador]]"
    );
  });

  test("is idempotent — second run produces no further changes", () => {
    const input = "[[locador.apellido]] [[contrato.fecha_inicio]]";
    const once = migrateBody(input);
    const twice = migrateBody(once);
    expect(once).toBe(twice);
  });

  test("passes through already-migrated paths unchanged", () => {
    const input = "[[apellido_locador]] [[fecha_inicio]]";
    expect(migrateBody(input)).toBe(input);
  });

  test("handles administradora duplicate (agencia.razon_social → nombre_administradora)", () => {
    const input = "Administrado por [[agencia.razon_social]]";
    expect(migrateBody(input)).toBe("Administrado por [[nombre_administradora]]");
  });

  test("handles propietario.dni alias", () => {
    const input = "DNI propietario: [[propietario.dni]]";
    expect(migrateBody(input)).toBe("DNI propietario: [[dni_locador]]");
  });
});
