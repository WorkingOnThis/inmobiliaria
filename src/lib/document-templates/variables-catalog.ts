import type { InferSelectModel } from "drizzle-orm";
import type { property } from "@/db/schema/property";
import type { client } from "@/db/schema/client";
import type { contract } from "@/db/schema/contract";
import type { agency } from "@/db/schema/agency";
import { numeroEnLetras, montoEnLetras } from "./num-to-words";
import { formatAddress } from "@/lib/properties/format-address";

export type VariableCategory =
  | "propiedad"
  | "propietario"
  | "inquilino"
  | "contrato"
  | "administradora"
  | "garante";

export type GuaranteeResolvedInfo = {
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerDni: string | null;
  ownerCuit: string | null;
  ownerAddress: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  propertyAddress: string | null;
  propertyCadastralRef: string | null;
  propertyRegistryNumber: string | null;
  propertySurfaceLand: string | null;
  propertySurfaceBuilt: string | null;
};

export type TemplateContext = {
  property: InferSelectModel<typeof property> | null;
  owner: InferSelectModel<typeof client> | null;
  tenants: InferSelectModel<typeof client>[];
  guarantors: InferSelectModel<typeof client>[];
  contract: InferSelectModel<typeof contract> | null;
  agency: InferSelectModel<typeof agency> | null;
  firstRealGuarantee: GuaranteeResolvedInfo | null;
};

export type TemplateVariable = {
  path: string;
  label: string;
  category: VariableCategory;
  resolver: (ctx: TemplateContext) => string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fullName(c: InferSelectModel<typeof client> | null | undefined): string | null {
  if (!c) return null;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function monthsBetween(start: string, end: string): number | null {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

function formatARS(val: string | null | undefined): string | null {
  if (!val) return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  return "$ " + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Maps service responsibility DB values to legal labels for contracts.
function labelResponsable(v: string | null | undefined): string | null {
  if (!v || v === "na") return null;
  if (v === "inquilino") return "Locatario";
  if (v === "propietario") return "Locadora";
  return null;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const VARIABLES_CATALOG: TemplateVariable[] = [

  // ── Propiedad ──────────────────────────────────────────────────────────────
  {
    path: "domicilio_propiedad_completo",
    label: "Dirección completa",
    category: "propiedad",
    resolver: (ctx) => ctx.property ? formatAddress({ addressStreet: ctx.property.addressStreet ?? "", addressNumber: ctx.property.addressNumber, floorUnit: ctx.property.floorUnit }) : null,
  },
  {
    path: "domicilio_propiedad_barrio",
    label: "Barrio/zona",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.zone ?? null,
  },
  {
    path: "domicilio_propiedad_unidad",
    label: "Piso/Unidad",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.floorUnit ?? null,
  },
  {
    path: "tipo_inmueble",
    label: "Tipo de inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.type ?? null,
  },
  {
    path: "domicilio_propiedad_calle",
    label: "Calle de la propiedad",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.addressStreet ?? null,
  },
  {
    path: "domicilio_propiedad_numero",
    label: "Número de la propiedad",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.addressNumber ?? null,
  },
  {
    path: "domicilio_propiedad_ciudad",
    label: "Ciudad de la propiedad",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.city ?? null,
  },
  {
    path: "domicilio_propiedad_provincia",
    label: "Provincia de la propiedad",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.province ?? null,
  },
  {
    path: "destino_propiedad",
    label: "Destino del inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.destino ?? null,
  },
  {
    path: "tiene_expensas",
    label: "¿Tiene expensas?",
    category: "propiedad",
    resolver: (ctx) => ctx.property != null ? (ctx.property.tieneExpensas ? "Sí" : "No") : null,
  },
  {
    path: "responsable_expensas",
    label: "Responsable de expensas",
    category: "propiedad",
    resolver: (ctx) => labelResponsable(ctx.property?.serviceHoa),
  },
  {
    path: "responsable_DGR",
    label: "Responsable de DGR",
    category: "propiedad",
    resolver: (ctx) => labelResponsable(ctx.property?.serviceStateTax),
  },
  {
    path: "responsable_municipal",
    label: "Responsable de tasa municipal",
    category: "propiedad",
    resolver: (ctx) => labelResponsable(ctx.property?.serviceCouncil),
  },
  {
    path: "responsable_agua",
    label: "Responsable de agua",
    category: "propiedad",
    resolver: (ctx) => labelResponsable(ctx.property?.serviceWater),
  },
  {
    path: "responsable_luz",
    label: "Responsable de luz",
    category: "propiedad",
    resolver: (ctx) => labelResponsable(ctx.property?.serviceElectricity),
  },
  {
    path: "responsable_gas",
    label: "Responsable de gas",
    category: "propiedad",
    resolver: (ctx) => labelResponsable(ctx.property?.serviceGas),
  },

  // ── Locador / Propietario ──────────────────────────────────────────────────
  {
    path: "nombre_completo_locador",
    label: "Nombre completo del locador",
    category: "propietario",
    resolver: (ctx) => fullName(ctx.owner),
  },
  {
    path: "nombres_locador",
    label: "Nombres del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.firstName ?? null,
  },
  {
    path: "apellido_locador",
    label: "Apellido del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.lastName ?? null,
  },
  {
    path: "dni_locador",
    label: "DNI del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.dni ?? null,
  },
  {
    path: "cuit_locador",
    label: "CUIT del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.cuit ?? null,
  },
  {
    path: "email_locador",
    label: "Email del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.email ?? null,
  },
  {
    path: "telefono_locador",
    label: "Teléfono del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.phone ?? null,
  },
  {
    path: "domicilio_locador",
    label: "Domicilio del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.address ?? null,
  },
  {
    path: "domicilio_locador_calle",
    label: "Calle del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.addressStreet ?? null,
  },
  {
    path: "domicilio_locador_numero",
    label: "Número del domicilio del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.addressNumber ?? null,
  },
  {
    path: "domicilio_locador_barrio",
    label: "Barrio del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.addressZone ?? null,
  },
  {
    path: "domicilio_locador_ciudad",
    label: "Ciudad del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.addressCity ?? null,
  },
  {
    path: "domicilio_locador_provincia",
    label: "Provincia del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.addressProvince ?? null,
  },

  // ── Locatario / Inquilino ──────────────────────────────────────────────────
  {
    path: "nombre_completo_locatario",
    label: "Nombre completo del locatario",
    category: "inquilino",
    resolver: (ctx) => fullName(ctx.tenants[0] ?? null),
  },
  {
    path: "nombres_locatario",
    label: "Nombres del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.firstName ?? null,
  },
  {
    path: "apellido_locatario",
    label: "Apellido del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.lastName ?? null,
  },
  {
    path: "dni_locatario",
    label: "DNI del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.dni ?? null,
  },
  {
    path: "cuit_locatario",
    label: "CUIT del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.cuit ?? null,
  },
  {
    path: "email_locatario",
    label: "Email del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.email ?? null,
  },
  {
    path: "telefono_locatario",
    label: "Teléfono del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.phone ?? null,
  },
  {
    path: "domicilio_locatario",
    label: "Domicilio del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.address ?? null,
  },
  {
    path: "domicilio_locatario_calle",
    label: "Calle del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.addressStreet ?? null,
  },
  {
    path: "domicilio_locatario_numero",
    label: "Número del domicilio del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.addressNumber ?? null,
  },
  {
    path: "domicilio_locatario_barrio",
    label: "Barrio del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.addressZone ?? null,
  },
  {
    path: "domicilio_locatario_ciudad",
    label: "Ciudad del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.addressCity ?? null,
  },
  {
    path: "domicilio_locatario_provincia",
    label: "Provincia del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.addressProvince ?? null,
  },

  // ── Contrato ───────────────────────────────────────────────────────────────
  {
    path: "fecha_inicio",
    label: "Fecha de inicio",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.startDate ?? null,
  },
  {
    path: "fecha_fin",
    label: "Fecha de fin",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.endDate ?? null,
  },
  {
    path: "duracion_meses",
    label: "Duración en meses",
    category: "contrato",
    resolver: (ctx) => {
      if (!ctx.contract?.startDate || !ctx.contract?.endDate) return null;
      const months = monthsBetween(ctx.contract.startDate, ctx.contract.endDate);
      return months !== null ? String(months) : null;
    },
  },
  {
    path: "duracion_texto",
    label: "Duración en letras",
    category: "contrato",
    resolver: (ctx) => {
      if (!ctx.contract?.startDate || !ctx.contract?.endDate) return null;
      const months = monthsBetween(ctx.contract.startDate, ctx.contract.endDate);
      return months !== null ? numeroEnLetras(months) : null;
    },
  },
  {
    path: "precio_inicial_numero",
    label: "Precio inicial (número)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.monthlyAmount ?? null,
  },
  {
    path: "precio_inicial_formato",
    label: "Precio inicial (formato ARS)",
    category: "contrato",
    resolver: (ctx) => formatARS(ctx.contract?.monthlyAmount),
  },
  {
    path: "precio_inicial_letras",
    label: "Precio inicial en letras",
    category: "contrato",
    resolver: (ctx) => montoEnLetras(ctx.contract?.monthlyAmount),
  },
  {
    path: "tipo_ajuste",
    label: "Tipo de ajuste (índice)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.adjustmentIndex ?? null,
  },
  {
    path: "periodo_ajuste_meses",
    label: "Período de ajuste en meses",
    category: "contrato",
    resolver: (ctx) =>
      ctx.contract?.adjustmentFrequency != null
        ? String(ctx.contract.adjustmentFrequency)
        : null,
  },
  {
    path: "dia_vencimiento",
    label: "Día de vencimiento del pago",
    category: "contrato",
    resolver: (ctx) =>
      ctx.contract?.paymentDay != null ? String(ctx.contract.paymentDay) : null,
  },
  {
    path: "modalidad_pago",
    label: "Modalidad de pago (A/B)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.paymentModality ?? null,
  },
  {
    path: "dia_gracia",
    label: "Días de gracia para el pago",
    category: "contrato",
    resolver: (ctx) => ctx.contract != null ? String(ctx.contract.graceDays ?? 0) : null,
  },
  {
    path: "porcentaje_comision_pago_electronico",
    label: "Comisión por pago electrónico (%)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.electronicPaymentFeePct ?? null,
  },
  {
    path: "porcentaje_interes_mora",
    label: "Interés por mora (%)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.lateInterestPct ?? null,
  },
  {
    path: "es_renovacion",
    label: "¿Es renovación?",
    category: "contrato",
    resolver: (ctx) => ctx.contract != null ? (ctx.contract.isRenewal ? "Sí" : "No") : null,
  },

  // ── Administradora ─────────────────────────────────────────────────────────
  {
    path: "nombre_administradora",
    label: "Nombre / razón social",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.legalName ?? null,
  },
  {
    path: "cuit_administradora",
    label: "CUIT de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.cuit ?? null,
  },
  {
    path: "domicilio_administradora",
    label: "Domicilio fiscal",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.fiscalAddress ?? null,
  },
  {
    path: "domicilio_administradora_calle",
    label: "Calle de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.fiscalAddressStreet ?? null,
  },
  {
    path: "domicilio_administradora_numero",
    label: "Número de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.fiscalAddressNumber ?? null,
  },
  {
    path: "domicilio_administradora_barrio",
    label: "Barrio de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.fiscalAddressZone ?? null,
  },
  {
    path: "domicilio_administradora_ciudad",
    label: "Ciudad de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.city ?? null,
  },
  {
    path: "domicilio_administradora_provincia",
    label: "Provincia de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.province ?? null,
  },
  {
    path: "telefono_administradora",
    label: "Teléfono de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.phone ?? null,
  },
  {
    path: "email_administradora",
    label: "Email de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.contactEmail ?? null,
  },
  {
    path: "matricula_administradora",
    label: "Matrícula profesional",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.licenseNumber ?? null,
  },
  {
    path: "firmante_administradora",
    label: "Nombre del firmante",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.signatory ?? null,
  },
  {
    path: "cbu_administradora",
    label: "CBU de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.bancoCBU ?? null,
  },
  {
    path: "alias_administradora",
    label: "Alias CBU de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.bancoAlias ?? null,
  },

  // ── Garante / Fiadoras ─────────────────────────────────────────────────────
  {
    path: "cantidad_fiadoras",
    label: "Cantidad de fiadores",
    category: "garante",
    resolver: (ctx) => String(ctx.guarantors.length),
  },
  {
    path: "nombre_completo_fiador",
    label: "Nombre completo del fiador (1°)",
    category: "garante",
    resolver: (ctx) => fullName(ctx.guarantors[0] ?? null),
  },

  // ── Garantía propietaria (primera garantía real) ──────────────────────────
  {
    path: "tiene_garantia_propietaria",
    label: "¿Tiene garantía propietaria?",
    category: "garante",
    resolver: (ctx) =>
      ctx.contract != null
        ? ctx.firstRealGuarantee != null ? "Sí" : "No"
        : null,
  },
  {
    path: "apellido_fiador_propietario",
    label: "Apellido del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerLastName ?? null,
  },
  {
    path: "nombres_fiador_propietario",
    label: "Nombres del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerFirstName ?? null,
  },
  {
    path: "dni_fiador_propietario",
    label: "DNI del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerDni ?? null,
  },
  {
    path: "cuil_fiador_propietario",
    label: "CUIL del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerCuit ?? null,
  },
  {
    path: "domicilio_fiador_propietario",
    label: "Domicilio del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerAddress ?? null,
  },
  {
    path: "email_fiador_propietario",
    label: "Email del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerEmail ?? null,
  },
  {
    path: "telefono_fiador_propietario",
    label: "Teléfono del fiador propietario",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.ownerPhone ?? null,
  },
  {
    path: "matricula_inmueble_garantia",
    label: "Matrícula del inmueble de garantía",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.propertyRegistryNumber ?? null,
  },
  {
    path: "catastro_inmueble_garantia",
    label: "Catastro del inmueble de garantía",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.propertyCadastralRef ?? null,
  },
  {
    path: "domicilio_inmueble_garantia",
    label: "Domicilio del inmueble de garantía",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.propertyAddress ?? null,
  },
  {
    path: "superficie_terreno_garantia",
    label: "Superficie del terreno de garantía",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.propertySurfaceLand ?? null,
  },
  {
    path: "superficie_cubierta_garantia",
    label: "Superficie cubierta de garantía",
    category: "garante",
    resolver: (ctx) => ctx.firstRealGuarantee?.propertySurfaceBuilt ?? null,
  },

  // Fiadoras 1–3 (generated)
  ...[1, 2, 3].flatMap((n): TemplateVariable[] => {
    const i = n - 1;
    const suffix = `fiador ${n}`;
    const mk = (
      field: string,
      label: string,
      get: (ctx: TemplateContext) => string | null | undefined
    ): TemplateVariable => ({
      path: `${field}_fiador_${n}`,
      label: `${label} ${suffix}`,
      category: "garante",
      resolver: (ctx) => get(ctx) ?? null,
    });
    return [
      mk("apellido",  "Apellido",   (ctx) => ctx.guarantors[i]?.lastName),
      mk("nombres",   "Nombres",    (ctx) => ctx.guarantors[i]?.firstName),
      mk("dni",       "DNI",        (ctx) => ctx.guarantors[i]?.dni),
      mk("cuil",      "CUIL",       (ctx) => ctx.guarantors[i]?.cuit),
      mk("domicilio", "Domicilio",  (ctx) => ctx.guarantors[i]?.address),
      mk("email",     "Email",      (ctx) => ctx.guarantors[i]?.email),
      mk("telefono",  "Teléfono",   (ctx) => ctx.guarantors[i]?.phone),
    ];
  }),
];

export const VARIABLE_PATHS = VARIABLES_CATALOG.map((v) => v.path);

export function resolveVariable(path: string, ctx: TemplateContext): string | null {
  const variable = VARIABLES_CATALOG.find((v) => v.path === path);
  return variable ? variable.resolver(ctx) : null;
}
