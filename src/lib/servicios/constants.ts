// Tipos de servicio disponibles
export const SERVICIO_TIPOS = [
  "luz",
  "gas",
  "agua",
  "expensas",
  "abl",
  "inmobiliario",
  "seguro",
  "otro",
] as const;

export type ServicioTipo = (typeof SERVICIO_TIPOS)[number];

export const SERVICIO_TIPO_LABELS: Record<ServicioTipo, string> = {
  luz: "Energía eléctrica",
  gas: "Gas natural",
  agua: "Agua",
  expensas: "Expensas",
  abl: "Provincial / Rentas",
  inmobiliario: "Inmobiliario",
  seguro: "Seguro del inmueble",
  otro: "Otro",
};

// Label corto para usar en tiles y cards (sin subetiquetas)
export const SERVICIO_TIPO_LABELS_CORTOS: Record<ServicioTipo, string> = {
  luz: "Luz",
  gas: "Gas",
  agua: "Agua",
  expensas: "Expensas",
  abl: "Provincial",
  inmobiliario: "Inmobiliario",
  seguro: "Seguro",
  otro: "Otro",
};

export const SERVICIO_TIPO_ICONS: Record<ServicioTipo, string> = {
  luz: "💡",
  gas: "🔥",
  agua: "💧",
  expensas: "🏢",
  abl: "🏛",
  inmobiliario: "🏠",
  seguro: "🛡",
  otro: "📋",
};

// Campos específicos que se guardan por tipo de servicio en la columna metadatos.
// El primer campo es siempre el identificador principal (se copia a numeroCuenta).
export type CampoServicio = {
  key: string;
  label: string;
  placeholder?: string;
  mono?: boolean; // true → fuente monoespaciada (para números de cuenta, códigos)
};

export const CAMPOS_SERVICIO: Record<ServicioTipo, CampoServicio[]> = {
  luz: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 123456789", mono: true },
    { key: "numeroContrato", label: "N° de contrato", placeholder: "Ej: CTR-0012", mono: true },
  ],
  gas: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 1234567", mono: true },
    { key: "numeroMedidor", label: "N° de medidor", placeholder: "Ej: G4-0012345", mono: true },
  ],
  agua: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 98765432", mono: true },
  ],
  expensas: [
    { key: "numeroCuenta", label: "N° de unidad / depto", placeholder: "Ej: 3°A" },
    { key: "contactoAdmin", label: "Contacto de la administración", placeholder: "Ej: mail, teléfono, nombre" },
  ],
  abl: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 1234-5678-90", mono: true },
  ],
  inmobiliario: [
    { key: "nomenclaturaCatastral", label: "Nomenclatura catastral", placeholder: "Ej: 01-01-01-001-0000-000", mono: true },
  ],
  seguro: [
    { key: "numeroPoliza", label: "N° de póliza", placeholder: "Ej: POL-20251234", mono: true },
  ],
  otro: [
    { key: "referencia", label: "N° de referencia", placeholder: "Ej: 12345", mono: true },
  ],
};

// Estados posibles de un servicio en un período dado
export const SERVICIO_ESTADOS = [
  "al_dia",
  "pendiente",
  "en_alerta",
  "bloqueado",
] as const;

export type ServicioEstado = (typeof SERVICIO_ESTADOS)[number];

export const SERVICIO_ESTADO_LABELS: Record<ServicioEstado, string> = {
  al_dia: "Al día",
  pendiente: "Pendiente",
  en_alerta: "En alerta",
  bloqueado: "Bloqueado",
};

// Quién es el titular del servicio
export const TITULAR_TIPOS = ["propietario", "inquilino", "otro"] as const;
export type TitularTipo = (typeof TITULAR_TIPOS)[number];

export const TITULAR_TIPO_LABELS: Record<TitularTipo, string> = {
  propietario: "Propietario",
  inquilino: "Inquilino",
  otro: "Otro",
};

// Quién es responsable de pagar el servicio
export const RESPONSABLE_PAGO_TIPOS = ["propietario", "inquilino"] as const;
export type ResponsablePagoTipo = (typeof RESPONSABLE_PAGO_TIPOS)[number];

export const RESPONSABLE_PAGO_LABELS: Record<ResponsablePagoTipo, string> = {
  propietario: "Propietario",
  inquilino: "Inquilino",
};

/**
 * Calcula el estado de un servicio dado:
 * - los días que pasaron desde el vencimiento del período actual
 * - si el servicio activa bloqueo
 * - si ya hay comprobante cargado para este período
 * - si hay una omisión de bloqueo para este período
 *
 * Reglas:
 *  - Con comprobante → "al_dia"
 *  - Sin comprobante, < 30 días → "pendiente"
 *  - Sin comprobante, 30+ días, con omisión → "pendiente" (el bloqueo fue omitido)
 *  - Sin comprobante, 30+ días, sin omisión → "en_alerta"
 *  - Sin comprobante, 30+ días, activa bloqueo, sin omisión → "bloqueado"
 */
export function calcularEstadoServicio({
  tieneComprobante,
  diasSinComprobante,
  activaBloqueo,
  tieneOmision,
}: {
  tieneComprobante: boolean;
  diasSinComprobante: number;
  activaBloqueo: boolean;
  tieneOmision: boolean;
}): ServicioEstado {
  if (tieneComprobante) return "al_dia";
  if (diasSinComprobante < 30) return "pendiente";
  if (tieneOmision) return "pendiente";
  if (activaBloqueo) return "bloqueado";
  return "en_alerta";
}
