"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  SERVICIO_TIPO_LABELS,
  SERVICIO_TIPO_ICONS,
  type ServicioTipo,
  type ServicioEstado,
} from "@/lib/servicios/constants";
import { StatusBadge } from "@/components/ui/status-badge";

// ── Tipos ──────────────────────────────────────────────────────────────
type ServicioResumen = {
  id: string;
  tipo: ServicioTipo;
  estado: ServicioEstado;
  diasSinComprobante: number;
  activaBloqueo: boolean;
};

type PropiedadResumen = {
  propertyId: string;
  propertyAddress: string | null;
  inquilinoNombre?: string;
  servicios: ServicioResumen[];
  peorEstado: ServicioEstado;
  alertasCount: number;
};

type KPIs = {
  totalPropiedades: number;
  alDia: number;
  enAlerta: number;
  bloqueadas: number;
  pendientes: number;
};

// ── Helpers de período ──────────────────────────────────────────────────
function periodoLabel(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(year, month - 1, 1);
  return fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function periodoAnterior(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodoSiguiente(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

// ── Chip de estado del servicio ─────────────────────────────────────────
function ServicioChip({
  tipo,
  estado,
  diasSinComprobante,
}: {
  tipo: ServicioTipo;
  estado: ServicioEstado;
  diasSinComprobante: number;
}) {
  const icon = SERVICIO_TIPO_ICONS[tipo] ?? "📋";
  const label = (SERVICIO_TIPO_LABELS[tipo] ?? tipo)
    .replace("Energía eléctrica", "Luz")
    .replace("Gas natural", "Gas")
    .replace("ABL / Impuesto inmobiliario", "ABL")
    .replace("Seguro del inmueble", "Seguro");

  const diasLabel = diasSinComprobante > 0 ? ` ${diasSinComprobante}d` : "";

  const clases: Record<ServicioEstado, string> = {
    al_dia:    "bg-income-dim text-income",
    pendiente: "bg-muted text-muted-foreground",
    en_alerta: "bg-mustard-dim text-mustard",
    bloqueado: "bg-destructive-dim text-destructive",
  };

  const dotClases: Record<ServicioEstado, string> = {
    al_dia:    "bg-current",
    pendiente: "bg-current",
    en_alerta: "bg-current",
    bloqueado: "bg-current",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.63rem] font-bold ${clases[estado]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClases[estado]}`} />
      {label}
      {diasLabel}
      {estado === "bloqueado" && " 🔒"}
    </span>
  );
}

// ── Badge resumen de alertas ────────────────────────────────────────────
function AlertasBadge({ estado, count }: { estado: ServicioEstado; count: number }) {
  if (estado === "al_dia") {
    return <StatusBadge variant="income">Al día</StatusBadge>;
  }
  if (estado === "bloqueado") {
    return (
      <StatusBadge variant="red">
        Bloqueado{count > 1 ? ` (${count})` : ""}
      </StatusBadge>
    );
  }
  if (estado === "en_alerta") {
    return <StatusBadge variant="mustard">{count} en alerta</StatusBadge>;
  }
  return (
    <StatusBadge variant="muted">
      {count} pendiente{count > 1 ? "s" : ""}
    </StatusBadge>
  );
}

// ── Componente principal ────────────────────────────────────────────────
export function ServiciosControlPanel() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(periodoActual);
  const [filtro, setFiltro] = useState<"todos" | ServicioEstado>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // KPIs
  const { data: resumen } = useQuery({
    queryKey: ["servicios-resumen", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/servicios/resumen?periodo=${periodo}`);
      if (!res.ok) throw new Error("Error al cargar resumen");
      return res.json() as Promise<{ kpis: KPIs; periodo: string }>;
    },
  });

  // Lista de servicios agrupados por propiedad
  const { data, isLoading } = useQuery({
    queryKey: ["servicios", periodo, page, filtro],
    queryFn: async () => {
      const estadoParam = filtro !== "todos" ? `&estado=${filtro}` : "";
      const res = await fetch(
        `/api/servicios?periodo=${periodo}&page=${page}&limit=${limit}${estadoParam}`
      );
      if (!res.ok) throw new Error("Error al cargar servicios");
      return res.json() as Promise<{
        items: (ServicioResumen & {
          propertyId: string;
          propertyAddress: string | null;
        })[];
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
        servicios: [],
        peorEstado: "al_dia",
        alertasCount: 0,
      });
      propiedades.push(mapaProps.get(item.propertyId)!);
    }
    const prop = mapaProps.get(item.propertyId)!;
    prop.servicios.push(item);
    // Actualizar peor estado
    const prioridad = { bloqueado: 4, en_alerta: 3, pendiente: 2, al_dia: 1 };
    if ((prioridad[item.estado] ?? 0) > (prioridad[prop.peorEstado] ?? 0)) {
      prop.peorEstado = item.estado;
    }
    if (item.estado === "en_alerta" || item.estado === "bloqueado") {
      prop.alertasCount++;
    }
  }

  // Filtrar por búsqueda en cliente
  const propiedadesFiltradas = busqueda.trim()
    ? propiedades.filter((p) =>
        p.propertyAddress?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : propiedades;

  const kpis = resumen?.kpis;
  const pagination = data?.pagination;

  const filtros: { key: "todos" | ServicioEstado; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "al_dia", label: "Al día" },
    { key: "pendiente", label: "Pendientes" },
    { key: "en_alerta", label: "En alerta" },
    { key: "bloqueado", label: "Bloqueados" },
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
            onClick={() => { setPeriodo(periodoAnterior(periodo)); setPage(1); }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-mid text-text-muted transition-colors hover:bg-surface-high hover:text-on-bg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[140px] rounded-xl border border-border bg-surface-mid px-4 py-1.5 text-center text-sm font-semibold capitalize">
            {periodoLabel(periodo)}
          </div>
          <button
            onClick={() => { setPeriodo(periodoSiguiente(periodo)); setPage(1); }}
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
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <div className="flex gap-1.5">
          {filtros.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFiltro(key); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold transition-colors ${
                filtro === key
                  ? key === "en_alerta"
                    ? "border-mustard/25 bg-mustard-dim text-mustard"
                    : key === "bloqueado"
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
                  className={`group cursor-pointer transition-colors hover:bg-border/50 ${
                    prop.peorEstado === "bloqueado"
                      ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-l-destructive"
                      : prop.peorEstado === "en_alerta"
                      ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-l-mustard"
                      : ""
                  }`}
                >
                  <td className="border-b border-border px-3.5 py-3">
                    <div className="font-semibold">{prop.propertyAddress ?? "Sin dirección"}</div>
                  </td>
                  <td className="border-b border-border px-3.5 py-3">
                    <span className="field-value empty"></span>
                  </td>
                  <td className="border-b border-border px-3.5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {prop.servicios.map((s) => (
                        <ServicioChip
                          key={s.id}
                          tipo={s.tipo as ServicioTipo}
                          estado={s.estado}
                          diasSinComprobante={s.diasSinComprobante}
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
                        className={`rounded-md border px-2.5 py-1 text-[0.67rem] font-semibold transition-colors ${
                          prop.peorEstado === "bloqueado"
                            ? "border-destructive/30 text-destructive hover:bg-destructive-dim"
                            : "border-border text-text-muted hover:text-text-secondary"
                        }`}
                      >
                        {prop.peorEstado === "bloqueado" ? "Resolver" : prop.peorEstado === "en_alerta" ? "Gestionar" : "Ver detalle"}
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
                  className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${
                    p === page
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
