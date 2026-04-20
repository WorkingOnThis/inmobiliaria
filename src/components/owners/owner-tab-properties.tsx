"use client";

import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PropertyData {
  id: string;
  title: string | null;
  address: string;
  price: string | null;
  type: string;
  status: string;
  zone: string | null;
  floorUnit: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  ownerId: string;
}

interface ContratoActivo {
  id: string;
  contractNumber: string;
  propertyId: string;
  status: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyAmount: string;
}

interface OwnerTabPropertiesProps {
  ownerId: string;
  propiedades: PropertyData[];
  contratosActivos: ContratoActivo[];
}

function formatPropertyType(type: string): string {
  const map: Record<string, string> = {
    casa:    "Casa",
    depto:   "Departamento",
    terreno: "Terreno",
    local:   "Local comercial",
    oficina: "Oficina",
    cochera: "Cochera",
  };
  return map[type] ?? type;
}

function getStatusPill(status: string): { cls: string; label: string } {
  switch (status) {
    case "available": return { cls: "status-pill status-available", label: "Disponible" };
    case "rented":    return { cls: "status-pill status-rented",    label: "Alquilado" };
    case "reserved":  return { cls: "status-pill status-reserved",  label: "Reservado" };
    case "sold":      return { cls: "status-pill status-baja",      label: "Vendido" };
    default:          return { cls: "status-pill status-draft",     label: status };
  }
}

function formatMoney(value: string | number | null): string {
  if (!value) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  const [year, month] = iso.split("-");
  return `${month}/${year}`;
}

function PropertyInitial({ address }: { address: string }) {
  const initial = (address ?? "P")[0].toUpperCase();
  return (
    <div
      className="w-full h-28 flex items-center justify-center text-white text-[32px] font-bold select-none"
      style={{ background: "var(--gradient-property)" }}
    >
      {initial}
    </div>
  );
}

export function OwnerTabProperties({
  ownerId,
  propiedades,
  contratosActivos,
}: OwnerTabPropertiesProps) {
  if (propiedades.length === 0) {
    return (
      <div className="p-7 flex flex-col items-center justify-center py-20 gap-4">
        <Building2 size={40} className="text-muted-foreground" />
        <div className="text-center">
          <p className="text-[0.9rem] font-semibold text-text-secondary mb-1">Sin propiedades cargadas</p>
          <p className="text-[0.78rem] text-muted-foreground">Este propietario no tiene propiedades asociadas todavía.</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/propiedades/nueva?ownerId=${ownerId}`}>
            <Plus size={14} /> Agregar propiedad
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {propiedades.length} {propiedades.length === 1 ? "propiedad" : "propiedades"}
        </span>
        <Button asChild size="sm">
          <Link href={`/propiedades/nueva?ownerId=${ownerId}`}>
            <Plus size={13} /> Agregar propiedad
          </Link>
        </Button>
      </div>

      {/* Grid: xl:3 md:2 sm:1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[14px]">
        {propiedades.map((prop) => {
          const { cls: statusCls, label: statusLabel } = getStatusPill(prop.status);
          const contratos = contratosActivos.filter((c) => c.propertyId === prop.id);
          const contrato = contratos[0] ?? null;

          const subtitle = [
            prop.zone,
            prop.rooms    ? `${prop.rooms} amb.`  : null,
            prop.surface  ? `${prop.surface} m²`  : null,
          ].filter(Boolean).join(" · ");

          return (
            <Link
              key={prop.id}
              href={`/propiedades/${prop.id}`}
              className="block bg-surface border border-border rounded-[10px] overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              {/* Thumbnail */}
              <PropertyInitial address={prop.address} />

              {/* Body */}
              <div className="p-3 flex flex-col gap-2">
                <h4 className="text-[14px] font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                  {prop.address}
                </h4>

                {subtitle && (
                  <p className="text-[12px] text-text-secondary">{subtitle}</p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className={cn(statusCls)}>{statusLabel}</span>
                  {contrato && (
                    <span className="font-mono text-[12px] text-on-surface tabular-nums">
                      {formatMoney(contrato.monthlyAmount)}/mes
                    </span>
                  )}
                </div>

                {contrato && (
                  <div
                    className="text-[12px] text-muted-foreground border-t border-border pt-2 mt-0.5"
                  >
                    {/* Inquilino no disponible en los datos actuales — mostrar vencimiento */}
                    <span className="font-mono tabular-nums">
                      {formatPropertyType(prop.type)} · vence {formatDate(contrato.endDate)}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
