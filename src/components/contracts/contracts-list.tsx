"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { differenceInDays, format } from "date-fns";
import { ClientPagination } from "@/components/clients/client-pagination";
import { Button } from "@/components/ui/button";

/* ──────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_PALETTE = [
  "bg-primary-dark text-white",
  "bg-[#3a2a6b] text-white",
  "bg-[#1a4a4a] text-white",
  "bg-[#1a2a4a] text-white",
  "bg-[#3a3a1a] text-white",
];

function avatarColor(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

const FREQ_SHORT: Record<number, string> = {
  1: "mens.",
  3: "trim.",
  6: "sem.",
  12: "anual",
};

function freqShort(freq: number): string {
  return FREQ_SHORT[freq] ?? `c/${freq}m`;
}

type ValidityDays = { text: string; variant: "normal" | "alerta" | "vencida" };

function validityDays(startDate: string, endDate: string, status: string): ValidityDays {
  const today = new Date();
  const end = new Date(endDate);
  const start = new Date(startDate);

  if (status === "terminated") {
    return { text: "Rescindido", variant: "normal" };
  }
  if (status === "draft") {
    const days = Math.abs(differenceInDays(today, start));
    return { text: `Creado hace ${days} día${days !== 1 ? "s" : ""}`, variant: "normal" };
  }
  const daysToEnd = differenceInDays(end, today);
  if (status === "expired" || daysToEnd < 0) {
    const ago = Math.abs(daysToEnd);
    return { text: `Venció hace ${ago} día${ago !== 1 ? "s" : ""}`, variant: "vencida" };
  }
  if (status === "pending_signature") {
    return { text: `Inicio en ${daysToEnd} días`, variant: "normal" };
  }
  if (daysToEnd <= 60) {
    return { text: `⚠ Vence en ${daysToEnd} días`, variant: "alerta" };
  }
  return { text: `Vence en ${daysToEnd} días`, variant: "normal" };
}

/* ──────────────────────────────────────────────────────────
   STATUS CONFIG
   ────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  active: "Vigente",
  expiring_soon: "Por vencer",
  expired: "Vencido",
  terminated: "Rescindido",
  draft: "En redacción",
  pending_signature: "Pend. firma",
};

function statusTagClasses(status: string): { pill: string; dot: string } {
  switch (status) {
    case "active":
      return {
        pill: "bg-green-dim text-green",
        dot: "bg-green",
      };
    case "expiring_soon":
      return {
        pill: "bg-mustard-dim text-mustard",
        dot: "bg-mustard",
      };
    case "expired":
      return {
        pill: "bg-error-dim text-error",
        dot: "bg-error",
      };
    case "terminated":
      return {
        pill: "bg-surface-highest text-text-muted border border-border",
        dot: "bg-text-muted",
      };
    case "draft":
      return {
        pill: "bg-info-dim text-info",
        dot: "bg-info",
      };
    case "pending_signature":
      return {
        pill: "bg-primary-dim text-primary",
        dot: "bg-primary",
      };
    default:
      return { pill: "bg-surface-highest text-text-muted", dot: "bg-text-muted" };
  }
}

/* ──────────────────────────────────────────────────────────
   FILTER CHIPS CONFIG
   ────────────────────────────────────────────────────────── */

const STATUS_FILTERS = [
  { value: "", label: "Todos", activeClasses: "bg-primary-dim text-primary border-border-accent" },
  { value: "activos", label: "Activos", activeClasses: "bg-primary-dim text-primary border-border-accent" },
  { value: "expiring_soon", label: "Por vencer", activeClasses: "bg-mustard-dim text-mustard border-mustard/25" },
  { value: "draft", label: "En redacción", activeClasses: "bg-info-dim text-info border-info/25" },
  { value: "pending_signature", label: "Pend. firma", activeClasses: "bg-primary-dim text-primary border-border-accent" },
  { value: "expired", label: "Vencidos", activeClasses: "bg-error-dim text-error border-error/25" },
  { value: "terminated", label: "Rescindidos", activeClasses: "bg-surface-highest text-text-muted border-border" },
];

/* ──────────────────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────────────────── */

interface ContractRow {
  id: string;
  contractNumber: string;
  propertyAddress: string | null;
  tenantNames: string[];
  ownerName: string;
  startDate: string;
  endDate: string;
  status: string;
  monthlyAmount: string | null;
  adjustmentIndex: string | null;
  adjustmentFrequency: number | null;
}

export function ContractsList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["contracts", page, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("q", searchQuery);
      const response = await fetch(`/api/contracts?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener los contratos");
      }
      return response.json();
    },
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/contratos?${params.toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (status) params.set("status", status);
    else params.delete("status");
    router.push(`/contratos?${params.toString()}`);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value) params.set("q", value);
    else params.delete("q");
    router.push(`/contratos?${params.toString()}`);
  };

  const counts = data?.counts ?? {};
  const contracts: ContractRow[] = data?.contracts ?? [];
  const total: number = data?.pagination?.total ?? 0;

  return (
    <div className="flex flex-1 flex-col">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between px-7 pt-6 pb-5">
        <div>
          <h1 className="font-headline text-[1.35rem] font-bold text-on-bg tracking-tight leading-tight">
            Contratos
          </h1>
          <p className="text-[0.78rem] text-text-muted mt-1">
            Gestión del ciclo de vida contractual
          </p>
        </div>
        <Link href="/contratos/nuevo">
          <Button size="sm" className="text-[0.72rem] font-semibold">
            + Nuevo contrato
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-7 pb-7">

        {/* ── KPI Grid ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Vigentes — accent */}
          <div className="rounded-[18px] border p-4 px-[18px]"
            style={{ borderColor: "var(--border-accent)", background: "linear-gradient(135deg, var(--surface) 0%, rgba(107,23,2,0.08) 100%)" }}>
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Vigentes</p>
            <p className="font-headline text-[1.6rem] font-bold text-primary leading-none">
              {isLoading ? "—" : counts.active ?? 0}
            </p>
            <p className="text-[0.68rem] text-text-muted mt-1.5">contratos activos</p>
          </div>

          {/* Por vencer — warn */}
          <div className="rounded-[18px] border p-4 px-[18px]"
            style={{ borderColor: "rgba(253,222,168,0.2)", background: "linear-gradient(135deg, var(--surface) 0%, var(--mustard-dim) 100%)" }}>
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Por vencer</p>
            <p className="font-headline text-[1.6rem] font-bold text-mustard leading-none">
              {isLoading ? "—" : counts.expiring_soon ?? 0}
            </p>
            <p className="text-[0.68rem] text-text-muted mt-1.5">vencen en ≤ 60 días</p>
          </div>

          {/* En redacción — draft/info */}
          <div className="rounded-[18px] border p-4 px-[18px]"
            style={{ borderColor: "rgba(147,197,253,0.2)", background: "linear-gradient(135deg, var(--surface) 0%, var(--info-dim) 100%)" }}>
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">En redacción</p>
            <p className="font-headline text-[1.6rem] font-bold text-info leading-none">
              {isLoading ? "—" : counts.draft ?? 0}
            </p>
            <p className="text-[0.68rem] text-text-muted mt-1.5">borradores activos</p>
          </div>

          {/* Pend. de firma */}
          <div className="rounded-[18px] border border-border p-4 px-[18px] bg-surface">
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Pend. de firma</p>
            <p className="font-headline text-[1.6rem] font-bold text-on-bg leading-none">
              {isLoading ? "—" : counts.pending_signature ?? 0}
            </p>
            <p className="text-[0.68rem] text-text-muted mt-1.5">esperando firmas</p>
          </div>

          {/* Vencidos — err */}
          <div className="rounded-[18px] border p-4 px-[18px]"
            style={{ borderColor: "rgba(255,180,171,0.2)", background: "linear-gradient(135deg, var(--surface) 0%, var(--error-dim) 100%)" }}>
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Vencidos</p>
            <p className="font-headline text-[1.6rem] font-bold text-error leading-none">
              {isLoading ? "—" : counts.expired ?? 0}
            </p>
            <p className="text-[0.68rem] text-text-muted mt-1.5">sin renovar ni rescindir</p>
          </div>
        </div>

        {/* ── Toolbar ───────────────────────────────────── */}
        <div className="flex items-center gap-[10px] bg-surface border border-border rounded-xl px-[14px] py-[10px]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="h-[0.85rem] w-[0.85rem] text-text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchInput);
                if (e.key === "Escape") { setSearchInput(""); handleSearch(""); }
              }}
              placeholder="Buscar por propiedad, inquilino, propietario, N° contrato…"
              className="flex-1 bg-transparent outline-none text-[0.82rem] text-on-surface placeholder:text-text-muted min-w-0"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); handleSearch(""); }}
                className="text-text-muted hover:text-on-surface transition-colors flex-shrink-0"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="w-px h-[22px] bg-border flex-shrink-0" />

          <div className="flex gap-1.5 flex-wrap flex-shrink-0">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleStatusFilter(f.value)}
                className={`px-3 py-1 text-[0.68rem] font-semibold border rounded-full cursor-pointer transition-all ${
                  statusFilter === f.value
                    ? f.activeClasses
                    : "bg-surface-high text-text-secondary border-border hover:text-on-surface hover:border-white/15"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tabla ─────────────────────────────────────── */}
        {error ? (
          <div className="rounded-xl bg-error-dim border border-error/20 p-6 text-center">
            <p className="text-error mb-4 text-sm">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-[18px] overflow-hidden">
            {/* Tabla header */}
            <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  Contratos
                </span>
                <span className="text-[0.72rem] text-text-muted">{total} resultado{total !== 1 ? "s" : ""}</span>
              </div>
              <button className="px-2 py-1 text-[0.67rem] font-semibold border border-border rounded-md text-text-secondary bg-transparent hover:bg-surface-high transition-colors">
                ↓ Exportar
              </button>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-20 px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border">
                    N°
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border">
                    Propiedad
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border">
                    Inquilino
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border">
                    Propietario
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border cursor-pointer hover:text-on-surface">
                    Vigencia
                  </th>
                  <th className="px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border">
                    Monto actual
                  </th>
                  <th className="w-32 px-[14px] py-[10px] text-left text-[0.67rem] font-bold uppercase tracking-[0.08em] text-text-muted bg-surface-low border-b border-border">
                    Estado
                  </th>
                  <th className="w-16 px-[14px] py-[10px] bg-surface-low border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {contracts.length > 0 ? (
                  contracts.map((c) => {
                    const dias = validityDays(c.startDate, c.endDate, c.status);
                    const { pill, dot } = statusTagClasses(c.status);
                    const tenantName = c.tenantNames[0] ?? "";
                    const tenantInitials = getInitials(tenantName);
                    const ownerInitials = getInitials(c.ownerName ?? "");
                    const isDraft = c.status === "draft";
                    const isExpiring = c.status === "expiring_soon";
                    const isExpired = c.status === "expired";
                    const isTerminated = c.status === "terminated";

                    return (
                      <tr
                        key={c.id}
                        className={`group cursor-pointer transition-all ${isTerminated ? "opacity-60 hover:opacity-100" : ""}`}
                        onClick={() => router.push(`/contratos/${c.id}`)}
                      >
                        {/* N° — with status left-border for por-vencer/vencido */}
                        <td
                          className="px-[14px] py-[11px] text-[0.78rem] text-on-surface border-b border-border align-middle"
                          style={{
                            borderLeft: isExpiring
                              ? "2px solid var(--mustard)"
                              : isExpired
                              ? "2px solid var(--error)"
                              : undefined,
                          }}
                        >
                          <span className="font-mono text-[0.67rem] text-text-muted">
                            {c.contractNumber}
                          </span>
                        </td>

                        {/* Propiedad */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[0.82rem] text-on-surface leading-tight">
                              {c.propertyAddress || <span className="text-text-muted italic">Sin dirección</span>}
                            </span>
                          </div>
                        </td>

                        {/* Inquilino */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          {tenantName ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[0.62rem] font-bold flex-shrink-0 ${avatarColor(tenantName)}`}>
                                {tenantInitials}
                              </div>
                              <span className="text-[0.78rem] font-medium text-on-surface">
                                {tenantName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-muted text-[0.78rem]">—</span>
                          )}
                        </td>

                        {/* Propietario */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[0.62rem] font-bold flex-shrink-0 ${avatarColor(c.ownerName ?? "")}`}>
                              {ownerInitials}
                            </div>
                            <span className="text-[0.78rem] font-medium text-on-surface">
                              {c.ownerName || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Vigencia */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          <div className="flex flex-col gap-0.5">
                            {isDraft ? (
                              <span className="text-[0.75rem] text-text-muted">A definir</span>
                            ) : (
                              <span className="text-[0.75rem] text-on-surface whitespace-nowrap">
                                {format(new Date(c.startDate), "dd/MM/yyyy")} →{" "}
                                {format(new Date(c.endDate), "dd/MM/yyyy")}
                              </span>
                            )}
                            <span
                              className={`text-[0.65rem] font-bold ${
                                dias.variant === "alerta"
                                  ? "text-mustard"
                                  : dias.variant === "vencida"
                                  ? "text-error"
                                  : "text-text-muted"
                              }`}
                            >
                              {dias.text}
                            </span>
                          </div>
                        </td>

                        {/* Monto actual */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          {c.monthlyAmount && !isDraft ? (
                            <div>
                              <div className="font-headline font-semibold text-[0.9rem] text-on-bg whitespace-nowrap">
                                ${parseFloat(c.monthlyAmount).toLocaleString("es-AR")}
                              </div>
                              <div className="text-[0.65rem] text-text-muted mt-0.5">
                                {c.adjustmentIndex ?? "—"}{c.adjustmentFrequency ? ` · ${freqShort(c.adjustmentFrequency)}` : ""}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-headline font-semibold text-[0.9rem] text-text-muted">—</div>
                              <div className="text-[0.65rem] text-text-muted mt-0.5">Pendiente</div>
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          <span
                            className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[0.67rem] font-bold tracking-[0.02em] whitespace-nowrap ${pill}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </td>

                        {/* Acciones (hover) */}
                        <td className="px-[14px] py-[11px] border-b border-border align-middle">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              title="Descargar PDF"
                              disabled={isDraft}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-1 text-[0.67rem] font-semibold border border-border rounded text-text-secondary bg-transparent hover:bg-surface-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-[0.82rem] text-text-muted">
                      No hay contratos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Paginación */}
            {data?.pagination && data.pagination.totalPages > 1 && (
              <div className="border-t border-border px-[18px] py-3">
                <ClientPagination
                  currentPage={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
