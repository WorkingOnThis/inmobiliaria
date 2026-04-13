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
  abl: "ABL / Impuesto inmobiliario",
  inmobiliario: "Inmobiliario",
  seguro: "Seguro del inmueble",
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
