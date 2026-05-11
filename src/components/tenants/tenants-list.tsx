"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientPagination } from "@/components/clients/client-pagination";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  PlusCircle,
  Search,
  Users,
  AlertCircle,
  Clock,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoInquilino = "activo" | "pendiente" | "en_mora" | "por_vencer" | "sin_contrato" | "pendiente_firma" | "historico";

interface ContratoInfo {
  id: string;
  numero: string;
  status: string;
  endDate: string;
  completitud: number | null;
}

interface TenantRow {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  contrato: ContratoInfo | null;
  property: string | null;
  ultimoPago: string | null;
  estado: EstadoInquilino;
  diasMora: number;
}

interface Stats {
  total: number;
  conContratoActivo: number;
  enMora: number;
  pendiente: number;
  porVencer: number;
  sinContrato: number;
  pendienteFirma: number;
  historico: number;
}

interface TenantGroup {
  contractId: string | null;
  primary: TenantRow;
  coTenants: TenantRow[];
  groupEstado: EstadoInquilino;
  diasMora: number;
  ultimoPago: string | null;
}

interface TenantsResponse {
  groups: TenantGroup[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: Stats;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────


function getInitials(firstName: string, lastName: string | null): string {
  const f = firstName[0]?.toUpperCase() ?? "";
  const l = lastName?.[0]?.toUpperCase() ?? "";
  return f + l;
}

function formatFecha(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: es });
  } catch {
    return "—";
  }
}

// ─── Subcomponentes de estado ─────────────────────────────────────────────────

function EstadoBadge({
  estado,
  diasMora,
}: {
  estado: EstadoInquilino;
  diasMora: number;
}) {
  if (estado === "activo") {
    return <StatusBadge variant="active">Al día</StatusBadge>;
  }
  if (estado === "pendiente") {
    return <StatusBadge variant="suspended">Pendiente</StatusBadge>;
  }
  if (estado === "en_mora") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="flex items-center gap-1 text-xs text-mustard font-medium">
          <AlertTriangle className="size-3" />
          {diasMora} días de mora
        </span>
        <StatusBadge variant="baja">En mora</StatusBadge>
      </div>
    );
  }
  if (estado === "por_vencer") {
    return <StatusBadge variant="expiring">Por vencer</StatusBadge>;
  }
  if (estado === "pendiente_firma") {
    return <StatusBadge variant="reserved">Por firmar</StatusBadge>;
  }
  if (estado === "historico") {
    return <StatusBadge variant="draft">Histórico</StatusBadge>;
  }
  return <StatusBadge variant="draft">Postulante</StatusBadge>;
}

function ProgressBar({ value }: { value: number }) {
  const indicatorColor =
    value >= 90
      ? "[&>[data-slot=progress-indicator]]:bg-destructive"
      : value >= 70
        ? "[&>[data-slot=progress-indicator]]:bg-mustard"
        : "[&>[data-slot=progress-indicator]]:bg-neutral";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <Progress value={value} className={cn("h-1.5 flex-1", indicatorColor)} />
      <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
        {value}%
      </span>
    </div>
  );
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

const SKELETON_WIDTHS = [
  ["w-28", "w-48", "w-32"],
  ["w-24", "w-52", "w-36"],
  ["w-32", "w-44", "w-28"],
  ["w-20", "w-56", "w-40"],
  ["w-28", "w-40", "w-32"],
] as const;

function SkeletonGroupRow({ index }: { index: number }) {
  const widths = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <TableRow className="pointer-events-none">
      <TableCell className="w-8 p-2" />
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-[10px] shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className={cn("h-3 rounded-sm", widths[0])} />
            <Skeleton className="h-2.5 rounded-sm w-16" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className={cn("h-3 rounded-sm", widths[1])} /></TableCell>
      <TableCell><Skeleton className="h-5 rounded w-16" /></TableCell>
      <TableCell><Skeleton className="h-3 rounded-sm w-20" /></TableCell>
      <TableCell><Skeleton className="h-3 rounded-sm w-20" /></TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-[100px]">
          <Skeleton className="h-1.5 flex-1 rounded-full" />
          <Skeleton className="h-3 w-7 rounded-sm" />
        </div>
      </TableCell>
      <TableCell><Skeleton className={cn("h-5 rounded-full", widths[2])} /></TableCell>
    </TableRow>
  );
}

// ─── Fila de grupo (primario + co-inquilinos colapsables) ─────────────────────

function TenantGroupRow({
  group,
  index,
  onNavigate,
}: {
  group: TenantGroup;
  index: number;
  onNavigate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasCoTenants = group.coTenants.length > 0;
  const { primary } = group;
  const nombre = `${primary.firstName} ${primary.lastName ?? ""}`.trim();

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/30 transition-colors row-animate"
        style={{ "--row-delay": `${index * 45}ms` } as React.CSSProperties}
        onClick={() => onNavigate(primary.id)}
      >
        {/* Toggle */}
        <TableCell className="w-8 p-2 text-center">
          {hasCoTenants && (
            <button
              type="button"
              aria-label={open ? "Ocultar co-inquilinos" : "Ver co-inquilinos"}
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="inline-flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {open ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
          )}
        </TableCell>

        {/* Tenant */}
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <EntityAvatar
                initials={getInitials(primary.firstName, primary.lastName)}
                size="md"
                colorSeed={primary.firstName}
              />
              {hasCoTenants && (
                <div className="absolute -bottom-1 -right-1 ring-1 ring-background rounded-sm">
                  <EntityAvatar
                    initials={getInitials(
                      group.coTenants[0].firstName,
                      group.coTenants[0].lastName
                    )}
                    size="sm"
                    colorSeed={group.coTenants[0].firstName}
                  />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{nombre}</p>
              {hasCoTenants && (
                <p className="text-xs text-muted-foreground">
                  +{group.coTenants.length} co-inquilino
                  {group.coTenants.length > 1 ? "s" : ""}
                </p>
              )}
              {primary.dni && (
                <p className="text-xs text-muted-foreground">DNI {primary.dni}</p>
              )}
            </div>
          </div>
        </TableCell>

        {/* Propiedad */}
        <TableCell>
          <span className="text-sm">
            {primary.property ?? <span className="field-value empty" />}
          </span>
        </TableCell>

        {/* Contrato */}
        <TableCell>
          {primary.contrato ? (
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {primary.contrato.numero}
            </span>
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Vencimiento */}
        <TableCell>
          {primary.contrato?.endDate ? (
            <span className="text-sm">{formatFecha(primary.contrato.endDate)}</span>
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Último pago (más reciente del grupo) */}
        <TableCell>
          {group.ultimoPago ? (
            <span className="text-sm">{formatFecha(group.ultimoPago)}</span>
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Completitud */}
        <TableCell>
          {primary.contrato?.completitud != null ? (
            <ProgressBar value={primary.contrato.completitud} />
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Estado */}
        <TableCell>
          <EstadoBadge estado={group.groupEstado} diasMora={group.diasMora} />
        </TableCell>
      </TableRow>

      {/* Sub-filas de co-inquilinos */}
      {open &&
        group.coTenants.map((ct) => {
          const ctNombre = `${ct.firstName} ${ct.lastName ?? ""}`.trim();
          return (
            <TableRow
              key={ct.id}
              className="bg-muted/5 hover:bg-muted/15 transition-colors"
            >
              <TableCell className="w-8 p-2" />
              <TableCell className="border-l-2 border-primary/40 pl-10">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left hover:underline underline-offset-2"
                  onClick={() => onNavigate(ct.id)}
                >
                  <EntityAvatar
                    initials={getInitials(ct.firstName, ct.lastName)}
                    size="sm"
                    colorSeed={ct.firstName}
                  />
                  <span className="text-sm font-medium">{ctNombre}</span>
                </button>
              </TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell>
                {ct.ultimoPago ? (
                  <span className="text-sm">{formatFecha(ct.ultimoPago)}</span>
                ) : (
                  <span className="field-value empty" />
                )}
              </TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell>
                <EstadoBadge estado={ct.estado} diasMora={ct.diasMora} />
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}

// ─── Filtros de estado ────────────────────────────────────────────────────────

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "activo", label: "Al día" },
  { key: "pendiente", label: "Pendiente" },
  { key: "en_mora", label: "En mora" },
  { key: "por_vencer", label: "Por vencer" },
  { key: "pendiente_firma", label: "Por firmar" },
  { key: "historico", label: "Histórico" },
] as const;

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportarCSV(groups: TenantGroup[]) {
  const encabezados = [
    "Nombre", "DNI", "Teléfono", "Propiedad", "Contrato",
    "Vencimiento", "Último Pago", "Completitud", "Estado", "Rol",
  ];
  const estadoLabel: Record<EstadoInquilino, string> = {
    activo: "Al día",
    pendiente: "Pendiente",
    en_mora: "En mora",
    por_vencer: "Por vencer",
    sin_contrato: "Postulante",
    pendiente_firma: "Por firmar",
    historico: "Histórico",
  };

  const filas: string[][] = [];
  for (const g of groups) {
    const allMembers = [
      { tenant: g.primary, rol: g.coTenants.length > 0 ? "Principal" : "" },
      ...g.coTenants.map((ct) => ({ tenant: ct, rol: "Co-inquilino" })),
    ];
    for (const { tenant: i, rol } of allMembers) {
      filas.push([
        `${i.firstName} ${i.lastName ?? ""}`.trim(),
        i.dni ?? "",
        i.phone ?? "",
        i.property ?? "",
        i.contrato?.numero ?? "",
        i.contrato?.endDate ? formatFecha(i.contrato.endDate) : "",
        i.ultimoPago ? formatFecha(i.ultimoPago) : "",
        i.contrato?.completitud != null ? `${i.contrato.completitud}%` : "",
        estadoLabel[i.estado],
        rol,
      ]);
    }
  }

  const csv = [encabezados, ...filas]
    .map((fila) => fila.map((c) => `"${c}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inquilinos_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TenantsList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );
  const [search, setSearch] = useState(searchInput);
  const estadoFilter = searchParams.get("estado") ?? "todos";

  // Debounce de búsqueda: espera 300ms antes de lanzar la query
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error, refetch } = useQuery<TenantsResponse>({
    queryKey: ["tenants", page, search, estadoFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (estadoFilter !== "todos") params.set("estado", estadoFilter);
      const res = await fetch(`/api/tenants?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al obtener los inquilinos");
      }
      return res.json();
    },
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/inquilinos?${params.toString()}`);
  };

  const handleFiltroChange = (filtro: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("estado", filtro);
    params.set("page", "1");
    router.push(`/inquilinos?${params.toString()}`);
  };

  const stats = data?.stats;
  const groups = data?.groups ?? [];
  const pagination = data?.pagination;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inquilinos</h1>
          <p className="text-sm text-muted-foreground">
            Todas las personas con contrato activo o historial en el sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => groups.length > 0 && exportarCSV(groups)}
            disabled={groups.length === 0}
          >
            <Download className="mr-2 size-4" />
            Exportar
          </Button>
          <Button asChild size="sm">
            <Link href="/inquilinos/nuevo">
              <PlusCircle className="mr-2 size-4" />
              Nuevo inquilino
            </Link>
          </Button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total */}
        <Card className="rounded-xl border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Inquilinos
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {isLoading ? "—" : (stats?.total ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats?.conContratoActivo ?? 0} con contrato activo
                </p>
              </div>
              <Users className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* En mora */}
        <Card className="rounded-xl border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  En mora
                </p>
                <p className="mt-1 text-3xl font-bold text-mustard">
                  {isLoading ? "—" : (stats?.enMora ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  con pagos atrasados
                </p>
              </div>
              <AlertCircle className="size-5 text-mustard" />
            </div>
          </CardContent>
        </Card>

        {/* Por vencer */}
        <Card className="rounded-xl border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contrato por vencer
                </p>
                <p className="mt-1 text-3xl font-bold text-mustard">
                  {isLoading ? "—" : (stats?.porVencer ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  vencen en ≤ 90 días
                </p>
              </div>
              <Clock className="size-5 text-mustard" />
            </div>
          </CardContent>
        </Card>

        {/* Sin contrato */}
        <Card className="rounded-xl border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Sin contrato activo
                </p>
                <p className="mt-1 text-3xl font-bold text-muted-foreground">
                  {isLoading ? "—" : (stats?.sinContrato ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  registrados sin contrato
                </p>
              </div>
              <UserX className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, DNI, dirección o contrato..."
          className="pl-9"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Filtros de estado + contador */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border p-1 gap-0.5">
          {FILTROS.map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => handleFiltroChange(f.key)}
              className={cn(
                "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                estadoFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!isLoading && pagination && (
          <span className="text-sm text-muted-foreground">
            {pagination.total} grupo{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tabla o estados de carga/error */}
      {error ? (
        <div className="flex flex-col items-center gap-4">
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-8" />
                  <TableHead className="font-semibold">Inquilino</TableHead>
                  <TableHead className="font-semibold">Propiedad</TableHead>
                  <TableHead className="font-semibold">Contrato</TableHead>
                  <TableHead className="font-semibold">Vencimiento</TableHead>
                  <TableHead className="font-semibold">Último pago</TableHead>
                  <TableHead className="font-semibold">Completitud</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <SkeletonGroupRow key={i} index={i} />
                  ))
                ) : groups.length > 0 ? (
                  groups.map((group, i) => (
                    <TenantGroupRow
                      key={group.primary.id}
                      group={group}
                      index={i}
                      onNavigate={(id) => router.push(`/inquilinos/${id}`)}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="size-8" />
                        <p className="text-sm">No hay inquilinos para mostrar.</p>
                        {search && (
                          <p className="text-xs">
                            Probá con otra búsqueda o limpiá el filtro.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación + texto "Mostrando X-Y de Z" */}
          {pagination && pagination.totalPages > 0 && (
            <div className="flex flex-col items-center gap-2">
              <ClientPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
              <p className="text-xs text-muted-foreground">
                Mostrando{" "}
                {pagination.total === 0
                  ? 0
                  : (pagination.page - 1) * pagination.limit + 1}
                –
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}{" "}
                de {pagination.total} grupo
                {pagination.total !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
