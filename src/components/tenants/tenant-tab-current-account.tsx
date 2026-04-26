"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LedgerTable, type LedgerEntry } from "./ledger-table";
import { CobroPanel } from "./cobro-panel";

type KPIs = {
  estadoCuenta: "al_dia" | "en_mora";
  totalCobradoYTD: number;
  proximoPago: { fecha: string; monto: string } | null;
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

export function TenantTabCurrentAccount({ inquilinoId, honorariosPct = 10 }: Props) {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"completa" | "historial">("completa");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [montoOverrides, setMontoOverrides] = useState<Record<string, string>>({});
  const [confirmEmit, setConfirmEmit] = useState(false);

  const { data, isLoading, isError } = useQuery<CuentaCorrienteData>({
    queryKey: ["cuenta-corriente", inquilinoId],
    queryFn: () =>
      fetch(`/api/tenants/${inquilinoId}/cuenta-corriente`).then((r) => r.json()),
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
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Error al emitir el recibo");
      }
      return response.json();
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setMontoOverrides({});
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", inquilinoId] });
    },
  });

  const addPunitorio = useMutation({
    mutationFn: async ({
      parentId,
      monto,
      descripcion,
    }: {
      parentId: string;
      monto: number;
      descripcion: string;
    }) => {
      const response = await fetch(
        `/api/tenants/${inquilinoId}/ledger/${parentId}/punitorio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monto, descripcion }),
        }
      );
      if (!response.ok) throw new Error("Error al agregar punitorio");
      return response.json();
    },
    onSuccess: (newEntry) => {
      setSelectedIds((prev) => new Set([...prev, newEntry.id]));
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", inquilinoId] });
    },
  });

  const cancelPunitorio = useMutation({
    mutationFn: async (entryId: string) => {
      await fetch(`/api/tenants/${inquilinoId}/ledger/${entryId}`, { method: "DELETE" });
    },
    onSuccess: (_, entryId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", inquilinoId] });
    },
  });

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectMonth(period: string) {
    const cobrables = (data?.ledgerEntries ?? [])
      .filter(
        (e) =>
          e.period === period &&
          (e.estado === "pendiente" || e.estado === "registrado") &&
          e.monto !== null
      )
      .map((e) => e.id);
    setSelectedIds((prev) => new Set([...prev, ...cobrables]));
  }

  function handleMontoChange(id: string, value: string) {
    setMontoOverrides((prev) => ({ ...prev, [id]: value }));
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Cargando cuenta corriente...</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error al cargar la cuenta corriente.
      </div>
    );
  }

  const { kpis, ledgerEntries, proximoAjuste } = data;
  const selectedEntries = ledgerEntries.filter((e) => selectedIds.has(e.id));

  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estado</p>
            <p className={`text-base font-bold mt-1 ${kpis.estadoCuenta === "al_dia" ? "text-green-400" : "text-destructive"}`}>
              {kpis.estadoCuenta === "al_dia" ? "Al día" : "En mora"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Próximo pago</p>
            {kpis.proximoPago ? (
              <>
                <p className="text-base font-bold mt-1 font-mono">
                  ${Number(kpis.proximoPago.monto).toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-muted-foreground">Vence {kpis.proximoPago.fecha}</p>
              </>
            ) : (
              <p className="text-base font-bold mt-1 text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cobrado {new Date().getFullYear()}</p>
            <p className="text-base font-bold mt-1 font-mono text-green-400">
              ${kpis.totalCobradoYTD.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próximo ajuste alert */}
      {proximoAjuste && (
        <div className="px-4">
          <Alert variant="default" className="border-amber-800 bg-amber-950/20">
            <AlertTitle className="text-amber-400 text-sm">
              ⚠ Ajuste de índice en {proximoAjuste.mesesRestantes} meses
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Período {proximoAjuste.period} — los montos a partir de ese mes están pendientes de revisión.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Table toolbar */}
      <div className="flex items-center justify-between px-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "completa" | "historial")}
        >
          <ToggleGroupItem value="completa" className="text-xs h-8 px-3">
            ↔ Completa
          </ToggleGroupItem>
          <ToggleGroupItem value="historial" className="text-xs h-8 px-3">
            ← Solo historial
          </ToggleGroupItem>
        </ToggleGroup>

        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            /* TODO PR 4: open manual cargo dialog */
          }}
        >
          + Cargo manual
        </Button>
      </div>

      {/* Ledger table */}
      <LedgerTable
        entries={ledgerEntries}
        montoOverrides={montoOverrides}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectMonth={handleSelectMonth}
        onMontoChange={handleMontoChange}
        onAddPunitorio={(parentId, monto, desc) =>
          addPunitorio.mutate({ parentId, monto, descripcion: desc })
        }
        onCancelPunitorio={(id) => cancelPunitorio.mutate(id)}
        viewMode={viewMode}
      />

      {/* Cobro panel */}
      <CobroPanel
        selectedEntries={selectedEntries}
        montoOverrides={montoOverrides}
        honorariosPct={honorariosPct}
        onClearSelection={() => {
          setSelectedIds(new Set());
          setMontoOverrides({});
        }}
        onEmitirRecibo={() => setConfirmEmit(true)}
        isEmitting={emitirMutation.isPending}
      />

      {/* Confirmation dialog */}
      <AlertDialog open={confirmEmit} onOpenChange={setConfirmEmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Emitir recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se emitirá un recibo por {selectedEntries.length} ítem(s) y se actualizarán los estados a &quot;conciliado&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEmit(false);
                emitirMutation.mutate();
              }}
            >
              Emitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
