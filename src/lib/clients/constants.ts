export const CLIENT_TYPES = [
  "propietario",
  "inquilino",
  "garante",
  "contacto",
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  propietario: "Propietario",
  inquilino: "Inquilino",
  garante: "Garante",
  contacto: "Contacto",
};

export const CONTRACT_STATUSES = [
  "draft",
  "pending_signature",
  "active",
  "expiring_soon",
  "expired",
  "terminated",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Borrador",
  pending_signature: "Pendiente de firma",
  active: "Vigente",
  expiring_soon: "Por vencer",
  expired: "Vencido",
  terminated: "Rescindido",
};

export const CONTRACT_TYPES = ["vivienda", "oficina", "local", "otro"] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  vivienda: "Vivienda",
  oficina: "Oficina",
  local: "Local comercial",
  otro: "Otro",
};

export const ADJUSTMENT_INDEXES = [
  "ICL",
  "IPC",
  "CER",
  "UVA",
  "manual",
  "sin_ajuste",
] as const;

export type AdjustmentIndex = (typeof ADJUSTMENT_INDEXES)[number];

export const ADJUSTMENT_INDEX_LABELS: Record<AdjustmentIndex, string> = {
  ICL: "ICL — Índice de Contratos de Locación",
  IPC: "IPC — Índice de Precios al Consumidor",
  CER: "CER — Coeficiente de Estabilización de Referencia",
  UVA: "UVA — Unidad de Valor Adquisitivo",
  manual: "Ajuste manual",
  sin_ajuste: "Sin ajuste",
};

export const ADJUSTMENT_FREQUENCIES = [1, 2, 3, 4, 6, 12] as const;

export const ADJUSTMENT_FREQUENCY_LABELS: Record<number, string> = {
  1: "Mensual",
  2: "Bimestral",
  3: "Trimestral",
  4: "Cuatrimestral",
  6: "Semestral",
  12: "Anual",
};

export const SERVICE_RESPONSIBILITY_OPTIONS = [
  "inquilino",
  "propietario",
  "na",
] as const;

export type ServiceResponsibility =
  (typeof SERVICE_RESPONSIBILITY_OPTIONS)[number];

export const SERVICE_RESPONSIBILITY_LABELS: Record<
  ServiceResponsibility,
  string
> = {
  inquilino: "Inquilino",
  propietario: "Propietario",
  na: "No aplica",
};

export const PROPERTY_SERVICES = [
  { key: "serviceLuz", label: "Luz" },
  { key: "serviceGas", label: "Gas" },
  { key: "serviceAgua", label: "Agua" },
  { key: "serviceMunicipalidad", label: "Municipalidad" },
  { key: "serviceRendas", label: "Rentas" },
  { key: "serviceExpensas", label: "Expensas" },
] as const;
