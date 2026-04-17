"use client";

import Link from "next/link";
import { Building2, Plus, Home, BedDouble, Bath, Ruler, FileText } from "lucide-react";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";

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

interface PropietarioTabPropiedadesProps {
  propietarioId: string;
  propiedades: PropertyData[];
  contratosActivos: ContratoActivo[];
}

function formatPropertyType(type: string): string {
  const map: Record<string, string> = {
    casa: "Casa",
    depto: "Departamento",
    terreno: "Terreno",
    local: "Local comercial",
    oficina: "Oficina",
    cochera: "Cochera",
  };
  return map[type] ?? type;
}

function getPropertyStatusBadge(status: string): { variant: StatusBadgeVariant; label: string } {
  switch (status) {
    case "available": return { variant: "available", label: "Disponible" };
    case "rented":    return { variant: "rented",    label: "Alquilado" };
    case "sold":      return { variant: "baja",      label: "Vendido" };
    case "reserved":  return { variant: "reserved",  label: "Reservado" };
    default:          return { variant: "draft",     label: status };
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
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function PropietarioTabPropiedades({
  propietarioId,
  propiedades,
  contratosActivos,
}: PropietarioTabPropiedadesProps) {
  if (propiedades.length === 0) {
    return (
      <div className="p-7 flex flex-col gap-5">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Building2 size={40} className="text-[#333537]" />
          <div className="text-center">
            <p className="text-[0.9rem] font-semibold text-[#a8a9ac] mb-1">
              Sin propiedades cargadas
            </p>
            <p className="text-[0.78rem] text-[#6b6d70]">
              Este propietario no tiene propiedades asociadas todavía.
            </p>
          </div>
          <Link
            href={`/propiedades/nueva?propietarioId=${propietarioId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#ffb4a2] text-[#561100] text-[0.78rem] font-semibold rounded-[12px] hover:brightness-110 transition-all"
          >
            <Plus size={14} />
            Agregar propiedad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70]">
          {propiedades.length} {propiedades.length === 1 ? "propiedad" : "propiedades"}
        </span>
        <Link
          href={`/propiedades/nueva?propietarioId=${propietarioId}`}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#ffb4a2] text-[#561100] text-[0.72rem] font-semibold rounded-[12px] hover:brightness-110 transition-all"
        >
          <Plus size={13} />
          Agregar propiedad
        </Link>
      </div>

      {/* Property cards */}
      <div className="flex flex-col gap-4">
        {propiedades.map((prop) => {
          const { variant: statusVariant, label: statusLabel } = getPropertyStatusBadge(prop.status);
          const contratos = contratosActivos.filter((c) => c.propertyId === prop.id);

          return (
            <Link
              key={prop.id}
              href={`/propiedades/${prop.id}`}
              className="block bg-[#191c1e] border border-white/[0.07] rounded-[18px] p-5 hover:border-white/[0.14] hover:bg-[#1d2022] transition-all group"
            >
              {/* Top row: address + status */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Home size={15} className="text-[#6b6d70] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[0.9rem] font-semibold text-[#e1e2e4] group-hover:text-[#ffb4a2] transition-colors truncate">
                      {prop.address}
                    </p>
                    {prop.title && (
                      <p className="text-[0.72rem] text-[#6b6d70] truncate">{prop.title}</p>
                    )}
                  </div>
                </div>
                <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
              </div>

              {/* Type + zone + details */}
              <div className="flex items-center gap-3 flex-wrap mb-3 pl-[22px]">
                <span className="text-[0.72rem] text-[#6b6d70]">
                  {formatPropertyType(prop.type)}
                </span>
                {prop.zone && (
                  <>
                    <span className="text-[#333537]">·</span>
                    <span className="text-[0.72rem] text-[#6b6d70]">{prop.zone}</span>
                  </>
                )}
                {prop.floorUnit && (
                  <>
                    <span className="text-[#333537]">·</span>
                    <span className="text-[0.72rem] text-[#6b6d70]">{prop.floorUnit}</span>
                  </>
                )}
              </div>

              {/* Property features */}
              {(prop.rooms || prop.bathrooms || prop.surface) && (
                <div className="flex items-center gap-4 pl-[22px] mb-3">
                  {prop.rooms && (
                    <span className="flex items-center gap-1 text-[0.72rem] text-[#a8a9ac]">
                      <BedDouble size={12} className="text-[#6b6d70]" />
                      {prop.rooms} amb.
                    </span>
                  )}
                  {prop.bathrooms && (
                    <span className="flex items-center gap-1 text-[0.72rem] text-[#a8a9ac]">
                      <Bath size={12} className="text-[#6b6d70]" />
                      {prop.bathrooms} baños
                    </span>
                  )}
                  {prop.surface && (
                    <span className="flex items-center gap-1 text-[0.72rem] text-[#a8a9ac]">
                      <Ruler size={12} className="text-[#6b6d70]" />
                      {prop.surface} m²
                    </span>
                  )}
                </div>
              )}

              {/* Active contracts */}
              {contratos.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex flex-col gap-2 pl-[22px]">
                    <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#6b6d70]">
                      Contratos activos
                    </span>
                    {contratos.map((c) => (
                      <div key={c.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={11} className="text-[#6b6d70]" />
                          <span className="text-[0.75rem] text-[#a8a9ac]">
                            {c.contractNumber}
                          </span>
                          <span className="text-[0.7rem] text-[#6b6d70]">
                            {formatDate(c.startDate)} → {formatDate(c.endDate)}
                          </span>
                        </div>
                        <span className="text-[0.78rem] font-semibold text-[#ffb4a2]">
                          {formatMoney(c.monthlyAmount)}/mes
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
