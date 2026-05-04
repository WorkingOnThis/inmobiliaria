"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { LedgerTable, type LedgerEntry } from "@/components/tenants/ledger-table";

type Props = {
  propietarioId: string;
};

type CuentaCorrienteData = {
  kpis: { totalLiquidadoYTD: number };
  ledgerEntries: LedgerEntry[];
};

export function OwnerTabCurrentAccount({ propietarioId }: Props) {
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

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* KPI Card */}
      <div className="px-4 pt-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Liquidado {new Date().getFullYear()}
            </p>
            <p className="text-base font-bold mt-1 font-mono text-[var(--income)]">
              ${kpis.totalLiquidadoYTD.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger table — read-only (no selection, no cobro) */}
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
          onViewDetail={() => {}}
          activeFilters={new Set()}
        />
      )}
    </div>
  );
}
