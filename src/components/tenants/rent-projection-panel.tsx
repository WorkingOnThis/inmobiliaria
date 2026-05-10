"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProyeccionResponse } from "@/app/api/tenants/[id]/proyeccion/route";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriod(p: string): string {
  const [y, m] = p.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
}

type Props = { tenantId: string };

export function RentProjectionPanel({ tenantId }: Props) {
  const [open, setOpen] = useState(false);
  const [tramoIdx, setTramoIdx] = useState(0);

  const { data, isLoading, isError } = useQuery<ProyeccionResponse>({
    queryKey: ["rent-proyeccion", tenantId],
    queryFn: () => fetch(`/api/tenants/${tenantId}/proyeccion`).then((r) => {
      if (!r.ok) throw new Error("sin proyeccion");
      return r.json();
    }),
    enabled: open,
    retry: false,
  });

  const tramo = data?.tramos[tramoIdx];

  return (
    <div className="mx-4 rounded-lg border border-border overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium bg-surface-low hover:bg-surface-high transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span>Proyección de alquiler</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border">
          {isLoading && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Calculando…</p>
          )}
          {isError && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin datos de proyección (el contrato no usa índice o faltan valores).
            </p>
          )}

          {data && data.tramos.length > 0 && tramo && (
            <>
              {/* Tramo tabs */}
              {data.tramos.length > 1 && (
                <div className="flex gap-1 px-4 pt-3">
                  {data.tramos.map((t, i) => (
                    <button
                      key={t.tramoStart}
                      onClick={() => setTramoIdx(i)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        i === tramoIdx
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-mid text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {i === 0 ? "Tramo actual" : `Tramo ${i + 1}`}
                      {t.hasProjected && (
                        <span className="ml-1 opacity-60">~</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Header summary */}
              <div className="px-4 pt-4 pb-3 text-center space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Alquiler al final del tramo
                  {tramo.hasProjected && (
                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 border-amber-500/30 text-amber-400">
                      proyectado
                    </Badge>
                  )}
                </p>
                <p className="text-2xl font-bold font-mono">{formatARS(tramo.newAmount)}</p>
                <p className="text-sm text-muted-foreground">
                  Aumento total:{" "}
                  <span className="font-semibold text-income">+{tramo.totalPct.toFixed(2)}%</span>
                </p>
              </div>

              {/* Month table */}
              <table className="w-full text-sm border-t border-border">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 text-left font-medium">Período</th>
                    <th className="px-4 py-2 text-right font-medium">% Ajuste</th>
                    <th className="px-4 py-2 text-right font-medium">Monto acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border text-muted-foreground bg-surface-low">
                    <td className="px-4 py-2 text-xs">Base ({formatPeriod(tramo.tramoStart)})</td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{formatARS(tramo.baseAmount)}</td>
                  </tr>
                  {tramo.months.map((m, i) => (
                    <tr key={m.period} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-surface-low/40"}`}>
                      <td className="px-4 py-2 text-xs">
                        {formatPeriod(m.period)}
                        {m.isProjected && (
                          <span className="ml-1.5 text-[10px] text-amber-400/70">~</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {m.pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums font-medium">
                        {formatARS(m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
                {tramo.hasProjected
                  ? `Los meses marcados con ~ usan el último valor conocido de ${data.adjustmentIndex}.`
                  : `Calculado con valores reales de ${data.adjustmentIndex}.`}
                {" "}Vencimiento del contrato: {data.endDate.split("-").reverse().join("/")}.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
