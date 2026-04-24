/**
 * Maps old variable paths (dot-notation) to new snake_case paths.
 * Used by both the migration script and its tests.
 *
 * Each entry produces two string replacements in clause bodies:
 *   [[old]] → [[new]]
 *   [[if:old]] → [[if:new]]
 */
export const PATH_MIGRATION_MAP: { old: string; new: string }[] = [
  // ── Propiedad ──────────────────────────────────────────────────────────────
  { old: "propiedad.direccion_completa",  new: "domicilio_propiedad_completo" },
  { old: "propiedad.barrio",              new: "domicilio_propiedad_barrio" },
  { old: "propiedad.unidad",              new: "domicilio_propiedad_unidad" },
  { old: "propiedad.tipo",                new: "tipo_inmueble" },
  { old: "propiedad.domicilio_calle",     new: "domicilio_propiedad_calle" },
  { old: "propiedad.domicilio_numero",    new: "domicilio_propiedad_numero" },
  { old: "propiedad.domicilio_ciudad",    new: "domicilio_propiedad_ciudad" },
  { old: "propiedad.domicilio_provincia", new: "domicilio_propiedad_provincia" },
  { old: "propiedad.destino",             new: "destino_propiedad" },
  { old: "propiedad.tiene_expensas",      new: "tiene_expensas" },
  { old: "propiedad.responsable_expensas",new: "responsable_expensas" },
  { old: "propiedad.responsable_dgr",     new: "responsable_DGR" },
  { old: "propiedad.responsable_municipal",new:"responsable_municipal" },
  { old: "propiedad.responsable_agua",    new: "responsable_agua" },
  { old: "propiedad.responsable_luz",     new: "responsable_luz" },
  { old: "propiedad.responsable_gas",     new: "responsable_gas" },

  // ── Locador / Propietario ──────────────────────────────────────────────────
  { old: "propietario.nombre_completo",   new: "nombre_completo_locador" },
  { old: "propietario.dni",               new: "dni_locador" },
  { old: "locador.nombres",               new: "nombres_locador" },
  { old: "locador.apellido",              new: "apellido_locador" },
  { old: "locador.dni",                   new: "dni_locador" },
  { old: "locador.cuit",                  new: "cuit_locador" },
  { old: "locador.email",                 new: "email_locador" },
  { old: "locador.telefono",              new: "telefono_locador" },
  { old: "locador.domicilio",             new: "domicilio_locador" },
  { old: "locador.domicilio_calle",       new: "domicilio_locador_calle" },
  { old: "locador.domicilio_numero",      new: "domicilio_locador_numero" },
  { old: "locador.domicilio_ciudad",      new: "domicilio_locador_ciudad" },
  { old: "locador.domicilio_provincia",   new: "domicilio_locador_provincia" },

  // ── Locatario / Inquilino ──────────────────────────────────────────────────
  { old: "inquilino.nombre_completo",     new: "nombre_completo_locatario" },
  { old: "inquilino.dni",                 new: "dni_locatario" },
  { old: "locatario.nombres",             new: "nombres_locatario" },
  { old: "locatario.apellido",            new: "apellido_locatario" },
  { old: "locatario.dni",                 new: "dni_locatario" },
  { old: "locatario.cuit",                new: "cuit_locatario" },
  { old: "locatario.email",               new: "email_locatario" },
  { old: "locatario.telefono",            new: "telefono_locatario" },
  { old: "locatario.domicilio",           new: "domicilio_locatario" },
  { old: "locatario.domicilio_calle",     new: "domicilio_locatario_calle" },
  { old: "locatario.domicilio_numero",    new: "domicilio_locatario_numero" },
  { old: "locatario.domicilio_ciudad",    new: "domicilio_locatario_ciudad" },
  { old: "locatario.domicilio_provincia", new: "domicilio_locatario_provincia" },

  // ── Contrato ───────────────────────────────────────────────────────────────
  { old: "contrato.fecha_inicio",          new: "fecha_inicio" },
  { old: "contrato.fecha_fin",             new: "fecha_fin" },
  { old: "contrato.plazo_meses",           new: "duracion_meses" },
  { old: "contrato.duracion_meses",        new: "duracion_meses" },
  { old: "contrato.monto_alquiler",        new: "precio_inicial_numero" },
  { old: "contrato.precio_inicial_numero", new: "precio_inicial_numero" },
  { old: "contrato.precio_inicial_formato",new: "precio_inicial_formato" },
  { old: "contrato.precio_inicial_letras", new: "precio_inicial_letras" },
  { old: "contrato.tipo_ajuste",           new: "tipo_ajuste" },
  { old: "contrato.periodo_ajuste_meses",  new: "periodo_ajuste_meses" },
  { old: "contrato.dia_vencimiento",       new: "dia_vencimiento" },
  { old: "contrato.modalidad_pago",        new: "modalidad_pago" },
  { old: "contrato.dia_gracia",            new: "dia_gracia" },
  { old: "contrato.porcentaje_comision",   new: "porcentaje_comision_pago_electronico" },
  { old: "contrato.porcentaje_interes_mora",new:"porcentaje_interes_mora" },
  { old: "contrato.es_renovacion",         new: "es_renovacion" },

  // ── Administradora ─────────────────────────────────────────────────────────
  { old: "agencia.razon_social",           new: "nombre_administradora" },
  { old: "administradora.nombre",          new: "nombre_administradora" },
  { old: "administradora.cuit",            new: "cuit_administradora" },
  { old: "administradora.domicilio",       new: "domicilio_administradora" },
  { old: "administradora.ciudad",          new: "domicilio_administradora_ciudad" },
  { old: "administradora.provincia",       new: "domicilio_administradora_provincia" },
  { old: "administradora.telefono",        new: "telefono_administradora" },
  { old: "administradora.email",           new: "email_administradora" },
  { old: "administradora.matricula",       new: "matricula_administradora" },
  { old: "administradora.firmante",        new: "firmante_administradora" },
  { old: "administradora.cbu",             new: "cbu_administradora" },
  { old: "administradora.alias",           new: "alias_administradora" },

  // ── Garantes / Fiadoras ────────────────────────────────────────────────────
  { old: "garante.nombre_completo",        new: "nombre_completo_fiador" },
  { old: "garante.dni",                    new: "dni_fiador_1" },
  { old: "garante.domicilio",              new: "domicilio_fiador_1" },
  { old: "garante.cantidad",               new: "cantidad_fiadoras" },
  { old: "fiadora1.apellido",              new: "apellido_fiador_1" },
  { old: "fiadora1.nombres",              new: "nombres_fiador_1" },
  { old: "fiadora1.dni",                   new: "dni_fiador_1" },
  { old: "fiadora1.cuit",                  new: "cuil_fiador_1" },
  { old: "fiadora1.domicilio",             new: "domicilio_fiador_1" },
  { old: "fiadora1.email",                 new: "email_fiador_1" },
  { old: "fiadora1.telefono",              new: "telefono_fiador_1" },
  { old: "fiadora2.apellido",              new: "apellido_fiador_2" },
  { old: "fiadora2.nombres",              new: "nombres_fiador_2" },
  { old: "fiadora2.dni",                   new: "dni_fiador_2" },
  { old: "fiadora2.cuit",                  new: "cuil_fiador_2" },
  { old: "fiadora2.domicilio",             new: "domicilio_fiador_2" },
  { old: "fiadora2.email",                 new: "email_fiador_2" },
  { old: "fiadora2.telefono",              new: "telefono_fiador_2" },
  { old: "fiadora3.apellido",              new: "apellido_fiador_3" },
  { old: "fiadora3.nombres",              new: "nombres_fiador_3" },
  { old: "fiadora3.dni",                   new: "dni_fiador_3" },
  { old: "fiadora3.cuit",                  new: "cuil_fiador_3" },
  { old: "fiadora3.domicilio",             new: "domicilio_fiador_3" },
  { old: "fiadora3.email",                 new: "email_fiador_3" },
  { old: "fiadora3.telefono",              new: "telefono_fiador_3" },
];

/**
 * Apply all path migrations to a single clause body string.
 * Safe to call multiple times (idempotent: already-migrated paths are not in the map as `old`).
 */
export function migrateBody(body: string): string {
  let result = body;
  for (const entry of PATH_MIGRATION_MAP) {
    result = result.replaceAll(`[[${entry.old}]]`, `[[${entry.new}]]`);
    result = result.replaceAll(`[[if:${entry.old}]]`, `[[if:${entry.new}]]`);
  }
  return result;
}
