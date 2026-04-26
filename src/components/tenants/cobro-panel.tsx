"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LedgerEntry } from "./ledger-table";

type Props = {
  selectedEntries: LedgerEntry[];
  montoOverrides: Record<string, string>;
  honorariosPct: number;
  onClearSelection: () => void;
  onEmitirRecibo: () => void;
  isEmitting: boolean;
};

function getMonto(entry: LedgerEntry, overrides: Record<string, string>): number {
  const raw = overrides[entry.id] ?? entry.monto;
  return raw !== null ? Number(raw) : 0;
}

export function CobroPanel({
  selectedEntries,
  montoOverrides,
  honorariosPct,
  onClearSelection,
  onEmitirRecibo,
  isEmitting,
}: Props) {
  if (selectedEntries.length === 0) return null;

  const baseComision = selectedEntries
    .filter((e) => e.tipo !== "punitorio" && e.tipo !== "descuento")
    .reduce((s, e) => s + getMonto(e, montoOverrides), 0);

  const totalRecibo = selectedEntries.reduce((s, e) => s + getMonto(e, montoOverrides), 0);
  const honorarios = baseComision * (honorariosPct / 100);
  const netoPropietario = totalRecibo - honorarios;

  return (
    <div className="sticky bottom-0 z-10 border-t-2 border-primary bg-background">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-6">
          {/* Breakdown */}
          <div className="flex-1 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Desglose del cobro
            </p>
            {selectedEntries.map((e) => (
              <div key={e.id} className="flex justify-between">
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {e.descripcion}
                </span>
                <span className="font-mono font-medium ml-4">
                  ${getMonto(e, montoOverrides).toLocaleString("es-AR")}
                </span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between text-xs text-primary">
              <span>Honorarios ({honorariosPct}%)</span>
              <span className="font-mono">${honorarios.toLocaleString("es-AR")}</span>
            </div>
            <div className="flex justify-between text-xs text-green-400">
              <span>Propietario recibe</span>
              <span className="font-mono">${netoPropietario.toLocaleString("es-AR")}</span>
            </div>
          </div>

          {/* Total + buttons */}
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a cobrar</p>
              <p className="text-2xl font-bold font-mono">
                ${totalRecibo.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClearSelection}>
                Limpiar
              </Button>
              <Button size="sm" onClick={onEmitirRecibo} disabled={isEmitting}>
                {isEmitting ? "Emitiendo..." : "Emitir recibo →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
