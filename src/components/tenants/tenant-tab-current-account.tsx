"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Printer, Pencil, Trash2, Receipt } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/ui/status-badge";

const inputCls =
  "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[0.82rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-muted-foreground";
const labelCls =
  "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5 block";

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  monto: string;
  categoria: string | null;
  nota: string | null;
  contratoId: string | null;
  propiedadId: string | null;
  propiedadAddress: string | null;
  reciboNumero?: string | null;
  period?: string | null;
  periodo?: string | null;
  origen: string;
  reconciled: boolean | null;
}

interface Kpis {
  totalCobradoYTD: number;
  punitorialAcumulado: number;
  proximoPago: { fecha: string; monto: string } | null;
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
  propertyId: string;
  propertyAddress: string | null;
  status: string;
  agencyCommission: string | null;
  managementCommissionPct: string | null;
}

interface PropiedadOption {
  id: string;
  address: string;
}

interface ServicioOption {
  id: string;
  etiqueta: string;
  tipo: string;
}

interface ServiceItem {
  servicioId: string | null;
  etiqueta: string;
  period: string;
  monto: string;
  incluir: boolean;
}

interface TenantCharge {
  id: string;
  contratoId: string;
  propiedadId: string;
  propiedadAddress: string | null;
  period: string | null;
  categoria: string;
  descripcion: string;
  monto: string;
  estado: string;
  reciboNumero: string | null;
}

interface Props {
  tenantId: string;
  tenantName: string;
  estado: string;
  diasMora: number;
  contrato: ContratoData | null;
  contratos: ContratoData[];
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

function periodoLabel(periodo: string) {
  const [year, month] = periodo.split("-");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${meses[parseInt(month) - 1]} ${year}`;
}

function periodoAnterior(periodo: string) {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodoSiguiente(periodo: string) {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  active: "activo",
  expiring_soon: "por vencer",
  pending_signature: "pendiente firma",
  draft: "borrador",
  expired: "vencido",
  terminated: "rescindido",
};

const CATEGORIAS_INGRESO = ["alquiler", "reserva", "depósito", "comisión", "expensas", "otros"];
const CATEGORIAS_EGRESO = ["reparación", "mantenimiento", "servicios", "comisión", "punitorios", "otros"];

function descripcionPorDefecto(categoria: string, tipo: string): string {
  if (tipo === "income") {
    if (categoria === "alquiler") return "Cobro de alquiler";
    if (categoria === "reserva") return "Cobro de reserva";
    if (categoria === "depósito") return "Cobro de depósito de garantía";
    if (categoria === "expensas") return "Cobro de expensas";
    if (categoria === "comisión") return "Comisión de gestión";
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
  contratos,
  propertyId,
}: Props) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [periodo, setPeriodo] = useState(periodoActual());
  const [verTodos, setVerTodos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<Movimiento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Movimiento | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New movement form state
  const [tipo, setTipo] = useState<"income" | "expense">("income");
  const [categoria, setCategoria] = useState("alquiler");
  const [descripcion, setDescripcion] = useState("Cobro de alquiler");
  const [monto, setMonto] = useState(contrato?.monthlyAmount ?? "");
  const [fecha, setFecha] = useState(hoy());
  const [periodoMov, setPeriodoMov] = useState(periodoActual());
  const [nota, setNota] = useState("");
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [propiedadesOptions, setPropiedadesOptions] = useState<PropiedadOption[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [generarRecibo, setGenerarRecibo] = useState(false);
  const [serviciosPropiedad, setServiciosPropiedad] = useState<ServicioOption[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);

  // Charges state
  const [chargesSeleccionados, setChargesSeleccionados] = useState<Set<string>>(new Set());
  const [emitirModalOpen, setEmitirModalOpen] = useState(false);
  const [emitirFecha, setEmitirFecha] = useState(hoy());
  const [emitirHonorariosPct, setEmitirHonorariosPct] = useState<string>("");
  const [emitirTrasladar, setEmitirTrasladar] = useState(true);
  const [emitirModalidad, setEmitirModalidad] = useState<string>("A");
  const [emitirContratoComision, setEmitirContratoComision] = useState<string>("0");
  const [emitirGuardando, setEmitirGuardando] = useState(false);
  const [emitirError, setEmitirError] = useState<string | null>(null);
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [editChargeTarget, setEditChargeTarget] = useState<TenantCharge | null>(null);
  const [deleteChargeTarget, setDeleteChargeTarget] = useState<TenantCharge | null>(null);
  const [chargeGuardando, setChargeGuardando] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);

  // New charge form state
  const [chargeContratoId, setChargeContratoId] = useState<string>("");
  const [chargeCategoria, setChargeCategoria] = useState("alquiler");
  const [chargeDescripcion, setChargeDescripcion] = useState("");
  const [chargePeriod, setChargePeriod] = useState(periodoActual());
  const [chargeMonto, setChargeMonto] = useState("");

  // Edit charge form state
  const [editChargeCategoria, setEditChargeCategoria] = useState("");
  const [editChargeDescripcion, setEditChargeDescripcion] = useState("");
  const [editChargePeriod, setEditChargePeriod] = useState("");
  const [editChargeMonto, setEditChargeMonto] = useState("");

  // Edit form state
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editMonto, setEditMonto] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editNota, setEditNota] = useState("");
  const [editCategoria, setEditCategoria] = useState("");

  const { data, isLoading } = useQuery<{ kpis: Kpis; movimientos: Movimiento[] }>({
    queryKey: ["tenant-cuenta-corriente", tenantId, verTodos ? "all" : periodo],
    queryFn: async () => {
      const url = verTodos
        ? `/api/tenants/${tenantId}/cuenta-corriente`
        : `/api/tenants/${tenantId}/cuenta-corriente?periodo=${periodo}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar la cuenta corriente");
      return res.json();
    },
  });

  const { data: chargesData, isLoading: chargesLoading } = useQuery<{ charges: TenantCharge[] }>({
    queryKey: ["tenant-charges", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/charges?estado=pendiente`);
      if (!res.ok) throw new Error("Error al cargar los cargos");
      return res.json();
    },
  });

  const charges = chargesData?.charges ?? [];
  const saldoDeudor = charges.reduce((s, c) => s + Number(c.monto), 0);

  const kpis = data?.kpis;
  const movimientos = data?.movimientos ?? [];
  const enMora = estado === "en_mora";

  const filtrados = filtro === "todos"
    ? movimientos
    : movimientos.filter((m) => m.tipo === filtro);

  // Group by period within the period
  const grupos = filtrados.reduce<Record<string, Movimiento[]>>((acc, m) => {
    const key = m.periodo ?? m.period ?? periodo;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const totalIngresos = movimientos.filter((m) => m.tipo === "income").reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresos = movimientos.filter((m) => m.tipo === "expense").reduce((s, m) => s + Number(m.monto), 0);

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
    setFecha(hoy());
    setPeriodoMov(periodoActual());
    setNota("");
    setErrorMsg(null);
    // Pre-select the best active contract if available
    const bestContrato = contratos.find((c) =>
      c.status === "active" || c.status === "expiring_soon"
    ) ?? contratos[0] ?? null;
    setSelectedContratoId(bestContrato?.id ?? null);
    setSelectedPropertyId(bestContrato?.propertyId ?? null);
    setMonto(bestContrato?.monthlyAmount ?? contrato?.monthlyAmount ?? "");
    setGenerarRecibo(false);
    setServiceItems([]);
    setServiciosPropiedad([]);
    setModalOpen(true);
  }

  async function cargarServicios(propiedadId: string) {
    try {
      const res = await fetch(`/api/properties/${propiedadId}/services`);
      if (res.ok) {
        const d = await res.json();
        const servicios = (d.servicios ?? []) as ServicioOption[];
        setServiciosPropiedad(servicios);
        setServiceItems(
          servicios.map((s) => ({
            servicioId: s.id,
            etiqueta: s.etiqueta,
            period: periodoActual(),
            monto: "",
            incluir: false,
          }))
        );
      }
    } catch {
      // silently ignore — no services is fine
    }
  }

  async function cargarPropiedades() {
    if (propiedadesOptions.length > 0) return;
    setLoadingProps(true);
    try {
      const res = await fetch("/api/properties?isManaged=true");
      if (res.ok) {
        const d = await res.json();
        const props = (d.properties ?? d) as { id: string; address: string }[];
        setPropiedadesOptions(props.map((p) => ({ id: p.id, address: p.address })));
      }
    } finally {
      setLoadingProps(false);
    }
  }

  function handleContratoChange(contratoId: string) {
    if (contratoId === "__none__") {
      setSelectedContratoId(null);
      setSelectedPropertyId(null);
      setMonto("");
      setServiceItems([]);
      setServiciosPropiedad([]);
      cargarPropiedades();
      return;
    }
    const c = contratos.find((ct) => ct.id === contratoId) ?? null;
    setSelectedContratoId(contratoId);
    setSelectedPropertyId(c?.propertyId ?? null);
    if (tipo === "income" && categoria === "alquiler" && c) {
      setMonto(c.monthlyAmount);
    }
    if (c?.propertyId && generarRecibo) {
      cargarServicios(c.propertyId);
    } else {
      setServiceItems([]);
      setServiciosPropiedad([]);
    }
  }

  function abrirEditModal(mov: Movimiento) {
    setEditDescripcion(mov.descripcion);
    setEditMonto(mov.monto);
    setEditFecha(mov.fecha);
    setEditNota(mov.nota ?? "");
    setEditCategoria(mov.categoria ?? "");
    setErrorMsg(null);
    setEditModal(mov);
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
          periodo: tipo === "income" && categoria === "alquiler" ? periodoMov : null,
          contratoId: selectedContratoId ?? null,
          propiedadId: selectedPropertyId ?? null,
          generarRecibo: tipo === "income" && generarRecibo,
          serviceItems: generarRecibo
            ? serviceItems
                .filter((s) => s.incluir)
                .map((s) => ({
                  servicioId: s.servicioId,
                  etiqueta: s.etiqueta,
                  period: s.period,
                  monto: s.monto ? Number(s.monto) : null,
                }))
            : [],
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["tenant-cuenta-corriente", tenantId] });
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
      setModalOpen(false);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditar() {
    if (!editModal) return;
    setErrorMsg(null);
    if (!editMonto || isNaN(Number(editMonto)) || Number(editMonto) <= 0) {
      setErrorMsg("El monto debe ser un número mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/movimientos/${editModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: editDescripcion.trim(),
          monto: Number(editMonto),
          fecha: editFecha,
          nota: editNota.trim() || null,
          categoria: editCategoria || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al actualizar");
      }
      await queryClient.invalidateQueries({ queryKey: ["tenant-cuenta-corriente", tenantId] });
      setEditModal(null);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/tenants/${tenantId}/movimientos/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al eliminar");
      }
      await queryClient.invalidateQueries({ queryKey: ["tenant-cuenta-corriente", tenantId] });
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    } finally {
      setDeleteTarget(null);
    }
  }

  const CATEGORIAS_CARGO = ["alquiler", "dias_ocupados", "expensas", "punitorios", "otros"] as const;

  function abrirChargeModal() {
    const bestContrato = contratos.find((c) => c.status === "active" || c.status === "expiring_soon") ?? contratos[0];
    setChargeContratoId(bestContrato?.id ?? "");
    setChargeCategoria("alquiler");
    setChargeDescripcion("Alquiler " + periodoLabel(periodoActual()));
    setChargePeriod(periodoActual());
    setChargeMonto(bestContrato?.monthlyAmount ?? "");
    setChargeError(null);
    setChargeModalOpen(true);
  }

  function abrirEditChargeModal(charge: TenantCharge) {
    setEditChargeCategoria(charge.categoria);
    setEditChargeDescripcion(charge.descripcion);
    setEditChargePeriod(charge.period ?? "");
    setEditChargeMonto(charge.monto);
    setChargeError(null);
    setEditChargeTarget(charge);
  }

  function toggleChargeSeleccion(id: string) {
    setChargesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSeleccionarTodos() {
    if (chargesSeleccionados.size === charges.length) {
      setChargesSeleccionados(new Set());
    } else {
      setChargesSeleccionados(new Set(charges.map((c) => c.id)));
    }
  }

  async function handleGuardarCargo() {
    setChargeError(null);
    if (!chargeContratoId) { setChargeError("Seleccioná un contrato."); return; }
    if (!chargeMonto || isNaN(Number(chargeMonto)) || Number(chargeMonto) <= 0) { setChargeError("El monto debe ser mayor a cero."); return; }
    if (!chargeDescripcion.trim()) { setChargeError("La descripción es obligatoria."); return; }
    setChargeGuardando(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratoId: chargeContratoId,
          categoria: chargeCategoria,
          descripcion: chargeDescripcion.trim(),
          period: chargePeriod || null,
          monto: Number(chargeMonto),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al guardar"); }
      await queryClient.invalidateQueries({ queryKey: ["tenant-charges", tenantId] });
      setChargeModalOpen(false);
    } catch (e) {
      setChargeError((e as Error).message);
    } finally {
      setChargeGuardando(false);
    }
  }

  async function handleEditarCargo() {
    if (!editChargeTarget) return;
    setChargeError(null);
    if (!editChargeMonto || isNaN(Number(editChargeMonto)) || Number(editChargeMonto) <= 0) { setChargeError("El monto debe ser mayor a cero."); return; }
    setChargeGuardando(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/charges/${editChargeTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: editChargeCategoria,
          descripcion: editChargeDescripcion.trim(),
          period: editChargePeriod || null,
          monto: Number(editChargeMonto),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al actualizar"); }
      await queryClient.invalidateQueries({ queryKey: ["tenant-charges", tenantId] });
      setEditChargeTarget(null);
    } catch (e) {
      setChargeError((e as Error).message);
    } finally {
      setChargeGuardando(false);
    }
  }

  async function handleEliminarCargo() {
    if (!deleteChargeTarget) return;
    try {
      const res = await fetch(`/api/tenants/${tenantId}/charges/${deleteChargeTarget.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al eliminar"); }
      await queryClient.invalidateQueries({ queryKey: ["tenant-charges", tenantId] });
      setChargesSeleccionados((prev) => { const next = new Set(prev); next.delete(deleteChargeTarget.id); return next; });
    } finally {
      setDeleteChargeTarget(null);
    }
  }

  const montoSeleccionado = charges
    .filter((c) => chargesSeleccionados.has(c.id))
    .reduce((s, c) => s + Number(c.monto), 0);

  const seleccionadosMismoContrato = (() => {
    const seleccionados = charges.filter((c) => chargesSeleccionados.has(c.id));
    if (seleccionados.length === 0) return true;
    const primerContrato = seleccionados[0].contratoId;
    return seleccionados.every((c) => c.contratoId === primerContrato);
  })();

  function abrirEmitirModal() {
    const contratoDelSeleccionado = charges.find((c) => chargesSeleccionados.has(c.id));
    const contratoData = contratos.find((ct) => ct.id === contratoDelSeleccionado?.contratoId);
    const modalidad = contratoData?.paymentModality ?? "A";
    const comision = contratoData?.managementCommissionPct != null ? String(contratoData.managementCommissionPct) : "10";
    setEmitirFecha(hoy());
    setEmitirContratoComision(comision);
    setEmitirHonorariosPct(comision);
    setEmitirTrasladar(modalidad !== "B");
    setEmitirModalidad(modalidad);
    setEmitirError(null);
    setEmitirModalOpen(true);
  }

  async function handleEmitir() {
    setEmitirError(null);
    const pct = Number(emitirHonorariosPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setEmitirError("El porcentaje de honorarios debe ser entre 0 y 100.");
      return;
    }
    setEmitirGuardando(true);
    try {
      const res = await fetch("/api/receipts/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargeIds: [...chargesSeleccionados],
          fecha: emitirFecha,
          honorariosPct: pct,
          trasladarAlPropietario: emitirTrasladar,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al emitir");
      }
      const { reciboNumero, movimientoAgenciaId } = await res.json();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant-charges", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-cuenta-corriente", tenantId] }),
      ]);
      setChargesSeleccionados(new Set());
      setEmitirModalOpen(false);
      // Show a simple notification with link to receipt
      window.open(`/recibos/${movimientoAgenciaId}`, "_blank");
      void reciboNumero;
    } catch (e) {
      setEmitirError((e as Error).message);
    } finally {
      setEmitirGuardando(false);
    }
  }

  const categoriasActuales = tipo === "income" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

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
              Próximo pago
            </div>
            <div className="font-headline text-[1.6rem] leading-none mb-1 text-on-bg">
              {kpis?.proximoPago ? formatMonto(kpis.proximoPago.monto) : "—"}
            </div>
            <div className="text-[0.7rem] text-muted-foreground">
              {kpis?.proximoPago
                ? `Vence el ${formatFecha(kpis.proximoPago.fecha)}`
                : "Sin contrato activo"}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[10px] border border-success/25 bg-success/5 py-0 gap-0">
          <CardContent className="p-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Cobrado {new Date().getFullYear()}
            </div>
            <div className="font-headline text-[1.6rem] leading-none mb-1 text-success">
              {kpis ? formatMonto(kpis.totalCobradoYTD) : "—"}
            </div>
            <div className="text-[0.7rem] text-muted-foreground">
              {movimientos.filter((m) => m.tipo === "income").length} ingreso{movimientos.filter((m) => m.tipo === "income").length !== 1 ? "s" : ""} registrado{movimientos.filter((m) => m.tipo === "income").length !== 1 ? "s" : ""}
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

      {/* Cargos pendientes */}
      <Card className="rounded-[10px] border py-0 gap-0 overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-[0.82rem] font-semibold">Cargos pendientes</CardTitle>
            {saldoDeudor > 0 && (
              <span className="text-[0.72rem] font-semibold text-error bg-error/8 px-2 py-0.5 rounded-full">
                Debe {formatMonto(saldoDeudor)}
              </span>
            )}
            {chargesSeleccionados.size > 0 && (
              <span className="text-[0.72rem] text-muted-foreground">
                Seleccionado: {formatMonto(montoSeleccionado)} / {chargesSeleccionados.size} cargo{chargesSeleccionados.size !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <CardAction className="flex items-center gap-2">
            {chargesSeleccionados.size > 0 && !seleccionadosMismoContrato && (
              <span className="text-[0.72rem] text-error">Los cargos deben ser del mismo contrato</span>
            )}
            <button
              onClick={abrirEmitirModal}
              disabled={chargesSeleccionados.size === 0 || !seleccionadosMismoContrato}
              title={chargesSeleccionados.size === 0 ? "Seleccioná al menos un cargo" : !seleccionadosMismoContrato ? "Los cargos deben ser del mismo contrato" : ""}
              className={cn(
                "flex items-center gap-1.5 text-[0.75rem] font-semibold px-3 py-1.5 rounded-[8px] transition-colors",
                chargesSeleccionados.size > 0 && seleccionadosMismoContrato
                  ? "bg-surface border border-border text-on-surface hover:bg-surface-mid"
                  : "opacity-40 cursor-not-allowed bg-surface border border-border text-muted-foreground"
              )}
            >
              <Receipt size={13} /> Generar recibo
            </button>
            <button
              onClick={abrirChargeModal}
              className="flex items-center gap-1.5 bg-primary text-white text-[0.75rem] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-primary/90 transition-colors"
            >
              <Plus size={13} /> Registrar cargo
            </button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          {chargesLoading ? (
            <div className="px-5 py-8 text-center text-[0.8rem] text-muted-foreground">Cargando...</div>
          ) : charges.length === 0 ? (
            <div className="px-5 py-8 text-center text-[0.8rem] text-muted-foreground">
              No hay cargos pendientes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-mid hover:bg-surface-mid">
                  <TableHead className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={chargesSeleccionados.size === charges.length && charges.length > 0}
                      onChange={toggleSeleccionarTodos}
                      className="size-4 rounded border-border accent-primary"
                    />
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Período</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Categoría</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Descripción</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Propiedad</TableHead>
                  <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-right">Monto</TableHead>
                  <TableHead className="px-4 py-2.5 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((charge) => (
                  <TableRow key={charge.id} className={cn("hover:bg-surface-mid/40", chargesSeleccionados.has(charge.id) && "bg-primary/4")}>
                    <TableCell className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={chargesSeleccionados.has(charge.id)}
                        onChange={() => toggleChargeSeleccion(charge.id)}
                        className="size-4 rounded border-border accent-primary"
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.8rem] text-text-secondary whitespace-nowrap">
                      {charge.period ? periodoLabel(charge.period) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.75rem] text-muted-foreground capitalize">
                      {charge.categoria.replace("_", " ")}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.82rem] text-on-bg font-medium">
                      {charge.descripcion}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[0.75rem] text-muted-foreground">
                      {charge.propiedadAddress ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <span className="text-[0.82rem] font-semibold text-error">
                        -{formatMonto(charge.monto)}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => abrirEditChargeModal(charge)}
                          className="size-6 flex items-center justify-center rounded-[4px] text-muted-foreground hover:text-on-surface hover:bg-surface-mid transition-colors"
                          title="Editar"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => setDeleteChargeTarget(charge)}
                          className="size-6 flex items-center justify-center rounded-[4px] text-muted-foreground hover:text-error hover:bg-error/5 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(() => {
            if (chargesSeleccionados.size === 0 || !seleccionadosMismoContrato) return null;
            const contratoId = charges.find((c) => chargesSeleccionados.has(c.id))?.contratoId;
            const ct = contratos.find((c) => c.id === contratoId);
            const pct = Number(ct?.managementCommissionPct ?? 10);
            const comision = Math.round(montoSeleccionado * pct / 100);
            const total = montoSeleccionado + comision;
            return (
              <div className="px-5 py-3 border-t border-border bg-surface-mid flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.78rem]">
                <span className="text-muted-foreground font-medium uppercase tracking-[0.07em] text-[0.62rem]">Desglose del pago</span>
                <span className="text-on-surface">
                  Propietario <span className="font-semibold text-income">{formatMonto(montoSeleccionado)}</span>
                </span>
                <span className="text-muted-foreground">+</span>
                <span className="text-on-surface">
                  Inmobiliaria ({pct}%) <span className="font-semibold text-income">{formatMonto(comision)}</span>
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="text-on-surface">
                  Total a transferir <span className="font-bold text-on-surface">{formatMonto(total)}</span>
                </span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Movement history */}
      <Card className="rounded-[10px] border py-0 gap-0 overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-[0.82rem] font-semibold">Historial de movimientos</CardTitle>
            {/* Period navigator */}
            {!verTodos && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPeriodo(periodoAnterior(periodo))}
                  className="size-6 flex items-center justify-center rounded-[5px] hover:bg-surface-mid text-muted-foreground transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="text-[0.75rem] font-semibold text-on-surface min-w-[70px] text-center">
                  {periodoLabel(periodo)}
                </span>
                <button
                  onClick={() => setPeriodo(periodoSiguiente(periodo))}
                  className="size-6 flex items-center justify-center rounded-[5px] hover:bg-surface-mid text-muted-foreground transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setVerTodos((v) => !v);
                if (verTodos) setPeriodo(periodoActual());
              }}
              className={cn(
                "text-[0.72rem] font-medium px-2 py-0.5 rounded-[4px] transition-colors",
                verTodos
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-on-surface"
              )}
            >
              {verTodos ? "Por mes" : "Ver todos"}
            </button>
          </div>
          <CardAction className="flex items-center gap-2">
            {/* Segmented filter */}
            <div className="flex rounded-[6px] p-[2px] border border-border" style={{ background: "var(--surface-mid)" }}>
              {([
                { value: "todos", label: "Todos" },
                { value: "income", label: "Ingresos" },
                { value: "expense", label: "Egresos" },
              ] as { value: FiltroEstado; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFiltro(value)}
                  className={cn(
                    "px-2.5 py-1 text-[0.72rem] font-medium rounded-[4px] transition-all",
                    filtro === value
                      ? "bg-surface text-on-surface shadow-sm"
                      : "text-muted-foreground hover:text-on-surface"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={abrirModal}
              className="flex items-center gap-1.5 bg-primary text-white text-[0.75rem] font-semibold px-3 py-1.5 rounded-[8px] hover:bg-primary/90 transition-colors"
            >
              <Plus size={13} /> Registrar movimiento
            </button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-5 py-10 text-center text-[0.8rem] text-muted-foreground">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="px-5 py-10 text-center text-[0.8rem] text-muted-foreground flex flex-col items-center gap-2">
              <span>{verTodos ? "No hay movimientos registrados aún." : `No hay movimientos en ${periodoLabel(periodo)}.`}</span>
              {!verTodos && (
                <button
                  onClick={() => setVerTodos(true)}
                  className="text-[0.75rem] text-primary hover:underline"
                >
                  Ver todos los movimientos
                </button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-mid hover:bg-surface-mid">
                    <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Fecha</TableHead>
                    <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Descripción</TableHead>
                    <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Categoría</TableHead>
                    <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]">Propiedad</TableHead>
                    <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-right">Monto</TableHead>
                    <TableHead className="px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-center">Recibo</TableHead>
                    <TableHead className="px-4 py-2.5 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(grupos).map(([grupoKey, items]) => (
                    <React.Fragment key={grupoKey}>
                      {Object.keys(grupos).length > 1 && (
                        <TableRow className="bg-surface-mid/60 hover:bg-surface-mid/60 border-b border-border/50">
                          <TableCell colSpan={7} className="px-4 py-1.5 text-[0.68rem] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                            {periodoLabel(grupoKey)}
                          </TableCell>
                        </TableRow>
                      )}
                      {items.map((mov) => (
                        <TableRow key={mov.id} className="hover:bg-surface-mid/40">
                          <TableCell className="px-4 py-3 text-[0.8rem] text-text-secondary whitespace-nowrap">
                            {formatFecha(mov.fecha)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-[0.82rem] text-on-bg font-medium">
                            {mov.descripcion}
                            {mov.period && (
                              <div className="text-[0.68rem] text-muted-foreground font-normal">{mov.period}</div>
                            )}
                            {mov.nota && (
                              <div className="text-[0.7rem] text-muted-foreground font-normal mt-0.5">{mov.nota}</div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-[0.75rem] text-muted-foreground capitalize">
                            {mov.categoria ?? "—"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-[0.75rem] text-muted-foreground">
                            {mov.propiedadAddress ?? "—"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <span className={cn("text-[0.82rem] font-semibold", mov.tipo === "income" ? "text-success" : "text-error")}>
                              {mov.tipo === "income" ? "+" : "-"}{formatMonto(mov.monto)}
                            </span>
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
                          <TableCell className="px-2 py-3">
                            {mov.origen === "manual" && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => abrirEditModal(mov)}
                                  className="size-6 flex items-center justify-center rounded-[4px] text-muted-foreground hover:text-on-surface hover:bg-surface-mid transition-colors"
                                  title="Editar"
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(mov)}
                                  className="size-6 flex items-center justify-center rounded-[4px] text-muted-foreground hover:text-error hover:bg-error/5 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>

              {/* Footer totals */}
              <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">Ingresos</span>
                  <span className="text-[0.82rem] font-semibold text-success">+{formatMonto(totalIngresos)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">Egresos</span>
                  <span className="text-[0.82rem] font-semibold text-error">-{formatMonto(totalEgresos)}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border pl-6">
                  <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">Neto</span>
                  <span className={cn("text-[0.82rem] font-semibold", totalIngresos - totalEgresos >= 0 ? "text-success" : "text-error")}>
                    {totalIngresos - totalEgresos >= 0 ? "+" : ""}{formatMonto(totalIngresos - totalEgresos)}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* New movement modal */}
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

            {/* Contract / property association */}
            {contratos.length > 0 ? (
              <div>
                <label className={labelCls}>Contrato</label>
                <Select
                  value={selectedContratoId ?? "__none__"}
                  onValueChange={handleContratoChange}
                >
                  <SelectTrigger className="w-full h-auto py-2 text-[0.82rem]">
                    <SelectValue placeholder="Sin contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin contrato (reserva previa)</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber} · {c.propertyAddress ?? c.propertyId} · {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedContratoId === null && (
                  <div className="mt-2">
                    <label className={labelCls}>Propiedad</label>
                    <Select
                      value={selectedPropertyId ?? ""}
                      onValueChange={(v) => setSelectedPropertyId(v || null)}
                      onOpenChange={(open) => { if (open) cargarPropiedades(); }}
                    >
                      <SelectTrigger className="w-full h-auto py-2 text-[0.82rem]">
                        <SelectValue placeholder={loadingProps ? "Cargando..." : "Seleccionar propiedad"} />
                      </SelectTrigger>
                      <SelectContent>
                        {propiedadesOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : null}

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
                  value={periodoMov}
                  onChange={(e) => setPeriodoMov(e.target.value)}
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

            {tipo === "income" && (
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={generarRecibo}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setGenerarRecibo(checked);
                      if (checked && selectedPropertyId) {
                        cargarServicios(selectedPropertyId);
                      } else {
                        setServiceItems([]);
                        setServiciosPropiedad([]);
                      }
                    }}
                    className="size-4 rounded border-border accent-primary"
                  />
                  <span className="text-[0.82rem] text-on-surface">Generar recibo para el inquilino</span>
                </label>

                {generarRecibo && serviceItems.length > 0 && (
                  <div className="border border-border rounded-[8px] overflow-hidden">
                    <div className="px-3 py-2 bg-surface-mid border-b border-border">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Servicios a incluir en el recibo
                      </span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {serviceItems.map((item, idx) => (
                        <div key={item.servicioId ?? idx} className="px-3 py-2.5 flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.incluir}
                            onChange={(e) => {
                              const updated = [...serviceItems];
                              updated[idx] = { ...updated[idx], incluir: e.target.checked };
                              setServiceItems(updated);
                            }}
                            className="size-4 rounded border-border accent-primary flex-shrink-0"
                          />
                          <span className="text-[0.8rem] text-on-surface flex-1 min-w-0 truncate">{item.etiqueta}</span>
                          <div className="relative flex-shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[0.78rem] text-muted-foreground">$</span>
                            <input
                              type="number"
                              value={item.monto}
                              onChange={(e) => {
                                const updated = [...serviceItems];
                                updated[idx] = { ...updated[idx], monto: e.target.value, incluir: true };
                                setServiceItems(updated);
                              }}
                              min="0"
                              step="0.01"
                              className="w-28 pl-5 pr-2 py-1 text-[0.78rem] bg-surface-mid border border-border rounded-[5px] text-right text-on-surface outline-none focus:border-primary"
                              placeholder="sin cobro"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 bg-surface-mid/50 border-t border-border">
                      <p className="text-[0.68rem] text-muted-foreground">
                        Si el propietario pagó el servicio, ingresá el monto a cobrarle al inquilino. Si lo pagó el inquilino, dejá vacío — quedará como constancia en el recibo.
                      </p>
                    </div>
                  </div>
                )}

                {generarRecibo && serviciosPropiedad.length === 0 && selectedPropertyId && (
                  <p className="text-[0.72rem] text-muted-foreground">
                    Esta propiedad no tiene servicios registrados aún.
                  </p>
                )}
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

      {/* Edit modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => { if (!open) setEditModal(null); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
            <DialogDescription>Solo se pueden editar movimientos cargados manualmente.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha</label>
                <input
                  type="date"
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Categoría</label>
                <input
                  type="text"
                  value={editCategoria}
                  onChange={(e) => setEditCategoria(e.target.value)}
                  className={inputCls}
                  placeholder="alquiler, depósito, etc."
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Concepto</label>
              <input
                type="text"
                value={editDescripcion}
                onChange={(e) => setEditDescripcion(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.82rem] text-muted-foreground">$</span>
                <input
                  type="number"
                  value={editMonto}
                  onChange={(e) => setEditMonto(e.target.value)}
                  min="0"
                  step="0.01"
                  className={cn(inputCls, "pl-7")}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Nota interna</label>
              <input
                type="text"
                value={editNota}
                onChange={(e) => setEditNota(e.target.value)}
                className={inputCls}
                placeholder="Solo visible para el staff"
              />
            </div>
            {errorMsg && (
              <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
                {errorMsg}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditModal(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleEditar} disabled={guardando} className="bg-primary text-primary-foreground hover:opacity-90">
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emit receipt modal */}
      <Dialog open={emitirModalOpen} onOpenChange={(open) => { if (!open) setEmitirModalOpen(false); }}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Emitir recibo</DialogTitle>
            <DialogDescription>Generá un recibo por los cargos seleccionados.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {/* Charge summary */}
            <div className="border border-border rounded-[8px] overflow-hidden">
              <div className="px-3 py-2 bg-surface-mid border-b border-border">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Cargos incluidos
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {charges.filter((c) => chargesSeleccionados.has(c.id)).map((c) => (
                  <div key={c.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.82rem] text-on-surface">{c.descripcion}</div>
                      {c.period && (
                        <div className="text-[0.68rem] text-muted-foreground">{periodoLabel(c.period)}</div>
                      )}
                    </div>
                    <span className="text-[0.82rem] font-semibold text-on-surface flex-shrink-0">
                      {formatMonto(c.monto)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2.5 border-t border-border bg-surface-mid/50 flex justify-between items-center">
                <span className="text-[0.75rem] font-semibold text-muted-foreground uppercase tracking-[0.07em]">Total</span>
                <span className="text-[0.9rem] font-bold text-on-surface">{formatMonto(montoSeleccionado)}</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Fecha del recibo <span className="text-error">*</span></label>
              <input
                type="date"
                value={emitirFecha}
                onChange={(e) => setEmitirFecha(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Owner section */}
            <div className="border border-border rounded-[8px] p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={labelCls}>Modalidad de cobro</span>
                <span className="text-[0.72rem] font-semibold px-2 py-0.5 rounded bg-surface-mid border border-border text-on-surface">
                  {emitirModalidad === "B"
                    ? "B — Pago directo al propietario"
                    : "A — Cobro por inmobiliaria"}
                </span>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emitirTrasladar}
                  onChange={(e) => {
                    setEmitirTrasladar(e.target.checked);
                    if (e.target.checked) setEmitirHonorariosPct(emitirContratoComision);
                  }}
                  className="size-4 rounded border-border accent-primary"
                />
                <span className="text-[0.82rem] font-medium text-on-surface">Trasladar cobro al propietario</span>
              </label>
              <p className="text-[0.7rem] text-muted-foreground -mt-1">
                Marcá esta opción para el alquiler y expensas. Desmarcá si el cobro es por gastos tuyos que le pasás al inquilino (ej: materiales, reparaciones).
              </p>

              {emitirTrasladar && (
                <div>
                  <label className={labelCls}>Honorarios de administración (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={emitirHonorariosPct}
                      onChange={(e) => setEmitirHonorariosPct(e.target.value)}
                      min="0"
                      max="100"
                      step="0.1"
                      className={cn(inputCls, "w-32")}
                      placeholder="0"
                    />
                    <span className="text-[0.82rem] text-muted-foreground">%</span>
                    {emitirHonorariosPct && Number(emitirHonorariosPct) > 0 && (
                      <span className="text-[0.78rem] text-muted-foreground">
                        = {formatMonto(Math.round(montoSeleccionado * Number(emitirHonorariosPct) / 100))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {emitirError && (
              <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
                {emitirError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEmitirModalOpen(false)} disabled={emitirGuardando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleEmitir} disabled={emitirGuardando} className="bg-primary text-primary-foreground hover:opacity-90">
              {emitirGuardando ? "Emitiendo..." : "Confirmar y emitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New charge modal */}
      <Dialog open={chargeModalOpen} onOpenChange={setChargeModalOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar cargo</DialogTitle>
            <DialogDescription>Cargá un concepto pendiente de cobro al inquilino.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {contratos.length > 0 && (
              <div>
                <label className={labelCls}>Contrato <span className="text-error">*</span></label>
                <Select value={chargeContratoId} onValueChange={(v) => {
                  setChargeContratoId(v);
                  const c = contratos.find((ct) => ct.id === v);
                  if (chargeCategoria === "alquiler" && c) setChargeMonto(c.monthlyAmount);
                }}>
                  <SelectTrigger className="w-full h-auto py-2 text-[0.82rem]">
                    <SelectValue placeholder="Seleccionar contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber} · {c.propertyAddress ?? c.propertyId} · {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Categoría</label>
                <Select value={chargeCategoria} onValueChange={(v) => {
                  setChargeCategoria(v);
                  setChargeDescripcion(v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ") + " " + periodoLabel(chargePeriod));
                }}>
                  <SelectTrigger className="w-full h-auto py-2 text-[0.82rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_CARGO.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c.charAt(0).toUpperCase() + c.slice(1).replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelCls}>Período</label>
                <input
                  type="month"
                  value={chargePeriod}
                  onChange={(e) => setChargePeriod(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Descripción <span className="text-error">*</span></label>
              <input
                type="text"
                value={chargeDescripcion}
                onChange={(e) => setChargeDescripcion(e.target.value)}
                className={inputCls}
                placeholder="Ej: Alquiler abril 2026"
              />
            </div>
            <div>
              <label className={labelCls}>Monto <span className="text-error">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.82rem] text-muted-foreground">$</span>
                <input
                  type="number"
                  value={chargeMonto}
                  onChange={(e) => setChargeMonto(e.target.value)}
                  min="0"
                  step="0.01"
                  className={cn(inputCls, "pl-7")}
                  placeholder="0"
                />
              </div>
            </div>
            {chargeError && (
              <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
                {chargeError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setChargeModalOpen(false)} disabled={chargeGuardando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardarCargo} disabled={chargeGuardando} className="bg-primary text-primary-foreground hover:opacity-90">
              {chargeGuardando ? "Guardando..." : "Registrar cargo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit charge modal */}
      <Dialog open={!!editChargeTarget} onOpenChange={(open) => { if (!open) setEditChargeTarget(null); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar cargo</DialogTitle>
            <DialogDescription>Solo se pueden editar cargos pendientes.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Categoría</label>
                <Select value={editChargeCategoria} onValueChange={setEditChargeCategoria}>
                  <SelectTrigger className="w-full h-auto py-2 text-[0.82rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_CARGO.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c.charAt(0).toUpperCase() + c.slice(1).replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelCls}>Período</label>
                <input
                  type="month"
                  value={editChargePeriod}
                  onChange={(e) => setEditChargePeriod(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input
                type="text"
                value={editChargeDescripcion}
                onChange={(e) => setEditChargeDescripcion(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.82rem] text-muted-foreground">$</span>
                <input
                  type="number"
                  value={editChargeMonto}
                  onChange={(e) => setEditChargeMonto(e.target.value)}
                  min="0"
                  step="0.01"
                  className={cn(inputCls, "pl-7")}
                />
              </div>
            </div>
            {chargeError && (
              <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
                {chargeError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditChargeTarget(null)} disabled={chargeGuardando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleEditarCargo} disabled={chargeGuardando} className="bg-primary text-primary-foreground hover:opacity-90">
              {chargeGuardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete charge confirmation */}
      <AlertDialog open={!!deleteChargeTarget} onOpenChange={(open) => { if (!open) setDeleteChargeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cargo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El cargo &ldquo;{deleteChargeTarget?.descripcion}&rdquo; será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarCargo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El movimiento &ldquo;{deleteTarget?.descripcion}&rdquo; será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
