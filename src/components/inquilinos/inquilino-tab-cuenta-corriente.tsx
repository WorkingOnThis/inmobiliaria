"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  monto: string;
  categoria: string | null;
  comprobante: string | null;
  nota: string | null;
  contratoId: string | null;
  reciboNumero?: string | null;
  periodo?: string | null;
}

interface ContratoData {
  id: string;
  monthlyAmount: string;
  paymentDay: number;
  endDate: string;
  adjustmentIndex: string;
  adjustmentFrequency: number;
  paymentModality: string;
  contractNumber: string;
}

interface Props {
  inquilinoId: string;
  inquilinoNombre: string;
  estado: string;
  diasMora: number;
  contrato: ContratoData | null;
  movimientos: Movimiento[];
  propiedadId?: string | null;
}

function formatMonto(val: string | number) {
  return "$" + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function formatFecha(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CATEGORIAS_INGRESO = ["alquiler", "expensas", "depósito", "otros"];
const CATEGORIAS_EGRESO = ["reparación", "mantenimiento", "servicios", "comisión", "punitorios", "otros"];

function descripcionPorDefecto(categoria: string, tipo: string): string {
  if (tipo === "ingreso") {
    if (categoria === "alquiler") return "Cobro de alquiler";
    if (categoria === "expensas") return "Cobro de expensas";
    if (categoria === "depósito") return "Cobro de depósito de garantía";
  }
  if (tipo === "egreso") {
    if (categoria === "reparación") return "Gasto de reparación";
    if (categoria === "mantenimiento") return "Gasto de mantenimiento";
    if (categoria === "servicios") return "Pago de servicios";
    if (categoria === "comisión") return "Comisión de gestión";
    if (categoria === "punitorios") return "Punitorios por mora";
  }
  return "";
}

type FiltroEstado = "todos" | "ingreso" | "egreso";

export function InquilinoTabCuentaCorriente({
  inquilinoId,
  estado,
  diasMora,
  contrato,
  movimientos,
  propiedadId,
}: Props) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [categoria, setCategoria] = useState("alquiler");
  const [descripcion, setDescripcion] = useState("Cobro de alquiler");
  const [monto, setMonto] = useState(contrato?.monthlyAmount ?? "");
  const [fecha, setFecha] = useState(hoy());
  const [periodo, setPeriodo] = useState(periodoActual());
  const [nota, setNota] = useState("");

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const totalCobrado = ingresos.reduce((acc, m) => acc + Number(m.monto), 0);
  const filtrados = filtro === "todos" ? movimientos : movimientos.filter((m) => m.tipo === filtro);
  const enMora = estado === "en_mora";

  let proximoVto: string | null = null;
  if (contrato) {
    const today = new Date();
    const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), contrato.paymentDay);
    const due = dueThisMonth >= today
      ? dueThisMonth
      : new Date(today.getFullYear(), today.getMonth() + 1, contrato.paymentDay);
    proximoVto = formatFecha(due.toISOString().slice(0, 10));
  }

  function handleTipoChange(val: "ingreso" | "egreso") {
    setTipo(val);
    const cat = val === "ingreso" ? "alquiler" : "reparación";
    setCategoria(cat);
    setDescripcion(descripcionPorDefecto(cat, val));
    setMonto(val === "ingreso" ? (contrato?.monthlyAmount ?? "") : "");
  }

  function handleCategoriaChange(val: string) {
    setCategoria(val);
    setDescripcion(descripcionPorDefecto(val, tipo));
  }

  function abrirModal() {
    setTipo("ingreso");
    setCategoria("alquiler");
    setDescripcion("Cobro de alquiler");
    setMonto(contrato?.monthlyAmount ?? "");
    setFecha(hoy());
    setPeriodo(periodoActual());
    setNota("");
    setErrorMsg(null);
    setModalOpen(true);
  }

  async function handleGuardar() {
    setErrorMsg(null);
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      setErrorMsg("El monto debe ser un número mayor a cero.");
      return;
    }
    if (!descripcion.trim()) {
      setErrorMsg("La descripción es obligatoria.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/inquilinos/${inquilinoId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          descripcion: descripcion.trim(),
          monto: Number(monto),
          fecha,
          categoria,
          nota: nota.trim() || null,
          periodo: tipo === "ingreso" && categoria === "alquiler" ? periodo : null,
          contratoId: contrato?.id ?? null,
          propiedadId: propiedadId ?? null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["inquilino", inquilinoId] });
      setModalOpen(false);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const categoriasActuales = tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  return (
    <div className="p-7 flex flex-col gap-5">
      {enMora && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Inquilino en mora — {diasMora} días</AlertTitle>
          <AlertDescription>
            El vencimiento del período actual ya pasó sin registro de pago.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={cn("rounded-[10px] border py-0 gap-0", enMora ? "border-error/30 bg-error/5" : "border-border")}>
          <CardContent className="p-5">
            <div className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.08em] mb-2", enMora ? "text-error/70" : "text-text-muted")}>
              {enMora ? "Deuda en mora" : "Estado de cuenta"}
            </div>
            <div className={cn("font-headline text-[1.6rem] leading-none mb-1", enMora ? "text-error" : "text-success")}>
              {enMora && contrato ? formatMonto(contrato.monthlyAmount) : "Al día"}
            </div>
            {enMora && (
              <div className="text-[0.7rem] text-text-muted">{diasMora} días sin pago registrado</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border py-0 gap-0">
          <CardContent className="p-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
              Próximo vencimiento
            </div>
            <div className="font-headline text-[1.6rem] leading-none mb-1 text-on-bg">
              {contrato ? formatMonto(contrato.monthlyAmount) : "—"}
            </div>
            <div className="text-[0.7rem] text-text-muted">
              {proximoVto ? `Vence el ${proximoVto}` : "Sin contrato activo"}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border border-success/25 bg-success/5 py-0 gap-0">
          <CardContent className="p-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
              Total cobrado (registrado)
            </div>
            <div className="font-headline text-[1.6rem] leading-none mb-1 text-success">
              {formatMonto(totalCobrado)}
            </div>
            <div className="text-[0.7rem] text-text-muted">
              {ingresos.length} ingreso{ingresos.length !== 1 ? "s" : ""} registrado{ingresos.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {contrato && contrato.adjustmentIndex !== "sin_ajuste" && (
        <div className="bg-surface border border-blue/20 border-l-[3px] border-l-blue rounded-[10px] px-5 py-4">
          <div className="text-[0.82rem] font-semibold text-blue flex items-center gap-2 mb-3">
            📈 Actualización por índice
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[0.65rem] text-text-muted uppercase tracking-[0.07em] mb-1">Índice</div>
              <div className="text-[0.85rem] font-semibold text-blue">{contrato.adjustmentIndex} (BCRA)</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-text-muted uppercase tracking-[0.07em] mb-1">Frecuencia</div>
              <div className="text-[0.85rem] font-semibold text-on-bg">Cada {contrato.adjustmentFrequency} meses</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-text-muted uppercase tracking-[0.07em] mb-1">Alquiler actual</div>
              <div className="text-[0.85rem] font-semibold text-on-bg">{formatMonto(contrato.monthlyAmount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <Card className="rounded-[10px] border py-0 gap-0 overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0 flex flex-row items-center justify-between">
          <CardTitle className="text-[0.82rem] font-semibold flex items-center gap-2">
            📅 Historial de movimientos
          </CardTitle>
          <CardAction className="flex items-center gap-2">
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
              <SelectTrigger className="h-auto py-1.5 px-2.5 text-[0.75rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ingreso">Ingresos</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <button
              onClick={abrirModal}
              className="flex items-center gap-1.5 bg-primary text-white text-[0.75rem] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-primary/90 transition-colors"
            >
              <Plus size={13} /> Registrar movimiento
            </button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="px-5 py-10 text-center text-[0.8rem] text-text-muted">
              No hay movimientos registrados aún.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-mid hover:bg-surface-mid">
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Fecha</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Descripción</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Categoría</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-right">Monto</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-center">Tipo</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-center">Recibo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((mov) => (
                  <TableRow key={mov.id} className="hover:bg-surface-mid/40">
                    <TableCell className="px-4 py-3 text-[0.8rem] text-text-secondary whitespace-nowrap">
                      {formatFecha(mov.fecha)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.82rem] text-on-bg font-medium">
                      {mov.descripcion}
                      {mov.periodo && (
                        <div className="text-[0.68rem] text-text-muted font-normal">{mov.periodo}</div>
                      )}
                      {mov.nota && (
                        <div className="text-[0.7rem] text-text-muted font-normal mt-0.5">{mov.nota}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.75rem] text-text-muted capitalize">
                      {mov.categoria ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <span className={cn("text-[0.82rem] font-semibold", mov.tipo === "ingreso" ? "text-success" : "text-error")}>
                        {mov.tipo === "ingreso" ? "+" : "-"}{formatMonto(mov.monto)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <StatusBadge variant={mov.tipo === "ingreso" ? "income" : "baja"}>
                        {mov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {mov.reciboNumero ? (
                        <a
                          href={`/recibos/${mov.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[0.72rem] text-primary hover:underline"
                          title={`Recibo ${mov.reciboNumero}`}
                        >
                          <Printer size={12} />
                          {mov.reciboNumero}
                        </a>
                      ) : (
                        <span className="text-[0.72rem] text-text-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {(["ingreso", "egreso"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTipoChange(t)}
                  className={cn(
                    "py-2.5 rounded-[8px] text-[0.8rem] font-semibold border transition-all",
                    tipo === t
                      ? t === "ingreso"
                        ? "bg-success/10 border-success text-success"
                        : "bg-error/10 border-error text-error"
                      : "bg-surface border-border text-text-muted hover:border-text-muted"
                  )}
                >
                  {t === "ingreso" ? "💰 Ingreso" : "💸 Egreso"}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                Categoría
              </label>
              <Select value={categoria} onValueChange={handleCategoriaChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriasActuales.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipo === "ingreso" && categoria === "alquiler" && (
              <div>
                <label className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                  Período
                </label>
                <input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full border border-border rounded-[8px] px-3 py-2 text-[0.82rem] text-on-bg bg-surface outline-none focus:border-primary"
                />
              </div>
            )}

            <div>
              <label className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                Descripción
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full border border-border rounded-[8px] px-3 py-2 text-[0.82rem] text-on-bg bg-surface outline-none focus:border-primary"
                placeholder="Descripción del movimiento"
              />
            </div>

            <div>
              <label className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                Monto
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.82rem] text-text-muted">$</span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full border border-border rounded-[8px] pl-7 pr-3 py-2 text-[0.82rem] text-on-bg bg-surface outline-none focus:border-primary"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-border rounded-[8px] px-3 py-2 text-[0.82rem] text-on-bg bg-surface outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">
                Nota interna (opcional)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                className="w-full border border-border rounded-[8px] px-3 py-2 text-[0.82rem] text-on-bg bg-surface outline-none focus:border-primary resize-none"
                placeholder="Ej: pagó con cheque, acuerda el día 5..."
              />
            </div>

            {errorMsg && (
              <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
                {errorMsg}
              </div>
            )}

            {tipo === "ingreso" && categoria === "alquiler" && (
              <div className="text-[0.72rem] text-text-muted bg-surface-mid rounded-[8px] px-3 py-2">
                Se generará automáticamente un número de recibo para este cobro.
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-[0.8rem] text-text-secondary hover:text-on-bg border border-border rounded-[8px] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 text-[0.8rem] font-semibold bg-primary text-white rounded-[8px] hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
