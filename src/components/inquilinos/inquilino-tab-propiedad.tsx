"use client";

import { useRouter } from "next/navigation";

interface PropiedadData {
  id: string;
  address: string;
  type: string;
  status: string;
  floorUnit: string | null;
  zone: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  price: string | null;
  title: string | null;
}

interface Props {
  propiedad: PropiedadData | null;
  propietarioNombre?: string;
  onVerPropietario?: () => void;
}

const tipoLabel: Record<string, string> = {
  departamento: "Departamento",
  casa: "Casa",
  local: "Local comercial",
  oficina: "Oficina",
  terreno: "Terreno",
  otro: "Otro",
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  alquilada: { label: "Ocupada", cls: "bg-success/10 text-success border-success/20" },
  disponible: { label: "Disponible", cls: "bg-blue/10 text-blue border-blue/20" },
  vendida: { label: "Vendida", cls: "bg-text-muted/10 text-text-muted border-border" },
};

export function InquilinoTabPropiedad({ propiedad, propietarioNombre, onVerPropietario }: Props) {
  const router = useRouter();

  if (!propiedad) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <div className="text-2xl opacity-40">🏢</div>
        <div className="text-[0.85rem] text-text-muted">Sin propiedad vinculada</div>
      </div>
    );
  }

  const status = statusLabel[propiedad.status] ?? {
    label: propiedad.status,
    cls: "bg-surface-highest text-text-muted border-border",
  };

  const direccionCompleta = propiedad.floorUnit
    ? `${propiedad.address}, ${propiedad.floorUnit}`
    : propiedad.address;

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Mini card — clickeable */}
      <div
        className="bg-surface-mid border border-border rounded-[8px] px-4 py-3.5 flex items-center gap-4 cursor-pointer hover:border-primary/30 hover:bg-primary-dark/5 transition-all"
        onClick={() => router.push(`/propiedades/${propiedad.id}`)}
      >
        <div className="w-9 h-9 bg-primary-dark/10 rounded-[8px] flex items-center justify-center text-base flex-shrink-0">
          🏢
        </div>
        <div className="flex-1">
          <div className="text-[0.85rem] font-semibold text-on-bg">{direccionCompleta}</div>
          <div className="text-[0.75rem] text-text-muted mt-0.5">
            {tipoLabel[propiedad.type] ?? propiedad.type}
            {propiedad.rooms ? ` · ${propiedad.rooms} amb` : ""}
            {propiedad.surface ? ` · ${propiedad.surface} m²` : ""}
          </div>
        </div>
        <span className={`text-[0.7rem] font-semibold px-2.5 py-1 rounded-full border ${status.cls}`}>
          {status.label}
        </span>
        <span className="text-text-muted text-lg ml-1">›</span>
      </div>

      {/* Datos de la propiedad */}
      <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <div className="text-[0.82rem] font-semibold text-on-bg">Datos de la propiedad</div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Tipo</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{tipoLabel[propiedad.type] ?? propiedad.type}</div>
          </div>
          {propiedad.surface && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Superficie</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propiedad.surface} m²</div>
            </div>
          )}
          {propiedad.rooms !== null && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Ambientes</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propiedad.rooms}</div>
            </div>
          )}
          {propiedad.bathrooms !== null && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Baños</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propiedad.bathrooms}</div>
            </div>
          )}
          {propiedad.zone && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Zona</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propiedad.zone}</div>
            </div>
          )}
          {propiedad.floorUnit && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Piso / Unidad</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propiedad.floorUnit}</div>
            </div>
          )}
          {propietarioNombre && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Propietario</div>
              <button
                onClick={onVerPropietario}
                className="text-[0.85rem] font-medium text-primary hover:underline text-left"
              >
                {propietarioNombre} →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
