"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
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

const inputCls =
  "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[0.82rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-muted-foreground";
const labelCls =
  "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5 block";

interface Movimiento {
  id: string;
  date: string;
  description: string;
  tipo: string;
  amount: string;
  categoria: string | null;
  comprobante: string | null;
  note: string | null;
  contratoId: string | null;
  reciboNumero?: string | null;
  period?: string | null;
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
  tenantId: string;
  tenantName: string;
  estado: string;
  diasMora: number;
  contrato: ContratoData | null;
  movimientos: Movimiento[];
  propertyId?: string | null;
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
  if (tipo === "income") {
    if (categoria === "alquiler") return "Cobro de alquiler";
    if (categoria === "expensas") return "Cobro de expensas";
    if (categoria === "depósito") return "Cobro de depósito de garantía";
  }
  if (tipo === "expense") {
    if (categoria === "reparación") return "Gasto de reparación";
    if (categoria === "mantenimiento") return "Gasto de mantenimiento";
    if (categoria === "servicios") return "Pago de servicios";
    if (categoria === "comisión") return "Comisión de gestión";
    if (categoria === "punitorios") return "Punitorios por mora";
  }
  return "";
}

type FiltroEstado = "todos" | "income" | "expense";

export function TenantTabCurrentAccount({
  tenantId,
  estado,
  diasMora,
  contrato,
  movimientos,
  propertyId,
}: Props) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"income" | "expense">("income");
  const [categoria, setCategoria] = useState("alquiler");
  const [descripcion, setDescripcion] = useState("Cobro de alquiler");
  const [monto, setMonto] = useState(contrato?.monthlyAmount ?? "");
  const [fecha, setFecha] = useState(hoy());
  const [periodo, setPeriodo] = useState(periodoActual());
  const [nota, setNota] = useState("");

  const ingresos = movimientos.filter((m) => m.tipo === "income");
  const totalCobrado = ingresos.reduce((acc, m) => acc + Number(m.amount), 0);
  const filtrados = filtro === "todos" ? movimientos : movimientos.filter((m) => m.tipo === (filtro as "income" | "expense"));
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

  function handleTipoChange(val: "income" | "expense") {
    setTipo(val);
    const cat = val === "income" ? "alquiler" : "reparación";
    setCategoria(cat);
    setDescripcion(descripcionPorDefecto(cat, val));
    setMonto(val === "income" ? (contrato?.monthlyAmount ?? "") : "");
  }

  function handleCategoriaChange(val: string) {
    setCategoria(val);
    setDescripcion(descripcionPorDefecto(val, tipo));
  }

  function abrirModal() {
    setTipo("income");
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
      const res = await fetch(`/api/tenants/${tenantId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          descripcion: descripcion.trim(),
          monto: Number(monto),
          fecha,
          categoria,
          nota: nota.trim() || null,
          periodo: tipo === "income" && categoria === "alquiler" ? periodo : null,
          contratoId: contrato?.id ?? null,
          propertyId: propertyId ?? null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
      setModalOpen(false);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const categoriasActuales = tipo === "income" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  return (
    <div className="p-7 flex flex-col gap-5">
      {enMora && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Tenant en mora — {diasMora} días</AlertTitle>
          <AlertDescription>
            El vencimiento del período actual ya pasó sin registro de pago.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={cn("rounded-[10px] border py-0 gap-0", enMora ? "border-error/30 bg-error/5" : "border-border")}>
          <CardContent className="p-5">
            <div className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.08em] mb-2", enMora ? "text-error/70" : "text-muted-foreground")}>
              {enMora ? "Deuda en mora" : "Estado de cuenta"}
            </div>
            <div className={cn("font-headline text-[1.6rem] leading-none mb-1", enMora ? "text-error" : "text-success")}>
              {enMora && contrato ? formatMonto(contrato.monthlyAmount) : "Al día"}
            </div>
            {enMora && (
              <div className="text-[0.7rem] text-muted-foreground">{diasMora} días sin pago registrado</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border py-0 gap-0">
          <CardContent className="p-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Próximo vencimiento
            </div>
            <div className="font-headline text-[1.6rem] leading-none mb-1 text-on-bg">
              {contrato ? formatMonto(contrato.monthlyAmount) : "—"}
            </div>
            <div className="text-[0.7rem] text-muted-foreground">
              {proximoVto ? `Vence el ${proximoVto}` : "Sin contrato activo"}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border border-success/25 bg-success/5 py-0 gap-0">
          <CardContent className="p-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Total cobrado (registrado)
            </div>
            <div className="font-headline text-[1.6rem] leading-none mb-1 text-success">
              {formatMonto(totalCobrado)}
            </div>
            <div className="text-[0.7rem] text-muted-foreground">
              {ingresos.length} ingreso{ingresos.length !== 1 ? "s" : ""} registrado{ingresos.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {contrato && contrato.adjustmentIndex !== "none" && (
        <div className="bg-surface border border-blue/20 border-l-[3px] border-l-blue rounded-[10px] px-5 py-4">
          <div className="text-[0.82rem] font-semibold text-blue flex items-center gap-2 mb-3">
            Actualización por índice
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.07em] mb-1">Índice</div>
              <div className="text-[0.85rem] font-semibold text-blue">{contrato.adjustmentIndex} (BCRA)</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.07em] mb-1">Frecuencia</div>
              <div className="text-[0.85rem] font-semibold text-on-bg">Cada {contrato.adjustmentFrequency} meses</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.07em] mb-1">Alquiler actual</div>
              <div className="text-[0.85rem] font-semibold text-on-bg">{formatMonto(contrato.monthlyAmount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <Card className="rounded-[10px] border py-0 gap-0 overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0 flex flex-row items-center justify-between">
          <CardTitle className="text-[0.82rem] font-semibold">
            Historial de movimientos
          </CardTitle>
          <CardAction className="flex items-center gap-2">
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
              <SelectTrigger className="h-auto py-1.5 px-2.5 text-[0.75rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="income">Ingresos</SelectItem>
                  <SelectItem value="expense">Egresos</SelectItem>
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
            <div className="px-5 py-10 text-center text-[0.8rem] text-muted-foreground">
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
                      {formatFecha(mov.date)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.82rem] text-on-bg font-medium">
                      {mov.description}
                      {mov.period && (
                        <div className="text-[0.68rem] text-muted-foreground font-normal">{mov.period}</div>
                      )}
                      {mov.note && (
                        <div className="text-[0.7rem] text-muted-foreground font-normal mt-0.5">{mov.note}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.75rem] text-muted-foreground capitalize">
                      {mov.categoria ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <span className={cn("text-[0.82rem] font-semibold", mov.tipo === "income" ? "text-success" : "text-error")}>
                        {mov.tipo === "income" ? "+" : "-"}{formatMonto(mov.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <StatusBadge variant={mov.tipo === "income" ? "income" : "baja"}>
                        {mov.tipo === "income" ? "Ingreso" : "Egreso"}
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
                        <span className="text-[0.72rem] text-muted-foreground">—</span>
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
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>Ingreso o egreso manual en la cuenta del inquilino</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Segmented tipo */}
            <div>
              <label className={labelCls}>Tipo</label>
              <div className="flex w-full rounded-[7px] p-[2px] border border-border" style={{ background: "var(--surface-mid)" }}>
                {(["income", "expense"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTipoChange(t)}
                    className={cn(
                      "flex-1 py-2 text-[0.75rem] font-semibold rounded-[5px] transition-all border",
                      tipo === t
                        ? "bg-primary-dim border-primary text-on-surface"
                        : "border-transparent text-text-secondary hover:text-on-surface"
                    )}
                  >
                    {t === "income" ? "↑ Ingreso" : "↓ Egreso"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha <span className="text-error">*</span></label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Categoría</label>
                <Select value={categoria} onValueChange={handleCategoriaChange}>
                  <SelectTrigger className="w-full h-auto py-2 text-[0.82rem]">
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
            </div>

            {tipo === "income" && categoria === "alquiler" && (
              <div>
                <label className={labelCls}>Período</label>
                <input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Concepto <span className="text-error">*</span></label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={inputCls}
                placeholder="Ej: Cobro de alquiler"
              />
            </div>

            <div>
              <label className={labelCls}>Monto <span className="text-error">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.82rem] text-muted-foreground">$</span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="0"
                  step="0.01"
                  className={cn(inputCls, "pl-7")}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Nota interna (opcional)</label>
              <input
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className={inputCls}
                placeholder="Solo visible para el staff"
              />
            </div>

            {errorMsg && (
              <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
                {errorMsg}
              </div>
            )}

            {tipo === "income" && categoria === "alquiler" && (
              <div className="text-[0.72rem] text-muted-foreground bg-surface-mid rounded-[8px] px-3 py-2">
                Se generará automáticamente un número de recibo para este cobro.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardar} disabled={guardando} className="bg-primary text-primary-foreground hover:opacity-90">
              {guardando ? "Guardando..." : "Guardar movimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
