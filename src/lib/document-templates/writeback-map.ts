// src/lib/document-templates/writeback-map.ts

export type WritebackEntry =
  | {
      entity: "contract" | "property" | "owner" | "tenant_0";
      dbField: string;
      label: string;
      inputType: "text" | "number" | "integer" | "date";
    }
  | {
      entity: "agency";
      settingsPath: string;
      label: string;
    };

export const WRITEBACK_MAP: Record<string, WritebackEntry> = {
  // ── Contrato ───────────────────────────────────────────────────────────────
  precio_inicial_numero:   { entity: "contract", dbField: "monthlyAmount",       label: "Precio mensual del contrato",   inputType: "number" },
  precio_inicial_formato:  { entity: "contract", dbField: "monthlyAmount",       label: "Precio mensual del contrato",   inputType: "number" },
  precio_inicial_letras:   { entity: "contract", dbField: "monthlyAmount",       label: "Precio mensual del contrato",   inputType: "number" },
  fecha_inicio:            { entity: "contract", dbField: "startDate",           label: "Fecha de inicio del contrato",  inputType: "date" },
  fecha_fin:               { entity: "contract", dbField: "endDate",             label: "Fecha de fin del contrato",     inputType: "date" },
  dia_vencimiento:         { entity: "contract", dbField: "paymentDay",          label: "Día de vencimiento del pago",   inputType: "integer" },
  tipo_ajuste:             { entity: "contract", dbField: "adjustmentIndex",     label: "Índice de ajuste",              inputType: "text" },
  periodo_ajuste_meses:    { entity: "contract", dbField: "adjustmentFrequency", label: "Frecuencia de ajuste (meses)",  inputType: "integer" },
  dia_gracia:              { entity: "contract", dbField: "graceDays",           label: "Días de gracia",                inputType: "integer" },
  modalidad_pago:          { entity: "contract", dbField: "paymentModality",     label: "Modalidad de pago",             inputType: "text" },

  // ── Propiedad ─────────────────────────────────────────────────────────────
  domicilio_propiedad_completo:   { entity: "property", dbField: "address",       label: "Dirección de la propiedad",       inputType: "text" },
  domicilio_propiedad_calle:      { entity: "property", dbField: "addressStreet", label: "Calle de la propiedad",           inputType: "text" },
  domicilio_propiedad_numero:     { entity: "property", dbField: "addressNumber", label: "Número de la propiedad",          inputType: "text" },
  domicilio_propiedad_barrio:     { entity: "property", dbField: "zone",          label: "Barrio/zona de la propiedad",     inputType: "text" },
  domicilio_propiedad_unidad:     { entity: "property", dbField: "floorUnit",     label: "Piso/Unidad de la propiedad",     inputType: "text" },
  domicilio_propiedad_ciudad:     { entity: "property", dbField: "city",          label: "Ciudad de la propiedad",          inputType: "text" },
  domicilio_propiedad_provincia:  { entity: "property", dbField: "province",      label: "Provincia de la propiedad",       inputType: "text" },
  tipo_inmueble:                  { entity: "property", dbField: "type",          label: "Tipo de inmueble",                inputType: "text" },
  destino_propiedad:              { entity: "property", dbField: "destino",       label: "Destino del inmueble",            inputType: "text" },

  // ── Locador / Propietario ─────────────────────────────────────────────────
  // nombre_completo_locador is intentionally absent: it's derived from firstName + lastName (two fields)
  nombres_locador:          { entity: "owner", dbField: "firstName",     label: "Nombres del locador",           inputType: "text" },
  apellido_locador:         { entity: "owner", dbField: "lastName",      label: "Apellido del locador",          inputType: "text" },
  dni_locador:              { entity: "owner", dbField: "dni",           label: "DNI del locador",               inputType: "text" },
  cuit_locador:             { entity: "owner", dbField: "cuit",          label: "CUIT del locador",              inputType: "text" },
  email_locador:            { entity: "owner", dbField: "email",         label: "Email del locador",             inputType: "text" },
  telefono_locador:         { entity: "owner", dbField: "phone",         label: "Teléfono del locador",          inputType: "text" },
  domicilio_locador:        { entity: "owner", dbField: "address",       label: "Domicilio del locador",         inputType: "text" },
  domicilio_locador_calle:  { entity: "owner", dbField: "addressStreet", label: "Calle del locador",             inputType: "text" },
  domicilio_locador_numero: { entity: "owner", dbField: "addressNumber", label: "Número del domicilio (locador)", inputType: "text" },
  domicilio_locador_barrio: { entity: "owner", dbField: "addressZone",   label: "Barrio del locador",            inputType: "text" },
  domicilio_locador_ciudad: { entity: "owner", dbField: "addressCity",   label: "Ciudad del locador",            inputType: "text" },
  domicilio_locador_provincia: { entity: "owner", dbField: "addressProvince", label: "Provincia del locador",   inputType: "text" },

  // ── Locatario / Inquilino ─────────────────────────────────────────────────
  // nombre_completo_locatario is intentionally absent: derived from firstName + lastName (two fields)
  nombres_locatario:          { entity: "tenant_0", dbField: "firstName",     label: "Nombres del locatario",            inputType: "text" },
  apellido_locatario:         { entity: "tenant_0", dbField: "lastName",      label: "Apellido del locatario",           inputType: "text" },
  dni_locatario:              { entity: "tenant_0", dbField: "dni",           label: "DNI del locatario",                inputType: "text" },
  cuit_locatario:             { entity: "tenant_0", dbField: "cuit",          label: "CUIT del locatario",               inputType: "text" },
  email_locatario:            { entity: "tenant_0", dbField: "email",         label: "Email del locatario",              inputType: "text" },
  telefono_locatario:         { entity: "tenant_0", dbField: "phone",         label: "Teléfono del locatario",           inputType: "text" },
  domicilio_locatario:        { entity: "tenant_0", dbField: "address",       label: "Domicilio del locatario",          inputType: "text" },
  domicilio_locatario_calle:  { entity: "tenant_0", dbField: "addressStreet", label: "Calle del locatario",              inputType: "text" },
  domicilio_locatario_numero: { entity: "tenant_0", dbField: "addressNumber", label: "Número del domicilio (locatario)", inputType: "text" },
  domicilio_locatario_barrio: { entity: "tenant_0", dbField: "addressZone",   label: "Barrio del locatario",             inputType: "text" },
  domicilio_locatario_ciudad: { entity: "tenant_0", dbField: "addressCity",   label: "Ciudad del locatario",             inputType: "text" },
  domicilio_locatario_provincia: { entity: "tenant_0", dbField: "addressProvince", label: "Provincia del locatario",    inputType: "text" },

  // ── Administradora (link only) ─────────────────────────────────────────────
  nombre_administradora:          { entity: "agency", settingsPath: "/agencia", label: "Nombre / razón social" },
  cuit_administradora:            { entity: "agency", settingsPath: "/agencia", label: "CUIT de la administradora" },
  domicilio_administradora:       { entity: "agency", settingsPath: "/agencia", label: "Domicilio fiscal" },
  domicilio_administradora_calle: { entity: "agency", settingsPath: "/agencia", label: "Calle de la administradora" },
  domicilio_administradora_numero:{ entity: "agency", settingsPath: "/agencia", label: "Número de la administradora" },
  domicilio_administradora_barrio:{ entity: "agency", settingsPath: "/agencia", label: "Barrio de la administradora" },
  domicilio_administradora_ciudad:{ entity: "agency", settingsPath: "/agencia", label: "Ciudad de la administradora" },
  domicilio_administradora_provincia: { entity: "agency", settingsPath: "/agencia", label: "Provincia de la administradora" },
  telefono_administradora:        { entity: "agency", settingsPath: "/agencia", label: "Teléfono de la administradora" },
  email_administradora:           { entity: "agency", settingsPath: "/agencia", label: "Email de la administradora" },
  matricula_administradora:       { entity: "agency", settingsPath: "/agencia", label: "Matrícula profesional" },
  firmante_administradora:        { entity: "agency", settingsPath: "/agencia", label: "Nombre del firmante" },
  cbu_administradora:             { entity: "agency", settingsPath: "/agencia", label: "CBU de la administradora" },
  alias_administradora:           { entity: "agency", settingsPath: "/agencia", label: "Alias CBU de la administradora" },
};
