"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Plus, X, ChevronLeft, ChevronRight,
  Banknote, Download, FileText, Filter,
  CheckCircle2, Circle, Paperclip, Eye, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Tipos ─────────────────────────────────────────────────────────────────────

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
  conciliado: boolean;
  conciliadoEn: string | null;
  comprobanteUrl: string | null;
  comprobanteMime: string | null;
}

interface CuentaCorrienteData {
  kpis: {
    liquidadoAcumulado: number;
    proximaLiquidacionEstimada: number;
    pendienteConfirmar: number;
  };
  movimientos: Movimiento[];
}

interface OwnerTabCurrentAccountProps {
  ownerId: string;
  onPendingCount?: (count: number) => void;
}

type MovFilter = "todos" | "liquidados" | "pendientes" | "confirmar";
type FabAction = "liquidacion" | "movimiento" | null;
type MovTipo = "income" | "expense" | "porcentaje";
type PorcentajeBase = "total_transferir" | "subtotal_alquileres" | "subtotal_ingresos" | "monto_manual";

interface MovimientoFormState {
  descripcion: string;
  tipo: MovTipo;
  monto: string;
  pctDireccion: "income" | "expense";
  pctValor: string;
  pctBase: PorcentajeBase;
  pctMontoManual: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const inputCls =
  "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[0.82rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-text-muted";
const labelCls =
  "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5 block";

// ── FilaMovimiento — componente de fila individual ────────────────────────────
//
// Es un componente separado (no inline en el .map) para poder usar hooks
// dentro de él sin violar las reglas de React.

function FilaMovimiento({
  movimiento,
  onActualizado,
}: {
  movimiento: Movimiento;
  onActualizado: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isImage = movimiento.comprobanteMime?.startsWith("image/");

  // Alterna conciliado. Si tenía comprobante y se va a desmarcar, abre el diálogo.
  const handleClickConciliado = () => {
    if (movimiento.conciliado && movimiento.comprobanteUrl) {
      setConfirmOpen(true);
    } else {
      ejecutarToggle();
    }
  };

  const ejecutarToggle = async () => {
    setToggling(true);
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/caja/movimientos/${movimiento.id}/conciliar`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error();
      onActualizado();
      toast.success(movimiento.conciliado ? "Desmarcado como conciliado" : "Marcado como conciliado");
    } catch {
      toast.error("No se pudo actualizar el estado de conciliación");
    } finally {
      setToggling(false);
    }
  };

  // Abre un file picker dinámico (sin <input> en el DOM — no puede ser hijo de <tr>)
  const handleAbrirFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("El archivo supera los 5 MB");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      setUploadingFile(true);
      try {
        const res = await fetch(`/api/caja/movimientos/${movimiento.id}/comprobante`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Error al subir");
        }
        onActualizado();
        toast.success("Comprobante adjuntado");
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setUploadingFile(false);
        input.remove();
      }
    };
    input.click();
  };

  const handleEliminarComprobante = async () => {
    try {
      const res = await fetch(`/api/caja/movimientos/${movimiento.id}/comprobante`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onActualizado();
      toast.success("Comprobante eliminado");
    } catch {
      toast.error("No se pudo eliminar el comprobante");
    }
  };

  return (
    <>
      {/* Diálogo de confirmación al desmarcar un movimiento con comprobante */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>¿Desmarcar como conciliado?</DialogTitle>
            <DialogDescription>
              Este movimiento tiene un comprobante adjunto. Desmarcarlo no elimina el archivo,
              pero el movimiento quedará sin verificar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={ejecutarToggle}
              disabled={toggling}
            >
              {toggling && <Loader2 size={12} className="animate-spin" />}
              Desmarcar igual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <td className="w-8 px-2 py-[11px] align-middle text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClickConciliado}
              disabled={toggling}
              className="transition-opacity disabled:opacity-40 flex items-center justify-center mx-auto"
            >
              {toggling ? (
                <Loader2 size={15} className="animate-spin text-text-muted" />
              ) : movimiento.conciliado ? (
                <CheckCircle2 size={15} className="text-success" />
              ) : (
                <Circle size={15} className="text-border hover:text-text-muted transition-colors" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {movimiento.conciliado
              ? `Conciliado${movimiento.conciliadoEn ? ` · ${format(new Date(movimiento.conciliadoEn), "dd/MM/yyyy")}` : ""}`
              : "Sin conciliar — click para marcar"}
          </TooltipContent>
        </Tooltip>
      </td>
      <td className="px-3.5 py-[11px] align-middle">
        <div className="text-[13.5px] font-medium text-on-surface">{movimiento.descripcion}</div>
        {movimiento.categoria && movimiento.categoria !== "pendiente_confirmacion" && (
          <div className="text-[12px] text-text-muted italic mt-0.5">{movimiento.categoria}</div>
        )}
        {movimiento.categoria === "pendiente_confirmacion" && (
          <div className="text-[12px] mt-0.5" style={{ color: "var(--warning)" }}>
            Pendiente de confirmación
          </div>
        )}
      </td>

      {/* ── Celda 3: propiedad ── */}
      <td className="px-3.5 py-[11px] align-middle text-[12px] text-text-muted">
        {movimiento.propiedadAddress
          ? movimiento.propiedadAddress.length > 22
            ? movimiento.propiedadAddress.slice(0, 22) + "…"
            : movimiento.propiedadAddress
          : "—"}
      </td>

      {/* ── Celda 4: fecha ── */}
      <td className="px-3.5 py-[11px] align-middle font-mono text-[12px] tabular-nums text-text-secondary">
        {movimiento.fecha ? format(new Date(movimiento.fecha), "dd/MM/yyyy", { locale: es }) : "—"}
      </td>

      {/* ── Celda 5: badge de origen ── */}
      <td className="px-3.5 py-[11px] align-middle">
        {movimiento.origen === "manual" ? (
          <span
            className="inline-flex items-center font-semibold text-[10.5px] uppercase tracking-[.05em] px-[7px] py-[2px] rounded-[4px] border"
            style={{
              color: "var(--warning)",
              borderColor: "color-mix(in srgb, var(--warning) 25%, transparent)",
              background: "var(--warning-dim)",
            }}
          >
            Manual
          </span>
        ) : (
          <span
            className="inline-flex items-center font-semibold text-[10.5px] uppercase tracking-[.05em] px-[7px] py-[2px] rounded-[4px] border"
            style={{
              color: "var(--origin-auto)",
              borderColor: "color-mix(in srgb, var(--origin-auto) 25%, transparent)",
              background: "var(--origin-auto-dim)",
            }}
          >
            Automático
          </span>
        )}
      </td>

      {/* ── Celda 6: monto ── */}
      <td
        className="px-3.5 py-[11px] align-middle text-right font-mono font-semibold text-[13.5px] tabular-nums"
        style={{ color: movimiento.tipo === "income" ? "var(--success)" : "var(--error)" }}
      >
        {movimiento.tipo === "income" ? "+$" : "−$"}
        {new Intl.NumberFormat("es-AR").format(Number(movimiento.monto))}
      </td>

      {/* ── Celda 7: acciones de comprobante ── */}
      <td className="w-16 px-2 py-[11px] align-middle text-center">
        {movimiento.comprobanteUrl ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center mx-auto text-primary hover:text-primary/80 transition-colors">
                <Paperclip size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <a
                  href={movimiento.comprobanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {isImage ? <Eye size={13} /> : <FileText size={13} />}
                  {isImage ? "Ver imagen" : "Ver PDF"}
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleEliminarComprobante}
                className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 size={13} />
                Eliminar comprobante
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleAbrirFilePicker}
                disabled={uploadingFile}
                className="flex items-center justify-center mx-auto text-border hover:text-text-muted transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
              >
                {uploadingFile
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Paperclip size={13} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Adjuntar comprobante</TooltipContent>
          </Tooltip>
        )}
      </td>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function OwnerTabCurrentAccount({
  ownerId,
  onPendingCount,
}: OwnerTabCurrentAccountProps) {
  const queryClient = useQueryClient();

  const [movFilter, setMovFilter] = useState<MovFilter>("todos");
  const [fabAction, setFabAction] = useState<FabAction>(null);
  const [saving, setSaving] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("");
  // false = todos; true = solo los no conciliados (pendientes de verificar)
  const [filtroPendientesConciliacion, setFiltroPendientesConciliacion] = useState(false);

  const [movForm, setMovForm] = useState<MovimientoFormState>({
    descripcion: "",
    tipo: "income",
    monto: "",
    pctDireccion: "expense",
    pctValor: "",
    pctBase: "total_transferir",
    pctMontoManual: "",
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
    queryKey: ["owner-cc-full", ownerId, periodoFiltro],
    queryFn: async () => {
      const res = await fetch(
        `/api/owners/${ownerId}/cuenta-corriente?${queryParams}`
      );
      if (!res.ok) throw new Error("Error al cargar cuenta corriente");
      return res.json();
    },
  });

  const movimientos = data?.movimientos ?? [];

  const { counts, noConciliados, totalIngresos, totalEgresos } = movimientos.reduce(
    (acc, m) => {
      acc.counts.todos++;
      if (m.origen === "settlement") acc.counts.liquidados++;
      else acc.counts.pendientes++;
      if (m.categoria === "pendiente_confirmacion") acc.counts.confirmar++;
      if (!m.conciliado) acc.noConciliados++;
      if (m.tipo === "income") acc.totalIngresos += Number(m.monto);
      else if (m.tipo === "expense") acc.totalEgresos += Number(m.monto);
      return acc;
    },
    { counts: { todos: 0, liquidados: 0, pendientes: 0, confirmar: 0 }, noConciliados: 0, totalIngresos: 0, totalEgresos: 0 }
  );

  useEffect(() => {
    onPendingCount?.(counts.pendientes);
  }, [counts.pendientes, onPendingCount]);

  const movimientosFiltrados = movimientos.filter((m) => {
    const pasaFiltroTipo =
      movFilter === "liquidados" ? m.origen === "settlement" :
      movFilter === "pendientes" ? m.origen !== "settlement" :
      movFilter === "confirmar"  ? m.categoria === "pendiente_confirmacion" :
      true;
    const pasaFiltroConciliacion = filtroPendientesConciliacion ? !m.conciliado : true;
    return pasaFiltroTipo && pasaFiltroConciliacion;
  });

  const grupos = movimientosFiltrados.reduce<Record<string, Movimiento[]>>((acc, m) => {
    const key = m.periodo ?? "sin-periodo";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));

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

  const calcPorcentajeMonto = (): number | null => {
    if (!movForm.pctValor) return null;
    const pct = parseFloat(movForm.pctValor) / 100;
    let base = 0;
    if (movForm.pctBase === "total_transferir") {
      base = (data?.kpis.proximaLiquidacionEstimada ?? 0) * 0.93;
    } else if (movForm.pctBase === "subtotal_alquileres") {
      base = data?.kpis.proximaLiquidacionEstimada ?? 0;
    } else if (movForm.pctBase === "subtotal_ingresos") {
      base = totalIngresos;
    } else if (movForm.pctBase === "monto_manual") {
      base = parseFloat(movForm.pctMontoManual) || 0;
    }
    return Math.round(base * pct);
  };

  const handleSaveMovimiento = async () => {
    if (!movForm.descripcion.trim()) { toast.error("Completá la descripción"); return; }
    if (!movForm.fecha)              { toast.error("Completá la fecha"); return; }

    let montoFinal: number;
    let tipoFinal: "income" | "expense";

    if (movForm.tipo === "porcentaje") {
      const calculado = calcPorcentajeMonto();
      if (!calculado || calculado <= 0) { toast.error("Revisá el porcentaje y la base de cálculo"); return; }
      montoFinal = calculado;
      tipoFinal = movForm.pctDireccion;
    } else {
      if (!movForm.monto) { toast.error("Completá el monto"); return; }
      montoFinal = parseFloat(movForm.monto);
      tipoFinal = movForm.tipo as "income" | "expense";
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/owners/${ownerId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: movForm.descripcion.trim(),
          tipo: tipoFinal,
          monto: montoFinal,
          fecha: movForm.fecha,
          categoria: movForm.categoria || null,
          nota: movForm.nota || null,
          origen: "manual" as const,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al guardar"); }
      await queryClient.invalidateQueries({ queryKey: ["owner-cc-full", ownerId] });
      await queryClient.invalidateQueries({ queryKey: ["owner-cc", ownerId] });
      toast.success("Movimiento registrado");
      setFabAction(null);
      setMovForm({
        descripcion: "", tipo: "income", monto: "", pctDireccion: "expense",
        pctValor: "", pctBase: "total_transferir", pctMontoManual: "",
        fecha: localDateString(), categoria: "", nota: "",
      });
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
      const res = await fetch(`/api/owners/${ownerId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: liqForm.descripcion.trim(),
          tipo: "expense",
          monto: parseFloat(liqForm.monto),
          fecha: liqForm.fecha,
          nota: liqForm.nota || null,
          origen: "settlement",
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al guardar"); }
      await queryClient.invalidateQueries({ queryKey: ["owner-cc-full", ownerId] });
      await queryClient.invalidateQueries({ queryKey: ["owner-cc", ownerId] });
      toast.success("Liquidación ejecutada");
      setFabAction(null);
      setLiqForm({ descripcion: "Liquidación mensual", monto: "", fecha: localDateString(), nota: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const invalidarMovimientos = () => {
    queryClient.invalidateQueries({ queryKey: ["owner-cc-full", ownerId] });
    queryClient.invalidateQueries({ queryKey: ["owner-cc", ownerId] });
  };

  return (
    <TooltipProvider delayDuration={300}>
    <div className="p-7 flex flex-col gap-5">

      {/* ── KPI Cards ── */}
      {data && (
        <div className="grid grid-cols-3 gap-[14px]">
          <div className="bg-surface border border-border rounded-[10px] p-[14px_16px] overflow-hidden relative">
            <div className="flex items-center justify-between mb-2">
              <div className="kpi-label">Liquidado acumulado · {new Date().getFullYear()}</div>
              <span className="font-mono text-[11px] text-text-muted">YTD</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px] font-semibold text-text-secondary tabular-nums">$</span>
              <span className="text-[28px] font-semibold text-on-surface tabular-nums leading-none">
                {new Intl.NumberFormat("es-AR").format(Math.round(data.kpis.liquidadoAcumulado))}
              </span>
            </div>
            <div className="kpi-sub mt-1.5">
              {data.kpis.liquidadoAcumulado === 0
                ? "Todavía no se liquidó al propietario"
                : "Total enviado al propietario"}
            </div>
            <svg className="mt-2.5 block w-full" height="22" viewBox="0 0 220 22" preserveAspectRatio="none">
              <polyline points="0,18 220,18" fill="none" style={{ stroke: "var(--spark-neutral)" }} strokeWidth="1.5"/>
            </svg>
          </div>

          <div className="bg-surface border border-border rounded-[10px] p-[14px_16px] overflow-hidden relative" style={{ borderLeft: "3px solid var(--primary)" }}>
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
            <div className="kpi-sub mt-1.5">
              {counts.pendientes > 0
                ? `Incluye ${counts.pendientes} partida${counts.pendientes !== 1 ? "s" : ""} no liquidada${counts.pendientes !== 1 ? "s" : ""}`
                : "Sin movimientos pendientes"}
            </div>
            <svg className="mt-2.5 block w-full" height="22" viewBox="0 0 220 22" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGradA" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.4 }} />
                  <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <polyline
                points="0,18 20,16 40,14 60,15 80,12 100,10 120,11 140,9 160,7 180,8 200,6 220,4"
                style={{ fill: "none", stroke: "var(--primary)" }} strokeWidth="1.6"
              />
              <polygon
                points="0,22 0,18 20,16 40,14 60,15 80,12 100,10 120,11 140,9 160,7 180,8 200,6 220,4 220,22"
                fill="url(#sparkGradA)"
              />
            </svg>
          </div>

          <div className="bg-surface border border-border rounded-[10px] p-[14px_16px] overflow-hidden relative">
            <div className="flex items-center justify-between mb-2">
              <div className="kpi-label">Pendiente de confirmar</div>
              {counts.confirmar > 0 && (
                <span className="font-mono text-[11px] text-warning">
                  {counts.confirmar} item{counts.confirmar !== 1 ? "s" : ""}
                </span>
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
            <div className="kpi-sub mt-1.5">
              {noConciliados > 0
                ? `${noConciliados} movimiento${noConciliados !== 1 ? "s" : ""} sin conciliar`
                : "Todo conciliado"}
            </div>
            <svg className="mt-2.5 block w-full" height="22" viewBox="0 0 220 22" preserveAspectRatio="none">
              <polyline
                points="0,18 20,18 40,17 60,18 80,18 100,16 120,18 140,17 160,18 180,17 200,18 220,18"
                style={{ fill: "none", stroke: "var(--spark-neutral)" }} strokeWidth="1.5" strokeDasharray="2,3"
              />
            </svg>
          </div>
        </div>
      )}

      {/* ── Panel de movimientos ── */}
      <div className="bg-surface border border-border rounded-[10px] overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-border flex-wrap">
          <span className="text-[0.82rem] font-semibold text-on-surface">Movimientos</span>

          {/* Navegador de período */}
          <div
            className="flex items-center border border-border rounded-[7px] overflow-hidden"
            style={{ background: "var(--surface-mid)" }}
          >
            <button
              onClick={handlePeriodoPrev}
              className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-on-surface transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => setPeriodoFiltro("")}
              className="text-[12.5px] text-text-secondary hover:text-on-surface transition-colors px-2.5 border-x border-border min-w-[110px] text-center h-7 tabular-nums"
            >
              {periodoLabel}
            </button>
            <button
              onClick={handlePeriodoNext}
              disabled={!periodoFiltro}
              className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-on-surface transition-colors disabled:opacity-30"
            >
              <ChevronRight size={12} />
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
                  "flex items-center gap-1.5 px-2.5 py-1 text-[0.7rem] font-semibold rounded-[5px] transition-all",
                  movFilter === key
                    ? "bg-surface-high text-on-surface shadow-[0_1px_0_rgba(0,0,0,0.2)]"
                    : "text-text-secondary hover:text-on-surface"
                )}
              >
                {label}
                <span className="font-mono text-[10px] px-[5px] py-px rounded-[3px] leading-none border border-border bg-surface text-text-muted">
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Acciones de toolbar */}
          <div className="ml-auto flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.72rem] font-medium text-text-secondary border border-border rounded-[6px] hover:text-on-surface transition-all bg-surface">
              <Filter size={11} /> Filtros
            </button>

            {/* Toggle: mostrar solo movimientos sin conciliar */}
            <button
              onClick={() => setFiltroPendientesConciliacion((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-[0.72rem] font-medium border rounded-[6px] transition-all",
                filtroPendientesConciliacion
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-text-muted bg-surface hover:text-on-surface"
              )}
            >
              <span
                className={cn(
                  "inline-block w-[26px] h-[14px] rounded-full relative transition-all flex-shrink-0",
                  filtroPendientesConciliacion ? "bg-primary/30" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-[2px] w-[10px] h-[10px] rounded-full transition-all",
                    filtroPendientesConciliacion ? "left-[14px] bg-primary" : "left-[2px] bg-text-muted"
                  )}
                />
              </span>
              Sin conciliar
              {noConciliados > 0 && (
                <span className="font-mono text-[10px] px-[5px] py-px rounded-[3px] leading-none border border-current">
                  {noConciliados}
                </span>
              )}
            </button>

            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.72rem] font-medium text-text-secondary border border-border rounded-[6px] hover:text-on-surface transition-all bg-surface">
              <Download size={11} /> CSV
            </button>
          </div>
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
                    <th className="w-8 px-2 py-2.5 text-center">
                      <CheckCircle2 size={12} className="text-text-muted mx-auto" />
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[33%]">Concepto</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[18%]">Propiedad</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[11%]">Fecha</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[12%]">Origen</th>
                    <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-text-muted w-[14%]">Monto</th>
                    <th className="w-16 px-2 py-2.5 text-center">
                      <Paperclip size={12} className="text-text-muted mx-auto" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gruposOrdenados.map(([periodo, items]) => (
                    <React.Fragment key={periodo}>
                      <tr>
                        <td colSpan={6} className="px-3.5 py-2 bg-surface-mid border-b border-border/50">
                          <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-[0.07em]">
                            {periodo !== "sin-periodo"
                              ? formatMonthYear(periodo).toUpperCase()
                              : "SIN PERÍODO"}
                          </span>
                        </td>
                        <td className="px-2 py-2 bg-surface-mid border-b border-border/50" />
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
                          <FilaMovimiento
                            movimiento={m}
                            onActualizado={invalidarMovimientos}
                          />
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="bg-surface border-t border-border px-5 py-3 flex items-center justify-between">
              <span className="text-[12px] text-text-muted">
                {movimientosFiltrados.length} movimiento{movimientosFiltrados.length !== 1 ? "s" : ""}
                {counts.confirmar > 0 && (
                  <> · <span className="text-on-surface">{counts.confirmar} a confirmar</span></>
                )}
                {noConciliados > 0 && (
                  <> · <span style={{ color: "var(--warning)" }}>{noConciliados} sin conciliar</span></>
                )}
              </span>
              <div className="flex gap-5">
                {[
                  { label: "Ingresos", value: totalIngresos, color: "var(--success)", prefix: "+" },
                  { label: "Egresos",  value: totalEgresos,  color: "var(--error)",   prefix: "−" },
                  {
                    label: "Neto",
                    value: totalIngresos - totalEgresos,
                    color: totalIngresos - totalEgresos >= 0 ? "var(--success)" : "var(--error)",
                    prefix: totalIngresos - totalEgresos >= 0 ? "+" : "−",
                  },
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
          <Link href={`/owners/${ownerId}/liquidacion${periodoFiltro ? `?periodo=${periodoFiltro}` : ""}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText size={13} /> Vista previa
            </Button>
          </Link>
          <Button size="sm" onClick={() => setFabAction("liquidacion")} className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90">
            <Banknote size={13} /> Generar liquidación
          </Button>
        </div>
      </div>

      {/* ── Modal: Agregar movimiento ── */}
      <Dialog open={fabAction === "movimiento"} onOpenChange={(o) => !o && setFabAction(null)}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Agregar movimiento</DialogTitle>
            <DialogDescription>Crédito o débito manual en la cuenta corriente</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Segmented TIPO */}
            <div>
              <label className={labelCls}>Tipo</label>
              <div className="flex w-full rounded-[7px] p-[2px] border border-border" style={{ background: "var(--surface-mid)" }}>
                {([
                  { key: "income",     label: "↑ Ingreso" },
                  { key: "expense",    label: "↓ Egreso" },
                  { key: "porcentaje", label: "% Porcentaje" },
                ] as { key: MovTipo; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMovForm((f) => ({ ...f, tipo: key }))}
                    className={cn(
                      "flex-1 py-2 text-[0.75rem] font-semibold rounded-[5px] transition-all border",
                      movForm.tipo === key
                        ? "bg-primary-dim border-primary text-on-surface"
                        : "border-transparent text-text-secondary hover:text-on-surface"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-panel porcentaje */}
            {movForm.tipo === "porcentaje" && (
              <div className="bg-surface-mid border border-border rounded-[8px] p-4 flex flex-col gap-3">
                <div>
                  <label className={labelCls}>Dirección</label>
                  <div className="flex rounded-[6px] p-[2px] border border-border" style={{ background: "var(--surface-high)" }}>
                    {(["income", "expense"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setMovForm((f) => ({ ...f, pctDireccion: d }))}
                        className={cn(
                          "flex-1 py-1.5 text-[0.72rem] font-semibold rounded-[4px] transition-all border",
                          movForm.pctDireccion === d
                            ? "bg-primary-dim border-primary text-on-surface"
                            : "border-transparent text-text-secondary hover:text-on-surface"
                        )}
                      >
                        {d === "income" ? "↑ Ingreso" : "↓ Egreso"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Porcentaje <span className="text-error">*</span></label>
                    <div className="relative">
                      <input
                        type="number"
                        value={movForm.pctValor}
                        onChange={(e) => setMovForm((f) => ({ ...f, pctValor: e.target.value }))}
                        placeholder="7"
                        min="0" max="100" step="0.1"
                        className={cn(inputCls, "pr-7")}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-[0.82rem]">%</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Base de cálculo</label>
                    <select
                      value={movForm.pctBase}
                      onChange={(e) => setMovForm((f) => ({ ...f, pctBase: e.target.value as PorcentajeBase }))}
                      className={inputCls}
                    >
                      <option value="total_transferir">Total a transferir</option>
                      <option value="subtotal_alquileres">Subtotal de alquileres</option>
                      <option value="subtotal_ingresos">Subtotal de ingresos</option>
                      <option value="monto_manual">Monto manual</option>
                    </select>
                  </div>
                </div>

                {movForm.pctBase === "monto_manual" && (
                  <div>
                    <label className={labelCls}>Monto base <span className="text-error">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[0.82rem]">$</span>
                      <input
                        type="number"
                        value={movForm.pctMontoManual}
                        onChange={(e) => setMovForm((f) => ({ ...f, pctMontoManual: e.target.value }))}
                        placeholder="150000"
                        min="0"
                        className={cn(inputCls, "pl-7")}
                      />
                    </div>
                  </div>
                )}

                {movForm.pctValor && calcPorcentajeMonto() !== null && (
                  <div className="flex items-center justify-between text-[12px] border-t border-border pt-2 mt-1">
                    <span className="text-text-muted">Monto calculado:</span>
                    <span
                      className="font-mono font-semibold tabular-nums"
                      style={{ color: movForm.pctDireccion === "income" ? "var(--success)" : "var(--error)" }}
                    >
                      {movForm.pctDireccion === "income" ? "+" : "−"}
                      {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(calcPorcentajeMonto()!)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha <span className="text-error">*</span></label>
                <input
                  type="date"
                  value={movForm.fecha}
                  onChange={(e) => setMovForm((f) => ({ ...f, fecha: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Propiedad (opcional)</label>
                <input type="text" placeholder="Sin especificar" className={inputCls} disabled />
              </div>
            </div>

            <div>
              <label className={labelCls}>Concepto <span className="text-error">*</span></label>
              <input
                type="text"
                value={movForm.descripcion}
                onChange={(e) => setMovForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Gasto de mantenimiento"
                className={inputCls}
              />
            </div>

            {movForm.tipo !== "porcentaje" && (
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
            )}

            <div>
              <label className={labelCls}>Nota interna (opcional)</label>
              <input
                type="text"
                value={movForm.nota}
                onChange={(e) => setMovForm((f) => ({ ...f, nota: e.target.value }))}
                placeholder="Solo visible para el staff"
                className={inputCls}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setFabAction(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveMovimiento} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
              {saving && <Loader2 size={12} className="animate-spin" />} Guardar movimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Generar liquidación ── */}
      <Dialog open={fabAction === "liquidacion"} onOpenChange={(o) => !o && setFabAction(null)}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generar liquidación</DialogTitle>
            <DialogDescription>Registrá el pago enviado al propietario</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Período</label>
                <input type="month" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha emisión <span className="text-error">*</span></label>
                <input
                  type="date"
                  value={liqForm.fecha}
                  onChange={(e) => setLiqForm((f) => ({ ...f, fecha: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

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
                  <span
                    className="font-mono font-bold text-[18px] tabular-nums"
                    style={{ color: data.kpis.proximaLiquidacionEstimada * 0.93 >= 0 ? "var(--green)" : "var(--error)" }}
                  >
                    {formatMoney(data.kpis.proximaLiquidacionEstimada * 0.93)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>Descripción <span className="text-error">*</span></label>
              <input
                type="text"
                value={liqForm.descripcion}
                onChange={(e) => setLiqForm((f) => ({ ...f, descripcion: e.target.value }))}
                className={inputCls}
              />
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
              <input
                type="text"
                value={liqForm.nota}
                onChange={(e) => setLiqForm((f) => ({ ...f, nota: e.target.value }))}
                placeholder="Ej: Transferencia Mercado Pago"
                className={inputCls}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setFabAction(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="secondary" size="sm" disabled={saving}>
              Vista previa
            </Button>
            <Button size="sm" onClick={handleSaveLiquidacion} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
              {saving && <Loader2 size={12} className="animate-spin" />} Generar y enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
