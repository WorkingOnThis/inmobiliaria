"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ── Types ────────────────────────────────────────────────

type IndexValue = {
  id: string;
  indexType: string;
  period: string;  // "YYYY-MM"
  value: string;
  loadedAt: string;
};

type AdjustmentRow = {
  id: string;
  contratoId: string;
  contractNumber: string;
  propertyAddress: string | null;
  adjustmentPeriod: string;  // "YYYY-MM"
  previousAmount: string;
  newAmount: string;
  factor: string;
  periodsUsed: string;  // JSON
  valuesUsed: string;   // JSON
  isProvisional: boolean;
  appliedAt: string;
};

// ── Helpers ──────────────────────────────────────────────

const INDEX_TYPES = ["ICL", "IPC", "CER", "UVA"] as const;

/** Convierte "YYYY-MM" → "MM/YYYY" */
function formatPeriod(p: string): string {
  return `${p.slice(5, 7)}/${p.slice(0, 4)}`;
}

/** Convierte timestamp → "DD/MM/YYYY" */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatARS(amount: string | number): string {
  return Number(amount).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

// ── Component ─────────────────────────────────────────────

export function IndexValuesPanel() {
  const [open, setOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [revertDialogId, setRevertDialogId] = useState<string | null>(null);

  // Form state
  const [indexType, setIndexType] = useState<string>("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [value, setValue] = useState("");

  const qc = useQueryClient();

  const { data: indexValues = [] } = useQuery<IndexValue[]>({
    queryKey: ["index-values"],
    queryFn: () => fetch("/api/index-values").then((r) => r.json()),
    enabled: open,
  });

  const { data: adjustments = [] } = useQuery<AdjustmentRow[]>({
    queryKey: ["index-adjustments"],
    queryFn: () => fetch("/api/index-values/adjustments").then((r) => r.json()),
    enabled: open,
  });

  const loadMutation = useMutation({
    mutationFn: (data: { indexType: string; period: string; value: number }) =>
      fetch("/api/index-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["index-values"] });
      qc.invalidateQueries({ queryKey: ["index-adjustments"] });
      setLoadDialogOpen(false);
      setIndexType("");
      setPeriodMonth("");
      setPeriodYear("");
      setValue("");
      if (data.contractsAffected > 0) {
        alert(`Índice cargado. ${data.contractsAffected} contrato(s) actualizado(s)${data.provisionalCount > 0 ? `, ${data.provisionalCount} de forma provisoria` : ""}.`);
      }
    },
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/index-values/adjustments/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["index-adjustments"] });
      setRevertDialogId(null);
    },
  });

  function handleLoad() {
    if (!indexType || !periodMonth || !periodYear || !value) return;
    const month = periodMonth.padStart(2, "0");
    const period = `${periodYear}-${month}`;
    loadMutation.mutate({ indexType, period, value: parseFloat(value) });
  }

  const revertTarget = adjustments.find((a) => a.id === revertDialogId);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-low px-4 py-3 text-sm font-medium hover:bg-surface-high transition-colors">
            <span>Índices de ajuste</span>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 space-y-4">
          {/* Tabla de valores cargados */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-low">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valores cargados
              </span>
              <Button size="sm" variant="outline" onClick={() => setLoadDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Cargar índice
              </Button>
            </div>

            {indexValues.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay valores cargados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">Período</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 text-left font-medium">Cargado</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {indexValues.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{v.indexType}</td>
                      <td className="px-4 py-2">{formatPeriod(v.period)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{parseFloat(v.value).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(v.loadedAt)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            if (!confirm(`¿Eliminar ${v.indexType} ${formatPeriod(v.period)}?`)) return;
                            await fetch(`/api/index-values/${v.id}`, { method: "DELETE" });
                            qc.invalidateQueries({ queryKey: ["index-values"] });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial de ajustes aplicados */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-surface-low">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historial de ajustes aplicados
              </span>
            </div>

            {adjustments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay ajustes aplicados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Contrato</th>
                    <th className="px-4 py-2 text-left font-medium">Rige desde</th>
                    <th className="px-4 py-2 text-right font-medium">Anterior</th>
                    <th className="px-4 py-2 text-right font-medium">Nuevo</th>
                    <th className="px-4 py-2 text-right font-medium">Factor</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{a.contractNumber}</div>
                        <div className="text-xs text-muted-foreground">{a.propertyAddress}</div>
                      </td>
                      <td className="px-4 py-2">
                        {formatPeriod(a.adjustmentPeriod)}
                        {a.isProvisional && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500/30 text-amber-500">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Provisorio
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {formatARS(a.previousAmount)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-income">
                        {formatARS(a.newAmount)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">
                        × {parseFloat(a.factor).toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setRevertDialogId(a.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Dialog: cargar índice */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cargar valor de índice</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de índice</label>
              <Select value={indexType} onValueChange={setIndexType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná el índice" />
                </SelectTrigger>
                <SelectContent>
                  {INDEX_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Período</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="MM"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={2020}
                  max={2099}
                  placeholder="YYYY"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">Mes y año al que corresponde este valor</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={200}
                placeholder="ej. 11.20"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Variación mensual del índice en porcentaje
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleLoad}
              disabled={!indexType || !periodMonth || !periodYear || !value || loadMutation.isPending}
            >
              {loadMutation.isPending ? "Cargando..." : "Cargar y aplicar"}
            </Button>
          </DialogFooter>

          {loadMutation.isError && (
            <p className="text-sm text-destructive">{(loadMutation.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar revertir */}
      <Dialog open={!!revertDialogId} onOpenChange={() => setRevertDialogId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revertir ajuste</DialogTitle>
          </DialogHeader>
          {revertTarget && (
            <div className="space-y-2 py-2 text-sm">
              <p>
                ¿Revertir el ajuste del contrato{" "}
                <span className="font-medium">{revertTarget.contractNumber}</span>{" "}
                que rige desde <span className="font-medium">{formatPeriod(revertTarget.adjustmentPeriod)}</span>?
              </p>
              <p className="text-muted-foreground">
                El monto volverá a {formatARS(revertTarget.previousAmount)} y los períodos afectados
                quedarán como pendientes de revisión.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialogId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => revertDialogId && revertMutation.mutate(revertDialogId)}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? "Revirtiendo..." : "Revertir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
