"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  type ServiceType,
  type ServiceStatus,
} from "@/lib/services/constants";
import { StatusBadge } from "@/components/ui/status-badge";

// ── Types ──────────────────────────────────────────────────────────────
type ServiceSummary = {
  id: string;
  type: ServiceType;
  status: ServiceStatus;
  daysWithoutReceipt: number;
  activatesBlock: boolean;
};

type PropertySummary = {
  propertyId: string;
  propertyAddress: string | null;
  tenantName?: string;
  tenantId?: string;
  services: ServiceSummary[];
  worstStatus: ServiceStatus;
  alertsCount: number;
};

type KPIs = {
  totalPropiedades: number;
  alDia: number;
  enAlerta: number;
  bloqueadas: number;
  pendientes: number;
};

type PropiedadResumen = {
  propertyId: string;
  propertyAddress: string | null;
  inquilinoNombre?: string;
  inquilinoId?: string;
  servicios: Array<{
    id: string;
    tipo: ServiceType;
    estado: ServiceStatus;
    diasSinComprobante: number;
  }>;
  peorEstado: ServiceStatus;
  alertasCount: number;
};

// ── Helpers de período ──────────────────────────────────────────────────
function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const fecha = new Date(year, month - 1, 1);
  return fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentPeriod(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

// ── Chip de estado del servicio ─────────────────────────────────────────
function ServicioChip({
  type,
  estado,
  daysWithoutReceipt,
  onClick,
}: {
  type: ServiceType;
  estado: ServiceStatus;
  daysWithoutReceipt: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const icon = SERVICE_TYPE_ICONS[type] ?? "📋";
  const label = (SERVICE_TYPE_LABELS[type] ?? type)
    .replace("Energía eléctrica", "Luz")
    .replace("Gas natural", "Gas")
    .replace("ABL / Impuesto inmobiliario", "ABL")
    .replace("Seguro del inmueble", "Seguro");

  const diasLabel = daysWithoutReceipt > 0 ? ` ${daysWithoutReceipt}d` : "";

  const clases: Record<ServiceStatus, string> = {
    current: "bg-income-dim text-income",
    pending: "bg-muted text-muted-foreground",
    alert: "bg-mustard-dim text-mustard",
    blocked: "bg-destructive-dim text-destructive",
  };

  const dotClases: Record<ServiceStatus, string> = {
    current: "bg-current",
    pending: "bg-current",
    alert: "bg-current",
    blocked: "bg-current",
  };

  return (
    <span
      onClick={onClick}
      title={onClick ? `Ver detalle de ${label}` : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.63rem] font-bold transition-all ${clases[estado]} ${onClick ? "cursor-pointer ring-1 ring-transparent hover:ring-current/30 hover:scale-105 active:scale-95" : ""}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClases[estado]}`} />
      {label}
      {diasLabel}
      {estado === "blocked" && " 🔒"}
    </span>
  );
}

// ── Badge resumen de alertas ────────────────────────────────────────────
function AlertasBadge({ estado, count }: { estado: ServiceStatus; count: number }) {
  if (estado === "current") {
    return <StatusBadge variant="income">Al día</StatusBadge>;
  }
  if (estado === "blocked") {
    return (
      <StatusBadge variant="baja">
        Bloqueado{count > 1 ? ` (${count})` : ""}
      </StatusBadge>
    );
  }
  if (estado === "alert") {
    return <StatusBadge variant="suspended">{count} en alerta</StatusBadge>;
  }
  return (
    <StatusBadge variant="draft">
      {count} pendiente{count > 1 ? "s" : ""}
    </StatusBadge>
  );
}

// ── Main component ────────────────────────────────────────────────
export function ServicesControlPanel() {
  const router = useRouter();
  const [period, setPeriod] = useState(currentPeriod);
  const [filter, setFilter] = useState<"todos" | ServiceStatus>("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // KPIs
  const { data: resumen } = useQuery({
    queryKey: ["servicios-resumen", period],
    queryFn: async () => {
      const res = await fetch(`/api/services/summary?period=${period}`);
      if (!res.ok) throw new Error("Error al cargar resumen");
      return res.json() as Promise<{ kpis: KPIs; period: string }>;
    },
  });

  // Lista de servicios agrupados por propiedad
  const { data, isLoading } = useQuery({
    queryKey: ["servicios", period, page, filter],
    queryFn: async () => {
      const estadoParam = filter !== "todos" ? `&estado=${filter}` : "";
      const res = await fetch(
        `/api/services?period=${period}&page=${page}&limit=${limit}${estadoParam}`
      );
      if (!res.ok) throw new Error("Error al cargar servicios");
      return res.json() as Promise<{
        items: Array<{
          id: string;
          tipo: ServiceType;
          company: string | null;
          accountNumber: string | null;
          holder: string | null;
          holderType: string;
          paymentResponsible: string;
          dueDay: number | null;
          triggersBlock: boolean;
          estado: ServiceStatus;
          diasSinComprobante: number;
          periodo: string;
          propertyId: string;
          propertyAddress: string | null;
          inquilinoNombre: string | null;
          inquilinoId: string | null;
          servicios: Array<{
            id: string;
            tipo: ServiceType;
            estado: ServiceStatus;
            daysWithoutReceipt: number;
          }>;
          peorEstado: ServiceStatus;
          alertasCount: number;
        }>;
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>;
    },
  });

  // Agrupar items por propiedad
  const propiedades: PropiedadResumen[] = [];
  const mapaProps = new Map<string, PropiedadResumen>();

  for (const item of data?.items ?? []) {
    if (!mapaProps.has(item.propertyId)) {
      mapaProps.set(item.propertyId, {
        propertyId: item.propertyId,
        propertyAddress: item.propertyAddress,
        inquilinoNombre: item.inquilinoNombre ?? undefined,
        inquilinoId: item.inquilinoId ?? undefined,
        servicios: [],
        peorEstado: "current",
        alertasCount: 0,
      });
      propiedades.push(mapaProps.get(item.propertyId)!);
    }
    const prop = mapaProps.get(item.propertyId)!;
    prop.servicios.push(item);
    // Actualizar peor estado
    const prioridad = { blocked: 4, alert: 3, pending: 2, current: 1 };
    if ((prioridad[item.estado] ?? 0) > (prioridad[prop.peorEstado] ?? 0)) {
      prop.peorEstado = item.estado;
    }
    if (item.estado === "alert" || item.estado === "blocked") {
      prop.alertasCount++;
    }
  }

  // Filtrar por búsqueda en cliente
  const propiedadesFiltradas = search.trim()
    ? propiedades.filter((p) =>
      p.propertyAddress?.toLowerCase().includes(search.toLowerCase())
    )
    : propiedades;

  const kpis = resumen?.kpis;
  const pagination = data?.pagination;

  const filters: { key: "todos" | ServiceStatus; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "current", label: "Al día" },
    { key: "pending", label: "Pendientes" },
    { key: "alert", label: "En alerta" },
    { key: "blocked", label: "Bloqueados" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[1.35rem] font-bold tracking-tight">
            Control de Servicios
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Estado de comprobantes por propiedad en el período actual
          </p>
        </div>

        {/* Selector de período */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPeriod(previousPeriod(period)); setPage(1); }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-mid text-text-muted transition-colors hover:bg-surface-high hover:text-on-bg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[140px] rounded-xl border border-border bg-surface-mid px-4 py-1.5 text-center text-sm font-semibold capitalize">
            {periodLabel(period)}
          </div>
          <button
            onClick={() => { setPeriod(nextPeriod(period)); setPage(1); }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-mid text-text-muted transition-colors hover:bg-surface-high hover:text-on-bg"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-transparent bg-primary-dark p-5">
          <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-widest text-primary/60">
            Propiedades con servicio
          </p>
          <p className="font-headline text-3xl font-bold tracking-tight text-white">
            {kpis?.totalPropiedades ?? "—"}
          </p>
          <p className="mt-1 text-xs text-primary/50">Servicios activos este período</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Al día
          </p>
          <p className="font-headline text-3xl font-bold tracking-tight text-income">
            {kpis?.alDia ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Todos los comprobantes cargados</p>
        </div>

        <div className="rounded-2xl border border-mustard/20 bg-mustard-dim p-5">
          <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-widest text-mustard/70">
            ⚠ En alerta (30+ días)
          </p>
          <p className="font-headline text-3xl font-bold tracking-tight text-mustard">
            {kpis?.enAlerta ?? "—"}
          </p>
          <p className="mt-1 text-xs text-mustard/60">Riesgo de bloqueo de alquiler</p>
        </div>

        <div className="rounded-2xl border border-destructive/20 bg-destructive-dim p-5">
          <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-widest text-destructive/70">
            🔒 Bloqueados
          </p>
          <p className="font-headline text-3xl font-bold tracking-tight text-destructive">
            {kpis?.bloqueadas ?? "—"}
          </p>
          <p className="mt-1 text-xs text-destructive/60">Alquiler retenido — requiere acción</p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-muted-foreground">
        <span className="font-semibold text-secondary-foreground">Estados:</span>
        {[
          { color: "bg-income", label: "Al día" },
          { color: "bg-muted-foreground", label: "Pendiente" },
          { color: "bg-mustard", label: "En alerta (30+ días)" },
          { color: "bg-destructive", label: "Bloqueado (alquiler retenido)" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por dirección…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <div className="flex gap-1.5">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold transition-colors ${filter === key
                ? key === "alert"
                  ? "border-mustard/25 bg-mustard-dim text-mustard"
                  : key === "blocked"
                    ? "border-destructive/25 bg-destructive-dim text-destructive"
                    : "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-transparent text-text-muted hover:text-text-secondary"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Propiedades
          </span>
          <span className="text-xs text-muted-foreground">
            {propiedadesFiltradas.length} {propiedadesFiltradas.length === 1 ? "propiedad" : "propiedades"}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : propiedadesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Zap className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay propiedades con servicios configurados</p>
            <p className="text-xs text-muted-foreground/60">
              Ingresá a una propiedad y agregá servicios desde el tab "Servicios"
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Propiedad", "Inquilino", "Servicios del período", "Alertas", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border bg-surface-mid px-3.5 py-2.5 text-left text-[0.67rem] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {propiedadesFiltradas.map((prop) => (
                <tr
                  key={prop.propertyId}
                  onClick={() => router.push(`/propiedades/${prop.propertyId}`)}
                  className={`group cursor-pointer transition-colors hover:bg-border/50 ${prop.peorEstado === "blocked"
                    ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-l-destructive"
                    : prop.peorEstado === "alert"
                      ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-l-mustard"
                      : ""
                    }`}
                >
                  <td className="border-b border-border px-3.5 py-3">
                    <div className="font-semibold">{prop.propertyAddress ?? "Sin dirección"}</div>
                  </td>
                  <td
                    className="border-b border-border px-3.5 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {prop.inquilinoNombre && prop.inquilinoId ? (
                      <button
                        onClick={() => router.push(`/inquilinos/${prop.inquilinoId}`)}
                        className="group/inq flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                      >
                        {prop.inquilinoNombre}
                        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover/inq:opacity-100" />
                      </button>
                    ) : prop.inquilinoNombre ? (
                      <span className="text-sm text-on-bg">{prop.inquilinoNombre}</span>
                    ) : (
                      <span className="text-[0.75rem] text-text-muted italic">Sin inquilino</span>
                    )}
                  </td>
                  <td
                    className="border-b border-border px-3.5 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {prop.servicios.map((s) => (
                        <ServicioChip
                          key={s.id}
                          type={s.tipo as ServiceType}
                          estado={s.estado}
                          daysWithoutReceipt={s.diasSinComprobante}
                          onClick={() => {
                            router.push(`/propiedades/${prop.propertyId}?tab=servicios&serviceId=${s.id}`);
                          }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="border-b border-border px-3.5 py-3">
                    <AlertasBadge estado={prop.peorEstado} count={prop.alertasCount} />
                  </td>
                  <td className="border-b border-border px-3.5 py-3">
                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/propiedades/${prop.propertyId}`); }}
                        className={`rounded-md border px-2.5 py-1 text-[0.67rem] font-semibold transition-colors ${prop.peorEstado === "blocked"
                          ? "border-destructive/30 text-destructive hover:bg-destructive-dim"
                          : "border-border text-text-muted hover:text-text-secondary"
                          }`}
                      >
                        {prop.peorEstado === "blocked" ? "Resolver" : prop.peorEstado === "alert" ? "Gestionar" : "Ver detalle"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} de {pagination.total} propiedades
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-mid text-text-muted transition-colors hover:bg-surface-high disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${p === page
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-surface-mid text-text-muted hover:bg-surface-high"
                    }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-mid text-text-muted transition-colors hover:bg-surface-high disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
