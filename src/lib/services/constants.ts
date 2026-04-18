// Available service types
export const SERVICE_TYPES = [
  "luz",
  "gas",
  "agua",
  "expensas",
  "abl",
  "inmobiliario",
  "seguro",
  "otro",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  luz: "Energía eléctrica",
  gas: "Gas natural",
  agua: "Agua",
  expensas: "Expensas",
  abl: "Provincial / Rentas",
  inmobiliario: "Inmobiliario",
  seguro: "Seguro del inmueble",
  otro: "Otro",
};

// Short label for tiles and cards
export const SERVICE_TYPE_SHORT_LABELS: Record<ServiceType, string> = {
  luz: "Luz",
  gas: "Gas",
  agua: "Agua",
  expensas: "Expensas",
  abl: "Provincial",
  inmobiliario: "Inmobiliario",
  seguro: "Seguro",
  otro: "Otro",
};

export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  luz: "💡",
  gas: "🔥",
  agua: "💧",
  expensas: "🏢",
  abl: "🏛",
  inmobiliario: "🏠",
  seguro: "🛡",
  otro: "📋",
};

// Service-specific fields stored in the metadata column.
// The first field is always the primary identifier (copied to accountNumber).
export type ServiceField = {
  key: string;
  label: string;
  placeholder?: string;
  mono?: boolean; // true → fuente monoespaciada (para números de cuenta, códigos)
};

export const SERVICE_FIELDS: Record<ServiceType, ServiceField[]> = {
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

// Possible states of a service in a given period
export const SERVICE_STATUSES = [
  "al_dia",
  "pendiente",
  "en_alerta",
  "bloqueado",
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  al_dia: "Al día",
  pendiente: "Pendiente",
  en_alerta: "En alerta",
  bloqueado: "Bloqueado",
};

// Who is the service holder
export const HOLDER_TYPES = ["propietario", "inquilino", "otro"] as const;
export type HolderType = (typeof HOLDER_TYPES)[number];

export const HOLDER_TYPE_LABELS: Record<HolderType, string> = {
  propietario: "Propietario",
  inquilino: "Inquilino",
  otro: "Otro",
};

// Who is responsible for paying the service
export const PAYMENT_RESPONSIBLE_TYPES = ["propietario", "inquilino"] as const;
export type PaymentResponsibleType = (typeof PAYMENT_RESPONSIBLE_TYPES)[number];

export const PAYMENT_RESPONSIBLE_LABELS: Record<PaymentResponsibleType, string> = {
  propietario: "Propietario",
  inquilino: "Inquilino",
};

/**
 * Calculate the status of a service given:
 * - Days elapsed since the current period expiration
 * - If the service activates blocking
 * - If a receipt is already loaded for this period
 * - If there is a block omission for this period
 *
 * Rules:
 *  - With receipt → "al_dia"
 *  - Without receipt, < 30 days → "pendiente"
 *  - Without receipt, 30+ days, with omission → "pendiente" (block was omitted)
 *  - Without receipt, 30+ days, without omission → "en_alerta"
 *  - Without receipt, 30+ days, activates block, without omission → "bloqueado"
 */
export function calculateServiceStatus({
  hasReceipt,
  daysWithoutReceipt,
  activatesBlock,
  hasOmission,
}: {
  hasReceipt: boolean;
  daysWithoutReceipt: number;
  activatesBlock: boolean;
  hasOmission: boolean;
}): ServiceStatus {
  if (hasReceipt) return "al_dia";
  if (daysWithoutReceipt < 30) return "pendiente";
  if (hasOmission) return "pendiente";
  if (activatesBlock) return "bloqueado";
  return "en_alerta";
}
