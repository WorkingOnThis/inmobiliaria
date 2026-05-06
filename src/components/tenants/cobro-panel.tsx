"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LedgerEntry } from "./ledger-table";

type SplitMeta = {
  managementCommissionPct: number;
  ownerName: string;
  ownerCbu: string | null;
  agencyNombre: string | null;
  agenciaCbu: string | null;
  agenciaAlias: string | null;
};

type Props = {
  selectedEntries: LedgerEntry[];
  montoOverrides: Record<string, string>;
  honorariosPct: number;
  onClearSelection: () => void;
  onEmitirRecibo: () => void;
  isEmitting: boolean;
  beneficiarioOverrides: Record<string, string>;
  splitMeta: SplitMeta | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getMonto(entry: LedgerEntry, overrides: Record<string, string>): number {
  const raw = overrides[entry.id] ?? entry.monto;
  return raw !== null ? Number(raw) : 0;
}

function computeSplitTotals(
  entries: LedgerEntry[],
  overrides: Record<string, string>,
  beneficiarioOverrides: Record<string, string>,
  pct: number
): { propietario: number; administracion: number } {
  let prop = 0;
  let adm = 0;
  for (const e of entries) {
    const monto = getMonto(e, overrides);
    const dest = beneficiarioOverrides[e.id] ?? e.beneficiario;
    if (dest === "split") {
      const admPart = Math.round(monto * (pct / 100));
      adm += admPart;
      prop += monto - admPart;
    } else if (dest === "administracion") {
      adm += monto;
    } else {
      // "propietario" or null — goes to owner
      prop += monto;
    }
  }
  return { propietario: round2(prop), administracion: round2(adm) };
}

export function CobroPanel({
  selectedEntries,
  montoOverrides,
  honorariosPct,
  onClearSelection,
  onEmitirRecibo,
  isEmitting,
  beneficiarioOverrides,
  splitMeta,
}: Props) {
  if (selectedEntries.length === 0) return null;

  const baseComision = selectedEntries
    .filter((e) => e.tipo !== "punitorio" && e.tipo !== "descuento")
    .reduce((s, e) => s + getMonto(e, montoOverrides), 0);

  const receiptTotal = round2(selectedEntries.reduce((s, e) => s + getMonto(e, montoOverrides), 0));
  const feesAmount = round2(baseComision * (honorariosPct / 100));
  const ownerNet = round2(receiptTotal - feesAmount);

  return (
    <div className="border-t-2 border-primary bg-background">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-6">
          {/* Breakdown */}
          {splitMeta ? (
            <div className="flex-1 space-y-2 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Desglose de transferencias
              </p>
              {(() => {
                const { propietario, administracion } = computeSplitTotals(
                  selectedEntries, montoOverrides, beneficiarioOverrides,
                  splitMeta.managementCommissionPct
                );
                return (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2">
                      <div>
                        <p className="font-medium text-emerald-300">{splitMeta.ownerName}</p>
                        {splitMeta.ownerCbu && (
                          <p className="text-xs text-muted-foreground">CBU {splitMeta.ownerCbu}</p>
                        )}
                      </div>
                      <span className="font-mono font-bold text-emerald-300">
                        ${propietario.toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-2">
                      <div>
                        <p className="font-medium text-blue-300">{splitMeta.agencyNombre ?? "Administración"}</p>
                        {splitMeta.agenciaCbu && (
                          <p className="text-xs text-muted-foreground">CBU {splitMeta.agenciaCbu}</p>
                        )}
                        {splitMeta.agenciaAlias && (
                          <p className="text-xs text-muted-foreground">alias: {splitMeta.agenciaAlias}</p>
                        )}
                      </div>
                      <span className="font-mono font-bold text-blue-300">
                        ${administracion.toLocaleString("es-AR")}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            // Original breakdown (modalities A/B)
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
                <span className="font-mono">${feesAmount.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--income)]">
                <span>Propietario recibe</span>
                <span className="font-mono">${ownerNet.toLocaleString("es-AR")}</span>
              </div>
            </div>
          )}

          {/* Total + buttons */}
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a cobrar</p>
              <p className="text-2xl font-bold font-mono">
                ${receiptTotal.toLocaleString("es-AR")}
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
