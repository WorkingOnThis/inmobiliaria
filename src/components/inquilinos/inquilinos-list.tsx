"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientPagination } from "@/components/clients/client-pagination";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Download,
  Loader2,
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

type EstadoInquilino = "activo" | "en_mora" | "por_vencer" | "sin_contrato";

interface ContratoInfo {
  id: string;
  numero: string;
  endDate: string;
  completitud: number | null;
}

interface InquilinoRow {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  contrato: ContratoInfo | null;
  propiedad: string | null;
  ultimoPago: string | null;
  estado: EstadoInquilino;
  diasMora: number;
}

interface Stats {
  total: number;
  conContratoActivo: number;
  enMora: number;
  porVencer: number;
  sinContrato: number;
}

interface InquilinosResponse {
  inquilinos: InquilinoRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: Stats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-avatar-a",
  "bg-avatar-b",
  "bg-neutral",
  "bg-income",
  "bg-destructive",
  "bg-status-reserved",
  "bg-mustard",
  "bg-primary",
];

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

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
    return <StatusBadge variant="green">Activo</StatusBadge>;
  }
  if (estado === "en_mora") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="flex items-center gap-1 text-xs text-mustard font-medium">
          <AlertTriangle className="h-3 w-3" />
          {diasMora} días de mora
        </span>
        <StatusBadge variant="red">En mora</StatusBadge>
      </div>
    );
  }
  if (estado === "por_vencer") {
    return <StatusBadge variant="mustard">Por vencer</StatusBadge>;
  }
  return <StatusBadge variant="muted">Sin contrato</StatusBadge>;
}

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? "bg-destructive"
      : value >= 70
        ? "bg-mustard"
        : "bg-neutral";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
        {value}%
      </span>
    </div>
  );
}

// ─── Filtros de estado ────────────────────────────────────────────────────────

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "activo", label: "Activos" },
  { key: "en_mora", label: "En mora" },
  { key: "por_vencer", label: "Por vencer" },
  { key: "sin_contrato", label: "Sin contrato" },
] as const;

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportarCSV(inquilinos: InquilinoRow[]) {
  const encabezados = [
    "Nombre",
    "DNI",
    "Teléfono",
    "Propiedad",
    "Contrato",
    "Vencimiento",
    "Último Pago",
    "Completitud",
    "Estado",
  ];
  const estadoLabel: Record<EstadoInquilino, string> = {
    activo: "Activo",
    en_mora: "En mora",
    por_vencer: "Por vencer",
    sin_contrato: "Sin contrato",
  };
  const filas = inquilinos.map((i) => [
    `${i.firstName} ${i.lastName ?? ""}`.trim(),
    i.dni ?? "",
    i.phone ?? "",
    i.propiedad ?? "",
    i.contrato?.numero ?? "",
    i.contrato?.endDate ? formatFecha(i.contrato.endDate) : "",
    i.ultimoPago ? formatFecha(i.ultimoPago) : "",
    i.contrato?.completitud != null ? `${i.contrato.completitud}%` : "",
    estadoLabel[i.estado],
  ]);

  const csv = [encabezados, ...filas]
    .map((fila) => fila.map((c) => `"${c}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inquilinos_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function InquilinosList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );
  const [search, setSearch] = useState(searchInput);
  const [estadoFilter, setEstadoFilter] = useState<string>(
    searchParams.get("estado") || "todos"
  );

  // Debounce de búsqueda: espera 300ms antes de lanzar la query
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error, refetch } = useQuery<InquilinosResponse>({
    queryKey: ["inquilinos", page, search, estadoFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (estadoFilter !== "todos") params.set("estado", estadoFilter);
      const res = await fetch(`/api/inquilinos?${params}`);
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
    setEstadoFilter(filtro);
    const params = new URLSearchParams(searchParams.toString());
    params.set("estado", filtro);
    params.set("page", "1");
    router.push(`/inquilinos?${params.toString()}`);
  };

  const stats = data?.stats;
  const inquilinos = data?.inquilinos ?? [];
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
            onClick={() => inquilinos.length > 0 && exportarCSV(inquilinos)}
            disabled={inquilinos.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button asChild size="sm">
            <Link href="/inquilinos/nuevo">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Inquilino
            </Link>
          </Button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total */}
        <div className="rounded-xl border bg-card p-4">
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
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        {/* En mora */}
        <div className="rounded-xl border bg-card p-4">
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
            <AlertCircle className="h-5 w-5 text-mustard" />
          </div>
        </div>

        {/* Por vencer */}
        <div className="rounded-xl border bg-card p-4">
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
            <Clock className="h-5 w-5 text-mustard" />
          </div>
        </div>

        {/* Sin contrato */}
        <div className="rounded-xl border bg-card p-4">
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
            <UserX className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            {pagination.total} registro{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tabla o estados de carga/error */}
      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center">
          <p className="text-destructive mb-4">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
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
                {inquilinos.length > 0 ? (
                  inquilinos.map((inq) => {
                    const nombre = `${inq.firstName} ${inq.lastName ?? ""}`.trim();
                    return (
                      <TableRow
                        key={inq.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() =>
                          router.push(`/inquilinos/${inq.id}`)
                        }
                      >
                        {/* Inquilino */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                                getAvatarColor(inq.firstName)
                              )}
                            >
                              {getInitials(inq.firstName, inq.lastName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm leading-tight truncate">
                                {nombre}
                              </p>
                              {inq.dni && (
                                <p className="text-xs text-muted-foreground">
                                  DNI {inq.dni}
                                </p>
                              )}
                              {inq.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {inq.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Propiedad */}
                        <TableCell>
                          <span className="text-sm">
                            {inq.propiedad ?? (
                              <span className="field-value empty"></span>
                            )}
                          </span>
                        </TableCell>

                        {/* Contrato */}
                        <TableCell>
                          {inq.contrato ? (
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              {inq.contrato.numero}
                            </span>
                          ) : (
                            <span className="field-value empty"></span>
                          )}
                        </TableCell>

                        {/* Vencimiento */}
                        <TableCell>
                          {inq.contrato?.endDate ? (
                            <span className="text-sm">
                              {formatFecha(inq.contrato.endDate)}
                            </span>
                          ) : (
                            <span className="field-value empty"></span>
                          )}
                        </TableCell>

                        {/* Último pago */}
                        <TableCell>
                          {inq.ultimoPago ? (
                            <span className="text-sm">
                              {formatFecha(inq.ultimoPago)}
                            </span>
                          ) : (
                            <span className="field-value empty"></span>
                          )}
                        </TableCell>

                        {/* Completitud */}
                        <TableCell>
                          {inq.contrato?.completitud != null ? (
                            <ProgressBar value={inq.contrato.completitud} />
                          ) : (
                            <span className="field-value empty"></span>
                          )}
                        </TableCell>

                        {/* Estado */}
                        <TableCell>
                          <EstadoBadge
                            estado={inq.estado}
                            diasMora={inq.diasMora}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8" />
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
                de {pagination.total} inquilino
                {pagination.total !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
