"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LedgerEntry = {
  id: string;
  contratoId: string;
  propietarioId: string;
  propiedadId: string;
  period: string | null;
  dueDate: string | null;
  tipo: string;
  descripcion: string;
  monto: string | null;
  estado: string;
  installmentOf: string | null;
  reciboNumero: string | null;
  lateInterestPct: string | null;
  montoPagado: string | null;
  ultimoPagoAt: string | null;
};

type Props = {
  entries: LedgerEntry[];
  montoOverrides: Record<string, string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectMonth: (period: string) => void;
  onMontoChange: (id: string, value: string) => void;
  onCancelPunitorio: (id: string) => void;
  activeFilters: Set<string>;
};

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  conciliado:        { label: "Pagado",        className: "bg-income-dim text-income border-[var(--income)]" },
  registrado:        { label: "Registrado",    className: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)]" },
  pendiente:         { label: "Pendiente",     className: "bg-primary/10 text-primary border-primary/30" },
  proyectado:        { label: "Proyectado",    className: "bg-transparent text-muted-foreground border-border" },
  pendiente_revision:{ label: "Revisar",       className: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)] border-dashed" },
  cancelado:         { label: "Cancelado",     className: "bg-muted text-muted-foreground border-border" },
  pago_parcial:      { label: "Pago parcial",  className: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)]" },
};

function isSelectable(entry: LedgerEntry): boolean {
  return ["pendiente", "registrado", "pago_parcial"].includes(entry.estado);
}

function isPast(period: string | null): boolean {
  if (!period) return false;
  return period < new Date().toISOString().slice(0, 7);
}

function isCurrent(period: string | null): boolean {
  if (!period) return false;
  return period === new Date().toISOString().slice(0, 7);
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

function formatDescription(desc: string): string {
  return desc.replace(/\b(\d{4})-(\d{2})\b/g, "$2/$1");
}

function groupByPeriod(entries: LedgerEntry[]): Map<string, LedgerEntry[]> {
  const map = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const key = entry.period ?? "__no_period__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}

export function LedgerTable({
  entries,
  montoOverrides,
  selectedIds,
  onToggleSelect,
  onSelectMonth,
  onMontoChange,
  onCancelPunitorio,
  activeFilters,
}: Props) {
  const todayPeriod = new Date().toISOString().slice(0, 7);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const PENDING_STATES = ["pendiente", "registrado", "pendiente_revision"];

  function matchesFilter(e: LedgerEntry): boolean {
    if (activeFilters.size === 0) return true;
    const isFuture = (e.period ?? "") > todayPeriod;
    const isPendingState = PENDING_STATES.includes(e.estado);
    const isOverdue = !isFuture && isPendingState && e.dueDate !== null && e.dueDate < today;
    const isPending = !isFuture && isPendingState && (e.dueDate === null || e.dueDate >= today);
    if (activeFilters.has("overdue") && isOverdue) return true;
    if (activeFilters.has("pending") && isPending) return true;
    if (activeFilters.has("paid") && e.estado === "conciliado") return true;
    if (activeFilters.has("future") && isFuture) return true;
    return false;
  }

  const filtered = entries.filter(matchesFilter);

  const topLevel = filtered.filter((e) => !e.installmentOf || e.tipo === "punitorio");

  const grouped = groupByPeriod(topLevel);
  const periods = [...grouped.keys()].sort();

  return (
    <div className="w-full">
      {/* Column headers — sticky so they stay visible while scrolling */}
      <div className="sticky top-0 z-10 grid items-center gap-2 px-4 py-1.5 bg-muted/80 backdrop-blur-sm border-b border-border grid-cols-[28px_1fr_80px_110px_90px_60px]">
        <div />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Concepto</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Monto</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Estado</span>
        <div />
      </div>

      {periods.map((period) => {
        const periodEntries = grouped.get(period) ?? [];
        const past = isPast(period === "__no_period__" ? null : period);
        const current = isCurrent(period === "__no_period__" ? null : period);
        const future = !past && !current;
        const hasSelectable = periodEntries.some(isSelectable);

        return (
          <div
            key={period}
            ref={current ? currentRef : undefined}
            className={cn(
              "border-b border-border",
              past && "opacity-60",
              future && "opacity-50",
              current && "border-l-2 border-l-primary bg-primary/5"
            )}
          >
            {/* Period header */}
            <div className="flex items-center justify-between px-4 py-2">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                current ? "text-primary" : "text-muted-foreground"
              )}>
                {current && "● "}
                {period === "__no_period__" ? "Sin período" : formatPeriod(period)}
                {current && " — hoy"}
              </span>
              {hasSelectable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => onSelectMonth(period)}
                >
                  Seleccionar mes
                </Button>
              )}
            </div>

            {/* Entries */}
            {periodEntries.map((entry) => {
              const selectable = isSelectable(entry);
              const selected = selectedIds.has(entry.id);
              const isPunitorio = entry.tipo === "punitorio";
              const displayMonto = montoOverrides[entry.id] ?? entry.monto;
              const badge = ESTADO_BADGE[entry.estado] ?? ESTADO_BADGE.pendiente;

              return (
                <div
                  key={entry.id}
                  onClick={() => selectable && onToggleSelect(entry.id)}
                  className={cn(
                    "grid items-center gap-2 px-4 py-2 text-sm",
                    "grid-cols-[28px_1fr_80px_110px_90px_60px]",
                    isPunitorio && "pl-10 bg-punitorio-dim border-t border-[var(--punitorio)]/30",
                    selectable && "cursor-pointer hover:bg-muted/40",
                    selected && "bg-primary/10 hover:bg-primary/15"
                  )}
                >
                  {/* Checkbox */}
                  <div>
                    {selectable ? (
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleSelect(entry.id)}
                        className={isPunitorio ? "border-[var(--punitorio)]" : undefined}
                      />
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </div>

                  {/* Descripcion */}
                  <span className={cn(
                    "truncate",
                    isPunitorio && "text-punitorio italic text-xs",
                    entry.monto === null && "text-[var(--warning)]"
                  )}>
                    {isPunitorio && "↳ "}
                    {formatDescription(entry.descripcion)}
                  </span>

                  {/* Tipo badge */}
                  <span className="text-xs text-muted-foreground truncate">{entry.tipo}</span>

                  {/* Monto */}
                  <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {entry.monto === null ? (
                      <span className="text-[var(--warning)] font-mono text-xs">$???</span>
                    ) : selected ? (
                      <Input
                        value={displayMonto ?? ""}
                        onChange={(e) => onMontoChange(entry.id, e.target.value)}
                        type="number"
                        min="0"
                        className="h-7 w-24 text-right text-xs font-mono"
                      />
                    ) : (
                      <span className="font-mono text-xs">
                        ${Number(entry.monto).toLocaleString("es-AR")}
                      </span>
                    )}
                  </div>

                  {/* Estado badge */}
                  <div className="flex justify-center">
                    <Badge variant="outline" className={cn("text-xs", badge.className)}>
                      {badge.label}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    {isPunitorio && entry.estado !== "conciliado" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelPunitorio(entry.id)}
                        aria-label="Cancelar punitorio"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </Button>
                    )}
                    {entry.reciboNumero && (
                      <span className="text-xs text-muted-foreground">{entry.reciboNumero}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
