"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, CalendarClock, TrendingUp, PlusCircle, AlertTriangle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerTable, type LedgerEntry } from "./ledger-table";
import { CobroPanel } from "./cobro-panel";

type KPIs = {
  estadoCuenta: "al_dia" | "en_mora";
  moraDetalle: { capital: number; intereses: number; total: number } | null;
  totalCobradoYTD: number;
  diasPromedioPago: number | null;
  proximoPago: { total: number | null; montoMinimo: number | null; fecha: string | null; tieneAjuste: boolean } | null;
};

type CuentaCorrienteData = {
  kpis: KPIs;
  ledgerEntries: LedgerEntry[];
  proximoAjuste: { period: string | null; mesesRestantes: number | null } | null;
};

type Props = {
  inquilinoId: string;
  honorariosPct?: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

function getMonto(entry: LedgerEntry, overrides: Record<string, string>): number {
  if (overrides[entry.id] !== undefined) {
    return Number(overrides[entry.id]);
  }
  if (entry.estado === "pago_parcial" && entry.montoPagado !== null) {
    return Math.max(0, Number(entry.monto ?? 0) - Number(entry.montoPagado));
  }
  return Number(entry.monto ?? 0);
}

const TIPOS_MANUAL = [
  { value: "gasto", label: "Gasto" },
  { value: "servicio", label: "Servicio" },
  { value: "bonificacion", label: "Bonificación" },
  { value: "descuento", label: "Descuento" },
] as const;

export function TenantTabCurrentAccount({ inquilinoId, honorariosPct = 10 }: Props) {
  const queryClient = useQueryClient();

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["overdue", "pending"]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [montoOverrides, setMontoOverrides] = useState<Record<string, string>>({});
  const [ajusteDismissed, setAjusteDismissed] = useState(false);

  // Emit dialog
  const [showEmit, setShowEmit] = useState(false);
  const [observations, setObservations] = useState("");
  const [emitError, setEmitError] = useState<string | null>(null);

  // Void receipt dialog
  const [voidConfirm, setVoidConfirm] = useState<{ reciboNumero: string } | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Cargo manual dialog
  const [showManual, setShowManual] = useState(false);
  const [manualTipo, setManualTipo] = useState<string>("gasto");
  const [manualDescripcion, setManualDescripcion] = useState("");
  const [manualMonto, setManualMonto] = useState("");
  const [manualPeriod, setManualPeriod] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  // Cancel entry dialog (Task 4)
  const [cancelConfirm, setCancelConfirm] = useState<LedgerEntry | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelEntryError, setCancelEntryError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<CuentaCorrienteData>({
    queryKey: ["tenant-ledger", inquilinoId],
    queryFn: async () => {
      const r = await fetch(`/api/tenants/${inquilinoId}/cuenta-corriente`);
      if (!r.ok) throw new Error("Error al obtener la cuenta corriente");
      return r.json() as Promise<CuentaCorrienteData>;
    },
  });

  const emitirMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/receipts/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerEntryIds: [...selectedIds],
          fecha: new Date().toISOString().slice(0, 10),
          honorariosPct,
          trasladarAlPropietario: true,
          montoOverrides,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Error al emitir el recibo");
      }
      return response.json();
    },
    onSuccess: (result: { reciboNumero: string; movimientoAgenciaId: string }) => {
      setShowEmit(false);
      setSelectedIds(new Set());
      setMontoOverrides({});
      setObservations("");
      setEmitError(null);
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
      if (result?.movimientoAgenciaId) {
        window.open(`/recibos/${result.movimientoAgenciaId}`, "_blank", "noopener,noreferrer");
      }
    },
    onError: (error: Error) => {
      setEmitError(error.message);
    },
  });

  const addPunitorio = useMutation({
    mutationFn: async ({ parentId, monto, descripcion }: { parentId: string; monto: number; descripcion: string }) => {
      const response = await fetch(`/api/tenants/${inquilinoId}/ledger/${parentId}/punitorio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, descripcion }),
      });
      if (!response.ok) throw new Error("Error al agregar punitorio");
      return response.json();
    },
    onSuccess: (newEntry) => {
      setSelectedIds((prev) => new Set([...prev, newEntry.id]));
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
    },
  });

  const cancelPunitorio = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch(`/api/tenants/${inquilinoId}/ledger/${entryId}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al cancelar punitorio");
      }
    },
    onSuccess: (_, entryId) => {
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(entryId); return next; });
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
    },
  });

  const anularReciboMutation = useMutation({
    mutationFn: async (reciboNumero: string) => {
      const response = await fetch(`/api/receipts/${reciboNumero}/void`, { method: "POST" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Error al anular el recibo");
      }
      return response.json();
    },
    onSuccess: () => {
      setVoidConfirm(null);
      setVoidError(null);
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
    },
    onError: (error: Error) => {
      setVoidError(error.message);
    },
  });

  const cancelEntryMutation = useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason: string }) => {
      const response = await fetch(`/api/tenants/${inquilinoId}/ledger/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "cancelado",
          ...(reason.trim() && { cancellationReason: reason.trim() }),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al cancelar el movimiento");
      }
    },
    onSuccess: (_, { entryId }) => {
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(entryId); return next; });
      setMontoOverrides((prev) => { const { [entryId]: _removed, ...rest } = prev; return rest; });
      setCancelConfirm(null);
      setCancelReason("");
      setCancelEntryError(null);
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
    },
    onError: (error: Error) => {
      setCancelEntryError(error.message);
    },
  });

  const addManualMutation = useMutation({
    mutationFn: async () => {
      const ctx = ledgerEntries[0];
      if (!ctx) throw new Error("No hay contexto de contrato");

      const monto = parseFloat(manualMonto.replace(/\./g, "").replace(",", "."));
      if (isNaN(monto) || monto <= 0) throw new Error("El monto debe ser un número positivo");
      if (!manualDescripcion.trim()) throw new Error("La descripción es obligatoria");

      const response = await fetch(`/api/tenants/${inquilinoId}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratoId: ctx.contratoId,
          propietarioId: ctx.propietarioId,
          propiedadId: ctx.propiedadId,
          tipo: manualTipo,
          descripcion: manualDescripcion.trim(),
          monto,
          ...(manualPeriod ? { period: manualPeriod } : {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Error al crear el cargo");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowManual(false);
      setManualDescripcion("");
      setManualMonto("");
      setManualPeriod("");
      setManualTipo("gasto");
      setManualError(null);
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
    },
    onError: (error: Error) => {
      setManualError(error.message);
    },
  });

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setMontoOverrides((overrides) => { const { [id]: _, ...rest } = overrides; return rest; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectMonth(period: string) {
    const cobrables = (data?.ledgerEntries ?? [])
      .filter((e) => e.period === period && (e.estado === "pendiente" || e.estado === "registrado" || e.estado === "pago_parcial") && e.monto !== null)
      .map((e) => e.id);
    setSelectedIds((prev) => new Set([...prev, ...cobrables]));
  }

  function handleSelectAll() {
    setSelectedIds((prev) => new Set([...prev, ...selectableEntries.map((e) => e.id)]));
  }

  function handleDeselectAll() {
    const ids = selectableEntries.map((e) => e.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setMontoOverrides((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  }

  function handleDeselectMonth(period: string) {
    const cobrables = (data?.ledgerEntries ?? [])
      .filter((e) => e.period === period && (e.estado === "pendiente" || e.estado === "registrado" || e.estado === "pago_parcial") && e.monto !== null)
      .map((e) => e.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      cobrables.forEach((id) => next.delete(id));
      return next;
    });
    setMontoOverrides((prev) => {
      const next = { ...prev };
      cobrables.forEach((id) => delete next[id]);
      return next;
    });
  }

  function handleMontoChange(id: string, value: string) {
    setMontoOverrides((prev) => ({ ...prev, [id]: value }));
  }

  function handleCancelEntry(entry: LedgerEntry) {
    setCancelConfirm(entry);
  }

  if (isLoading) return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="grid grid-cols-3 gap-3 px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4">
        <Skeleton className="h-8 w-72" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="border-t border-b border-border px-4 py-6 flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
  if (isError || !data) return <div className="p-4 text-sm text-destructive">Error al cargar la cuenta corriente.</div>;

  const { kpis, ledgerEntries = [], proximoAjuste } = data;
  const selectedEntries = ledgerEntries.filter((e) => selectedIds.has(e.id));

  const baseComision = selectedEntries
    .filter((e) => e.tipo !== "punitorio" && e.tipo !== "descuento")
    .reduce((s, e) => s + getMonto(e, montoOverrides), 0);
  const receiptTotal = round2(selectedEntries.reduce((s, e) => s + getMonto(e, montoOverrides), 0));
  const feesAmount = round2(baseComision * (honorariosPct / 100));
  const ownerNet = round2(receiptTotal - feesAmount);

  const hasContract = ledgerEntries.length > 0;

  const pendingEntries = ledgerEntries.filter((e) => e.estado === "pendiente" || e.estado === "pago_parcial");

  function pendingAmount(e: LedgerEntry): number {
    if (e.estado === "pago_parcial" && e.montoPagado !== null) {
      return Math.max(0, Number(e.monto ?? 0) - Number(e.montoPagado));
    }
    return Number(e.monto ?? 0);
  }

  const totalPendiente = round2(pendingEntries.reduce((s, e) => s + pendingAmount(e), 0));
  const totalCapital   = round2(pendingEntries.filter((e) => e.tipo !== "punitorio").reduce((s, e) => s + pendingAmount(e), 0));
  const totalIntereses = round2(pendingEntries.filter((e) => e.tipo === "punitorio").reduce((s, e) => s + pendingAmount(e), 0));

  const totalRegistrado = round2(ledgerEntries
    .filter((e) => e.estado === "registrado")
    .reduce((s, e) => s + Number(e.monto ?? 0), 0));

  const selectableEntries = ledgerEntries.filter(
    (e) => (e.estado === "pendiente" || e.estado === "registrado" || e.estado === "pago_parcial") && e.monto !== null
  );
  const isAllSelected = selectableEntries.length > 0 && selectableEntries.every((e) => selectedIds.has(e.id));

  return (
    <div className="flex flex-col gap-4 pt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 px-4">
        {/* Estado */}
        <Card className="rounded-[var(--radius-lg)] border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</p>
                <p className={`mt-1 text-2xl font-bold ${kpis.estadoCuenta === "al_dia" ? "text-income" : "text-destructive"}`}>
                  {kpis.estadoCuenta === "al_dia" ? "Al día" : "En mora"}
                </p>
                {kpis.moraDetalle ? (
                  <p className="mt-1 text-xs text-muted-foreground font-mono">
                    ${kpis.moraDetalle.total.toLocaleString("es-AR")} deuda
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">sin atrasos</p>
                )}
              </div>
              {kpis.estadoCuenta === "al_dia"
                ? <CheckCircle2 className="size-5 text-income" />
                : <AlertCircle className="size-5 text-destructive" />
              }
            </div>
          </CardContent>
        </Card>

        {/* Próximo pago */}
        <Card className="rounded-[var(--radius-lg)] border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximo pago</p>
                {kpis.proximoPago ? (
                  <>
                    <div className="flex items-center gap-1.5 mt-1">
                      {kpis.proximoPago.total !== null ? (
                        <p className="text-2xl font-bold font-mono">${kpis.proximoPago.total.toLocaleString("es-AR")}</p>
                      ) : kpis.proximoPago.montoMinimo !== null ? (
                        <p className="text-2xl font-bold font-mono">≥&nbsp;${kpis.proximoPago.montoMinimo.toLocaleString("es-AR")}</p>
                      ) : (
                        <p className="text-2xl font-bold text-warning">A confirmar</p>
                      )}
                      {kpis.proximoPago.tieneAjuste && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-warning text-warning">
                          Ajuste
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {kpis.proximoPago.fecha ? `Vence ${formatDate(kpis.proximoPago.fecha)}` : "Fecha a confirmar"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
                    <p className="mt-1 text-xs text-muted-foreground">sin contrato activo</p>
                  </>
                )}
              </div>
              <CalendarClock className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Día promedio de pago */}
        <Card className="rounded-[var(--radius-lg)] border py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Puntualidad
                </p>
                {kpis.diasPromedioPago === null ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
                    <p className="mt-1 text-xs text-muted-foreground">sin historial de pagos</p>
                  </>
                ) : kpis.diasPromedioPago <= 0 ? (
                  <>
                    <p className="mt-1 text-2xl font-bold font-mono text-income">
                      {kpis.diasPromedioPago === 0 ? "En fecha" : `${Math.abs(kpis.diasPromedioPago)} días antes`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">promedio histórico</p>
                  </>
                ) : kpis.diasPromedioPago <= 7 ? (
                  <>
                    <p className="mt-1 text-2xl font-bold font-mono text-warning">
                      +{kpis.diasPromedioPago} días
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">promedio histórico</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-bold font-mono text-destructive">
                      +{kpis.diasPromedioPago} días
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">promedio histórico</p>
                  </>
                )}
              </div>
              <TrendingUp className={`size-5 ${
                kpis.diasPromedioPago === null ? "text-muted-foreground" :
                kpis.diasPromedioPago <= 0 ? "text-income" :
                kpis.diasPromedioPago <= 7 ? "text-warning" : "text-destructive"
              }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximo ajuste alert */}
      {proximoAjuste && proximoAjuste.mesesRestantes !== null && !ajusteDismissed && (
        <div className="px-4">
          <Alert variant="default" className="relative border-warning bg-warning-dim">
            <AlertTriangle className="size-4 text-warning" />
            <AlertTitle className="text-warning text-sm pr-6">
              Ajuste de índice en {proximoAjuste.mesesRestantes} {proximoAjuste.mesesRestantes === 1 ? "mes" : "meses"}
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Período {proximoAjuste.period ? formatPeriod(proximoAjuste.period) : ""} — los montos a partir de ese mes están pendientes de revisión.
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAjusteDismissed(true)}
              className="absolute top-3 right-3 h-6 w-6 text-warning opacity-60 hover:opacity-100"
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </Button>
          </Alert>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4">
        <ToggleGroup
          type="multiple"
          value={[...activeFilters]}
          onValueChange={(v) => setActiveFilters(new Set(v))}
        >
          <ToggleGroupItem value="overdue" className="text-xs h-8 px-3">En mora</ToggleGroupItem>
          <ToggleGroupItem value="pending" className="text-xs h-8 px-3">Pendientes</ToggleGroupItem>
          <ToggleGroupItem value="paid" className="text-xs h-8 px-3">Pagados</ToggleGroupItem>
          <ToggleGroupItem value="future" className="text-xs h-8 px-3">Futuros</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs h-8 px-3 font-medium transition-colors",
              isAllSelected
                ? "bg-primary/15 text-primary hover:bg-primary/10"
                : "bg-muted text-foreground/70 hover:text-foreground hover:bg-muted/70"
            )}
            disabled={!hasContract || selectableEntries.length === 0}
            onClick={() => isAllSelected ? handleDeselectAll() : handleSelectAll()}
          >
            {isAllSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 font-semibold"
            disabled={!hasContract}
            onClick={() => { setManualError(null); setShowManual(true); }}
          >
            <PlusCircle size={14} />
            Cargo manual
          </Button>
        </div>
      </div>

      {/* Scrollable ledger panel */}
      <div
        className="overflow-y-auto border-t border-b border-border"
        style={{ maxHeight: "calc(100dvh - 420px)", minHeight: 200 }}
      >
        <LedgerTable
          entries={ledgerEntries}
          montoOverrides={montoOverrides}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectMonth={handleSelectMonth}
          onDeselectMonth={handleDeselectMonth}
          onMontoChange={handleMontoChange}
          onCancelPunitorio={(id) => cancelPunitorio.mutate(id)}
          onAnularRecibo={(reciboNumero) => { setVoidError(null); setVoidConfirm({ reciboNumero }); }}
          onCancelEntry={handleCancelEntry}
          activeFilters={activeFilters}
        />
      </div>

      {/* Ledger totals footer */}
      <div className="flex items-center justify-end gap-6 px-4 py-2 border-b border-border text-xs text-muted-foreground">
        <span>Capital <span className="font-semibold text-foreground font-mono">${totalCapital.toLocaleString("es-AR")}</span></span>
        <span>Intereses <span className="font-semibold text-destructive font-mono">${totalIntereses.toLocaleString("es-AR")}</span></span>
        <span className="border-l border-border pl-6">Pendientes <span className="font-semibold text-warning font-mono">${totalPendiente.toLocaleString("es-AR")}</span></span>
        <span>Registrados <span className="font-semibold text-primary font-mono">${totalRegistrado.toLocaleString("es-AR")}</span></span>
      </div>

      {/* Bottom action bar */}
      <div className="px-4 pb-4 space-y-3">
        <CobroPanel
          selectedEntries={selectedEntries}
          montoOverrides={montoOverrides}
          honorariosPct={honorariosPct}
          onClearSelection={() => { setSelectedIds(new Set()); setMontoOverrides({}); }}
          onEmitirRecibo={() => { setEmitError(null); setShowEmit(true); }}
          isEmitting={emitirMutation.isPending}
        />

        {selectedEntries.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Seleccioná ítems de la lista para emitir un recibo
          </p>
        )}

        {emitError && <p className="text-xs text-destructive">{emitError}</p>}
      </div>

      {/* ── Emit receipt dialog ── */}
      <Dialog open={showEmit} onOpenChange={(open) => { if (!open && !emitirMutation.isPending) { setShowEmit(false); setEmitError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar recibo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Ítems a cobrar</p>
              {selectedEntries.map((e) => (
                <div key={e.id} className="flex justify-between">
                  <span className="text-muted-foreground truncate max-w-[240px]">{e.descripcion}</span>
                  <span className="font-mono ml-4">${getMonto(e, montoOverrides).toLocaleString("es-AR")}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Total del recibo</span>
                <span className="font-mono">${receiptTotal.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-xs text-primary">
                <span>Honorarios ({honorariosPct}%)</span>
                <span className="font-mono">${feesAmount.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-xs text-income">
                <span>Propietario recibe</span>
                <span className="font-mono">${ownerNet.toLocaleString("es-AR")}</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Observaciones (opcional)
              </label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ej: pago parcial, acuerdo de fecha, seña…"
                rows={3}
                className="text-sm resize-none"
              />
            </div>
            {emitError && (
              <p className="text-xs text-destructive">{emitError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEmit(false); setEmitError(null); }} disabled={emitirMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => emitirMutation.mutate()} disabled={emitirMutation.isPending}>
              {emitirMutation.isPending ? "Emitiendo..." : "Confirmar y emitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Void receipt dialog ── */}
      <Dialog
        open={voidConfirm !== null}
        onOpenChange={(open) => { if (!open) { setVoidConfirm(null); setVoidError(null); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Anular recibo {voidConfirm?.reciboNumero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {voidConfirm && (() => {
              const affectedEntries = ledgerEntries.filter((e) => e.reciboNumero === voidConfirm.reciboNumero);
              return (
                <>
                  <p className="text-muted-foreground text-xs">
                    Se revertirán los siguientes ítems a su estado anterior y se eliminarán los movimientos de caja generados por este recibo.
                  </p>
                  <div className="space-y-1 rounded-md border border-border p-3">
                    {affectedEntries.map((e) => (
                      <div key={e.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[180px]">{e.descripcion}</span>
                        <span className="font-mono ml-2">${Number(e.montoPagado ?? e.monto ?? 0).toLocaleString("es-AR")}</span>
                      </div>
                    ))}
                    {affectedEntries.length === 0 && (
                      <p className="text-xs text-muted-foreground">No se encontraron ítems con este recibo en la vista actual.</p>
                    )}
                  </div>
                  <p className="text-xs text-destructive font-medium">Esta acción no se puede deshacer.</p>
                </>
              );
            })()}
            {voidError && <p className="text-xs text-destructive">{voidError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidConfirm(null); setVoidError(null); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidConfirm && anularReciboMutation.mutate(voidConfirm.reciboNumero)}
              disabled={anularReciboMutation.isPending}
            >
              {anularReciboMutation.isPending ? "Anulando..." : "Confirmar anulación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cargo manual dialog ── */}
      <Dialog open={showManual} onOpenChange={(open) => { setShowManual(open); if (!open) setManualError(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cargo manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={manualTipo} onValueChange={setManualTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_MANUAL.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Descripción</label>
              <Input
                value={manualDescripcion}
                onChange={(e) => setManualDescripcion(e.target.value)}
                placeholder="Ej: arreglo de cañería"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Monto ($)</label>
              <Input
                value={manualMonto}
                onChange={(e) => setManualMonto(e.target.value)}
                placeholder="0"
                type="number"
                min="0"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Período (opcional)</label>
              <Input
                value={manualPeriod}
                onChange={(e) => setManualPeriod(e.target.value)}
                placeholder="YYYY-MM"
                pattern="\d{4}-\d{2}"
                className="h-9"
              />
            </div>
            {manualError && <p className="text-xs text-destructive">{manualError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManual(false)}>Cancelar</Button>
            <Button
              onClick={() => addManualMutation.mutate()}
              disabled={addManualMutation.isPending}
            >
              {addManualMutation.isPending ? "Guardando..." : "Agregar cargo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel entry dialog ── */}
      <Dialog
        open={cancelConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelConfirm(null);
            setCancelReason("");
            setCancelEntryError(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {cancelConfirm && (
              <div className="rounded-md border border-border p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground truncate">{cancelConfirm.descripcion}</p>
                {cancelConfirm.monto !== null && (
                  <p className="font-mono text-sm font-semibold">
                    ${Number(cancelConfirm.monto).toLocaleString("es-AR")}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: error de carga, no corresponde cobrar…"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            {cancelEntryError && <p className="text-xs text-destructive">{cancelEntryError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelConfirm(null);
                setCancelReason("");
                setCancelEntryError(null);
              }}
              disabled={cancelEntryMutation.isPending}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                cancelConfirm &&
                cancelEntryMutation.mutate({ entryId: cancelConfirm.id, reason: cancelReason })
              }
              disabled={cancelEntryMutation.isPending}
            >
              {cancelEntryMutation.isPending ? "Cancelando..." : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
