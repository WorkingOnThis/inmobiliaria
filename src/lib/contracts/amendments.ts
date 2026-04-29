export const AMENDMENT_TYPES = [
  "erratum",
  "modification",
  "extension",
  "termination",
  "guarantee_substitution",
  "index_change",
] as const;

export type AmendmentType = (typeof AMENDMENT_TYPES)[number];

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  erratum:                "Salvedad",
  modification:           "Acuerdo Modificatorio",
  extension:              "Prórroga",
  termination:            "Rescisión Consensuada",
  guarantee_substitution: "Sustitución de Garantía",
  index_change:           "Cambio de Índice",
};

export const AMENDMENT_TYPE_DESCRIPTIONS: Record<AmendmentType, string> = {
  erratum:                "Corregir un error de dato en el texto del contrato",
  modification:           "Cambiar una condición acordada por las partes",
  extension:              "Extender el plazo del contrato",
  termination:            "Acordar la terminación anticipada del contrato",
  guarantee_substitution: "Reemplazar un garante o garantía existente",
  index_change:           "Acordar un nuevo índice de ajuste",
};

export const AMENDMENT_STATUS_LABELS: Record<string, string> = {
  registered:         "Registrado",
  document_generated: "Documento generado",
  signed:             "Firmado",
};

// Which contract fields each type is allowed to change
export const ALLOWED_FIELDS: Record<AmendmentType, string[]> = {
  erratum:                ["contractType", "startDate", "endDate"],
  modification:           [
    "monthlyAmount", "graceDays", "electronicPaymentFeePct",
    "lateInterestPct", "paymentDay", "paymentModality", "managementCommissionPct",
  ],
  extension:              ["endDate", "monthlyAmount"],
  termination:            ["status"],
  guarantee_substitution: [],
  index_change:           ["adjustmentIndex", "adjustmentFrequency"],
};

// Human-readable Spanish labels for contract fields
export const FIELD_LABELS: Record<string, string> = {
  contractType:            "Tipo de contrato",
  startDate:               "Fecha de inicio",
  endDate:                 "Fecha de fin",
  monthlyAmount:           "Canon mensual",
  graceDays:               "Días de gracia",
  electronicPaymentFeePct: "Comisión pago electrónico (%)",
  lateInterestPct:         "Interés por mora (%)",
  paymentDay:              "Día de pago",
  paymentModality:         "Modalidad de pago",
  managementCommissionPct: "Comisión de administración (%)",
  adjustmentIndex:         "Índice de ajuste",
  adjustmentFrequency:     "Frecuencia de ajuste (meses)",
  status:                  "Estado del contrato",
};

// Whether the type requires an effectiveDate
export const REQUIRES_EFFECTIVE_DATE: Record<AmendmentType, boolean> = {
  erratum:                false,
  modification:           true,
  extension:              true,
  termination:            true,
  guarantee_substitution: false,
  index_change:           true,
};

// Whether the type requires a description
export const REQUIRES_DESCRIPTION: Record<AmendmentType, boolean> = {
  erratum:                false,
  modification:           false,
  extension:              false,
  termination:            false,
  guarantee_substitution: true,
  index_change:           false,
};

// Valid status transitions
export const VALID_TRANSITIONS: Record<string, string[]> = {
  registered:         ["document_generated", "signed"],
  document_generated: ["signed"],
  signed:             [],
};

export type AmendmentListItem = {
  id: string;
  type: AmendmentType;
  sequenceNumber: number;
  typeSequenceNumber: number;
  status: string;
  title: string;
  description: string | null;
  fieldsChanged: Record<string, { before: unknown; after: unknown; label: string }>;
  effectiveDate: string | null;
  hasDocument: boolean;
  signedAt: string | null;
  createdAt: string;
};
