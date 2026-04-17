"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Plus, X, ChevronLeft, ChevronRight,
  Banknote, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  categoria: string | null;
  monto: string;
  origen: string;
  propiedadId: string | null;
  propiedadAddress: string | null;
  periodo: string | null;
}

interface CuentaCorrienteData {
  kpis: {
    liquidadoAcumulado: number;
    proximaLiquidacionEstimada: number;
    pendienteConfirmar: number;
  };
  movimientos: Movimiento[];
}

interface PropietarioTabCuentaCorrienteProps {
  propietarioId: string;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function localDateString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatMonthYear(periodo: string) {
  const [year, month] = periodo.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
}

type MovFilter = "todos" | "liquidados" | "pendientes" | "confirmar";
type FabAction = "liquidacion" | "movimiento" | null;

interface MovimientoFormState {
  descripcion: string;
  tipo: "ingreso" | "egreso";
  monto: string;
  fecha: string;
  categoria: string;
  nota: string;
}

interface LiquidacionFormState {
  descripcion: string;
  monto: string;
  fecha: string;
  nota: string;
}

const inputCls =
  "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[0.82rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-text-muted";
const labelCls =
  "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5 block";

export function PropietarioTabCuentaCorriente({
  propietarioId,
}: PropietarioTabCuentaCorrienteProps) {
  const queryClient = useQueryClient();

  const [movFilter, setMovFilter] = useState<MovFilter>("todos");
  const [fabAction, setFabAction] = useState<FabAction>(null);
  const [saving, setSaving] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("");

  const [movForm, setMovForm] = useState<MovimientoFormState>({
    descripcion: "",
    tipo: "ingreso",
    monto: "",
    fecha: localDateString(),
    categoria: "",
    nota: "",
  });

  const [liqForm, setLiqForm] = useState<LiquidacionFormState>({
    descripcion: "Liquidación mensual",
    monto: "",
    fecha: localDateString(),
    nota: "",
  });

  const queryParams = new URLSearchParams();
  if (periodoFiltro) queryParams.set("periodo", periodoFiltro);

  const { data, isLoading, error } = useQuery<CuentaCorrienteData>({
    queryKey: ["propietario-cc-full", propietarioId, periodoFiltro],
    queryFn: async () => {
      const res = await fetch(
        `/api/propietarios/${propietarioId}/cuenta-corriente?${queryParams}`
      );
      if (!res.ok) throw new Error("Error al cargar cuenta corriente");
      return res.json();
    },
  });

  const movimientos = data?.movimientos ?? [];

  const counts = {
    todos:      movimientos.length,
    liquidados: movimientos.filter((m) => m.origen === "liquidacion").length,
    pendientes: movimientos.filter((m) => m.origen !== "liquidacion").length,
    confirmar:  movimientos.filter((m) => m.categoria === "pendiente_confirmacion").length,
  };

  const movimientosFiltrados = movimientos.filter((m) => {
    if (movFilter === "liquidados") return m.origen === "liquidacion";
    if (movFilter === "pendientes") return m.origen !== "liquidacion";
    if (movFilter === "confirmar")  return m.categoria === "pendiente_confirmacion";
    return true;
  });

  const grupos = movimientosFiltrados.reduce<Record<string, Movimiento[]>>((acc, m) => {
    const key = m.periodo ?? "sin-periodo";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));

  const totalIngresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresos  = movimientos.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0);

  const handlePeriodoPrev = () => {
    if (!periodoFiltro) {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setPeriodoFiltro(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
    } else {
      const [y, m] = periodoFiltro.split("-").map(Number);
      const prev = new Date(y, m - 2, 1);
      setPeriodoFiltro(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
    }
  };

  const handlePeriodoNext = () => {
    if (!periodoFiltro) return;
    const [y, m] = periodoFiltro.split("-").map(Number);
    const next = new Date(y, m, 1);
    if (next > new Date()) { setPeriodoFiltro(""); return; }
    setPeriodoFiltro(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  const periodoLabel = periodoFiltro
    ? formatMonthYear(periodoFiltro)
    : `Todo ${new Date().getFullYear()}`;

  const handleSaveMovimiento = async () => {
    if (!movForm.descripcion.trim()) { toast.error("Completá la descripción"); return; }
    if (!movForm.monto)              { toast.error("Completá el monto"); return; }
    if (!movForm.fecha)              { toast.error("Completá la fecha"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/propietarios/${propietarioId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: movForm.descripcion.trim(),
          tipo: movForm.tipo,
          monto: parseFloat(movForm.monto),
          fecha: movForm.fecha,
          categoria: movForm.categoria || null,
          nota: movForm.nota || null,
          origen: "manual",
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al guardar"); }
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc-full", propietarioId] });
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc",      propietarioId] });
      toast.success("Movimiento registrado");
      setFabAction(null);
      setMovForm({ descripcion: "", tipo: "ingreso", monto: "", fecha: localDateString(), categoria: "", nota: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLiquidacion = async () => {
    if (!liqForm.descripcion.trim()) { toast.error("Completá la descripción"); return; }
    if (!liqForm.monto)              { toast.error("Completá el monto a liquidar"); return; }
    if (!liqForm.fecha)              { toast.error("Completá la fecha"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/propietarios/${propietarioId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: liqForm.descripcion.trim(),
          tipo: "egreso",
          monto: parseFloat(liqForm.monto),
          fecha: liqForm.fecha,
          nota: liqForm.nota || null,
          origen: "liquidacion",
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al guardar"); }
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc-full", propietarioId] });
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc",      propietarioId] });
      toast.success("Liquidación ejecutada");
      setFabAction(null);
      setLiqForm({ descripcion: "Liquidación mensual", monto: "", fecha: localDateString(), nota: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-7 flex flex-col gap-5">

      {/* ── KPI Cards ── */}
      {data && (
        <div className="grid grid-cols-3 gap-[14px]">
          {/* Card 1: Liquidado acumulado */}
          <div className="bg-surface border border-border rounded-[10px] p-[16px_18px]">
            <div className="kpi-label mb-2">Liquidado acumulado · {new Date().getFullYear()}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px] font-semibold text-text-secondary tabular-nums">$</span>
              <span className="text-[28px] font-semibold text-on-surface tabular-nums font-variant-numeric leading-none">
                {new Intl.NumberFormat("es-AR").format(Math.round(data.kpis.liquidadoAcumulado))}
              </span>
            </div>
            <div className="kpi-sub mt-1.5">Total enviado al propietario</div>
          </div>

          {/* Card 2: Próxima liquidación */}
          <div className="bg-surface border border-border rounded-[10px] p-[16px_18px]" style={{ borderLeft: "3px solid var(--primary)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="kpi-label">Próxima liquidación estimada</div>
              <span className="font-mono text-[11px] text-primary">30 abr</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px] font-semibold text-text-secondary tabular-nums">$</span>
              <span className="text-[28px] font-semibold text-on-surface tabular-nums leading-none">
                {new Intl.NumberFormat("es-AR").format(Math.round(data.kpis.proximaLiquidacionEstimada))}
              </span>
            </div>
            <div className="kpi-sub mt-1.5">Ingresos pendientes de liquidar</div>
          </div>

          {/* Card 3: Pendiente de confirmar */}
          <div className="bg-surface border border-border rounded-[10px] p-[16px_18px]">
            <div className="flex items-center justify-between mb-2">
              <div className="kpi-label">Pendiente de confirmar</div>
              {counts.confirmar > 0 && (
                <span className="font-mono text-[11px] text-warning">{counts.confirmar} items</span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px] font-semibold text-text-secondary tabular-nums">$</span>
              <span
                className="text-[28px] font-semibold tabular-nums leading-none"
                style={{ color: data.kpis.pendienteConfirmar > 0 ? "var(--warning)" : "var(--on-surface)" }}
              >
                {new Intl.NumberFormat("es-AR").format(Math.round(data.kpis.pendienteConfirmar))}
              </span>
            </div>
            <div className="kpi-sub mt-1.5">Transferencias sin confirmar</div>
          </div>
        </div>
      )}

      {/* ── Panel de movimientos ── */}
      <div className="bg-surface border border-border rounded-[10px] overflow-hidden">

        {/* Header del panel */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-border flex-wrap">
          <span className="text-[0.82rem] font-semibold text-on-surface">Movimientos</span>

          {/* Período */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePeriodoPrev}
              className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-on-surface transition-colors rounded"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPeriodoFiltro("")}
              className="text-[13px] font-semibold text-text-secondary hover:text-on-surface transition-colors px-2 min-w-[130px] text-center"
            >
              {periodoLabel}
            </button>
            <button
              onClick={handlePeriodoNext}
              disabled={!periodoFiltro}
              className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-on-surface transition-colors disabled:opacity-30 rounded"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Segmented filter */}
          <div
            className="inline-flex rounded-[7px] p-[2px] border border-border"
            style={{ background: "var(--surface-mid)" }}
          >
            {(
              [
                { key: "todos",      label: "Todos" },
                { key: "liquidados", label: "Liquidados" },
                { key: "pendientes", label: "Pendientes" },
                { key: "confirmar",  label: "A confirmar" },
              ] as { key: MovFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMovFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 text-[0.7rem] font-semibold rounded-[5px] transition-all",
                  movFilter === key
                    ? "bg-surface-high text-on-surface shadow-[0_1px_0_rgba(0,0,0,0.2)]"
                    : "text-text-secondary hover:text-on-surface"
                )}
              >
                {label}
                <span className="font-mono text-[10px] opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>

          {/* CSV button */}
          <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-semibold text-text-secondary border border-border rounded-[6px] hover:text-on-surface hover:border-border transition-all bg-surface">
            <Download size={12} /> CSV
          </button>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={22} className="animate-spin text-text-muted" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-error text-sm">Error al cargar los movimientos</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted text-sm">
            Sin movimientos en este período
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface border-b border-border">
                    <th className="w-7 px-3 py-2.5" />
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[35%]">Concepto</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[18%]">Propiedad</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[11%]">Fecha</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[12%]">Origen</th>
                    <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[14%]">Monto</th>
                    <th className="w-10 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {gruposOrdenados.map(([periodo, items]) => (
                    <React.Fragment key={periodo}>
                      {/* Grupo header */}
                      <tr>
                        <td colSpan={6} className="px-3.5 py-2 bg-surface-mid">
                          <span className="text-[11px] font-bold text-text-muted uppercase tracking-[0.06em]">
                            {periodo !== "sin-periodo" ? formatMonthYear(periodo) : "Sin período"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 bg-surface-mid text-right">
                          <span className="text-[12px] font-semibold font-mono" style={{ color: "var(--success)" }}>
                            +{formatMoney(items.filter((i) => i.tipo === "ingreso").reduce((s, i) => s + Number(i.monto), 0))}
                          </span>
                        </td>
                      </tr>

                      {items.map((m) => (
                        <tr
                          key={m.id}
                          className={cn(
                            "group transition-colors",
                            m.categoria === "pendiente_confirmacion"
                              ? "bg-warning-dim/40"
                              : "hover:bg-surface-mid"
                          )}
                        >
                          {/* Checkbox */}
                          <td className="w-7 px-3 py-[11px] align-middle">
                            <div className="size-4 rounded-[4px] border border-border bg-surface flex items-center justify-center cursor-pointer hover:border-primary transition-colors" />
                          </td>

                          {/* Concepto */}
                          <td className="px-3.5 py-[11px] align-middle">
                            <div className="text-[13.5px] font-medium text-on-surface">{m.descripcion}</div>
                            {m.categoria && m.categoria !== "pendiente_confirmacion" && (
                              <div className="text-[12px] text-text-muted italic mt-0.5">{m.categoria}</div>
                            )}
                            {m.categoria === "pendiente_confirmacion" && (
                              <div className="text-[12px] mt-0.5" style={{ color: "var(--warning)" }}>
                                Pendiente de confirmación
                              </div>
                            )}
                          </td>

                          {/* Propiedad */}
                          <td className="px-3.5 py-[11px] align-middle text-[12px] text-text-muted">
                            {m.propiedadAddress
                              ? m.propiedadAddress.length > 22
                                ? m.propiedadAddress.slice(0, 22) + "…"
                                : m.propiedadAddress
                              : "—"}
                          </td>

                          {/* Fecha */}
                          <td className="px-3.5 py-[11px] align-middle font-mono text-[12px] tabular-nums text-text-secondary">
                            {m.fecha ? format(new Date(m.fecha), "dd/MM/yyyy", { locale: es }) : "—"}
                          </td>

                          {/* Origen badge */}
                          <td className="px-3.5 py-[11px] align-middle">
                            <span
                              className={cn(
                                "inline-block font-mono text-[11px] px-[7px] py-[2px] rounded-[4px]",
                                m.origen === "liquidacion"
                                  ? "bg-warning-dim text-warning"
                                  : "bg-neutral-dim text-neutral"
                              )}
                            >
                              {m.origen === "liquidacion" ? "Liquidación" : m.origen === "manual" ? "Manual" : "Contrato"}
                            </span>
                          </td>

                          {/* Monto */}
                          <td
                            className="px-3.5 py-[11px] align-middle text-right font-mono font-semibold text-[13.5px] tabular-nums"
                            style={{ color: m.tipo === "ingreso" ? "var(--success)" : "var(--error)" }}
                          >
                            {m.tipo === "ingreso" ? "+$" : "−$"}
                            {new Intl.NumberFormat("es-AR").format(Number(m.monto))}
                          </td>

                          <td className="w-10 px-2 align-middle text-center">
                            <button className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-on-surface transition-all text-[18px] leading-none">⋮</button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="bg-surface border-t border-border px-5 py-3 flex items-center justify-between">
              <span className="text-[12px] text-text-muted">
                {movimientosFiltrados.length} movimiento{movimientosFiltrados.length !== 1 ? "s" : ""}
                {counts.confirmar > 0 && (
                  <> · <span className="text-on-surface">{counts.confirmar} a confirmar</span></>
                )}
              </span>
              <div className="flex gap-5">
                {[
                  { label: "Ingresos", value: totalIngresos,                color: "var(--success)", prefix: "+" },
                  { label: "Egresos",  value: totalEgresos,                 color: "var(--error)",   prefix: "−" },
                  { label: "Neto",     value: totalIngresos - totalEgresos, color: totalIngresos - totalEgresos >= 0 ? "var(--success)" : "var(--error)", prefix: totalIngresos - totalEgresos >= 0 ? "+" : "−" },
                ].map(({ label, value, color, prefix }) => (
                  <div key={label} className="text-right">
                    <div className="text-[10.5px] uppercase tracking-[0.07em] text-text-muted">{label}</div>
                    <div className="font-mono font-semibold text-[13px] tabular-nums" style={{ color }}>
                      {prefix}{formatMoney(Math.abs(value))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button className="flex items-center gap-1.5 px-4 py-2 text-[0.78rem] font-medium text-text-secondary hover:text-on-surface transition-colors">
          <Download size={14} /> Exportar resumen
        </button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setFabAction("movimiento")} className="gap-1.5">
            <Plus size={13} /> Agregar movimiento manual
          </Button>
          <Button size="sm" onClick={() => setFabAction("liquidacion")} className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90">
            <Banknote size={13} /> Generar liquidación
          </Button>
        </div>
      </div>

      {/* ── Modal: Agregar movimiento ── */}
      {fabAction === "movimiento" && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[3px] flex items-center justify-center px-4">
          <div className="bg-surface border border-border rounded-[12px] w-full max-w-[560px] overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between">
              <div>
                <div className="font-semibold text-[15px] text-on-surface">Agregar movimiento</div>
                <div className="text-[12px] text-text-muted mt-0.5">Crédito o débito manual en la cuenta corriente</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFabAction(null)} className="size-8 text-text-muted">
                <X size={16} />
              </Button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Segmented TIPO */}
              <div>
                <label className={labelCls}>Tipo</label>
                <div
                  className="flex w-full rounded-[7px] p-[2px] border border-border"
                  style={{ background: "var(--surface-mid)" }}
                >
                  {(["ingreso", "egreso"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setMovForm((f) => ({ ...f, tipo: t }))}
                      className={cn(
                        "flex-1 py-2 text-[0.78rem] font-semibold rounded-[5px] transition-all border",
                        movForm.tipo === t
                          ? "bg-primary-dim border-primary text-on-surface"
                          : "border-transparent text-text-secondary hover:text-on-surface"
                      )}
                    >
                      {t === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha <span className="text-error">*</span></label>
                  <input type="date" value={movForm.fecha} onChange={(e) => setMovForm((f) => ({ ...f, fecha: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Propiedad (opcional)</label>
                  <input type="text" placeholder="Sin especificar" className={inputCls} disabled />
                </div>
              </div>

              <div>
                <label className={labelCls}>Concepto <span className="text-error">*</span></label>
                <input type="text" value={movForm.descripcion} onChange={(e) => setMovForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Gasto de mantenimiento" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Monto <span className="text-error">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[0.82rem]">$</span>
                  <input
                    type="number"
                    value={movForm.monto}
                    onChange={(e) => setMovForm((f) => ({ ...f, monto: e.target.value }))}
                    placeholder="150000"
                    min="0"
                    className={cn(inputCls, "pl-7")}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Nota interna (opcional)</label>
                <input type="text" value={movForm.nota} onChange={(e) => setMovForm((f) => ({ ...f, nota: e.target.value }))} placeholder="Solo visible para el staff" className={inputCls} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFabAction(null)} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveMovimiento} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
                {saving && <Loader2 size={12} className="animate-spin" />} Guardar movimiento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Generar liquidación ── */}
      {fabAction === "liquidacion" && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[3px] flex items-center justify-center px-4">
          <div className="bg-surface border border-border rounded-[12px] w-full max-w-[500px] overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between">
              <div>
                <div className="font-semibold text-[15px] text-on-surface">Generar liquidación</div>
                <div className="text-[12px] text-text-muted mt-0.5">Registrá el pago enviado al propietario</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFabAction(null)} className="size-8 text-text-muted">
                <X size={16} />
              </Button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Período</label>
                  <input type="month" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fecha emisión <span className="text-error">*</span></label>
                  <input type="date" value={liqForm.fecha} onChange={(e) => setLiqForm((f) => ({ ...f, fecha: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Resumen */}
              {data && (
                <div className="bg-surface-mid border border-border rounded-[8px] p-3 flex flex-col gap-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-secondary">Alquileres</span>
                    <span className="font-mono font-medium" style={{ color: "var(--success)" }}>
                      +{formatMoney(data.kpis.proximaLiquidacionEstimada)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-secondary">Honorarios (7%)</span>
                    <span className="font-mono font-medium" style={{ color: "var(--error)" }}>
                      −{formatMoney(data.kpis.proximaLiquidacionEstimada * 0.07)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-baseline">
                    <span className="text-[12px] text-text-muted uppercase tracking-wide font-bold">Total a transferir</span>
                    <span className="font-mono font-bold text-[18px] tabular-nums" style={{ color: "var(--primary)" }}>
                      {formatMoney(data.kpis.proximaLiquidacionEstimada * 0.93)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Descripción <span className="text-error">*</span></label>
                <input type="text" value={liqForm.descripcion} onChange={(e) => setLiqForm((f) => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monto a liquidar <span className="text-error">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[0.82rem]">$</span>
                  <input
                    type="number"
                    value={liqForm.monto}
                    onChange={(e) => setLiqForm((f) => ({ ...f, monto: e.target.value }))}
                    placeholder={String(Math.round(data?.kpis.proximaLiquidacionEstimada ?? 0))}
                    min="0"
                    className={cn(inputCls, "pl-7")}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Nota interna (opcional)</label>
                <input type="text" value={liqForm.nota} onChange={(e) => setLiqForm((f) => ({ ...f, nota: e.target.value }))} placeholder="Ej: Transferencia Mercado Pago" className={inputCls} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFabAction(null)} disabled={saving}>Cancelar</Button>
              <Button variant="secondary" size="sm" disabled={saving}>Vista previa</Button>
              <Button size="sm" onClick={handleSaveLiquidacion} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
                {saving && <Loader2 size={12} className="animate-spin" />} Generar y enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
