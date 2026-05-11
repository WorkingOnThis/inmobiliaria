"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  X,
  ArrowRight,
  Key,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ZoneCombobox } from "@/components/ui/zone-combobox";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/properties/format-address";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyRow {
  id: string;
  title: string;
  addressStreet: string;
  addressNumber: string | null;
  rentalPrice: string | null;
  rentalPriceCurrency: string;
  salePrice: string | null;
  salePriceCurrency: string;
  type: string;
  rentalStatus: string;
  saleStatus: string | null;
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
  maintenance: number;
  for_sale: number;
  sold: number;
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

const RENTAL_STATUS_CONFIG: Record<string, { label: string; borderLeft?: string }> = {
  available:   { label: "Disponible",    borderLeft: "var(--status-available)" },
  rented:      { label: "Alquilada" },
  reserved:    { label: "Reservada" },
  maintenance: { label: "Mantenimiento", borderLeft: "var(--status-maintenance)" },
};

const RENTAL_STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  available:   "available",
  rented:      "rented",
  reserved:    "reserved",
  maintenance: "maintenance",
};

const SALE_STATUS_CONFIG: Record<string, { label: string }> = {
  for_sale: { label: "En venta" },
  sold:     { label: "Vendida" },
};

const SALE_STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  for_sale: "reserved",
  sold:     "baja",
};

/**
 * Each tab carries: a param name + value to set (empty string = clear that param).
 * Only one dimension is active at a time.
 */
const FILTER_TABS: { param: "rentalStatus" | "saleStatus" | ""; value: string; label: string; activeBg: string; activeColor: string }[] = [
  { param: "",             value: "",         label: "Todos",        activeBg: "var(--primary)",                activeColor: "var(--primary-foreground)" },
  { param: "rentalStatus", value: "rented",   label: "Alquiladas",   activeBg: "var(--status-rented-dim)",      activeColor: "var(--status-rented)" },
  { param: "rentalStatus", value: "available",label: "Disponibles",  activeBg: "var(--status-available-dim)",   activeColor: "var(--status-available)" },
  { param: "rentalStatus", value: "reserved", label: "Reservadas",   activeBg: "var(--status-reserved-dim)",    activeColor: "var(--status-reserved)" },
  { param: "rentalStatus", value: "maintenance", label: "Mantenimiento", activeBg: "var(--status-maintenance-dim)", activeColor: "var(--status-maintenance)" },
  { param: "saleStatus",   value: "for_sale", label: "En venta",     activeBg: "var(--status-reserved-dim)",    activeColor: "var(--status-reserved)" },
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

function KpiCard({
  label,
  value,
  sub,
  valueClassName,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub: string;
  valueClassName?: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="flex-1 min-w-0 rounded-xl border py-0 gap-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className={cn("mt-1 text-3xl font-bold tabular-nums", valueClassName ?? "")}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
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
    <Button
      variant={active ? "default" : "secondary"}
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className="size-7 rounded-sm text-[12px]"
    >
      {children}
    </Button>
  );
}

/** Columna contrato: muestra número + vencimiento con alertas de color */
function ContratoCell({ prop }: { prop: PropertyRow }) {
  if (!prop.contractNumber) {
    return (
      <span className="text-[11px] italic text-muted-foreground">
        Sin contrato activo
      </span>
    );
  }

  // Contratos pendientes de firma o en redacción
  const isPending = prop.contractStatus === "pending_signature" || prop.contractStatus === "draft";
  if (isPending) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] font-bold text-status-reserved">
          {prop.contractNumber}
        </span>
        <span className="text-[10px] text-muted-foreground">
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
      <span className="font-mono text-[11px] font-bold text-primary">
        {prop.contractNumber}
      </span>
      {prop.contractEndDate && (
        <span
          className={cn(
            "text-[10px] font-semibold",
            isExpiringSoon ? "text-status-available" : "text-muted-foreground"
          )}
        >
          {isExpiringSoon ? `⚠ Vence en ${days} días` : `Vence ${formatDate(prop.contractEndDate)}`}
        </span>
      )}
    </div>
  );
}

// ── Skeleton de carga ─────────────────────────────────────────────────────────

const SKELETON_WIDTHS = [
  ["w-36", "w-24", "w-20"],
  ["w-44", "w-28", "w-16"],
  ["w-32", "w-20", "w-24"],
  ["w-40", "w-32", "w-18"],
  ["w-28", "w-24", "w-20"],
] as const;

function SkeletonPropertyRow({ index }: { index: number }) {
  const widths = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <div
      className="grid px-4 py-3 pointer-events-none"
      style={{
        gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 150px 60px 64px",
        borderBottom: "1px solid rgba(160,132,126,0.07)",
        borderLeft: "2px solid transparent",
      }}
    >
      {/* Propiedad */}
      <div className="flex items-center gap-3 min-w-0">
        <Skeleton className="size-8 rounded-sm flex-shrink-0" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className={cn("h-3 rounded-sm", widths[0])} />
          <Skeleton className="h-2.5 rounded-sm w-24" />
        </div>
      </div>
      {/* Propietario */}
      <div className="flex items-center gap-2 min-w-0">
        <Skeleton className="size-6 rounded-full flex-shrink-0" />
        <Skeleton className={cn("h-3 rounded-sm", widths[1])} />
      </div>
      {/* Contrato */}
      <div className="flex flex-col gap-1 justify-center">
        <Skeleton className={cn("h-3 rounded-sm", widths[2])} />
        <Skeleton className="h-2.5 rounded-sm w-16" />
      </div>
      {/* Estado */}
      <div className="flex flex-col gap-1 justify-center">
        <Skeleton className="h-5 rounded-full w-20" />
      </div>
      {/* Tareas */}
      <div className="flex items-center justify-center">
        <Skeleton className="h-3 w-3 rounded-sm" />
      </div>
      {/* Acción */}
      <div />
    </div>
  );
}

// ── Property row ──────────────────────────────────────────────────────────────

function PropertyRowItem({ prop, even, onClick }: { prop: PropertyRow; even: boolean; onClick: () => void }) {
  const rentalCfg = RENTAL_STATUS_CONFIG[prop.rentalStatus];
  return (
    <div
      className={cn(
        "grid px-4 py-3 cursor-pointer transition-colors group",
        "hover:bg-[var(--primary-subtle)]",
        even ? "bg-[var(--surface-mid)]" : "bg-background"
      )}
      style={{
        gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 150px 60px 64px",
        borderBottom: "1px solid rgba(160,132,126,0.07)",
        borderLeft: rentalCfg?.borderLeft ? `2px solid ${rentalCfg.borderLeft}` : "2px solid transparent",
      }}
      onClick={onClick}
    >
      {/* Propiedad */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex-shrink-0 flex items-center justify-center size-8 rounded-sm bg-muted text-muted-foreground">
          {TYPE_ICON[prop.type] ?? <Building2 size={16} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug truncate font-headline text-foreground">
            {prop.title || formatAddress(prop)}
          </p>
          <p className="text-[11px] leading-none mt-0.5 truncate text-muted-foreground">
            {buildSubtitle(prop)}
          </p>
        </div>
      </div>

      {/* Propietario */}
      <div className="flex items-center gap-2 min-w-0">
        <EntityAvatar
          initials={getOwnerInitials(prop.ownerFirstName, prop.ownerLastName)}
          size="sm"
          colorSeed={prop.ownerFirstName ?? undefined}
        />
        <span className="text-[12px] font-medium truncate text-foreground">
          {prop.ownerLastName && prop.ownerFirstName
            ? `${prop.ownerLastName}, ${prop.ownerFirstName}`
            : prop.ownerFirstName ?? "Sin cargar"}
        </span>
      </div>

      {/* Contrato */}
      <div className="flex flex-col justify-center">
        <ContratoCell prop={prop} />
      </div>

      {/* Estado */}
      <div className="flex flex-col gap-1 justify-center">
        <StatusBadge variant={RENTAL_STATUS_VARIANT[prop.rentalStatus] ?? "available"}>
          {RENTAL_STATUS_CONFIG[prop.rentalStatus]?.label ?? prop.rentalStatus}
        </StatusBadge>
        {prop.saleStatus && (
          <StatusBadge variant={SALE_STATUS_VARIANT[prop.saleStatus] ?? "reserved"}>
            {SALE_STATUS_CONFIG[prop.saleStatus]?.label ?? prop.saleStatus}
          </StatusBadge>
        )}
      </div>

      {/* Tareas — placeholder hasta que exista el módulo */}
      <div className="flex items-center justify-center">
        <span className="text-[12px] text-muted-foreground">—</span>
      </div>

      {/* Acción — visible en hover */}
      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded text-primary bg-[var(--primary-dim)]">
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

  const page = parseInt(searchParams.get("page") || "1");
  const rentalStatusFilter = searchParams.get("rentalStatus") || "";
  const saleStatusFilter = searchParams.get("saleStatus") || "";
  const zoneFilter = searchParams.get("zone") || "";

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = [
    "properties",
    page,
    rentalStatusFilter,
    saleStatusFilter,
    zoneFilter,
    searchParams.get("search") || "",
  ];

  const { data, isLoading, error, refetch } = useQuery<PropertiesResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "8",
        isManaged: "true",
        ...(rentalStatusFilter ? { rentalStatus: rentalStatusFilter } : {}),
        ...(saleStatusFilter ? { saleStatus: saleStatusFilter } : {}),
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
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      if (value) params.set("zone", value);
      else params.delete("zone");
      router.push(`/propiedades?${params.toString()}`);
    },
    [searchParams, router]
  );

  const handleStatusFilter = (tab: typeof FILTER_TABS[number]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    // Clear both dimensions, then set only the one for this tab
    params.delete("rentalStatus");
    params.delete("saleStatus");
    if (tab.param && tab.value) params.set(tab.param, tab.value);
    router.push(`/propiedades?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/propiedades?${params.toString()}`);
  };

  const counts = data?.counts;
  const pagination = data?.pagination;
  const properties = data?.properties ?? [];

  const occupancyPct = counts?.total
    ? Math.round(((counts.rented ?? 0) / counts.total) * 100)
    : 0;

  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--background)" }}>

      {/* Page header */}
      <div className="px-8 pt-7 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-[28px] font-bold tracking-tight leading-none mb-1 font-headline"
              style={{ color: "var(--foreground)" }}
            >
              Propiedades
            </h1>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Portfolio completo en administración
            </p>
          </div>

          {/* Botón prominente */}
          <Button
            onClick={() => router.push("/propiedades/nueva")}
            size="lg"
          >
            <Plus size={18} />
            Nueva propiedad
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-8 mb-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Total"
            value={counts?.total ?? 0}
            sub="propiedades en cartera"
            icon={Building2}
          />
          <KpiCard
            label="Alquiladas"
            value={counts?.rented ?? 0}
            sub={`${occupancyPct}% de ocupación`}
            valueClassName="text-[var(--status-rented)]"
            icon={Key}
          />
          <KpiCard
            label="Disponibles"
            value={counts?.available ?? 0}
            sub="sin contrato activo"
            valueClassName="text-mustard"
            icon={CheckCircle2}
          />
          <KpiCard
            label="En venta"
            value={counts?.for_sale ?? 0}
            sub="publicadas para venta"
            valueClassName="text-muted-foreground"
            icon={Tag}
          />
        </div>
      </div>

      {/* Toolbar: búsqueda + chips de estado */}
      <div className="px-8 mb-2 flex items-center gap-3 flex-wrap">
        {/* Búsqueda */}
        <div
          className="relative flex-1 min-w-[200px] max-w-md"
          style={{ background: "var(--muted)", borderRadius: "8px" }}
        >
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Buscar por dirección, propietario, barrio…"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 pr-8 border-0 bg-transparent rounded-lg text-[13px] h-10"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
              onClick={() => handleSearch("")}
            >
              <X size={13} />
            </Button>
          )}
        </div>

        {/* Chips de estado — cada uno con su color */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const isActive =
              tab.param === ""
                ? !rentalStatusFilter && !saleStatusFilter
                : tab.param === "rentalStatus"
                  ? tab.value === rentalStatusFilter
                  : tab.value === saleStatusFilter;
            return (
              <Button
                key={tab.param + tab.value}
                variant="outline"
                onClick={() => handleStatusFilter(tab)}
                className="px-3.5 py-1.5 h-auto text-[11px] rounded-full"
                style={{
                  background: isActive ? tab.activeBg : "transparent",
                  color: isActive ? tab.activeColor : "var(--muted-foreground)",
                  borderColor: isActive ? tab.activeColor + "40" : "rgba(160,132,126,0.15)",
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filtro por barrio/zona — fila secundaria */}
      <div className="px-8 mb-4">
        <div
          className="flex items-center gap-3 px-4 py-1 rounded-lg"
          style={{ background: "var(--muted)", border: "1px solid rgba(160,132,126,0.08)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] flex-shrink-0 text-muted-foreground">
            Barrio:
          </span>
          <ZoneCombobox
            value={zoneFilter}
            onChange={handleZoneFilter}
            placeholder="Filtrar por barrio o zona…"
            showCreate={false}
            eager
            className="flex-1"
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-8 flex-1">
        {/* Table label + count */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: "var(--muted)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Propiedades
            </span>
            {pagination && (
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                {pagination.total} {pagination.total === 1 ? "propiedad" : "propiedades"}
              </span>
            )}
          </div>
        </div>

        {/* Table header */}
        <div
          className="grid text-[10px] font-bold uppercase tracking-[0.12em] px-4 py-3"
          style={{
            gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 150px 60px 64px",
            color: "var(--muted-foreground)",
            background: "var(--muted)",
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
        {isLoading &&
          Array.from({ length: 5 }, (_, i) => (
            <SkeletonPropertyRow key={i} index={i} />
          ))
        }

        {/* Error */}
        {error && !isLoading && (
          <div
            className="flex flex-col items-center gap-3 py-16"
            style={{ background: "var(--background)" }}
          >
            <p className="text-sm text-destructive">
              {(error as Error).message}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && properties.length === 0 && (
          <div
            className="py-20 text-center"
            style={{ background: "var(--background)" }}
          >
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              No se encontraron propiedades.
            </p>
          </div>
        )}

        {/* Rows */}
        {!isLoading &&
          !error &&
          properties.map((prop, i) => (
            <div
              key={prop.id}
              className="row-animate"
              style={{ "--row-delay": `${i * 45}ms` } as React.CSSProperties}
            >
              <PropertyRowItem
                prop={prop}
                even={i % 2 === 1}
                onClick={() => router.push(`/propiedades/${prop.id}`)}
              />
            </div>
          ))}

        {/* Pagination */}
        {pagination && pagination.totalPages > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: "var(--background)",
              borderTop: "1px solid rgba(160,132,126,0.1)",
            }}
          >
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
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
                      style={{ color: "var(--muted-foreground)" }}
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
        <div className="px-8 pt-4">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonPropertyRow key={i} index={i} />
          ))}
        </div>
      }
    >
      <PropertyListContent />
    </Suspense>
  );
}
