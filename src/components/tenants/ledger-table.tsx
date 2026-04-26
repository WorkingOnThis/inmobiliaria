"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PunitorioPopover } from "./punitorio-popover";

export type LedgerEntry = {
  id: string;
  period: string | null;
  dueDate: string | null;
  tipo: string;
  descripcion: string;
  monto: string | null;
  estado: string;
  installmentOf: string | null;
  reciboNumero: string | null;
};

type Props = {
  entries: LedgerEntry[];
  montoOverrides: Record<string, string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectMonth: (period: string) => void;
  onMontoChange: (id: string, value: string) => void;
  onAddPunitorio: (parentId: string, monto: number, descripcion: string) => void;
  onCancelPunitorio: (id: string) => void;
  viewMode: "completa" | "historial";
  inquilinoId: string;
};

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  conciliado:        { label: "Pagado",     className: "bg-green-900/40 text-green-400 border-green-900" },
  registrado:        { label: "Registrado", className: "bg-amber-900/40 text-amber-400 border-amber-900" },
  pendiente:         { label: "Pendiente",  className: "bg-primary/10 text-primary border-primary/30" },
  proyectado:        { label: "Proyectado", className: "bg-transparent text-muted-foreground border-border" },
  pendiente_revision:{ label: "Revisar",    className: "bg-amber-950/30 text-amber-300 border-amber-800 border-dashed" },
  cancelado:         { label: "Cancelado",  className: "bg-muted text-muted-foreground border-border" },
};

function isSelectable(entry: LedgerEntry): boolean {
  return entry.estado === "pendiente" || entry.estado === "registrado";
}

function isPast(period: string | null): boolean {
  if (!period) return false;
  return period < new Date().toISOString().slice(0, 7);
}

function isCurrent(period: string | null): boolean {
  if (!period) return false;
  return period === new Date().toISOString().slice(0, 7);
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
  onAddPunitorio,
  onCancelPunitorio,
  viewMode,
  inquilinoId,
}: Props) {
  const todayPeriod = new Date().toISOString().slice(0, 7);

  const filtered = viewMode === "historial"
    ? entries.filter((e) => (e.period ?? "") <= todayPeriod)
    : entries;

  const topLevel = filtered.filter((e) => !e.installmentOf || e.tipo === "punitorio");

  const grouped = groupByPeriod(topLevel);
  const periods = [...grouped.keys()].sort();

  return (
    <div className="w-full">
      {periods.map((period) => {
        const periodEntries = grouped.get(period) ?? [];
        const past = isPast(period === "__no_period__" ? null : period);
        const current = isCurrent(period === "__no_period__" ? null : period);
        const future = !past && !current;

        return (
          <div
            key={period}
            className={cn(
              "border-b border-border",
              past && "opacity-40",
              future && !current && "opacity-45",
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
                {period === "__no_period__" ? "Sin período" : period}
                {current && " — hoy"}
              </span>
              {current && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => onSelectMonth(period)}
                >
                  Seleccionar todo el mes
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
                  className={cn(
                    "grid items-center gap-2 px-4 py-2 text-sm",
                    "grid-cols-[28px_1fr_80px_110px_90px_60px]",
                    isPunitorio && "pl-10 bg-purple-950/20 border-t border-purple-900/30",
                    selected && "bg-primary/10"
                  )}
                >
                  {/* Checkbox */}
                  <div>
                    {selectable ? (
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleSelect(entry.id)}
                        className={isPunitorio ? "border-purple-500" : undefined}
                      />
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </div>

                  {/* Descripcion */}
                  <span className={cn(
                    "truncate",
                    isPunitorio && "text-purple-300 italic text-xs",
                    entry.monto === null && "text-amber-400"
                  )}>
                    {isPunitorio && "↳ "}
                    {entry.descripcion}
                  </span>

                  {/* Tipo badge */}
                  <span className="text-xs text-muted-foreground truncate">{entry.tipo}</span>

                  {/* Monto */}
                  <div className="flex items-center gap-1 justify-end">
                    {entry.monto === null ? (
                      <span className="text-amber-400 font-mono text-xs">$???</span>
                    ) : selected ? (
                      <Input
                        value={displayMonto ?? ""}
                        onChange={(e) => onMontoChange(entry.id, e.target.value)}
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
                  <div className="flex items-center justify-end">
                    {entry.tipo === "alquiler" && selectable && !isPunitorio && (
                      <PunitorioPopover
                        parentId={entry.id}
                        alquilerMonto={Number(entry.monto ?? 0)}
                        dueDate={entry.dueDate}
                        onConfirm={(monto, desc) => onAddPunitorio(entry.id, monto, desc)}
                      />
                    )}
                    {isPunitorio && entry.estado !== "conciliado" && (
                      <button
                        onClick={() => onCancelPunitorio(entry.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </button>
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
