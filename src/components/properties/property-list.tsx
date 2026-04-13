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
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { QuickPropertyForm } from "@/components/properties/quick-property-form";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyRow {
  id: string;
  title: string;
  address: string;
  price: string;
  type: string;
  status: string;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  ownerId: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
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

const FILTER_TABS = [
  { value: "", label: "Todos" },
  { value: "rented", label: "Alquiladas" },
  { value: "available", label: "Disponibles" },
  { value: "reserved", label: "Reservadas" },
  { value: "maintenance", label: "Mantenimiento" },
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
  return parts.join(" · ");
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
      className="inline-flex items-center justify-center w-7 h-7 flex-shrink-0 text-[10px] font-extrabold font-arce-brand"
      style={{
        background: "var(--color-arce-primary-container)",
        color: "var(--color-arce-on-primary-fixed)",
      }}
    >
      {getOwnerInitials(firstName, lastName)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: "primary" | "tertiary" | "error";
}) {
  const valueColor =
    accent === "primary"
      ? "var(--color-arce-primary)"
      : accent === "tertiary"
      ? "var(--color-arce-on-tertiary-fixed)"
      : accent === "error"
      ? "var(--color-arce-error)"
      : "var(--color-arce-on-surface)";

  return (
    <div
      className="px-6 py-5 flex-1 min-w-0"
      style={{ background: "var(--color-arce-surface-lowest)" }}
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
      className="w-7 h-7 flex items-center justify-center text-[12px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? "var(--color-arce-primary)" : "var(--color-arce-surface-container)",
        color: active ? "var(--color-arce-on-primary)" : "var(--color-arce-on-surface)",
      }}
    >
      {children}
    </button>
  );
}

// ── Property row ──────────────────────────────────────────────────────────────

function PropertyRowItem({ prop, even, onClick }: { prop: PropertyRow; even: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[prop.status];
  return (
    <div
      className="grid px-4 py-3 cursor-pointer transition-colors group"
      style={{
        gridTemplateColumns: "minmax(220px,2fr) minmax(160px,1fr) minmax(180px,1fr) 140px 80px",
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
          className="flex-shrink-0 flex items-center justify-center w-8 h-8"
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
            {prop.title}
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
            : "—"}
        </span>
      </div>

      {/* Contrato */}
      <div className="flex flex-col justify-center">
        <p className="text-[11px]" style={{ color: "var(--color-arce-secondary-text)" }}>
          Sin contrato activo
        </p>
      </div>

      {/* Estado */}
      <div className="flex items-center">
        <StatusBadge status={prop.status} />
      </div>

      {/* Tareas */}
      <div className="flex items-center justify-end">
        <span className="text-[12px]" style={{ color: "var(--color-arce-outline)" }}>
          —
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

  const [drawerOpen, setDrawerOpen] = useState(false);

  const page = parseInt(searchParams.get("page") || "1");
  const statusFilter = searchParams.get("status") || "";
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = ["properties", page, statusFilter, searchParams.get("search") || ""];

  const { data, isLoading, error, refetch } = useQuery<PropertiesResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "8",
        ...(statusFilter ? { status: statusFilter } : {}),
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

  const handleFormSuccess = () => {
    setDrawerOpen(false);
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  };

  const counts = data?.counts;
  const pagination = data?.pagination;
  const properties = data?.properties ?? [];

  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--color-arce-background)" }}>

      {/* Drawer — Nueva propiedad */}
      <Drawer direction="right" open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent
          className="flex flex-col h-full bg-[#1a1d1e] border-l border-white/10 max-w-lg ml-auto shadow-2xl"
          style={{ 
            borderTopLeftRadius: '1.5rem', 
            borderBottomLeftRadius: '1.5rem',
          }}
        >
          <DrawerHeader className="p-6 pb-2 flex justify-between items-center border-b border-white/5">
            <DrawerTitle className="text-xl font-bold text-white font-arce-headline">
              Nueva propiedad
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto">
            <QuickPropertyForm onSuccess={handleFormSuccess} onCancel={() => setDrawerOpen(false)} inline />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Header */}
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
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer border-none"
            style={{
              background: "var(--color-arce-primary)",
              color: "var(--color-arce-on-primary)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--color-arce-primary-container)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--color-arce-primary)";
            }}
          >
            <Plus size={14} />
            Nueva propiedad
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-8 mb-5">
        <div className="flex gap-4">
          <KpiCard label="Total" value={counts?.total ?? 0} sub="propiedades en cartera" />
          <KpiCard
            label="Alquiladas"
            value={counts?.rented ?? 0}
            sub={
              counts?.total
                ? `${Math.round((counts.rented / counts.total) * 100)}% de ocupación`
                : "0% de ocupación"
            }
            accent="primary"
          />
          <KpiCard label="Disponibles" value={counts?.available ?? 0} sub="sin contrato activo" />
          <KpiCard
            label="Mantenimiento"
            value={counts?.maintenance ?? 0}
            sub="fuera de disponibilidad"
            accent="tertiary"
          />
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="px-8 mb-4 flex items-center justify-between gap-4">
        <div
          className="relative flex-1 max-w-lg"
          style={{ background: "var(--color-arce-surface-container)" }}
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-arce-secondary-text)" }}
          />
          <input
            type="text"
            placeholder="Buscar por dirección, propietario, inquilino…"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-transparent outline-none border-none font-arce-body"
            style={{ color: "var(--color-arce-on-surface)" }}
          />
        </div>

        <div
          className="flex items-center"
          style={{ background: "var(--color-arce-surface-container)" }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = tab.value === statusFilter;
            return (
              <button
                key={tab.value}
                onClick={() => handleStatusFilter(tab.value)}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors border-none cursor-pointer"
                style={{
                  background: isActive ? "var(--color-arce-primary)" : "transparent",
                  color: isActive
                    ? "var(--color-arce-on-primary)"
                    : "var(--color-arce-secondary-text)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 flex-1">
        {/* Label */}
        <div
          className="flex items-center gap-3 px-4 py-2"
          style={{ background: "var(--color-arce-surface-low)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-arce-secondary-text)" }}
          >
            Propiedades
          </span>
          {pagination && (
            <span className="text-[10px]" style={{ color: "var(--color-arce-outline)" }}>
              {pagination.total} propiedades
            </span>
          )}
        </div>

        {/* Table header */}
        <div
          className="grid text-[10px] font-bold uppercase tracking-[0.12em] px-4 py-3"
          style={{
            gridTemplateColumns:
              "minmax(220px,2fr) minmax(160px,1fr) minmax(180px,1fr) 140px 80px",
            color: "var(--color-arce-secondary-text)",
            background: "var(--color-arce-surface-low)",
            borderBottom: "1px solid rgba(160,132,126,0.12)",
          }}
        >
          <span>Propiedad</span>
          <span>Propietario</span>
          <span>Contrato activo</span>
          <span>Estado</span>
          <span className="text-right">Tareas</span>
        </div>

        {/* States */}
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
              className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest"
              style={{
                background: "var(--color-arce-surface-container)",
                color: "var(--color-arce-on-surface)",
              }}
            >
              Reintentar
            </button>
          </div>
        )}

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
              de {pagination.total} propiedades
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
