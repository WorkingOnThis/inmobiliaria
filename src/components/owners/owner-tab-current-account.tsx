"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LedgerTable, type LedgerEntry } from "@/components/tenants/ledger-table";
import { EntryDetailDialog } from "@/components/ledger/entry-detail-dialog";

type Props = {
  propietarioId: string;
};

type CuentaCorrienteData = {
  kpis: { totalLiquidadoYTD: number; totalPendiente: number };
  ledgerEntries: LedgerEntry[];
  properties: { id: string; address: string }[];
};

const currentYear = new Date().getFullYear().toString();

function netYTDForProperty(entries: LedgerEntry[], propiedadId: string): number {
  // Sum the gross alquiler entries for this property + their negative honorarios
  // Both are in the entries array; just filter by property + estado conciliado + currentYear
  return entries
    .filter(
      (e) =>
        e.propiedadId === propiedadId &&
        e.estado === "conciliado" &&
        e.dueDate?.startsWith(currentYear)
    )
    .reduce((sum, e) => sum + Number(e.monto ?? 0), 0);
}

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

  const { kpis, ledgerEntries, properties } = data;

  // In owner view, "pending" includes overdue entries (entries past due date are
  // overdue because the tenant hasn't paid, not because the owner hasn't paid)
  const effectiveFilters = new Set(activeFilters);
  if (activeFilters.has("pending")) effectiveFilters.add("overdue");

  const isMultiProperty = properties.length >= 2;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <Card className="rounded-[var(--radius-lg)] border py-0 gap-0">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Liquidado {currentYear}
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

      {/* Ledger — single or grouped by property */}
      {ledgerEntries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No hay entradas en la cuenta corriente todavía.
        </div>
      ) : isMultiProperty ? (
        <div className="px-4">
          <Accordion type="multiple" defaultValue={properties.map((p) => p.id)} className="flex flex-col gap-2">
            {properties.map((p) => {
              const propEntries = ledgerEntries.filter((e) => e.propiedadId === p.id);
              const propNet = netYTDForProperty(propEntries, p.id);
              return (
                <AccordionItem key={p.id} value={p.id} className="border rounded-[var(--radius-lg)] px-3">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center justify-between flex-1 mr-2">
                      <span className="text-sm font-medium">{p.address}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        Liquidado {currentYear}: ${propNet.toLocaleString("es-AR")}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <LedgerTable
                      entries={propEntries}
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
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
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
