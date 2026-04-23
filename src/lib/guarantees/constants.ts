export const GUARANTEE_KINDS = ["propertyOwner", "deposit", "salaryReceipt"] as const;
export const GUARANTEE_STATUSES = ["active", "replaced", "released"] as const;

export type GuaranteeKind = (typeof GUARANTEE_KINDS)[number];
export type GuaranteeStatus = (typeof GUARANTEE_STATUSES)[number];

export const GUARANTEE_KIND_LABELS: Record<GuaranteeKind, string> = {
  propertyOwner: "Garantía propietaria",
  deposit: "Depósito en garantía",
  salaryReceipt: "Recibo de sueldo",
};

export const GUARANTEE_STATUS_LABELS: Record<GuaranteeStatus, string> = {
  active: "Activa",
  replaced: "Sustituida",
  released: "Liberada",
};
