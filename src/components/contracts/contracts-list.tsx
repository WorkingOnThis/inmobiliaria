"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, XCircle, Download, SlidersHorizontal, ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, format } from "date-fns";
import { ClientPagination } from "@/components/clients/client-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IndexValuesPanel } from "@/components/contracts/index-values-panel";

/* ── Helpers ──────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.62 0.13 30), oklch(0.46 0.12 25))",
  "linear-gradient(135deg, oklch(0.62 0.14 50), oklch(0.46 0.13 45))",
  "linear-gradient(135deg, oklch(0.55 0.13 270), oklch(0.42 0.13 265))",
  "linear-gradient(135deg, oklch(0.60 0.13 155), oklch(0.45 0.12 150))",
  "linear-gradient(135deg, oklch(0.60 0.13 200), oklch(0.45 0.12 205))",
  "linear-gradient(135deg, oklch(0.60 0.13 320), oklch(0.45 0.13 315))",
];

function avatarGradient(name: string): string {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

const FREQ_SHORT: Record<number, string> = { 1: "mens.", 3: "trim.", 6: "sem.", 12: "anual" };

function freqShort(freq: number): string {
  return FREQ_SHORT[freq] ?? `c/${freq}m`;
}

type ValidityDays = { text: string; variant: "normal" | "alerta" | "vencida" };

function validityDays(startDate: string, endDate: string, status: string): ValidityDays {
  const parseDate = (s: string) => new Date(s.length === 10 ? s + "T00:00:00" : s);
  const today = new Date();
  const end = parseDate(endDate);
  const start = parseDate(startDate);

  if (status === "terminated") return { text: "Rescindido", variant: "normal" };
  if (status === "draft") {
    const days = Math.abs(differenceInDays(today, start));
    return { text: `Creado hace ${days} día${days !== 1 ? "s" : ""}`, variant: "normal" };
  }
  const daysToEnd = differenceInDays(end, today);
  if (status === "expired" || daysToEnd < 0) {
    const ago = Math.abs(daysToEnd);
    return { text: `Venció hace ${ago} día${ago !== 1 ? "s" : ""}`, variant: "vencida" };
  }
  if (status === "pending_signature") return { text: `Inicio en ${daysToEnd} días`, variant: "normal" };
  if (daysToEnd <= 60) return { text: `Vence en ${daysToEnd} días`, variant: "alerta" };
  return { text: `Vence en ${daysToEnd} días`, variant: "normal" };
}

/* ── Status config ────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  // En proceso
  draft:             "Borrador",
  pending_signature: "Pend. firma",
  // Activo
  active:            "Vigente",
  expiring_soon:     "Por vencer",
  // Inactivo
  expired:           "Vencido",
  terminated:        "Rescindido",
};

function statusTagClasses(status: string): { pill: string; dot: string } {
  switch (status) {
    case "draft":
    case "pending_signature":
      return { pill: "bg-info-dim text-info", dot: "bg-info" };
    case "active":
      return { pill: "bg-income-dim text-income", dot: "bg-income" };
    case "expiring_soon":
      return { pill: "bg-mustard-dim text-mustard", dot: "bg-mustard" };
    case "expired":
    case "terminated":
      return { pill: "bg-surface-highest text-muted-foreground border border-border", dot: "bg-muted-foreground" };
    default:
      return { pill: "bg-surface-highest text-muted-foreground", dot: "bg-muted-foreground" };
  }
}

function groupActiveClasses(groupValue: string): { button: string; count: string; style?: React.CSSProperties } {
  switch (groupValue) {
    case "activos":
      return { button: "bg-income-dim text-income", count: "bg-income-dim text-income border-transparent" };
    case "en_proceso":
      return {
        button: "",
        count: "border-transparent",
        style: { background: "oklch(0.58 0.07 245 / 0.11)", color: "oklch(0.70 0.09 245)" },
      };
    case "terminados":
      return {
        button: "",
        count: "border-transparent",
        style: { background: "oklch(0.52 0.06 18 / 0.11)", color: "oklch(0.64 0.08 18)" },
      };
    default:
      return { button: "bg-primary-dim text-primary", count: "bg-primary-dim text-primary border-transparent" };
  }
}

/* ── Filter config ────────────────────────────────────────── */

const FILTER_GROUPS = [
  { value: "", label: "Todos", children: [] },
  {
    value: "activos", label: "Activos",
    children: [
      { value: "active", label: "Vigente" },
      { value: "expiring_soon", label: "Por vencer" },
    ],
  },
  {
    value: "en_proceso", label: "En proceso",
    children: [
      { value: "draft", label: "Borrador" },
      { value: "pending_signature", label: "Pend. firma" },
    ],
  },
  {
    value: "terminados", label: "Terminados",
    children: [
      { value: "expired", label: "Vencido" },
      { value: "terminated", label: "Rescindido" },
    ],
  },
];

function getGroupCount(groupValue: string, counts: Record<string, number>): number {
  if (groupValue === "") return Object.values(counts).reduce((s, v) => s + (v ?? 0), 0);
  if (groupValue === "activos") return (counts.active ?? 0) + (counts.expiring_soon ?? 0);
  if (groupValue === "en_proceso") return (counts.draft ?? 0) + (counts.pending_signature ?? 0);
  if (groupValue === "terminados") return (counts.expired ?? 0) + (counts.terminated ?? 0);
  return counts[groupValue] ?? 0;
}

/* ── Skeleton de carga ────────────────────────────────────── */

const SKELETON_WIDTHS = [
  ["w-16", "w-48", "w-32", "w-28"],
  ["w-14", "w-52", "w-28", "w-24"],
  ["w-20", "w-44", "w-36", "w-32"],
  ["w-12", "w-56", "w-24", "w-20"],
  ["w-16", "w-40", "w-32", "w-28"],
] as const;

function SkeletonContractRow({ index }: { index: number }) {
  const widths = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <tr className="pointer-events-none">
      {/* Nº */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <Skeleton className={`h-3 rounded-sm ${widths[0]}`} />
      </td>
      {/* Propiedad */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <Skeleton className={`h-3 rounded-sm ${widths[1]}`} />
      </td>
      {/* Inquilino */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <div className="flex items-center gap-[10px]">
          <Skeleton className="w-7 h-7 rounded-[7px] shrink-0" />
          <Skeleton className={`h-3 rounded-sm ${widths[2]}`} />
        </div>
      </td>
      {/* Propietario */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <div className="flex items-center gap-[10px]">
          <Skeleton className="w-7 h-7 rounded-[7px] shrink-0" />
          <Skeleton className={`h-3 rounded-sm ${widths[3]}`} />
        </div>
      </td>
      {/* Vigencia */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <Skeleton className="h-3 rounded-sm w-36 mb-1.5" />
        <Skeleton className="h-2.5 rounded-sm w-24" />
      </td>
      {/* Monto */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <Skeleton className="h-3.5 rounded-sm w-28 mb-1.5" />
        <Skeleton className="h-2.5 rounded-sm w-16" />
      </td>
      {/* Estado */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle">
        <Skeleton className="h-5 rounded-full w-20" />
      </td>
      {/* Acciones */}
      <td className="px-[16px] py-[14px] border-b border-border align-middle text-right">
        <Skeleton className="w-[30px] h-[30px] rounded-[7px]" />
      </td>
    </tr>
  );
}

/* ── Types ────────────────────────────────────────────────── */

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

/* ── Component ────────────────────────────────────────────── */

export function ContractsList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;
  const [groupFilter, setGroupFilter] = useState("");
  const [subFilter, setSubFilter] = useState("");
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  // El parámetro efectivo para la API es el subfiltro si está activo, sino el grupo
  const activeStatusParam = subFilter || groupFilter;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["contracts", page, activeStatusParam, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (activeStatusParam) params.set("status", activeStatusParam);
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

  const handleGroupFilter = (group: string) => {
    setGroupFilter(group);
    setSubFilter("");
  };

  const handleSubFilter = (sub: string) => {
    setSubFilter(sub === subFilter ? "" : sub);
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

      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between px-7 pt-6 pb-5">
        <div>
          <h1 className="font-headline text-[1.35rem] font-bold text-on-bg tracking-tight leading-tight">
            Contratos
          </h1>
          <p className="text-[0.78rem] text-muted-foreground mt-1">
            Gestión del ciclo de vida contractual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-[0.72rem] font-medium gap-[7px]">
            <Download className="h-[14px] w-[14px]" />
            Exportar
          </Button>
          <Link href="/contratos/nuevo">
            <Button size="sm" className="text-[0.72rem] font-semibold gap-[7px]">
              + Nuevo contrato
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-7 pb-7">

        {/* ── KPI Grid ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">

          <Card className="rounded-xl border py-0 gap-0">
            <CardContent className="p-4 px-[18px]">
              <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Vigentes</p>
              <p className="font-headline text-[1.875rem] font-bold text-green leading-none">
                {isLoading ? "—" : counts.active ?? 0}
              </p>
              <p className="text-[0.68rem] text-muted-foreground mt-1.5">contratos activos</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border py-0 gap-0">
            <CardContent className="p-4 px-[18px]">
              <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Por vencer</p>
              <p className="font-headline text-[1.875rem] font-bold text-mustard leading-none">
                {isLoading ? "—" : counts.expiring_soon ?? 0}
              </p>
              <p className="text-[0.68rem] text-muted-foreground mt-1.5">vencen en ≤ 60 días</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border py-0 gap-0">
            <CardContent className="p-4 px-[18px]">
              <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">En redacción</p>
              <p className="font-headline text-[1.875rem] font-bold text-info leading-none">
                {isLoading ? "—" : counts.draft ?? 0}
              </p>
              <p className="text-[0.68rem] text-muted-foreground mt-1.5">borradores activos</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border py-0 gap-0">
            <CardContent className="p-4 px-[18px]">
              <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Pend. de firma</p>
              <p className="font-headline text-[1.875rem] font-bold text-primary leading-none">
                {isLoading ? "—" : counts.pending_signature ?? 0}
              </p>
              <p className="text-[0.68rem] text-muted-foreground mt-1.5">esperando firmas</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border py-0 gap-0">
            <CardContent className="p-4 px-[18px]">
              <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Vencidos</p>
              <p className="font-headline text-[1.875rem] font-bold text-error leading-none">
                {isLoading ? "—" : counts.expired ?? 0}
              </p>
              <p className="text-[0.68rem] text-muted-foreground mt-1.5">sin renovar ni rescindir</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Índices de ajuste ────────────────────────── */}
        <IndexValuesPanel />

        {/* ── Toolbar ──────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-[480px] bg-surface-low border border-border rounded-lg px-3 py-[8px] focus-within:border-primary transition-colors">
            <Search className="h-[14px] w-[14px] text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchInput);
                if (e.key === "Escape") { setSearchInput(""); handleSearch(""); }
              }}
              placeholder="Buscar por propiedad, inquilino, propietario, N° contrato…"
              className="flex-1 bg-transparent outline-none text-[13px] text-on-surface placeholder:text-muted-foreground min-w-0"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); handleSearch(""); }}
                className="text-muted-foreground hover:text-on-surface transition-colors flex-shrink-0"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro de grupos */}
          <div className="flex flex-col gap-[6px]">
            <div className="inline-flex bg-surface-low border border-border rounded-lg p-[3px] gap-[1px] overflow-x-auto">
              {FILTER_GROUPS.map((g) => {
                const isActive = groupFilter === g.value;
                const count = getGroupCount(g.value, counts);
                const activeClasses = groupActiveClasses(g.value);
                return (
                  <button
                    key={g.value}
                    onClick={() => handleGroupFilter(g.value)}
                    style={isActive && activeClasses.style ? activeClasses.style : undefined}
                    className={`inline-flex items-center gap-[6px] px-[11px] py-[6px] rounded-[5px] text-[12.5px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap ${
                      isActive ? activeClasses.button : "text-muted-foreground hover:text-on-surface"
                    }`}
                  >
                    {g.label}
                    <span
                      style={isActive && activeClasses.style ? activeClasses.style : undefined}
                      className={`font-mono text-[10.5px] px-[5px] py-[1px] rounded-[3px] border leading-[1.3] transition-all duration-150 ${
                        isActive ? activeClasses.count : "bg-surface border-border text-muted-foreground"
                      }`}
                    >
                      {isLoading ? "·" : count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sub-filtros del grupo activo */}
            {groupFilter !== "" && (() => {
              const group = FILTER_GROUPS.find((g) => g.value === groupFilter);
              if (!group || group.children.length === 0) return null;
              const parentActive = groupActiveClasses(group.value);
              return (
                <div className="inline-flex bg-surface-low border border-border rounded-lg p-[3px] gap-[1px] overflow-x-auto animate-in fade-in slide-in-from-top-1 duration-150">
                  {group.children.map((child) => {
                    const isActive = subFilter === child.value;
                    const count = counts[child.value] ?? 0;
                    return (
                      <button
                        key={child.value}
                        onClick={() => handleSubFilter(child.value)}
                        style={isActive && parentActive.style ? parentActive.style : undefined}
                        className={`inline-flex items-center gap-[6px] px-[11px] py-[6px] rounded-[5px] text-[12px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap ${
                          isActive ? parentActive.button : "text-muted-foreground hover:text-on-surface"
                        }`}
                      >
                        {child.label}
                        <span
                          style={isActive && parentActive.style ? parentActive.style : undefined}
                          className={`font-mono text-[10.5px] px-[5px] py-[1px] rounded-[3px] border leading-[1.3] transition-all duration-150 ${
                            isActive ? parentActive.count : "bg-surface border-border text-muted-foreground"
                          }`}
                        >
                          {isLoading ? "·" : count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Tabla ────────────────────────────────────── */}
        {error ? (
          <div className="rounded-xl bg-error-dim border border-error/20 p-6 text-center">
            <p className="text-error mb-4 text-sm">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-[18px] overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Contratos
                </span>
                <span className="text-[12px] text-muted-foreground">{total} resultado{total !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-[8px]">
                <button className="flex items-center gap-[6px] px-[10px] py-[6px] text-[12.5px] font-medium border border-border rounded-md text-muted-foreground bg-transparent hover:bg-surface-low hover:text-on-surface transition-colors">
                  <SlidersHorizontal className="h-3 w-3" />
                  Filtros
                </button>
                <button className="flex items-center gap-[6px] px-[10px] py-[6px] text-[12.5px] font-medium border border-border rounded-md text-muted-foreground bg-transparent hover:bg-surface-low hover:text-on-surface transition-colors">
                  <ArrowUpDown className="h-3 w-3" />
                  Ordenar
                </button>
                <button className="flex items-center gap-[6px] px-[10px] py-[6px] text-[12.5px] font-medium border border-border rounded-md text-muted-foreground bg-transparent hover:bg-surface-low hover:text-on-surface transition-colors">
                  <Download className="h-3 w-3" />
                  Exportar
                </button>
              </div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[90px] px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Nº</th>
                  <th className="px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Propiedad</th>
                  <th className="px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Inquilino</th>
                  <th className="px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Propietario</th>
                  <th className="w-[200px] px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Vigencia</th>
                  <th className="w-[180px] px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Monto actual</th>
                  <th className="w-[110px] px-[16px] py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-surface-low border-b border-border">Estado</th>
                  <th className="w-10 px-[16px] py-[11px] bg-surface-low border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <SkeletonContractRow key={i} index={i} />
                  ))
                ) : contracts.length > 0 ? (
                  contracts.map((c, i) => {
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
                        className={`group cursor-pointer transition-colors hover:bg-surface-low row-animate ${isTerminated ? "opacity-60 hover:opacity-100" : ""}`}
                        style={{ "--row-delay": `${i * 45}ms` } as React.CSSProperties}
                        onClick={() => router.push(`/contratos/${c.id}`)}
                      >
                        {/* Nº */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          <span className={`font-mono text-[12px] ${isExpired || isTerminated ? "text-muted-foreground" : "text-on-surface"}`}>
                            {c.contractNumber}
                          </span>
                        </td>

                        {/* Propiedad */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          <div className="font-medium text-[13px] text-on-surface leading-tight">
                            {c.propertyAddress || <span className="text-muted-foreground italic">Sin dirección</span>}
                          </div>
                        </td>

                        {/* Inquilino */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          {tenantName ? (
                            <div className="flex items-center gap-[10px]">
                              <div
                                className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[10.5px] font-semibold flex-shrink-0 text-white"
                                style={{ background: avatarGradient(tenantName), boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)" }}
                              >
                                {tenantInitials}
                              </div>
                              <span className="text-[13px] font-medium text-on-surface">{tenantName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[13px]">—</span>
                          )}
                        </td>

                        {/* Propietario */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          <div className="flex items-center gap-[10px]">
                            <div
                              className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[10.5px] font-semibold flex-shrink-0 text-white"
                              style={{ background: avatarGradient(c.ownerName || "O"), boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)" }}
                            >
                              {ownerInitials}
                            </div>
                            <span className="text-[13px] font-medium text-on-surface">{c.ownerName || "—"}</span>
                          </div>
                        </td>

                        {/* Vigencia */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          <div className="font-mono text-[12px] text-on-surface whitespace-nowrap">
                            {isDraft ? (
                              <span className="font-sans text-[0.75rem] text-muted-foreground">A definir</span>
                            ) : (
                              <>
                                {format(new Date(c.startDate + "T00:00:00"), "dd/MM/yyyy")} →{" "}
                                {format(new Date(c.endDate + "T00:00:00"), "dd/MM/yyyy")}
                              </>
                            )}
                          </div>
                          <div className={`text-[11.5px] mt-[3px] ${
                            dias.variant === "alerta" ? "text-mustard" :
                            dias.variant === "vencida" ? "text-error" :
                            "text-muted-foreground"
                          }`}>
                            {dias.text}
                          </div>
                        </td>

                        {/* Monto */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          {c.monthlyAmount && !isDraft ? (
                            <>
                              <div className="font-mono font-semibold text-[13.5px] text-on-bg whitespace-nowrap">
                                $ {parseFloat(c.monthlyAmount).toLocaleString("es-AR")}
                              </div>
                              <div className="flex items-center gap-[6px] mt-[3px]">
                                {c.adjustmentIndex && c.adjustmentIndex !== "none" && (
                                  <span className="font-mono text-[10px] px-[5px] py-[1px] rounded-[3px] bg-surface-low border border-border text-muted-foreground tracking-[0.02em]">
                                    {c.adjustmentIndex}
                                  </span>
                                )}
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {c.adjustmentFrequency ? freqShort(c.adjustmentFrequency) : ""}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono font-semibold text-[13.5px] text-muted-foreground">—</div>
                              <div className="text-[11px] text-muted-foreground mt-[3px]">Sin definir</div>
                            </>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle">
                          <span className={`inline-flex items-center gap-[6px] px-[9px] py-[4px] rounded-full text-[11px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap ${pill}`}>
                            <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${dot}`} />
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-[16px] py-[14px] border-b border-border align-middle text-right">
                          <button
                            className="w-[30px] h-[30px] rounded-[7px] border border-border bg-surface-low inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-on-surface hover:bg-surface-high"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-[14px] w-[14px]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <p className="text-[13px] font-medium text-on-surface mb-1">
                        {groupFilter ? "Sin contratos en este grupo" : "Sin contratos registrados"}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {groupFilter ? "Probá seleccionando otro filtro o volvé a Todos." : "Los contratos aparecen acá una vez creados."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

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
