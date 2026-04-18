"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload, CheckCircle2, AlertTriangle, Lock, Clock, Pencil, Save } from "lucide-react";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_SHORT_LABELS,
  SERVICE_TYPE_ICONS,
  SERVICE_FIELDS,
  HOLDER_TYPE_LABELS,
  PAYMENT_RESPONSIBLE_LABELS,
  HOLDER_TYPES,
  PAYMENT_RESPONSIBLE_TYPES,
  type ServiceType,
  type ServiceStatus,
  type HolderType,
  type PaymentResponsibleType,
} from "@/lib/services/constants";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CompanyCombobox } from "./company-combobox";
import { ServiceFields } from "./service-fields";

type Props = {
  serviceId: string | null;
  propertyId: string;
  period: string;
  open: boolean;
  onClose: () => void;
};

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function StatusBox({ estado, daysWithoutReceipt, period }: { estado: ServiceStatus; daysWithoutReceipt: number; period: string }) {
  if (estado === "current") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-income/20 bg-income-dim p-3.5 mb-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-income mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-income">Al día</p>
          <p className="mt-0.5 text-[0.67rem] text-muted-foreground">Comprobante cargado para {periodLabel(period)}.</p>
        </div>
      </div>
    );
  }
  if (estado === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 mb-3">
        <Clock className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Pendiente — {daysWithoutReceipt} días sin comprobante</p>
          <p className="mt-0.5 text-[0.67rem] text-muted-foreground">Todavía no se generó el bloqueo automático.</p>
        </div>
      </div>
    );
  }
  if (estado === "alert") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-mustard/20 bg-mustard-dim p-3.5 mb-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-mustard mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-mustard">En alerta — {daysWithoutReceipt} días sin comprobante</p>
          <p className="mt-0.5 text-[0.67rem] text-mustard/70">
            Riesgo inminente de bloqueo de alquiler. Cargá el comprobante o indicá el motivo para omitir el bloqueo.
          </p>
        </div>
      </div>
    );
  }
  if (estado === "blocked") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-error/20 bg-error-dim p-3.5 mb-3">
        <Lock className="h-5 w-5 shrink-0 text-error mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-error">Bloqueado — {daysWithoutReceipt} días sin comprobante</p>
          <p className="mt-0.5 text-[0.67rem] text-error/70">
            El cobro del alquiler de esta propiedad está bloqueado hasta regularizar el comprobante o registrar una omisión.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

type EditForm = {
  type: ServiceType;
  company: string;
  metadata: Record<string, string>;
  holder: string;
  holderType: HolderType;
  paymentResponsible: PaymentResponsibleType;
  dueDay: string;
  activatesBlock: boolean;
};

// Mapeo tipo de servicio → clave en la tabla property
const TIPO_TO_PROPERTY_KEY: Record<string, string> = {
  luz: "serviceLuz",
  gas: "serviceGas",
  agua: "serviceAgua",
  abl: "serviceMunicipalidad",
  inmobiliario: "serviceRendas",
  expensas: "serviceExpensas",
};

export function ServiceDrawerDetail({ serviceId, propertyId, period, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [omissionReason, setOmissionReason] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [editing, setEditing] = useState(false);
  const [showContractWarning, setShowContractWarning] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    type: "electricity",
    company: "",
    metadata: {},
    holder: "",
    holderType: "propietario",
    paymentResponsible: "propietario",
    dueDay: "",
    activatesBlock: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["servicio-detalle", serviceId, period],
    queryFn: async () => {
      const res = await fetch(`/api/servicios/${serviceId}?period=${period}`);
      if (!res.ok) throw new Error("Error al cargar el servicio");
      return res.json();
    },
    enabled: !!serviceId && open,
  });

  // Mutation: toggle triggersBlock
  const toggleBloqueo = useMutation({
    mutationFn: async (triggersBlock: boolean) => {
      const res = await fetch(`/api/servicios/${serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggersBlock }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      toast.success("Configuración actualizada");
    },
    onError: () => toast.error("Error al actualizar"),
  });

  // Mutation: cargar comprobante
  const cargarComprobante = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/servicios/${serviceId}/comprobante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          monto: receiptAmount ? parseFloat(receiptAmount) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar comprobante");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["servicios-resumen"] });
      setReceiptAmount("");
      toast.success("Comprobante registrado");
    },
    onError: (err) => toast.error(err.message),
  });

  // Mutation: omitir bloqueo
  const omitirBloqueo = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/servicios/${serviceId}/omitir-bloqueo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, motivo: omissionReason }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al registrar omisión");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["servicios-resumen"] });
      setOmissionReason("");
      toast.success("Omisión de bloqueo registrada");
    },
    onError: (err) => toast.error(err.message),
  });

  // Mutation: guardar edición de datos del servicio
  const guardarEdicion = useMutation({
    mutationFn: async () => {
      // El primer valor de metadata se copia a accountNumber para mostrarlo en listas
      const primerValor = Object.values(editForm.metadata)[0] ?? null;
      const res = await fetch(`/api/servicios/${serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: editForm.company || null,
          accountNumber: primerValor || null,
          metadata: Object.keys(editForm.metadata).length > 0 ? editForm.metadata : null,
          holder: editForm.holder || null,
          holderType: editForm.holderType,
          paymentResponsible: editForm.paymentResponsible,
          dueDay: editForm.dueDay ? parseInt(editForm.dueDay) : null,
          triggersBlock: editForm.activatesBlock,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: async () => {
      // Si cambió paymentResponsible, propagar a property.serviceX y al contrato
      if (s && editForm.paymentResponsible !== s.paymentResponsible) {
        const propertyKey = TIPO_TO_PROPERTY_KEY[s.tipo];
        if (propertyKey) {
          await fetch(`/api/properties/${propertyId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [propertyKey]: editForm.paymentResponsible }),
          });
          queryClient.invalidateQueries({ queryKey: ["contract"] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      setEditing(false);
      toast.success("Datos actualizados");
    },
    onError: () => toast.error("Error al guardar los datos"),
  });

  function startEditing(item: typeof s) {
    if (!item) return;
    setEditForm({
      type: (item.tipo as ServiceType) ?? "electricity",
      company: item.company ?? "",
      metadata: (item.metadata as Record<string, string> | null) ?? {},
      holder: item.holder ?? "",
      holderType: (item.holderType as HolderType) ?? "propietario",
      paymentResponsible: (item.paymentResponsible as PaymentResponsibleType) ?? "propietario",
      dueDay: item.dueDay ? String(item.dueDay) : "",
      activatesBlock: item.triggersBlock ?? true,
    });
    setEditing(true);
  }

  const s = data?.item;
  const estado: ServiceStatus = data?.estado ?? "pendiente";
  const daysWithoutReceipt: number = data?.daysWithoutReceipt ?? 0;
  const historial = data?.historial ?? [];
  const tieneOmision = !!data?.omisionPeriodo;

  const tipo = s?.tipo as ServiceType | undefined;
  const icon = tipo ? (SERVICE_TYPE_ICONS[tipo] ?? "📋") : "📋";
  const nombre = tipo ? SERVICE_TYPE_LABELS[tipo] : "Servicio";

  return (
    <Drawer direction="right" open={open} onOpenChange={(v) => { if (!v) { setEditing(false); onClose(); } }}>
      <DrawerContent className="ml-auto flex h-full w-[460px] max-w-[95vw] flex-col rounded-l-2xl border-l border-border bg-surface p-0">
        <DrawerTitle className="sr-only">{nombre} — detalle del servicio</DrawerTitle>
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-mid text-xl">
              {icon}
            </div>
            <div>
              <p className="font-headline text-base font-bold">{nombre}</p>
              <p className="text-xs text-muted-foreground">
                {s?.company ?? "Sin company"} · {periodLabel(period)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-mid hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Cargando…
            </div>
          ) : (
            <>
              {/* Estado actual */}
              <div className="border-b border-border px-6 py-5">
                <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                  Estado del período — {periodLabel(period)}
                </p>
                <StatusBox estado={estado} daysWithoutReceipt={daysWithoutReceipt} period={period} />

                {/* Cargar comprobante */}
                {estado !== "current" && (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Monto (opcional)"
                        value={receiptAmount}
                        onChange={(e) => setReceiptAmount(e.target.value)}
                        className="w-36 rounded-lg border border-border bg-surface-mid px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </div>
                    <button
                      onClick={() => cargarComprobante.mutate()}
                      disabled={cargarComprobante.isPending}
                      className="btn btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {cargarComprobante.isPending ? "Registrando…" : `Cargar comprobante de ${periodLabel(period)}`}
                    </button>
                    <p className="mt-1.5 text-center text-[0.65rem] text-muted-foreground">
                      También puede cargarlo el propietario o el inquilino desde su portal.
                    </p>
                  </div>
                )}
              </div>

              {/* Datos del servicio / Formulario de edición */}
              {s && !editing && (
                <div className="border-b border-border px-6 py-5">
                  <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Datos del servicio
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Empresa */}
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Empresa prestadora
                      </p>
                      <p className="text-sm font-medium">{s.company ?? "—"}</p>
                    </div>
                    {/* Campos específicos del tipo */}
                    {tipo && (SERVICE_FIELDS[tipo] ?? []).map((campo) => {
                      const valor = (s.metadata as Record<string, string> | null)?.[campo.key] ?? s.accountNumber ?? "—";
                      return (
                        <div key={campo.key}>
                          <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                            {campo.label}
                          </p>
                          <p className={`text-sm font-medium ${campo.mono ? "font-mono text-xs" : ""}`}>
                            {valor || "—"}
                          </p>
                        </div>
                      );
                    })}
                    {/* Datos comunes */}
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Titular
                      </p>
                      <p className="text-sm font-medium">{s.holder ?? "—"}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Tipo de holder
                      </p>
                      <p className="text-sm font-medium">
                        {s.holderType ? HOLDER_TYPE_LABELS[s.holderType as HolderType] : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Responsable de pago
                      </p>
                      <p className="text-sm font-medium">
                        {s.paymentResponsible ? PAYMENT_RESPONSIBLE_LABELS[s.paymentResponsible as PaymentResponsibleType] : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Vencimiento mensual
                      </p>
                      <p className="text-sm font-medium">
                        {s.dueDay ? `Día ${s.dueDay} de cada mes` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuración — solo en modo lectura */}
              {s && !editing && (
                <div className="border-b border-border px-6 py-5">
                  <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Configuración
                  </p>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-3.5">
                    <div>
                      <p className="text-sm font-semibold">Activa bloqueo de alquiler</p>
                      <p className="mt-0.5 max-w-[260px] text-[0.67rem] text-muted-foreground">
                        Si está activo y el comprobante lleva más de 30 días sin cargarse, el sistema bloquea el registro del pago de alquiler.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[0.68rem] text-muted-foreground min-w-[20px] text-right">
                        {s.triggersBlock ? "Sí" : "No"}
                      </span>
                      <button
                        type="button"
                        disabled={toggleBloqueo.isPending}
                        onClick={() => toggleBloqueo.mutate(!s.triggersBlock)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.triggersBlock ? "bg-primary" : "bg-surface-highest"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${s.triggersBlock ? "left-[18px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario de edición — mismo layout que "Nuevo servicio" */}
              {s && editing && (
                <div className="border-b border-border px-6 py-5">
                  <p className="mb-4 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Editar servicio
                  </p>
                  <div className="flex flex-col gap-4">
                    {/* Tipo — bloqueado, solo muestra el actual activo */}
                    <div>
                      <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                        Tipo de servicio
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SERVICE_TYPES.map((t) => {
                          const esActual = t === editForm.type;
                          return (
                            <div
                              key={t}
                              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.65rem] font-semibold transition-colors ${
                                esActual
                                  ? "border-border-accent bg-primary-dim text-primary"
                                  : "border-border bg-card text-muted-foreground opacity-35"
                              }`}
                            >
                              <span className="text-base">{SERVICE_TYPE_ICONS[t]}</span>
                              {SERVICE_TYPE_SHORT_LABELS[t]}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Empresa */}
                    <div>
                      <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                        Empresa prestadora
                      </label>
                      <CompanyCombobox
                        value={editForm.company}
                        onChange={(v) => setEditForm((f) => ({ ...f, company: v }))}
                      />
                    </div>

                    {/* Campos específicos por tipo */}
                    <ServiceFields
                      type={editForm.type}
                      values={editForm.metadata}
                      onChange={(v) => setEditForm((f) => ({ ...f, metadata: v }))}
                    />

                    {/* Titular + Tipo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                          Titular
                        </label>
                        <input
                          type="text"
                          value={editForm.holder}
                          onChange={(e) => setEditForm((f) => ({ ...f, holder: e.target.value }))}
                          placeholder="Nombre del holder"
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                          Tipo de holder
                        </label>
                        <select
                          value={editForm.holderType}
                          onChange={(e) => setEditForm((f) => ({ ...f, holderType: e.target.value as HolderType }))}
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none focus:border-primary/40"
                        >
                          {HOLDER_TYPES.map((t) => (
                            <option key={t} value={t}>{HOLDER_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Responsable + Vencimiento */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                          Responsable de pago
                        </label>
                        <select
                          value={editForm.paymentResponsible}
                          onChange={(e) => setEditForm((f) => ({ ...f, paymentResponsible: e.target.value as PaymentResponsibleType }))}
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none focus:border-primary/40"
                        >
                          {PAYMENT_RESPONSIBLE_TYPES.map((t) => (
                            <option key={t} value={t}>{PAYMENT_RESPONSIBLE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                          Día de vencimiento
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editForm.dueDay}
                          onChange={(e) => setEditForm((f) => ({ ...f, dueDay: e.target.value }))}
                          placeholder="Ej: 10"
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
                        />
                      </div>
                    </div>

                    {/* Toggle bloqueo */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-3.5">
                      <div>
                        <p className="text-sm font-semibold">Activa bloqueo de alquiler</p>
                        <p className="mt-0.5 max-w-[260px] text-[0.67rem] text-muted-foreground">
                          Si está activo y el comprobante lleva más de 30 días sin cargarse, el sistema bloquea el registro del pago de alquiler.
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[0.68rem] text-muted-foreground min-w-[20px] text-right">
                          {editForm.activatesBlock ? "Sí" : "No"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, activatesBlock: !f.activatesBlock }))}
                          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${editForm.activatesBlock ? "bg-primary" : "bg-surface-highest"}`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${editForm.activatesBlock ? "left-[18px]" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de comprobantes */}
              <div className="border-b border-border px-6 py-5">
                <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                  Historial de comprobantes
                </p>
                {historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin comprobantes registrados</p>
                ) : (
                  <div>
                    {historial.map((comp: { id: string; period: string; monto: string | null; uploadedAt: string }) => (
                      <div key={comp.id} className="flex items-start gap-3 border-b border-border py-2.5 last:border-0">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-income" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold capitalize">
                            {(() => {
                              const [y, m] = comp.period.split("-").map(Number);
                              return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
                            })()}
                          </p>
                          <p className="text-[0.65rem] text-muted-foreground">
                            Cargado el {new Date(comp.uploadedAt).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        <p className="text-sm font-semibold shrink-0">
                          {comp.monto ? `$${parseFloat(comp.monto).toLocaleString("es-AR")}` : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zona de upload (placeholder) */}
                <div className="mt-3 cursor-pointer rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                  <Upload className="mx-auto mb-1.5 h-5 w-5" />
                  <p>Arrastrá el comprobante aquí o <strong>hacé click para seleccionar</strong></p>
                  <p className="mt-1 text-[0.62rem]">PDF, JPG, PNG — máx. 5 MB</p>
                </div>
              </div>

              {/* Omitir bloqueo — solo si en_alerta o bloqueado */}
              {(estado === "alert" || estado === "blocked") && !tieneOmision && (
                <div className="px-6 py-5">
                  <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Acciones de emergencia
                  </p>
                  <div className="rounded-xl border border-error/20 bg-error-dim p-4">
                    <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-error">
                      🔓 Omitir bloqueo de alquiler — {periodLabel(period)}
                    </p>
                    <p className="mb-3 text-[0.68rem] text-muted-foreground leading-relaxed">
                      Permite registrar el cobro del alquiler de este mes aunque el comprobante no esté cargado. Esta acción queda registrada con tu usuario, la fecha y el motivo.
                    </p>
                    <textarea
                      value={omissionReason}
                      onChange={(e) => setOmissionReason(e.target.value)}
                      placeholder="Motivo de la omisión (ej: el propietario está tramitando la reconexión, comprobante en trámite…)"
                      rows={3}
                      className="w-full resize-y rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-error/30"
                    />
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={() => omitirBloqueo.mutate()}
                        disabled={omitirBloqueo.isPending || omissionReason.length < 10}
                        className="btn btn-danger btn-sm"
                      >
                        {omitirBloqueo.isPending ? "Registrando…" : "Confirmar omisión"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tieneOmision && (
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Bloqueo omitido para este período. El alquiler puede cobrarse normalmente.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de advertencia: el cambio de paymentResponsible también afecta al contrato */}
        {showContractWarning && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-[inherit]">
            <div className="mx-5 w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
              <div className="mb-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-mustard mt-0.5" />
                <div>
                  <p className="font-semibold text-on-surface mb-1.5 text-[0.9rem]">
                    Cambio afecta al contrato
                  </p>
                  <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                    Modificar el responsable de pago de este servicio también actualizará ese dato en el contrato asociado a esta propiedad.
                    <br /><br />
                    <strong className="text-on-surface">¿Querés continuar?</strong>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowContractWarning(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setShowContractWarning(false); guardarEdicion.mutate(); }}
                  className="btn btn-primary btn-sm"
                >
                  Confirmar y guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-4">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // Si cambió el paymentResponsible, mostrar advertencia antes de guardar
                  if (s && editForm.paymentResponsible !== s.paymentResponsible) {
                    setShowContractWarning(true);
                  } else {
                    guardarEdicion.mutate();
                  }
                }}
                disabled={guardarEdicion.isPending}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                <Save className="h-3.5 w-3.5" />
                {guardarEdicion.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="btn btn-ghost btn-sm"
              >
                Cerrar
              </button>
              <div className="flex items-center gap-2">
                {s && (
                  <button
                    onClick={() => startEditing(s)}
                    className="btn btn-secondary btn-sm flex items-center gap-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                )}
                {estado !== "current" && (
                  <button
                    onClick={() => cargarComprobante.mutate()}
                    disabled={cargarComprobante.isPending}
                    className="btn btn-primary btn-sm flex items-center gap-2"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {cargarComprobante.isPending ? "Registrando…" : "Cargar comprobante"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
