"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Home,
  Car,
  Store,
  Briefcase,
  MapPin,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickPropertyForm } from "@/components/properties/quick-property-form";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyRow {
  id: string;
  title: string;
  address: string;
  price: string;
  type: string;
  status: string;
  zone: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  ownerId: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  contractNumber: string | null;
  contractEndDate: string | null;
  contractStatus: string | null;
  createdAt: string;
}

interface PropertyCounts {
  total: number;
  available: number;
  rented: number;
  reserved: number;
  sold: number;
  maintenance: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PropertiesResponse {
  properties: PropertyRow[];
  pagination: Pagination;
  counts: PropertyCounts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ABBREV: Record<string, string> = {
  departamento: "Depto",
  casa: "Casa",
  terreno: "Terreno",
  local: "Local",
  oficina: "Ofic.",
  cochera: "Cochera",
  otro: "Otro",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  departamento: <Building2 size={16} />,
  casa: <Home size={16} />,
  local: <Store size={16} />,
  oficina: <Briefcase size={16} />,
  cochera: <Car size={16} />,
  terreno: <MapPin size={16} />,
  otro: <Building2 size={16} />,
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; textColor: string; dot: string; borderLeft?: string }
> = {
  available: {
    label: "Disponible",
    bg: "rgba(253,222,168,0.15)",
    textColor: "#ffdea8",
    dot: "#ffdea8",
    borderLeft: "#ffdea8",
  },
  rented: {
    label: "Alquilada",
    bg: "rgba(141,207,149,0.12)",
    textColor: "#8dcf95",
    dot: "#8dcf95",
  },
  reserved: {
    label: "Reservada",
    bg: "rgba(147,197,253,0.12)",
    textColor: "#93c5fd",
    dot: "#93c5fd",
  },
  maintenance: {
    label: "Mantenimiento",
    bg: "rgba(253,186,116,0.12)",
    textColor: "#fdba74",
    dot: "#fdba74",
    borderLeft: "#fdba74",
  },
  sold: {
    label: "Vendida",
    bg: "rgba(255,180,171,0.12)",
    textColor: "#ffb4ab",
    dot: "#ffb4ab",
  },
};

/** Colores activos para cada chip de filtro */
const FILTER_TABS = [
  { value: "", label: "Todos", activeBg: "var(--color-arce-primary)", activeColor: "var(--color-arce-on-primary)" },
  { value: "rented", label: "Alquiladas", activeBg: "rgba(141,207,149,0.2)", activeColor: "#8dcf95" },
  { value: "available", label: "Disponibles", activeBg: "rgba(253,222,168,0.2)", activeColor: "#ffdea8" },
  { value: "reserved", label: "Reservadas", activeBg: "rgba(147,197,253,0.2)", activeColor: "#93c5fd" },
  { value: "maintenance", label: "Mantenimiento", activeBg: "rgba(253,186,116,0.2)", activeColor: "#fdba74" },
];

function getOwnerInitials(firstName: string | null, lastName: string | null) {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function formatSurface(surface: string | null) {
  if (!surface) return null;
  const n = parseFloat(surface);
  return isNaN(n) ? null : `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} m²`;
}

function buildSubtitle(p: PropertyRow) {
  const parts: string[] = [TYPE_ABBREV[p.type] ?? p.type];
  if (p.rooms) parts.push(`${p.rooms} amb`);
  const surf = formatSurface(p.surface);
  if (surf) parts.push(surf);
  if (p.zone) parts.push(p.zone);
  return parts.join(" · ");
}

/**
 * Calcula cuántos días faltan hasta una fecha ISO (YYYY-MM-DD).
 * Retorna negativo si ya venció.
 */
function daysUntil(isoDate: string): number {
  const end = new Date(isoDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.available;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.textColor }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function OwnerAvatar({ firstName, lastName }: { firstName: string | null; lastName: string | null }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 flex-shrink-0 text-[10px] font-extrabold font-arce-brand rounded-sm"
      style={{
        background: "var(--color-arce-primary-container)",
        color: "var(--color-arce-on-primary-fixed)",
      }}
    >
      {getOwnerInitials(firstName, lastName)}
    </span>
  );
}

/** KPI card con colores específicos por tipo */
function KpiCard({
  label,
  value,
  sub,
  valueColor,
  borderColor,
  bgGradient,
}: {
  label: string;
  value: number;
  sub: string;
  valueColor: string;
  borderColor: string;
  bgGradient: string;
}) {
  return (
    <div
      className="px-6 py-5 flex-1 min-w-0 rounded-lg border"
      style={{
        background: bgGradient,
        borderColor,
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3"
        style={{ color: "var(--color-arce-secondary-text)" }}
      >
        {label}
      </p>
      <p
        className="text-4xl font-bold leading-none mb-1 tabular-nums font-arce-headline"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      <p className="text-[11px]" style={{ color: "var(--color-arce-secondary-text)" }}>
        {sub}
      </p>
    </div>
  );
}

function PaginationBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center text-[12px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
      style={{
        background: active ? "var(--color-arce-primary)" : "var(--color-arce-surface-container)",
        color: active ? "var(--color-arce-on-primary)" : "var(--color-arce-on-surface)",
      }}
    >
      {children}
    </button>
  );
}

/** Columna contrato: muestra número + vencimiento con alertas de color */
function ContratoCell({ prop }: { prop: PropertyRow }) {
  if (!prop.contractNumber) {
    return (
      <span
        className="text-[11px] italic"
        style={{ color: "var(--color-arce-outline)" }}
      >
        Sin contrato activo
      </span>
    );
  }

  // Contratos pendientes de firma o en redacción
  const isPending = prop.contractStatus === "pending_signature" || prop.contractStatus === "draft";
  if (isPending) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] font-bold" style={{ color: "#93c5fd" }}>
          {prop.contractNumber}
        </span>
        <span className="text-[10px]" style={{ color: "var(--color-arce-secondary-text)" }}>
          Pend. firma{prop.contractEndDate ? ` · Inicio ${formatDate(prop.contractEndDate)}` : ""}
        </span>
      </div>
    );
  }

  // Contrato activo — verificar si vence pronto
  const days = prop.contractEndDate ? daysUntil(prop.contractEndDate) : 999;
  const isExpiringSoon = days <= 60;

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-mono text-[11px] font-bold"
        style={{ color: "var(--color-arce-primary)" }}
      >
        {prop.contractNumber}
      </span>
      {prop.contractEndDate && (
        <span
          className="text-[10px] font-semibold"
          style={{ color: isExpiringSoon ? "#ffdea8" : "var(--color-arce-secondary-text)" }}
        >
          {isExpiringSoon ? `⚠ Vence en ${days} días` : `Vence ${formatDate(prop.contractEndDate)}`}
        </span>
      )}
    </div>
  );
}

// ── Property row ──────────────────────────────────────────────────────────────

function PropertyRowItem({ prop, even, onClick }: { prop: PropertyRow; even: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[prop.status];
  return (
    <div
      className="grid px-4 py-3 cursor-pointer transition-colors group"
      style={{
        gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 130px 60px 64px",
        background: even ? "rgba(40,42,44,0.45)" : "var(--color-arce-surface-lowest)",
        borderBottom: "1px solid rgba(160,132,126,0.07)",
        borderLeft: cfg?.borderLeft ? `2px solid ${cfg.borderLeft}` : "2px solid transparent",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,180,162,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = even
          ? "rgba(40,42,44,0.45)"
          : "var(--color-arce-surface-lowest)";
      }}
    >
      {/* Propiedad */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-sm"
          style={{
            background: "var(--color-arce-surface-container)",
            color: "var(--color-arce-secondary-text)",
          }}
        >
          {TYPE_ICON[prop.type] ?? <Building2 size={16} />}
        </span>
        <div className="min-w-0">
          <p
            className="text-[13px] font-semibold leading-snug truncate font-arce-headline"
            style={{ color: "var(--color-arce-on-surface)" }}
          >
            {prop.title || prop.address}
          </p>
          <p
            className="text-[11px] leading-none mt-0.5 truncate"
            style={{ color: "var(--color-arce-secondary-text)" }}
          >
            {buildSubtitle(prop)}
          </p>
        </div>
      </div>

      {/* Propietario */}
      <div className="flex items-center gap-2 min-w-0">
        <OwnerAvatar firstName={prop.ownerFirstName} lastName={prop.ownerLastName} />
        <span
          className="text-[12px] font-medium truncate"
          style={{ color: "var(--color-arce-on-surface)" }}
        >
          {prop.ownerLastName && prop.ownerFirstName
            ? `${prop.ownerLastName}, ${prop.ownerFirstName}`
            : prop.ownerFirstName || "—"}
        </span>
      </div>

      {/* Contrato */}
      <div className="flex flex-col justify-center">
        <ContratoCell prop={prop} />
      </div>

      {/* Estado */}
      <div className="flex items-center">
        <StatusBadge status={prop.status} />
      </div>

      {/* Tareas — placeholder hasta que exista el módulo */}
      <div className="flex items-center justify-center">
        <span className="text-[12px]" style={{ color: "var(--color-arce-outline)" }}>—</span>
      </div>

      {/* Acción — visible en hover */}
      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          className="text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded"
          style={{
            color: "var(--color-arce-primary)",
            background: "var(--color-arce-primary-dim)",
          }}
        >
          Ver <ArrowRight size={12} />
        </span>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function PropertyListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);

  const page = parseInt(searchParams.get("page") || "1");
  const statusFilter = searchParams.get("status") || "";
  const zoneFilter = searchParams.get("zone") || "";

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [zoneInput, setZoneInput] = useState(zoneFilter);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = [
    "properties",
    page,
    statusFilter,
    zoneFilter,
    searchParams.get("search") || "",
  ];

  const { data, isLoading, error, refetch } = useQuery<PropertiesResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "8",
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(zoneFilter ? { zone: zoneFilter } : {}),
        ...(searchParams.get("search") ? { search: searchParams.get("search")! } : {}),
      });
      const res = await fetch(`/api/properties?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al obtener propiedades");
      }
      return res.json();
    },
  });

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      searchDebounce.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", "1");
        if (value.trim()) params.set("search", value.trim());
        else params.delete("search");
        router.push(`/propiedades?${params.toString()}`);
      }, 350);
    },
    [searchParams, router]
  );

  const handleZoneFilter = useCallback(
    (value: string) => {
      setZoneInput(value);
      if (zoneDebounce.current) clearTimeout(zoneDebounce.current);
      zoneDebounce.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", "1");
        if (value.trim()) params.set("zone", value.trim());
        else params.delete("zone");
        router.push(`/propiedades?${params.toString()}`);
      }, 350);
    },
    [searchParams, router]
  );

  const handleStatusFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value) params.set("status", value);
    else params.delete("status");
    router.push(`/propiedades?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/propiedades?${params.toString()}`);
  };

  const handleFormSuccess = (propertyId: string) => {
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    router.push(`/propiedades/${propertyId}`);
  };

  const counts = data?.counts;
  const pagination = data?.pagination;
  const properties = data?.properties ?? [];

  const occupancyPct = counts?.total
    ? Math.round((counts.rented / counts.total) * 100)
    : 0;

  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--color-arce-background)" }}>

      {/* Modal — Nueva propiedad */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg p-0 gap-0 border-white/10 overflow-hidden"
          style={{ background: "#1a1d1e" }}
        >
          <DialogHeader className="px-6 pt-6 pb-2 border-b border-white/5">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-white font-arce-headline">
                  Nueva propiedad
                </DialogTitle>
                <p className="text-[12px] text-gray-400 mt-1">
                  Los campos con <span className="text-[#ffb4a2]">*</span> son obligatorios.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[80vh]">
            <QuickPropertyForm
              onSuccess={handleFormSuccess}
              onCancel={() => setDialogOpen(false)}
              inline
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Page header */}
      <div className="px-8 pt-7 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-[28px] font-bold tracking-tight leading-none mb-1 font-arce-headline"
              style={{ color: "var(--color-arce-on-surface)" }}
            >
              Propiedades
            </h1>
            <p className="text-[13px]" style={{ color: "var(--color-arce-secondary-text)" }}>
              Portfolio completo en administración
            </p>
          </div>

          {/* Botón prominente */}
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2.5 px-6 py-3 text-[13px] font-bold rounded-xl transition-all cursor-pointer border-none shadow-lg"
            style={{
              background: "var(--color-arce-primary)",
              color: "var(--color-arce-on-primary)",
              boxShadow: "0 4px 14px rgba(255,180,162,0.25)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "";
            }}
          >
            <Plus size={18} />
            Nueva propiedad
          </button>
        </div>
      </div>

      {/* KPI cards — colores diferenciados por tipo */}
      <div className="px-8 mb-5">
        <div className="flex gap-3">
          <KpiCard
            label="Total"
            value={counts?.total ?? 0}
            sub="propiedades en cartera"
            valueColor="var(--color-arce-primary)"
            borderColor="rgba(255,180,162,0.2)"
            bgGradient="linear-gradient(135deg, var(--color-arce-surface-lowest) 0%, rgba(107,23,2,0.08) 100%)"
          />
          <KpiCard
            label="Alquiladas"
            value={counts?.rented ?? 0}
            sub={`${occupancyPct}% de ocupación`}
            valueColor="#8dcf95"
            borderColor="rgba(141,207,149,0.2)"
            bgGradient="linear-gradient(135deg, var(--color-arce-surface-lowest) 0%, rgba(141,207,149,0.06) 100%)"
          />
          <KpiCard
            label="Disponibles"
            value={counts?.available ?? 0}
            sub="sin contrato activo"
            valueColor="#ffdea8"
            borderColor="rgba(253,222,168,0.2)"
            bgGradient="linear-gradient(135deg, var(--color-arce-surface-lowest) 0%, rgba(253,222,168,0.06) 100%)"
          />
          <KpiCard
            label="Mantenimiento"
            value={counts?.maintenance ?? 0}
            sub="fuera de disponibilidad"
            valueColor="#fdba74"
            borderColor="rgba(253,186,116,0.2)"
            bgGradient="linear-gradient(135deg, var(--color-arce-surface-lowest) 0%, rgba(253,186,116,0.06) 100%)"
          />
        </div>
      </div>

      {/* Toolbar: búsqueda + chips de estado */}
      <div className="px-8 mb-2 flex items-center gap-3 flex-wrap">
        {/* Búsqueda */}
        <div
          className="relative flex-1 min-w-[200px] max-w-md"
          style={{ background: "var(--color-arce-surface-container)", borderRadius: "8px" }}
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-arce-secondary-text)" }}
          />
          <input
            type="text"
            placeholder="Buscar por dirección, propietario, barrio…"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-transparent outline-none border-none font-arce-body rounded-lg"
            style={{ color: "var(--color-arce-on-surface)" }}
          />
          {searchInput && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={() => handleSearch("")}
              style={{ color: "var(--color-arce-secondary-text)" }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Chips de estado — cada uno con su color */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const isActive = tab.value === statusFilter;
            return (
              <button
                key={tab.value}
                onClick={() => handleStatusFilter(tab.value)}
                className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] transition-all border rounded-full cursor-pointer"
                style={{
                  background: isActive ? tab.activeBg : "transparent",
                  color: isActive ? tab.activeColor : "var(--color-arce-secondary-text)",
                  borderColor: isActive ? tab.activeColor + "40" : "rgba(160,132,126,0.15)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro por barrio/zona — fila secundaria */}
      <div className="px-8 mb-4">
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
          style={{ background: "var(--color-arce-surface-container)", border: "1px solid rgba(160,132,126,0.08)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em] flex-shrink-0"
            style={{ color: "var(--color-arce-secondary-text)" }}
          >
            Barrio:
          </span>
          <input
            type="text"
            placeholder="Filtrar por barrio o zona…"
            value={zoneInput}
            onChange={(e) => handleZoneFilter(e.target.value)}
            className="flex-1 text-[12px] bg-transparent outline-none border-none font-arce-body"
            style={{ color: "var(--color-arce-on-surface)" }}
          />
          {zoneInput && (
            <button onClick={() => handleZoneFilter("")} style={{ color: "var(--color-arce-secondary-text)" }}>
              <X size={13} />
            </button>
          )}
          <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "var(--color-arce-outline)" }}>
            Filtro por zona
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 flex-1">
        {/* Table label + count */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: "var(--color-arce-surface-low)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--color-arce-secondary-text)" }}
            >
              Propiedades
            </span>
            {pagination && (
              <span className="text-[10px]" style={{ color: "var(--color-arce-outline)" }}>
                {pagination.total} {pagination.total === 1 ? "propiedad" : "propiedades"}
              </span>
            )}
          </div>
        </div>

        {/* Table header */}
        <div
          className="grid text-[10px] font-bold uppercase tracking-[0.12em] px-4 py-3"
          style={{
            gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 130px 60px 64px",
            color: "var(--color-arce-secondary-text)",
            background: "var(--color-arce-surface-low)",
            borderBottom: "1px solid rgba(160,132,126,0.12)",
          }}
        >
          <span>Propiedad</span>
          <span>Propietario</span>
          <span>Contrato activo</span>
          <span>Estado</span>
          <span className="text-center">Tareas</span>
          <span />
        </div>

        {/* Loading */}
        {isLoading && (
          <div
            className="flex items-center justify-center py-20"
            style={{ background: "var(--color-arce-surface-lowest)" }}
          >
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: "var(--color-arce-secondary-text)" }}
            />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div
            className="flex flex-col items-center gap-3 py-16"
            style={{ background: "var(--color-arce-surface-lowest)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-arce-error)" }}>
              {(error as Error).message}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest rounded"
              style={{
                background: "var(--color-arce-surface-container)",
                color: "var(--color-arce-on-surface)",
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && properties.length === 0 && (
          <div
            className="py-20 text-center"
            style={{ background: "var(--color-arce-surface-lowest)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-arce-secondary-text)" }}>
              No se encontraron propiedades.
            </p>
          </div>
        )}

        {/* Rows */}
        {!isLoading &&
          !error &&
          properties.map((prop, i) => (
            <PropertyRowItem
              key={prop.id}
              prop={prop}
              even={i % 2 === 1}
              onClick={() => router.push(`/propiedades/${prop.id}`)}
            />
          ))}

        {/* Pagination */}
        {pagination && pagination.totalPages > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: "var(--color-arce-surface-lowest)",
              borderTop: "1px solid rgba(160,132,126,0.1)",
            }}
          >
            <p className="text-[11px]" style={{ color: "var(--color-arce-secondary-text)" }}>
              Mostrando{" "}
              {pagination.total === 0
                ? "0"
                : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
                    pagination.page * pagination.limit,
                    pagination.total
                  )}`}{" "}
              de {pagination.total} {pagination.total === 1 ? "propiedad" : "propiedades"}
            </p>

            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <PaginationBtn
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft size={13} />
                </PaginationBtn>
                {buildPageNumbers(pagination.page, pagination.totalPages).map((p, idx) =>
                  p === "…" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-[12px]"
                      style={{ color: "var(--color-arce-secondary-text)" }}
                    >
                      …
                    </span>
                  ) : (
                    <PaginationBtn
                      key={p}
                      active={p === pagination.page}
                      onClick={() => handlePageChange(p as number)}
                    >
                      {p}
                    </PaginationBtn>
                  )
                )}
                <PaginationBtn
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <ChevronRight size={13} />
                </PaginationBtn>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function PropertyList() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2
            className="animate-spin"
            style={{ color: "var(--color-arce-secondary-text)" }}
          />
        </div>
      }
    >
      <PropertyListContent />
    </Suspense>
  );
}
