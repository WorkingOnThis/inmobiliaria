"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, TrendingUp, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ── Types ────────────────────────────────────────────────

type IndexValue = {
  id: string;
  indexType: string;
  period: string;  // "YYYY-MM"
  value: string;
  loadedAt: string;
  auditedAt: string | null;
  auditedBy: string | null;
  source: string;  // "cron" | "manual"
};

// ── Constants ─────────────────────────────────────────────

const INDEX_TYPES = ["IPC (Córdoba)", "ICL", "CER", "UVA"] as const;
type IndexType = (typeof INDEX_TYPES)[number];

const INDEX_META: Record<IndexType, { label: string; source: string; swatch: string }> = {
  "IPC (Córdoba)": { label: "IPC · Córdoba", source: "INDEC · base 2017=100",  swatch: "oklch(0.585 0.135 32)" },
  "ICL":           { label: "ICL",           source: "BCRA · Ley 27.551",       swatch: "oklch(0.72 0.10 235)" },
  "CER":           { label: "CER",           source: "BCRA · base 2002",         swatch: "oklch(0.74 0.14 155)" },
  "UVA":           { label: "UVA",           source: "BCRA · CER",              swatch: "oklch(0.66 0.16 295)" },
};

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ── Helpers ───────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatPeriod(p: string): string {
  return `${p.slice(5, 7)}/${p.slice(0, 4)}`;
}

// ── Component ─────────────────────────────────────────────

export function IndexValuesPanel() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<IndexType>(INDEX_TYPES[0]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Load/edit dialog state
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<IndexValue | null>(null); // null = create mode
  const [indexType, setIndexType] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [value, setValue] = useState("");

  // Unaudit confirmation dialog
  const [unauditTarget, setUnauditTarget] = useState<IndexValue | null>(null);

  const qc = useQueryClient();

  const today = new Date();
  const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Max clickable period = 1 month after current
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const maxClickablePeriod = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const { data: indexValues = [] } = useQuery<IndexValue[]>({
    queryKey: ["index-values"],
    queryFn: () => fetch("/api/index-values").then(async r => {
      if (!r.ok) throw new Error("Error al cargar índices");
      return r.json();
    }),
    enabled: open,
  });

  const loadMutation = useMutation({
    mutationFn: (data: { indexType: string; period: string; value: number }) =>
      fetch("/api/index-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["index-values"] });
      closeLoadDialog();
      if (data.contractsAffected > 0) {
        alert(`Índice cargado. ${data.contractsAffected} contrato(s) actualizado(s)${data.provisionalCount > 0 ? `, ${data.provisionalCount} de forma provisoria` : ""}.`);
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      fetch(`/api/index-values/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["index-values"] });
      closeLoadDialog();
      if (data.contractsAffected > 0) {
        alert(`Índice actualizado. ${data.contractsAffected} contrato(s) re-calculado(s).`);
      }
    },
  });

  const auditMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/index-values/${id}`, { method: "PATCH" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onMutate: async (id) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ["index-values"] });

      // Snapshot current cache value so we can roll back on error
      const previous = qc.getQueryData<IndexValue[]>(["index-values"]);

      // Optimistically toggle auditedAt in the cache
      qc.setQueryData<IndexValue[]>(["index-values"], (old = []) =>
        old.map(v =>
          v.id === id
            ? { ...v, auditedAt: v.auditedAt ? null : new Date().toISOString(), auditedBy: v.auditedAt ? null : "me" }
            : v
        )
      );

      return { previous };
    },
    onError: (_err, _id, ctx) => {
      // Roll back to the snapshot on failure
      if (ctx?.previous) qc.setQueryData(["index-values"], ctx.previous);
    },
    onSettled: () => {
      // Sync with server regardless of success/error
      qc.invalidateQueries({ queryKey: ["index-values"] });
      setUnauditTarget(null);
    },
  });

  function closeLoadDialog() {
    setLoadDialogOpen(false);
    setEditingValue(null);
    setIndexType("");
    setPeriodMonth("");
    setPeriodYear("");
    setValue("");
  }

  function openLoadDialog() {
    setEditingValue(null);
    setIndexType(selectedIndex);
    setLoadDialogOpen(true);
  }

  function handleCellClick(v: IndexValue | undefined, month: number) {
    const period = `${selectedYear}-${String(month).padStart(2, "0")}`;
    if (period > maxClickablePeriod) return; // 2+ months in the future — not editable

    if (v?.auditedAt) {
      // show unaudit dialog instead of edit
      setUnauditTarget(v);
      return;
    }

    setIndexType(selectedIndex);
    setPeriodMonth(String(month));
    setPeriodYear(String(selectedYear));
    setValue(v ? parseFloat(v.value).toFixed(2) : "");
    setEditingValue(v ?? null);
    setLoadDialogOpen(true);
  }

  function handleSubmit() {
    if (!indexType || !periodMonth || !periodYear || !value) return;
    const numValue = parseFloat(value);
    if (editingValue) {
      editMutation.mutate({ id: editingValue.id, value: numValue });
    } else {
      loadMutation.mutate({
        indexType,
        period: `${periodYear}-${periodMonth.padStart(2, "0")}`,
        value: numValue,
      });
    }
  }

  function handleAuditToggle(e: React.MouseEvent, v: IndexValue) {
    e.stopPropagation();
    if (v.auditedAt) {
      setUnauditTarget(v);
    } else {
      auditMutation.mutate(v.id);
    }
  }

  // Derived data for selected index + year
  const allForIndex = indexValues.filter(v => v.indexType === selectedIndex);
  const mostRecent = [...allForIndex].sort((a, b) => b.period.localeCompare(a.period))[0];

  const availableYears = [...new Set(allForIndex.map(v => parseInt(v.period.slice(0, 4))))];
  if (!availableYears.includes(today.getFullYear())) availableYears.push(today.getFullYear());
  availableYears.sort((a, b) => a - b);

  const yearValues = allForIndex.filter(v => v.period.startsWith(String(selectedYear)));
  const monthMap = Object.fromEntries(yearValues.map(v => [parseInt(v.period.slice(5)), v]));

  const acumulado = yearValues.reduce((s, v) => s + parseFloat(v.value), 0);
  const promedio = yearValues.length > 0 ? acumulado / yearValues.length : 0;
  const mayorVal = yearValues.length > 0 ? Math.max(...yearValues.map(v => parseFloat(v.value))) : 0;
  const mayorV = yearValues.find(v => parseFloat(v.value) === mayorVal);
  const ultimaCarga = yearValues.length > 0
    ? [...yearValues].sort((a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime())[0].loadedAt
    : null;

  const isMutating = loadMutation.isPending || editMutation.isPending;
  const mutationError = (loadMutation.error ?? editMutation.error) as Error | null;

  if (!mounted) {
    // SSR-safe placeholder matching the closed-state header dimensions exactly.
    // Avoids hydration mismatches in Radix `useId` when an ancestor Suspense
    // boundary causes the server tree to differ from the client tree.
    return (
      <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
        <div className="flex w-full items-center gap-3 px-[18px] py-[14px]">
          <TrendingUp className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="text-[13.5px] font-semibold text-on-surface">Índices de ajuste</span>
          <ChevronDown className="h-[14px] w-[14px] ml-auto text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="bg-surface border border-border rounded-[10px] overflow-hidden">

          {/* Trigger */}
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-3 px-[18px] py-[14px] cursor-pointer hover:bg-surface-low transition-colors">
              <TrendingUp className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="text-[13.5px] font-semibold text-on-surface">Índices de ajuste</span>
              <ChevronDown className={`h-[14px] w-[14px] ml-auto text-muted-foreground transition-transform duration-200 ${open ? "rotate-180 text-on-surface" : ""}`} />
            </button>
          </CollapsibleTrigger>

          {/* Content */}
          <CollapsibleContent>
            <div className="border-t border-border px-[18px] pb-[18px] pt-[4px]">
              <p className="text-[12px] text-muted-foreground mt-[10px] mb-[14px]">
                Referencias usadas en los ajustes contractuales activos. Seleccioná un índice para ver su serie mensual.
              </p>

              {/* Master-detail grid */}
              <div className="grid gap-[14px]" style={{ gridTemplateColumns: "240px 1fr" }}>

                {/* Left: index picker */}
                <div className="flex flex-col gap-[6px]">
                  {INDEX_TYPES.map(type => {
                    const meta = INDEX_META[type];
                    const recent = [...indexValues.filter(v => v.indexType === type)]
                      .sort((a, b) => b.period.localeCompare(a.period))[0];
                    const isActive = selectedIndex === type;

                    return (
                      <button
                        key={type}
                        onClick={() => { setSelectedIndex(type); setSelectedYear(today.getFullYear()); }}
                        className={`grid items-center gap-[10px] text-left rounded-[9px] border p-[10px_12px] cursor-pointer transition-all ${
                          isActive ? "border-primary bg-primary-dim" : "bg-surface-low border-border hover:border-muted-foreground/30"
                        }`}
                        style={{ gridTemplateColumns: "8px 1fr auto" }}
                      >
                        <div className="h-[30px] rounded-[3px]" style={{ background: meta.swatch }} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold leading-[1.2]">{meta.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-[2px] font-mono tracking-[0.02em] truncate">{meta.source}</div>
                        </div>
                        <div className="font-mono text-[13px] font-semibold text-right shrink-0">
                          {recent ? `${parseFloat(recent.value).toFixed(2)}%` : "—"}
                          <div className="text-[10.5px] text-green font-medium mt-[2px]">
                            {recent ? formatPeriod(recent.period) : "sin datos"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right: detail */}
                <div className="bg-surface-low border border-border rounded-[10px] overflow-hidden min-w-0">

                  {/* Detail header */}
                  <div className="flex items-center gap-3 px-[16px] py-[12px] border-b border-border flex-wrap gap-y-2">
                    <span className="text-[13.5px] font-semibold">
                      {INDEX_META[selectedIndex]?.label ?? selectedIndex}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">· variación mensual %</span>
                    {/* Year tabs */}
                    <div className="ml-auto inline-flex gap-[1px] bg-surface border border-border rounded-[7px] p-[3px]">
                      {availableYears.map(yr => (
                        <button
                          key={yr}
                          onClick={() => setSelectedYear(yr)}
                          className={`px-[10px] py-[4px] rounded-[5px] text-[12px] font-medium font-mono cursor-pointer transition-all ${
                            selectedYear === yr ? "bg-primary-dim text-primary" : "text-muted-foreground hover:text-on-surface"
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Detail body */}
                  <div className="p-[16px]">

                    {/* Summary stats */}
                    <div className="grid grid-cols-4 gap-3 pb-[14px] mb-[14px] border-b border-dashed border-border">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Acumulado año</div>
                        <div className={`font-mono text-[15px] font-semibold mt-[4px] ${yearValues.length > 0 ? "text-green" : "text-muted-foreground"}`}>
                          {yearValues.length > 0 ? `↑ ${acumulado.toFixed(1)}%` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Promedio mensual</div>
                        <div className="font-mono text-[15px] font-semibold mt-[4px]">
                          {yearValues.length > 0 ? `${promedio.toFixed(2)}%` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Mayor variación</div>
                        <div className={`font-mono text-[15px] font-semibold mt-[4px] ${yearValues.length > 0 ? "text-green" : "text-muted-foreground"}`}>
                          {mayorV ? `${mayorVal.toFixed(2)}% · ${MES_CORTO[parseInt(mayorV.period.slice(5)) - 1].toLowerCase()}` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Última carga</div>
                        <div className="font-mono text-[15px] font-semibold mt-[4px] text-primary">
                          {ultimaCarga ? formatDate(ultimaCarga) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* 12-month grid */}
                    <div className="grid gap-[8px]" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1;
                        const v = monthMap[month];
                        const period = `${selectedYear}-${String(month).padStart(2, "0")}`;
                        const isCurrent = period === currentPeriod;
                        const isFuture = period > currentPeriod;
                        const isClickable = period <= maxClickablePeriod;
                        const isAudited = !!v?.auditedAt;
                        const isManual = v?.source === "manual" && !isAudited;
                        const isPending = auditMutation.isPending && auditMutation.variables === v?.id;

                        return (
                          <div
                            key={month}
                            onClick={() => isClickable && handleCellClick(v, month)}
                            className={`group relative rounded-[7px] p-[9px_10px] transition-colors select-none ${
                              isAudited
                                ? "border border-green/40 bg-green/5 cursor-pointer hover:border-green/60"
                                : isManual
                                ? "border border-yellow-500/40 bg-yellow-500/5 cursor-pointer hover:border-yellow-500/60"
                                : isCurrent && v
                                ? "border border-primary bg-primary-dim cursor-pointer hover:opacity-80"
                                : v
                                ? "border border-border bg-surface cursor-pointer hover:border-primary/40 hover:bg-primary-dim/30"
                                : isClickable
                                ? "border border-dashed border-border bg-transparent cursor-pointer hover:border-primary/40 hover:bg-primary-dim/20"
                                : "border border-dashed border-border/40 bg-transparent cursor-default opacity-40"
                            }`}
                          >
                            {/* Current-month dot */}
                            {isCurrent && v && !isAudited && (
                              <div
                                className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-primary"
                                style={{ boxShadow: "0 0 0 3px var(--surface-low)" }}
                              />
                            )}

                            {/* Audit stamp badge (green) */}
                            {isAudited && (
                              <div
                                className="absolute -top-[5px] -right-[5px] w-[16px] h-[16px] rounded-full flex items-center justify-center"
                                style={{ background: "oklch(0.74 0.14 155)", boxShadow: "0 0 0 2px var(--surface-low)" }}
                                title={`Auditado el ${formatDate(v!.auditedAt!)}`}
                              >
                                <ShieldCheck className="w-[9px] h-[9px] text-white" />
                              </div>
                            )}
                            {/* Manual badge (yellow) */}
                            {isManual && (
                              <div
                                className="absolute -top-[5px] -right-[5px] w-[16px] h-[16px] rounded-full flex items-center justify-center bg-yellow-500/80"
                                style={{ boxShadow: "0 0 0 2px var(--surface-low)" }}
                                title="Cargado manualmente — pendiente de auditar"
                              >
                                <span className="text-[8px] font-bold text-black leading-none">M</span>
                              </div>
                            )}

                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {MES_CORTO[i]}
                            </div>

                            {v ? (
                              <>
                                <div className={`font-mono text-[13px] font-semibold mt-[4px] ${isAudited ? "text-green" : isManual ? "text-yellow-400" : ""}`}>
                                  {parseFloat(v.value).toFixed(2)}%
                                </div>
                                <div className={`font-mono text-[10.5px] mt-[1px] ${isAudited ? "text-green/70" : isManual ? "text-yellow-500/70" : "text-green"}`}>
                                  ↑ {parseFloat(v.value).toFixed(2)}
                                </div>

                                {/* Audit toggle — visible on hover */}
                                <button
                                  type="button"
                                  onClick={(e) => handleAuditToggle(e, v)}
                                  disabled={isPending}
                                  title={isAudited ? "Quitar sello de auditoría" : "Marcar como auditado"}
                                  className={`absolute bottom-[6px] right-[6px] opacity-0 group-hover:opacity-100 transition-opacity rounded-[4px] p-[2px] cursor-pointer ${
                                    isAudited
                                      ? "text-green/60 hover:text-destructive hover:bg-destructive/10"
                                      : "text-muted-foreground hover:text-green hover:bg-green/10"
                                  }`}
                                >
                                  {isAudited
                                    ? <ShieldOff className="w-[11px] h-[11px]" />
                                    : <ShieldCheck className="w-[11px] h-[11px]" />
                                  }
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="font-mono text-[13px] text-muted-foreground font-normal mt-[4px]">—</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground mt-[1px]">
                                  {isFuture ? "pendiente" : "sin dato"}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-[14px] mt-[12px] mb-[2px]">
                      <div className="flex items-center gap-[5px]">
                        <div className="w-[8px] h-[8px] rounded-full bg-green/60" />
                        <span className="text-[10.5px] text-muted-foreground">Auditado</span>
                      </div>
                      <div className="flex items-center gap-[5px]">
                        <div className="w-[8px] h-[8px] rounded-full bg-yellow-500/60" />
                        <span className="text-[10.5px] text-muted-foreground">Manual — pendiente auditar</span>
                      </div>
                      <div className="flex items-center gap-[5px]">
                        <div className="w-[8px] h-[8px] rounded-full bg-border" />
                        <span className="text-[10.5px] text-muted-foreground">Cron (sin auditar)</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-[10px] mt-[14px]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-[30px] px-[10px] text-[12.5px] gap-[6px]"
                        onClick={openLoadDialog}
                      >
                        <Plus className="h-3 w-3" />
                        Cargar mes
                      </Button>
                      {mostRecent && (
                        <span className="ml-auto text-[11.5px] text-muted-foreground">
                          Última carga: <span className="font-medium text-on-surface">{formatDate(mostRecent.loadedAt)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Dialog: cargar / editar mes */}
      <Dialog open={loadDialogOpen} onOpenChange={open => { if (!open) closeLoadDialog(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingValue ? "Editar valor de índice" : "Cargar valor de índice"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de índice</label>
              <Select value={indexType} onValueChange={setIndexType} disabled={!!editingValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná el índice" />
                </SelectTrigger>
                <SelectContent>
                  {INDEX_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{INDEX_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Período</label>
              <div className="flex gap-2">
                <input
                  type="number" min={1} max={12} placeholder="MM"
                  value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}
                  disabled={!!editingValue}
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
                <input
                  type="number" min={2020} max={2099} placeholder="YYYY"
                  value={periodYear} onChange={e => setPeriodYear(e.target.value)}
                  disabled={!!editingValue}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {editingValue ? `Período: ${formatPeriod(editingValue.period)}` : "Mes y año al que corresponde este valor"}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Variación mensual (%)</label>
              <input
                type="number" step="0.01" min={0} max={200} placeholder="ej. 2.40"
                value={value} onChange={e => setValue(e.target.value)}
                autoFocus
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeLoadDialog}>Cancelar</Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!indexType || !periodMonth || !periodYear || !value || isMutating}
            >
              {isMutating
                ? (editingValue ? "Guardando..." : "Cargando...")
                : (editingValue ? "Guardar cambios" : "Cargar y aplicar")
              }
            </Button>
          </DialogFooter>

          {mutationError && (
            <p className="text-sm text-destructive">{mutationError.message}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar quitar sello */}
      <Dialog open={!!unauditTarget} onOpenChange={open => { if (!open) setUnauditTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quitar sello de auditoría</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Este valor fue marcado como auditado. Al quitarle el sello vas a poder editarlo o eliminarlo.
            </p>
            {unauditTarget && (
              <div className="rounded-[8px] border border-border bg-surface-low px-[14px] py-[10px] font-mono text-[13px]">
                <span className="text-muted-foreground">{MES_CORTO[parseInt(unauditTarget.period.slice(5)) - 1]} {unauditTarget.period.slice(0, 4)}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="font-semibold">{parseFloat(unauditTarget.value).toFixed(2)}%</span>
                <div className="text-[11px] text-muted-foreground mt-[4px]">
                  Auditado el {formatDate(unauditTarget.auditedAt!)}
                </div>
              </div>
            )}
            <p className="text-[12px] text-muted-foreground">¿Confirmás que querés quitar el sello?</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnauditTarget(null)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => unauditTarget && auditMutation.mutate(unauditTarget.id)}
              disabled={auditMutation.isPending}
            >
              {auditMutation.isPending ? "Quitando..." : "Quitar sello"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
