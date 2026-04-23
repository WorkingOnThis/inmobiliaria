"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

interface PropiedadData {
  id: string;
  address: string;
  type: string;
  rentalStatus: string;
  saleStatus: string | null;
  floorUnit: string | null;
  zone: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  rentalPrice: string | null;
  rentalPriceCurrency: string;
  salePrice: string | null;
  salePriceCurrency: string;
  title: string | null;
}

interface Props {
  property: PropiedadData | null;
  ownerName?: string;
  onVerOwner?: () => void;
}

const tipoLabel: Record<string, string> = {
  departamento: "Departamento",
  casa: "Casa",
  local: "Local comercial",
  oficina: "Oficina",
  terreno: "Terreno",
  otro: "Otro",
};

const statusLabel: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  alquilada: { label: "Ocupada",    variant: "active" },
  disponible: { label: "Disponible", variant: "reserved" },
  vendida:    { label: "Vendida",    variant: "draft" },
};

export function TenantTabProperty({ property, ownerName, onVerOwner }: Props) {
  const router = useRouter();

  if (!property) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <div className="text-2xl opacity-40">🏢</div>
        <div className="text-[0.85rem] text-muted-foreground">Sin property vinculada</div>
      </div>
    );
  }

  const RENTAL_LABELS: Record<string, { label: string; variant: StatusBadgeVariant }> = {
    available:   { label: "Disponible",   variant: "reserved" },
    rented:      { label: "Alquilada",    variant: "active" },
    reserved:    { label: "Reservada",    variant: "reserved" },
    maintenance: { label: "Mantenimiento", variant: "draft" },
  };
  const status = RENTAL_LABELS[property.rentalStatus] ?? {
    label: property.rentalStatus,
    variant: "draft" as StatusBadgeVariant,
  };

  const direccionCompleta = property.floorUnit
    ? `${property.address}, ${property.floorUnit}`
    : property.address;

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Mini card — clickeable */}
      <Card
        className="rounded-[8px] bg-surface-mid cursor-pointer hover:border-primary/30 hover:bg-primary-dark/5 transition-all py-0 gap-0"
        onClick={() => router.push(`/propiedades/${property.id}`)}
      >
        <CardContent className="px-4 py-3.5 flex items-center gap-4">
          <div className="size-9 bg-primary-dark/10 rounded-[8px] flex items-center justify-center text-base flex-shrink-0">
            🏢
          </div>
          <div className="flex-1">
            <div className="text-[0.85rem] font-semibold text-on-bg">{direccionCompleta}</div>
            <div className="text-[0.75rem] text-muted-foreground mt-0.5">
              {tipoLabel[property.type] ?? property.type}
              {property.rooms ? ` · ${property.rooms} amb` : ""}
              {property.surface ? ` · ${property.surface} m²` : ""}
            </div>
          </div>
          <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
          <span className="text-muted-foreground text-lg ml-1">›</span>
        </CardContent>
      </Card>

      {/* Datos de la property */}
      <Card className="rounded-[10px] border py-0 gap-0 overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0">
          <CardTitle className="text-[0.82rem] font-semibold">Datos de la property</CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Tipo</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{tipoLabel[property.type] ?? property.type}</div>
          </div>
          {property.surface && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Superficie</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{property.surface} m²</div>
            </div>
          )}
          {property.rooms !== null && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Ambientes</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{property.rooms}</div>
            </div>
          )}
          {property.bathrooms !== null && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Baños</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{property.bathrooms}</div>
            </div>
          )}
          {property.zone && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Zona</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{property.zone}</div>
            </div>
          )}
          {property.floorUnit && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Piso / Unidad</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{property.floorUnit}</div>
            </div>
          )}
          {ownerName && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Propietario</div>
              <button
                onClick={onVerOwner}
                className="text-[0.85rem] font-medium text-primary hover:underline text-left"
              >
                {ownerName} →
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
