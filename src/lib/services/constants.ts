// Available service types
export const SERVICE_TYPES = [
  "electricity",
  "gas",
  "water",
  "hoa",
  "abl",
  "property_tax",
  "insurance",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  electricity: "Energía eléctrica",
  gas: "Gas natural",
  water: "Agua",
  hoa: "Expensas",
  abl: "Provincial / Rentas",
  property_tax: "Inmobiliario",
  insurance: "Seguro del inmueble",
  other: "Otro",
};

// Short label for tiles and cards
export const SERVICE_TYPE_SHORT_LABELS: Record<ServiceType, string> = {
  electricity: "Luz",
  gas: "Gas",
  water: "Agua",
  hoa: "Expensas",
  abl: "Provincial",
  property_tax: "Inmobiliario",
  insurance: "Seguro",
  other: "Otro",
};

export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  electricity: "💡",
  gas: "🔥",
  water: "💧",
  hoa: "🏢",
  abl: "🏛",
  property_tax: "🏠",
  insurance: "🛡",
  other: "📋",
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
  electricity: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 123456789", mono: true },
    { key: "numeroContrato", label: "N° de contrato", placeholder: "Ej: CTR-0012", mono: true },
  ],
  gas: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 1234567", mono: true },
    { key: "numeroMedidor", label: "N° de medidor", placeholder: "Ej: G4-0012345", mono: true },
  ],
  water: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 98765432", mono: true },
  ],
  hoa: [
    { key: "numeroCuenta", label: "N° de unidad / depto", placeholder: "Ej: 3°A" },
    { key: "contactoAdmin", label: "Contacto de la administración", placeholder: "Ej: mail, teléfono, nombre" },
  ],
  abl: [
    { key: "numeroCuenta", label: "N° de cuenta", placeholder: "Ej: 1234-5678-90", mono: true },
  ],
  property_tax: [
    { key: "nomenclaturaCatastral", label: "Nomenclatura catastral", placeholder: "Ej: 01-01-01-001-0000-000", mono: true },
  ],
  insurance: [
    { key: "numeroPoliza", label: "N° de póliza", placeholder: "Ej: POL-20251234", mono: true },
  ],
  other: [
    { key: "referencia", label: "N° de referencia", placeholder: "Ej: 12345", mono: true },
  ],
};

// Possible states of a service in a given period
export const SERVICE_STATUSES = [
  "current",
  "pending",
  "alert",
  "blocked",
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  current: "Al día",
  pending: "Pendiente",
  alert: "En alerta",
  blocked: "Bloqueado",
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

export function getPeriodDays(period: string): { start: Date; daysElapsed: number } {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const today = new Date();
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { start, daysElapsed };
}

/**
 * Calculate the status of a service given:
 * - Days elapsed since the current period expiration
 * - If the service activates blocking
 * - If a receipt is already loaded for this period
 * - If there is a block omission for this period
 *
 * Rules:
 *  - With receipt → "current"
 *  - Without receipt, < 30 days → "pending"
 *  - Without receipt, 30+ days, with omission → "pending" (block was omitted)
 *  - Without receipt, 30+ days, without omission → "alert"
 *  - Without receipt, 30+ days, activates block, without omission → "blocked"
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
  if (hasReceipt) return "current";
  if (daysWithoutReceipt < 30) return "pending";
  if (hasOmission) return "pending";
  if (activatesBlock) return "blocked";
  return "alert";
}
