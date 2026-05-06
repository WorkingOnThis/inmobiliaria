"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LedgerTable, type LedgerEntry } from "@/components/tenants/ledger-table";
import { EntryDetailDialog } from "@/components/ledger/entry-detail-dialog";

type Props = {
  propietarioId: string;
};

type CuentaCorrienteData = {
  kpis: { totalLiquidadoYTD: number; totalPendiente: number };
  ledgerEntries: LedgerEntry[];
};

export function OwnerTabCurrentAccount({ propietarioId }: Props) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["pending", "paid"]));
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<LedgerEntry | null>(null);

  const { data, isLoading, isError } = useQuery<CuentaCorrienteData>({
    queryKey: ["owner-cuenta-corriente", propietarioId],
    queryFn: () =>
      fetch(`/api/owners/${propietarioId}/cuenta-corriente`).then((r) => r.json()),
  });

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

  const { kpis, ledgerEntries } = data;

  // In owner view, "pending" includes overdue entries (entries past due date are
  // overdue because the tenant hasn't paid, not because the owner hasn't paid)
  const effectiveFilters = new Set(activeFilters);
  if (activeFilters.has("pending")) effectiveFilters.add("overdue");

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <Card className="rounded-[var(--radius-lg)] border py-0 gap-0">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Liquidado {new Date().getFullYear()}
            </p>
            <p className="text-2xl font-bold mt-1 font-mono text-income">
              ${kpis.totalLiquidadoYTD.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[var(--radius-lg)] border py-0 gap-0">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pendiente de liquidar
            </p>
            {kpis.totalPendiente > 0 ? (
              <p className="text-2xl font-bold mt-1 font-mono text-warning">
                ${kpis.totalPendiente.toLocaleString("es-AR")}
              </p>
            ) : (
              <p className="text-2xl font-bold mt-1 text-income">Al día</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="px-4">
        <ToggleGroup
          type="multiple"
          value={[...activeFilters]}
          onValueChange={(v) => setActiveFilters(new Set(v))}
        >
          <ToggleGroupItem value="pending" className="text-xs h-8 px-3">Pendientes</ToggleGroupItem>
          <ToggleGroupItem value="paid" className="text-xs h-8 px-3">Pagados</ToggleGroupItem>
          <ToggleGroupItem value="future" className="text-xs h-8 px-3">Futuros</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Ledger table */}
      {ledgerEntries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No hay entradas en la cuenta corriente todavía.
        </div>
      ) : (
        <LedgerTable
          entries={ledgerEntries}
          montoOverrides={{}}
          selectedIds={new Set()}
          onToggleSelect={() => {}}
          onSelectMonth={() => {}}
          onDeselectMonth={() => {}}
          onMontoChange={() => {}}
          onAnularRecibo={() => {}}
          onCancelEntry={() => {}}
          onViewDetail={setSelectedDetailEntry}
          activeFilters={effectiveFilters}
          isOwnerView={true}
        />
      )}

      <EntryDetailDialog
        entry={selectedDetailEntry}
        onOpenChange={(open) => { if (!open) setSelectedDetailEntry(null); }}
        readOnly={true}
        onSave={() => Promise.resolve()}
      />
    </div>
  );
}
