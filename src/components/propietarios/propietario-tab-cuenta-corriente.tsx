"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  periodo: string | null; // "YYYY-MM"
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

function formatMonthYear(periodo: string) {
  // "YYYY-MM" → "Abril 2025"
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

export function PropietarioTabCuentaCorriente({
  propietarioId,
}: PropietarioTabCuentaCorrienteProps) {
  const queryClient = useQueryClient();

  const [movFilter, setMovFilter] = useState<MovFilter>("todos");
  const [fabOpen, setFabOpen] = useState(false);
  const [fabAction, setFabAction] = useState<FabAction>(null);
  const [saving, setSaving] = useState(false);

  // Período: año actual por defecto (sin filtro de mes → ver todo)
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("");

  const [movForm, setMovForm] = useState<MovimientoFormState>({
    descripcion: "",
    tipo: "ingreso",
    monto: "",
    fecha: new Date().toISOString().slice(0, 10),
    categoria: "",
    nota: "",
  });

  const [liqForm, setLiqForm] = useState<LiquidacionFormState>({
    descripcion: "Liquidación mensual",
    monto: "",
    fecha: new Date().toISOString().slice(0, 10),
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

  // Filtrar movimientos según el filtro activo
  const movimientos = data?.movimientos ?? [];
  const movimientosFiltrados = movimientos.filter((m) => {
    if (movFilter === "liquidados") return m.origen === "liquidacion";
    if (movFilter === "pendientes") return m.origen !== "liquidacion";
    if (movFilter === "confirmar") return m.categoria === "pendiente_confirmacion";
    return true;
  });

  // Agrupar por período
  const grupos = movimientosFiltrados.reduce<Record<string, Movimiento[]>>((acc, m) => {
    const key = m.periodo ?? "sin-periodo";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));

  // Totales
  const totalIngresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((sum, m) => sum + Number(m.monto), 0);
  const totalEgresos = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((sum, m) => sum + Number(m.monto), 0);

  // Navegación de período
  const handlePeriodoPrev = () => {
    if (!periodoFiltro) {
      // Si está en "todo el año", pasamos al mes anterior al actual
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
    const now = new Date();
    if (next > now) {
      setPeriodoFiltro("");
      return;
    }
    setPeriodoFiltro(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  const periodoLabel = periodoFiltro
    ? formatMonthYear(periodoFiltro)
    : `Todo ${new Date().getFullYear()}`;

  // Guardar movimiento manual
  const handleSaveMovimiento = async () => {
    if (!movForm.descripcion.trim() || !movForm.monto || !movForm.fecha) {
      toast.error("Completá descripción, monto y fecha");
      return;
    }
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc-full", propietarioId] });
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc", propietarioId] });
      toast.success("Movimiento registrado");
      setFabAction(null);
      setFabOpen(false);
      setMovForm({
        descripcion: "",
        tipo: "ingreso",
        monto: "",
        fecha: new Date().toISOString().slice(0, 10),
        categoria: "",
        nota: "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Guardar liquidación
  const handleSaveLiquidacion = async () => {
    if (!liqForm.descripcion.trim() || !liqForm.monto || !liqForm.fecha) {
      toast.error("Completá descripción, monto y fecha");
      return;
    }
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc-full", propietarioId] });
      await queryClient.invalidateQueries({ queryKey: ["propietario-cc", propietarioId] });
      toast.success("Liquidación ejecutada");
      setFabAction(null);
      setFabOpen(false);
      setLiqForm({
        descripcion: "Liquidación mensual",
        monto: "",
        fecha: new Date().toISOString().slice(0, 10),
        nota: "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground";
  const labelClass =
    "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5 block";

  return (
    <div className="p-7 flex flex-col gap-5 pb-20 relative">
      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-[18px] p-4">
            <div className="text-[0.62rem] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1">
              Liquidado acumulado · {new Date().getFullYear()}
            </div>
            <div className="text-[1.4rem] font-bold text-foreground font-headline">
              {formatMoney(data.kpis.liquidadoAcumulado)}
            </div>
            <div className="text-[0.65rem] text-muted-foreground mt-0.5">Total enviado al propietario</div>
          </div>
          <div className="bg-card border border-border rounded-[18px] p-4">
            <div className="text-[0.62rem] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1">
              Próxima liquidación estimada
            </div>
            <div className="text-[1.4rem] font-bold text-foreground font-headline">
              {formatMoney(data.kpis.proximaLiquidacionEstimada)}
            </div>
            <div className="text-[0.65rem] text-muted-foreground mt-0.5">Ingresos pendientes de liquidar</div>
          </div>
          <div
            className={cn(
              "border rounded-[18px] p-4",
              data.kpis.pendienteConfirmar > 0
                ? "bg-mustard/[0.06] border-mustard/20"
                : "bg-card border-border"
            )}
          >
            <div className="text-[0.62rem] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1">
              ⏳ Pendiente de confirmar
            </div>
            <div
              className={cn(
                "text-[1.4rem] font-bold font-headline",
                data.kpis.pendienteConfirmar > 0 ? "text-mustard" : "text-foreground"
              )}
            >
              {formatMoney(data.kpis.pendienteConfirmar)}
            </div>
            <div className="text-[0.65rem] text-muted-foreground mt-0.5">
              Transferencias sin confirmar · Modalidad B
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-card border border-border rounded-[18px] overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-border flex-wrap">
          <span className="text-[0.78rem] font-semibold text-foreground">Movimientos</span>
          <Separator orientation="vertical" className="h-4" />

          {/* Selector de período */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePeriodoPrev}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPeriodoFiltro("")}
              className="text-[0.72rem] font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 min-w-[120px] text-center"
            >
              {periodoLabel}
            </button>
            <button
              onClick={handlePeriodoNext}
              disabled={!periodoFiltro}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Filtros */}
          <div className="flex gap-1">
            {(
              [
                { key: "todos", label: "Todos" },
                { key: "liquidados", label: "Liquidados" },
                { key: "pendientes", label: "Pendientes" },
                { key: "confirmar", label: "⏳ A confirmar" },
              ] as { key: MovFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMovFilter(key)}
                className={cn(
                  "px-2.5 py-1 text-[0.62rem] font-semibold rounded-[6px] transition-all border",
                  movFilter === key
                    ? "bg-primary-dim text-primary border-border-accent"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                  key === "confirmar" && "text-mustard"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto">
            <button className="text-[0.62rem] text-muted-foreground hover:text-muted-foreground border border-border rounded-[6px] px-2 py-1 transition-all">
              ⬇ CSV
            </button>
          </div>
        </div>

        {/* Tabla de movimientos */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive text-sm">
            Error al cargar los movimientos
          </div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <div className="text-sm">Sin movimientos en este período</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.8rem]">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground bg-card w-[34%]">
                      Concepto
                    </th>
                    <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground bg-card w-[14%]">
                      Propiedad
                    </th>
                    <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground bg-card w-[10%]">
                      Fecha
                    </th>
                    <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground bg-card w-[12%]">
                      Origen
                    </th>
                    <th className="px-4 py-2.5 text-right text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground bg-card w-[14%]">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gruposOrdenados.map(([periodo, items]) => (
                    <React.Fragment key={periodo}>
                      {/* Header de grupo */}
                      <tr className="bg-card">
                        <td colSpan={4} className="px-4 py-2">
                          <span className="text-[0.72rem] font-bold text-muted-foreground">
                            {periodo !== "sin-periodo" ? formatMonthYear(periodo) : "Sin período"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-[0.78rem] font-bold text-green">
                            +
                            {formatMoney(
                              items
                                .filter((i) => i.tipo === "ingreso")
                                .reduce((sum, i) => sum + Number(i.monto), 0)
                            )}
                          </span>
                        </td>
                      </tr>

                      {/* Ítems del grupo */}
                      {items.map((m, idx) => (
                        <tr
                          key={m.id}
                          className={cn(
                            "transition-colors hover:bg-foreground/[0.02]",
                            m.categoria === "pendiente_confirmacion"
                              ? "bg-mustard/[0.04]"
                              : idx % 2 === 1
                              ? "bg-foreground/[0.01]"
                              : ""
                          )}
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="font-medium text-foreground">{m.descripcion}</div>
                            {m.categoria && m.categoria !== "pendiente_confirmacion" && (
                              <div className="text-[0.65rem] text-muted-foreground mt-0.5">
                                {m.categoria}
                              </div>
                            )}
                            {m.categoria === "pendiente_confirmacion" && (
                              <div className="text-[0.65rem] text-mustard mt-0.5">
                                ⏳ Pendiente de confirmación
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle text-[0.72rem] text-muted-foreground">
                            {m.propiedadAddress
                              ? m.propiedadAddress.length > 20
                                ? m.propiedadAddress.slice(0, 20) + "…"
                                : m.propiedadAddress
                              : "—"}
                          </td>
                          <td className="px-4 py-3 align-middle text-[0.72rem] text-muted-foreground">
                            {m.fecha
                              ? format(new Date(m.fecha), "dd/MM/yyyy", { locale: es })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <Badge
                              variant={
                                m.origen === "liquidacion"
                                  ? "income"
                                  : "secondary"
                              }
                            >
                              {m.origen === "liquidacion"
                                ? "Liquidación"
                                : m.origen === "manual"
                                ? "Manual"
                                : "Contrato"}
                            </Badge>
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 align-middle text-right font-bold font-headline text-[0.9rem]",
                              m.tipo === "ingreso" ? "text-green" : "text-destructive"
                            )}
                          >
                            {m.tipo === "ingreso" ? "+" : "−"}
                            {formatMoney(Number(m.monto))}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de totales */}
            <div className="bg-card border-t border-border px-5 py-3 flex items-center justify-between">
              <span className="text-[0.72rem] text-muted-foreground">
                {movimientosFiltrados.length} movimiento
                {movimientosFiltrados.length !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-5">
                <div className="text-right">
                  <div className="text-[0.6rem] text-muted-foreground uppercase tracking-[0.08em]">
                    Ingresos
                  </div>
                  <div className="text-[0.85rem] font-bold text-green font-headline">
                    +{formatMoney(totalIngresos)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[0.6rem] text-muted-foreground uppercase tracking-[0.08em]">
                    Egresos
                  </div>
                  <div className="text-[0.85rem] font-bold text-destructive font-headline">
                    −{formatMoney(totalEgresos)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[0.6rem] text-muted-foreground uppercase tracking-[0.08em]">
                    Neto
                  </div>
                  <div
                    className={cn(
                      "text-[0.85rem] font-bold font-headline",
                      totalIngresos - totalEgresos >= 0 ? "text-green" : "text-destructive"
                    )}
                  >
                    {totalIngresos - totalEgresos >= 0 ? "+" : ""}
                    {formatMoney(totalIngresos - totalEgresos)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* FAB — botón flotante */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-2 z-30">
        {fabOpen && (
          <>
            <button
              onClick={() => {
                setFabAction("liquidacion");
                setFabOpen(false);
              }}
              className="flex items-center gap-2 bg-card border border-border rounded-[12px] px-4 py-2.5 text-[0.78rem] font-semibold text-foreground shadow-xl hover:border-border-accent hover:text-primary transition-all whitespace-nowrap"
            >
              💸 Generar liquidación
            </button>
            <button
              onClick={() => {
                setFabAction("movimiento");
                setFabOpen(false);
              }}
              className="flex items-center gap-2 bg-card border border-border rounded-[12px] px-4 py-2.5 text-[0.78rem] font-semibold text-foreground shadow-xl hover:border-border-accent hover:text-primary transition-all whitespace-nowrap"
            >
              ➕ Agregar movimiento manual
            </button>
          </>
        )}
        <button
          onClick={() => setFabOpen((o) => !o)}
          className={cn(
            "size-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_6px_24px_rgba(255,180,162,0.35)] hover:shadow-[0_8px_28px_rgba(255,180,162,0.5)] transition-all text-xl font-bold",
            fabOpen && "rotate-45"
          )}
          style={{ transition: "transform 0.22s ease, box-shadow 0.2s ease" }}
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Modal: Agregar movimiento manual */}
      {fabAction === "movimiento" && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[3px] flex items-center justify-center px-4">
          <div className="bg-card border border-border rounded-[24px] w-full max-w-[480px] overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between">
              <div>
                <div className="font-bold text-[1.05rem] text-foreground font-headline">
                  Agregar movimiento
                </div>
                <div className="text-[0.71rem] text-muted-foreground mt-0.5">
                  Crédito o débito manual en la cuenta corriente
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFabAction(null)}
                className="size-8 text-muted-foreground"
              >
                <X size={18} />
              </Button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3.5">
              {/* Tipo */}
              <div>
                <label className={labelClass}>Tipo</label>
                <div className="flex gap-2">
                  {(["ingreso", "egreso"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setMovForm((f) => ({ ...f, tipo: t }))}
                      className={cn(
                        "flex-1 py-2 text-[0.72rem] font-semibold rounded-[10px] border transition-all",
                        movForm.tipo === t
                          ? t === "ingreso"
                            ? "bg-green-dim border-green/20 text-green"
                            : "bg-destructive-dim border-destructive/20 text-destructive"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Descripción <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={movForm.descripcion}
                  onChange={(e) => setMovForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Gasto de mantenimiento"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Monto <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={movForm.monto}
                    onChange={(e) => setMovForm((f) => ({ ...f, monto: e.target.value }))}
                    placeholder="150000"
                    min="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Fecha <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={movForm.fecha}
                    onChange={(e) => setMovForm((f) => ({ ...f, fecha: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Categoría (opcional)</label>
                <input
                  type="text"
                  value={movForm.categoria}
                  onChange={(e) => setMovForm((f) => ({ ...f, categoria: e.target.value }))}
                  placeholder="Ej: Plomería, Honorarios…"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Nota interna (opcional)</label>
                <input
                  type="text"
                  value={movForm.nota}
                  onChange={(e) => setMovForm((f) => ({ ...f, nota: e.target.value }))}
                  placeholder="Solo visible para el staff"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setFabAction(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveMovimiento} disabled={saving}>
                {saving && <Loader2 size={12} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Generar liquidación */}
      {fabAction === "liquidacion" && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[3px] flex items-center justify-center px-4">
          <div className="bg-card border border-border rounded-[24px] w-full max-w-[480px] overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between">
              <div>
                <div className="font-bold text-[1.05rem] text-foreground font-headline">
                  Generar liquidación
                </div>
                <div className="text-[0.71rem] text-muted-foreground mt-0.5">
                  Registrá el pago enviado al propietario
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFabAction(null)}
                className="size-8 text-muted-foreground"
              >
                <X size={18} />
              </Button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3.5">
              {data && (
                <div className="bg-muted rounded-[12px] px-4 py-3 border border-border">
                  <div className="text-[0.65rem] text-muted-foreground">Estimado a liquidar</div>
                  <div className="text-[1.2rem] font-bold text-foreground font-headline">
                    {formatMoney(data.kpis.proximaLiquidacionEstimada)}
                  </div>
                </div>
              )}
              <div>
                <label className={labelClass}>
                  Descripción <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={liqForm.descripcion}
                  onChange={(e) => setLiqForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Liquidación mensual"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Monto a liquidar <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={liqForm.monto}
                    onChange={(e) => setLiqForm((f) => ({ ...f, monto: e.target.value }))}
                    placeholder={String(Math.round(data?.kpis.proximaLiquidacionEstimada ?? 0))}
                    min="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Fecha <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={liqForm.fecha}
                    onChange={(e) => setLiqForm((f) => ({ ...f, fecha: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Nota interna (opcional)</label>
                <input
                  type="text"
                  value={liqForm.nota}
                  onChange={(e) => setLiqForm((f) => ({ ...f, nota: e.target.value }))}
                  placeholder="Ej: Transferencia Mercado Pago"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setFabAction(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveLiquidacion} disabled={saving}>
                {saving && <Loader2 size={12} className="animate-spin" />}
                Ejecutar liquidación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
