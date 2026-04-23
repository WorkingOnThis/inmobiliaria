import type { InferSelectModel } from "drizzle-orm";
import type { property } from "@/db/schema/property";
import type { client } from "@/db/schema/client";
import type { contract } from "@/db/schema/contract";
import type { agency } from "@/db/schema/agency";

export type VariableCategory =
  | "propiedad"
  | "propietario"
  | "inquilino"
  | "contrato"
  | "administradora"
  | "garante";

export type TemplateContext = {
  property: InferSelectModel<typeof property> | null;
  owner: InferSelectModel<typeof client> | null;
  tenants: InferSelectModel<typeof client>[];
  guarantors: InferSelectModel<typeof client>[];
  contract: InferSelectModel<typeof contract> | null;
  agency: InferSelectModel<typeof agency> | null;
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

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const VARIABLES_CATALOG: TemplateVariable[] = [

  // ── Propiedad ──────────────────────────────────────────────────────────────
  {
    path: "propiedad.direccion_completa",
    label: "Dirección completa",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.address ?? null,
  },
  {
    path: "propiedad.barrio",
    label: "Barrio/zona",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.zone ?? null,
  },
  {
    path: "propiedad.unidad",
    label: "Piso/Unidad",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.floorUnit ?? null,
  },
  {
    path: "propiedad.tipo",
    label: "Tipo de inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.type ?? null,
  },
  {
    path: "propiedad.domicilio_calle",
    label: "Calle de la propiedad",
    category: "propiedad",
    resolver: () => null, // address is a single field — no split
  },
  {
    path: "propiedad.domicilio_numero",
    label: "Número de la propiedad",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.domicilio_ciudad",
    label: "Ciudad de la propiedad",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.domicilio_provincia",
    label: "Provincia de la propiedad",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.destino",
    label: "Destino del inmueble",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.tiene_expensas",
    label: "¿Tiene expensas?",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.responsable_expensas",
    label: "Responsable de expensas",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.responsable_dgr",
    label: "Responsable de DGR",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.responsable_municipal",
    label: "Responsable de tasa municipal",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.responsable_agua",
    label: "Responsable de agua",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.responsable_luz",
    label: "Responsable de luz",
    category: "propiedad",
    resolver: () => null,
  },
  {
    path: "propiedad.responsable_gas",
    label: "Responsable de gas",
    category: "propiedad",
    resolver: () => null,
  },

  // ── Propietario / Locador ──────────────────────────────────────────────────
  {
    path: "propietario.nombre_completo",
    label: "Nombre completo del propietario",
    category: "propietario",
    resolver: (ctx) => fullName(ctx.owner),
  },
  {
    path: "propietario.dni",
    label: "DNI del propietario",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.dni ?? null,
  },
  {
    path: "locador.nombres",
    label: "Nombres del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.firstName ?? null,
  },
  {
    path: "locador.apellido",
    label: "Apellido del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.lastName ?? null,
  },
  {
    path: "locador.dni",
    label: "DNI del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.dni ?? null,
  },
  {
    path: "locador.cuit",
    label: "CUIT del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.cuit ?? null,
  },
  {
    path: "locador.email",
    label: "Email del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.email ?? null,
  },
  {
    path: "locador.telefono",
    label: "Teléfono del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.phone ?? null,
  },
  {
    path: "locador.domicilio",
    label: "Domicilio del locador",
    category: "propietario",
    resolver: (ctx) => ctx.owner?.address ?? null,
  },
  {
    path: "locador.domicilio_calle",
    label: "Calle del locador",
    category: "propietario",
    resolver: () => null,
  },
  {
    path: "locador.domicilio_numero",
    label: "Número del domicilio del locador",
    category: "propietario",
    resolver: () => null,
  },
  {
    path: "locador.domicilio_ciudad",
    label: "Ciudad del locador",
    category: "propietario",
    resolver: () => null,
  },
  {
    path: "locador.domicilio_provincia",
    label: "Provincia del locador",
    category: "propietario",
    resolver: () => null,
  },

  // ── Inquilino / Locatario ──────────────────────────────────────────────────
  {
    path: "inquilino.nombre_completo",
    label: "Nombre completo del inquilino",
    category: "inquilino",
    resolver: (ctx) => fullName(ctx.tenants[0] ?? null),
  },
  {
    path: "inquilino.dni",
    label: "DNI del inquilino",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.dni ?? null,
  },
  {
    path: "locatario.nombres",
    label: "Nombres del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.firstName ?? null,
  },
  {
    path: "locatario.apellido",
    label: "Apellido del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.lastName ?? null,
  },
  {
    path: "locatario.dni",
    label: "DNI del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.dni ?? null,
  },
  {
    path: "locatario.cuit",
    label: "CUIT del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.cuit ?? null,
  },
  {
    path: "locatario.email",
    label: "Email del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.email ?? null,
  },
  {
    path: "locatario.telefono",
    label: "Teléfono del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.phone ?? null,
  },
  {
    path: "locatario.domicilio",
    label: "Domicilio del locatario",
    category: "inquilino",
    resolver: (ctx) => ctx.tenants[0]?.address ?? null,
  },
  {
    path: "locatario.domicilio_calle",
    label: "Calle del locatario",
    category: "inquilino",
    resolver: () => null,
  },
  {
    path: "locatario.domicilio_numero",
    label: "Número del domicilio del locatario",
    category: "inquilino",
    resolver: () => null,
  },
  {
    path: "locatario.domicilio_ciudad",
    label: "Ciudad del locatario",
    category: "inquilino",
    resolver: () => null,
  },
  {
    path: "locatario.domicilio_provincia",
    label: "Provincia del locatario",
    category: "inquilino",
    resolver: () => null,
  },

  // ── Contrato ───────────────────────────────────────────────────────────────
  {
    path: "contrato.fecha_inicio",
    label: "Fecha de inicio",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.startDate ?? null,
  },
  {
    path: "contrato.fecha_fin",
    label: "Fecha de fin",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.endDate ?? null,
  },
  {
    path: "contrato.plazo_meses",
    label: "Plazo en meses",
    category: "contrato",
    resolver: (ctx) => {
      if (!ctx.contract?.startDate || !ctx.contract?.endDate) return null;
      const months = monthsBetween(ctx.contract.startDate, ctx.contract.endDate);
      return months !== null ? String(months) : null;
    },
  },
  {
    path: "contrato.duracion_meses",
    label: "Duración en meses",
    category: "contrato",
    resolver: (ctx) => {
      if (!ctx.contract?.startDate || !ctx.contract?.endDate) return null;
      const months = monthsBetween(ctx.contract.startDate, ctx.contract.endDate);
      return months !== null ? String(months) : null;
    },
  },
  {
    path: "contrato.monto_alquiler",
    label: "Monto mensual de alquiler",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.monthlyAmount ?? null,
  },
  {
    path: "contrato.precio_inicial_numero",
    label: "Precio inicial (número)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.monthlyAmount ?? null,
  },
  {
    path: "contrato.precio_inicial_formato",
    label: "Precio inicial (formato ARS)",
    category: "contrato",
    resolver: (ctx) => formatARS(ctx.contract?.monthlyAmount),
  },
  {
    path: "contrato.precio_inicial_letras",
    label: "Precio inicial en letras",
    category: "contrato",
    resolver: () => null, // requires number-to-words library
  },
  {
    path: "contrato.tipo_ajuste",
    label: "Tipo de ajuste (índice)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.adjustmentIndex ?? null,
  },
  {
    path: "contrato.periodo_ajuste_meses",
    label: "Período de ajuste en meses",
    category: "contrato",
    resolver: (ctx) =>
      ctx.contract?.adjustmentFrequency != null
        ? String(ctx.contract.adjustmentFrequency)
        : null,
  },
  {
    path: "contrato.dia_vencimiento",
    label: "Día de vencimiento del pago",
    category: "contrato",
    resolver: (ctx) =>
      ctx.contract?.paymentDay != null ? String(ctx.contract.paymentDay) : null,
  },
  {
    path: "contrato.modalidad_pago",
    label: "Modalidad de pago (A/B)",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.paymentModality ?? null,
  },
  {
    path: "contrato.dia_gracia",
    label: "Días de gracia para el pago",
    category: "contrato",
    resolver: () => null,
  },
  {
    path: "contrato.porcentaje_comision",
    label: "Porcentaje comisión pago electrónico",
    category: "contrato",
    resolver: () => null,
  },
  {
    path: "contrato.porcentaje_interes_mora",
    label: "Porcentaje interés por mora",
    category: "contrato",
    resolver: () => null,
  },
  {
    path: "contrato.es_renovacion",
    label: "¿Es renovación?",
    category: "contrato",
    resolver: () => null,
  },
  {
    path: "agencia.razon_social",
    label: "Razón social de la agencia",
    category: "contrato",
    resolver: (ctx) => ctx.agency?.legalName ?? null,
  },

  // ── Administradora ─────────────────────────────────────────────────────────
  {
    path: "administradora.nombre",
    label: "Nombre / razón social",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.legalName ?? null,
  },
  {
    path: "administradora.cuit",
    label: "CUIT de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.cuit ?? null,
  },
  {
    path: "administradora.domicilio",
    label: "Domicilio fiscal",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.fiscalAddress ?? null,
  },
  {
    path: "administradora.ciudad",
    label: "Ciudad de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.city ?? null,
  },
  {
    path: "administradora.provincia",
    label: "Provincia de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.province ?? null,
  },
  {
    path: "administradora.telefono",
    label: "Teléfono de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.phone ?? null,
  },
  {
    path: "administradora.email",
    label: "Email de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.contactEmail ?? null,
  },
  {
    path: "administradora.matricula",
    label: "Matrícula profesional",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.licenseNumber ?? null,
  },
  {
    path: "administradora.firmante",
    label: "Nombre del firmante",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.signatory ?? null,
  },
  {
    path: "administradora.cbu",
    label: "CBU de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.bancoCBU ?? null,
  },
  {
    path: "administradora.alias",
    label: "Alias CBU de la administradora",
    category: "administradora",
    resolver: (ctx) => ctx.agency?.bancoAlias ?? null,
  },

  // ── Garante / Fiadoras ─────────────────────────────────────────────────────
  {
    path: "garante.nombre_completo",
    label: "Nombre completo del garante",
    category: "garante",
    resolver: (ctx) => fullName(ctx.guarantors[0] ?? null),
  },
  {
    path: "garante.dni",
    label: "DNI del garante",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.dni ?? null,
  },
  {
    path: "garante.domicilio",
    label: "Domicilio del garante",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.address ?? null,
  },
  {
    path: "garante.cantidad",
    label: "Cantidad de garantes",
    category: "garante",
    resolver: (ctx) => String(ctx.guarantors.length),
  },

  // Fiadora 1
  {
    path: "fiadora1.apellido",
    label: "Apellido fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.lastName ?? null,
  },
  {
    path: "fiadora1.nombres",
    label: "Nombres fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.firstName ?? null,
  },
  {
    path: "fiadora1.dni",
    label: "DNI fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.dni ?? null,
  },
  {
    path: "fiadora1.cuit",
    label: "CUIT fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.cuit ?? null,
  },
  {
    path: "fiadora1.domicilio",
    label: "Domicilio fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.address ?? null,
  },
  {
    path: "fiadora1.email",
    label: "Email fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.email ?? null,
  },
  {
    path: "fiadora1.telefono",
    label: "Teléfono fiadora 1",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[0]?.phone ?? null,
  },

  // Fiadora 2
  {
    path: "fiadora2.apellido",
    label: "Apellido fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.lastName ?? null,
  },
  {
    path: "fiadora2.nombres",
    label: "Nombres fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.firstName ?? null,
  },
  {
    path: "fiadora2.dni",
    label: "DNI fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.dni ?? null,
  },
  {
    path: "fiadora2.cuit",
    label: "CUIT fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.cuit ?? null,
  },
  {
    path: "fiadora2.domicilio",
    label: "Domicilio fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.address ?? null,
  },
  {
    path: "fiadora2.email",
    label: "Email fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.email ?? null,
  },
  {
    path: "fiadora2.telefono",
    label: "Teléfono fiadora 2",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[1]?.phone ?? null,
  },

  // Fiadora 3
  {
    path: "fiadora3.apellido",
    label: "Apellido fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.lastName ?? null,
  },
  {
    path: "fiadora3.nombres",
    label: "Nombres fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.firstName ?? null,
  },
  {
    path: "fiadora3.dni",
    label: "DNI fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.dni ?? null,
  },
  {
    path: "fiadora3.cuit",
    label: "CUIT fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.cuit ?? null,
  },
  {
    path: "fiadora3.domicilio",
    label: "Domicilio fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.address ?? null,
  },
  {
    path: "fiadora3.email",
    label: "Email fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.email ?? null,
  },
  {
    path: "fiadora3.telefono",
    label: "Teléfono fiadora 3",
    category: "garante",
    resolver: (ctx) => ctx.guarantors[2]?.phone ?? null,
  },
];

export const VARIABLE_PATHS = VARIABLES_CATALOG.map((v) => v.path);

export function resolveVariable(path: string, ctx: TemplateContext): string | null {
  const variable = VARIABLES_CATALOG.find((v) => v.path === path);
  return variable ? variable.resolver(ctx) : null;
}
