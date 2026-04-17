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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuickPropertyForm } from "@/components/properties/quick-property-form";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { cn } from "@/lib/utils";

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

const STATUS_CONFIG: Record<string, { label: string; borderLeft?: string }> = {
  available:   { label: "Disponible",    borderLeft: "var(--status-available)" },
  rented:      { label: "Alquilada" },
  reserved:    { label: "Reservada" },
  maintenance: { label: "Mantenimiento", borderLeft: "var(--status-maintenance)" },
  sold:        { label: "Vendida" },
};

const STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  available:   "available",
  rented:      "rented",
  reserved:    "reserved",
  maintenance: "maintenance",
  sold:        "baja",
};

/** Colores activos para cada chip de filtro */
const FILTER_TABS = [
  { value: "", label: "Todos", activeBg: "var(--primary)", activeColor: "var(--primary-foreground)" },
  { value: "rented", label: "Alquiladas", activeBg: "var(--status-rented-dim)", activeColor: "var(--status-rented)" },
  { value: "available", label: "Disponibles", activeBg: "var(--status-available-dim)", activeColor: "var(--status-available)" },
  { value: "reserved", label: "Reservadas", activeBg: "var(--status-reserved-dim)", activeColor: "var(--status-reserved)" },
  { value: "maintenance", label: "Mantenimiento", activeBg: "var(--status-maintenance-dim)", activeColor: "var(--status-maintenance)" },
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
    <Card
      className="flex-1 min-w-0 rounded-lg border gap-0 py-0"
      style={{ background: bgGradient, borderColor }}
    >
      <CardContent className="px-6 py-5 flex flex-col">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3 text-muted-foreground">
          {label}
        </p>
        <p
          className="text-4xl font-bold leading-none mb-1 tabular-nums font-headline"
          style={{ color: valueColor }}
        >
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
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

// ── Property row ──────────────────────────────────────────────────────────────

function PropertyRowItem({ prop, even, onClick }: { prop: PropertyRow; even: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[prop.status];
  return (
    <div
      className={cn(
        "grid px-4 py-3 cursor-pointer transition-colors group",
        "hover:bg-[var(--primary-subtle)]",
        even ? "bg-[var(--surface-mid)]" : "bg-background"
      )}
      style={{
        gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 130px 60px 64px",
        borderBottom: "1px solid rgba(160,132,126,0.07)",
        borderLeft: cfg?.borderLeft ? `2px solid ${cfg.borderLeft}` : "2px solid transparent",
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
            {prop.title || prop.address}
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
      <div className="flex items-center">
        <StatusBadge variant={STATUS_VARIANT[prop.status] ?? "available"}>
          {STATUS_CONFIG[prop.status]?.label ?? prop.status}
        </StatusBadge>
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
    <div className="flex flex-col min-h-full" style={{ background: "var(--background)" }}>

      {/* Modal — Nueva propiedad */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg p-0 gap-0 border-border overflow-hidden"
          style={{ background: "var(--card)" }}
        >
          <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-white font-headline">
                  Nueva propiedad
                </DialogTitle>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Los campos con <span className="text-primary">*</span> son obligatorios.
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
            onClick={() => setDialogOpen(true)}
            size="lg"
            className="gap-2.5 rounded-xl shadow-lg"
            style={{ boxShadow: "0 4px 14px rgba(255,180,162,0.25)" }}
          >
            <Plus size={18} />
            Nueva propiedad
          </Button>
        </div>
      </div>

      {/* KPI cards — colores diferenciados por tipo */}
      <div className="px-8 mb-5">
        <div className="flex gap-3">
          <KpiCard
            label="Total"
            value={counts?.total ?? 0}
            sub="propiedades en cartera"
            valueColor="var(--primary)"
            borderColor="rgba(255,180,162,0.2)"
            bgGradient="linear-gradient(135deg, var(--background) 0%, rgba(107,23,2,0.08) 100%)"
          />
          <KpiCard
            label="Alquiladas"
            value={counts?.rented ?? 0}
            sub={`${occupancyPct}% de ocupación`}
            valueColor="var(--status-rented)"
            borderColor="rgba(141,207,149,0.2)"
            bgGradient="linear-gradient(135deg, var(--background) 0%, rgba(141,207,149,0.06) 100%)"
          />
          <KpiCard
            label="Disponibles"
            value={counts?.available ?? 0}
            sub="sin contrato activo"
            valueColor="var(--status-available)"
            borderColor="rgba(253,222,168,0.2)"
            bgGradient="linear-gradient(135deg, var(--background) 0%, rgba(253,222,168,0.06) 100%)"
          />
          <KpiCard
            label="Mantenimiento"
            value={counts?.maintenance ?? 0}
            sub="fuera de disponibilidad"
            valueColor="var(--status-maintenance)"
            borderColor="rgba(253,186,116,0.2)"
            bgGradient="linear-gradient(135deg, var(--background) 0%, rgba(253,186,116,0.06) 100%)"
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
            const isActive = tab.value === statusFilter;
            return (
              <Button
                key={tab.value}
                variant="outline"
                onClick={() => handleStatusFilter(tab.value)}
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
          <Input
            type="text"
            placeholder="Filtrar por barrio o zona…"
            value={zoneInput}
            onChange={(e) => handleZoneFilter(e.target.value)}
            className="flex-1 border-0 bg-transparent text-[12px] h-9 px-0"
          />
          {zoneInput && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 flex-shrink-0"
              onClick={() => handleZoneFilter("")}
            >
              <X size={13} />
            </Button>
          )}
          <span className="text-[10px] ml-auto flex-shrink-0 text-muted-foreground">
            Filtro por zona
          </span>
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
            gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) 130px 60px 64px",
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
        {isLoading && (
          <div
            className="flex items-center justify-center py-20"
            style={{ background: "var(--background)" }}
          >
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>
        )}

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
        <div className="flex h-64 items-center justify-center">
          <Loader2
            className="animate-spin"
            style={{ color: "var(--muted-foreground)" }}
          />
        </div>
      }
    >
      <PropertyListContent />
    </Suspense>
  );
}
