// Catálogo de variables disponibles para plantillas de documentos.
//
// Variables disponibles (16 en total):
//
//  PROPIEDAD
//   [[propiedad.direccion_completa]]  Dirección completa del inmueble  → property.address
//   [[propiedad.barrio]]              Barrio/zona                       → property.zone
//   [[propiedad.unidad]]              Piso/Unidad (depto)               → property.floorUnit
//   [[propiedad.tipo]]                Tipo de inmueble                  → property.type
//
//  PROPIETARIO
//   [[propietario.nombre_completo]]   Nombre del propietario            → client.firstName + lastName
//   [[propietario.dni]]               DNI del propietario               → client.dni
//
//  INQUILINO  (primer inquilino del contrato)
//   [[inquilino.nombre_completo]]     Nombre del inquilino              → client.firstName + lastName
//   [[inquilino.dni]]                 DNI del inquilino                 → client.dni
//
//  CONTRATO
//   [[contrato.fecha_inicio]]         Fecha de inicio                   → contract.startDate
//   [[contrato.fecha_fin]]            Fecha de fin                      → contract.endDate
//   [[contrato.plazo_meses]]          Plazo en meses (derivado)         → endDate - startDate
//   [[contrato.monto_alquiler]]       Monto mensual de alquiler         → contract.monthlyAmount
//
//  AGENCIA
//   [[agencia.razon_social]]          Razón social de la agencia        → agency.legalName
//
//  GARANTE  (primer garante del contrato)
//   [[garante.nombre_completo]]       Nombre del garante                → client.firstName + lastName
//   [[garante.dni]]                   DNI del garante                   → client.dni
//   [[garante.domicilio]]             Domicilio del garante             → client.address

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

export const VARIABLES_CATALOG: TemplateVariable[] = [
  // ── Propiedad ──────────────────────────────────────────────────────────────
  {
    path: "propiedad.direccion_completa",
    label: "Dirección completa del inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.address ?? null,
  },
  {
    path: "propiedad.barrio",
    label: "Barrio/zona del inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.zone ?? null,
  },
  {
    path: "propiedad.unidad",
    label: "Piso/Unidad del inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.floorUnit ?? null,
  },
  {
    path: "propiedad.tipo",
    label: "Tipo de inmueble",
    category: "propiedad",
    resolver: (ctx) => ctx.property?.type ?? null,
  },

  // ── Propietario ────────────────────────────────────────────────────────────
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

  // ── Inquilino ──────────────────────────────────────────────────────────────
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

  // ── Contrato ───────────────────────────────────────────────────────────────
  {
    path: "contrato.fecha_inicio",
    label: "Fecha de inicio del contrato",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.startDate ?? null,
  },
  {
    path: "contrato.fecha_fin",
    label: "Fecha de fin del contrato",
    category: "contrato",
    resolver: (ctx) => ctx.contract?.endDate ?? null,
  },
  {
    path: "contrato.plazo_meses",
    label: "Plazo del contrato en meses",
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
    path: "agencia.razon_social",
    label: "Razón social de la agencia",
    category: "contrato",
    resolver: (ctx) => ctx.agency?.legalName ?? null,
  },

  // ── Garante ────────────────────────────────────────────────────────────────
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
];

export const VARIABLE_PATHS = VARIABLES_CATALOG.map((v) => v.path);

export function resolveVariable(path: string, ctx: TemplateContext): string | null {
  const variable = VARIABLES_CATALOG.find((v) => v.path === path);
  return variable ? variable.resolver(ctx) : null;
}
