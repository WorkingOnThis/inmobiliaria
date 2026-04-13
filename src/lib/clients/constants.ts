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
  ICL: "ICL",
  IPC: "IPC",
  CER: "CER",
  UVA: "UVA",
  manual: "Ajuste manual",
  sin_ajuste: "Sin ajuste",
};
