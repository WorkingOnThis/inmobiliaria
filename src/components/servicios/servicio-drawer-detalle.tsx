"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload, CheckCircle2, AlertTriangle, Lock, Clock, Pencil, Save } from "lucide-react";
import {
  SERVICIO_TIPOS,
  SERVICIO_TIPO_LABELS,
  SERVICIO_TIPO_LABELS_CORTOS,
  SERVICIO_TIPO_ICONS,
  CAMPOS_SERVICIO,
  TITULAR_TIPO_LABELS,
  RESPONSABLE_PAGO_LABELS,
  TITULAR_TIPOS,
  RESPONSABLE_PAGO_TIPOS,
  type ServicioTipo,
  type ServicioEstado,
  type TitularTipo,
  type ResponsablePagoTipo,
} from "@/lib/servicios/constants";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EmpresaCombobox } from "./empresa-combobox";
import { CamposServicio } from "./campos-servicio";

type Props = {
  servicioId: string | null;
  propertyId: string;
  periodo: string;
  open: boolean;
  onClose: () => void;
};

function periodoLabel(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function EstadoBox({ estado, diasSinComprobante, periodo }: { estado: ServicioEstado; diasSinComprobante: number; periodo: string }) {
  if (estado === "al_dia") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-income/20 bg-income-dim p-3.5 mb-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-income mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-income">Al día</p>
          <p className="mt-0.5 text-[0.67rem] text-muted-foreground">Comprobante cargado para {periodoLabel(periodo)}.</p>
        </div>
      </div>
    );
  }
  if (estado === "pendiente") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 mb-3">
        <Clock className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Pendiente — {diasSinComprobante} días sin comprobante</p>
          <p className="mt-0.5 text-[0.67rem] text-muted-foreground">Todavía no se generó el bloqueo automático.</p>
        </div>
      </div>
    );
  }
  if (estado === "en_alerta") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-mustard/20 bg-mustard-dim p-3.5 mb-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-mustard mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-mustard">En alerta — {diasSinComprobante} días sin comprobante</p>
          <p className="mt-0.5 text-[0.67rem] text-mustard/70">
            Riesgo inminente de bloqueo de alquiler. Cargá el comprobante o indicá el motivo para omitir el bloqueo.
          </p>
        </div>
      </div>
    );
  }
  if (estado === "bloqueado") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-error/20 bg-error-dim p-3.5 mb-3">
        <Lock className="h-5 w-5 shrink-0 text-error mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-error">Bloqueado — {diasSinComprobante} días sin comprobante</p>
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
  tipo: ServicioTipo;
  empresa: string;
  metadatos: Record<string, string>;
  titular: string;
  titularTipo: TitularTipo;
  responsablePago: ResponsablePagoTipo;
  vencimientoDia: string;
  activaBloqueo: boolean;
};

export function ServicioDrawerDetalle({ servicioId, propertyId, periodo, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [motivoOmision, setMotivoOmision] = useState("");
  const [montoComprobante, setMontoComprobante] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    tipo: "luz",
    empresa: "",
    metadatos: {},
    titular: "",
    titularTipo: "propietario",
    responsablePago: "propietario",
    vencimientoDia: "",
    activaBloqueo: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["servicio-detalle", servicioId, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/servicios/${servicioId}?periodo=${periodo}`);
      if (!res.ok) throw new Error("Error al cargar el servicio");
      return res.json();
    },
    enabled: !!servicioId && open,
  });

  // Mutation: toggle activaBloqueo
  const toggleBloqueo = useMutation({
    mutationFn: async (activaBloqueo: boolean) => {
      const res = await fetch(`/api/servicios/${servicioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activaBloqueo }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", servicioId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      toast.success("Configuración actualizada");
    },
    onError: () => toast.error("Error al actualizar"),
  });

  // Mutation: cargar comprobante
  const cargarComprobante = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/servicios/${servicioId}/comprobante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo,
          monto: montoComprobante ? parseFloat(montoComprobante) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar comprobante");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", servicioId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["servicios-resumen"] });
      setMontoComprobante("");
      toast.success("Comprobante registrado");
    },
    onError: (err) => toast.error(err.message),
  });

  // Mutation: omitir bloqueo
  const omitirBloqueo = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/servicios/${servicioId}/omitir-bloqueo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo, motivo: motivoOmision }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al registrar omisión");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", servicioId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["servicios-resumen"] });
      setMotivoOmision("");
      toast.success("Omisión de bloqueo registrada");
    },
    onError: (err) => toast.error(err.message),
  });

  // Mutation: guardar edición de datos del servicio
  const guardarEdicion = useMutation({
    mutationFn: async () => {
      // El primer valor de metadatos se copia a numeroCuenta para mostrarlo en listas
      const primerValor = Object.values(editForm.metadatos)[0] ?? null;
      const res = await fetch(`/api/servicios/${servicioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: editForm.empresa || null,
          numeroCuenta: primerValor || null,
          metadatos: Object.keys(editForm.metadatos).length > 0 ? editForm.metadatos : null,
          titular: editForm.titular || null,
          titularTipo: editForm.titularTipo,
          responsablePago: editForm.responsablePago,
          vencimientoDia: editForm.vencimientoDia ? parseInt(editForm.vencimientoDia) : null,
          activaBloqueo: editForm.activaBloqueo,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicio-detalle", servicioId] });
      queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
      setEditing(false);
      toast.success("Datos actualizados");
    },
    onError: () => toast.error("Error al guardar los datos"),
  });

  function startEditing(item: typeof s) {
    if (!item) return;
    setEditForm({
      tipo: (item.tipo as ServicioTipo) ?? "luz",
      empresa: item.empresa ?? "",
      metadatos: (item.metadatos as Record<string, string> | null) ?? {},
      titular: item.titular ?? "",
      titularTipo: (item.titularTipo as TitularTipo) ?? "propietario",
      responsablePago: (item.responsablePago as ResponsablePagoTipo) ?? "propietario",
      vencimientoDia: item.vencimientoDia ? String(item.vencimientoDia) : "",
      activaBloqueo: item.activaBloqueo ?? true,
    });
    setEditing(true);
  }

  const s = data?.item;
  const estado: ServicioEstado = data?.estado ?? "pendiente";
  const diasSinComprobante: number = data?.diasSinComprobante ?? 0;
  const historial = data?.historial ?? [];
  const tieneOmision = !!data?.omisionPeriodo;

  const tipo = s?.tipo as ServicioTipo | undefined;
  const icon = tipo ? (SERVICIO_TIPO_ICONS[tipo] ?? "📋") : "📋";
  const nombre = tipo ? SERVICIO_TIPO_LABELS[tipo] : "Servicio";

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
                {s?.empresa ?? "Sin empresa"} · {periodoLabel(periodo)}
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
                  Estado del período — {periodoLabel(periodo)}
                </p>
                <EstadoBox estado={estado} diasSinComprobante={diasSinComprobante} periodo={periodo} />

                {/* Cargar comprobante */}
                {estado !== "al_dia" && (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Monto (opcional)"
                        value={montoComprobante}
                        onChange={(e) => setMontoComprobante(e.target.value)}
                        className="w-36 rounded-lg border border-border bg-surface-mid px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </div>
                    <button
                      onClick={() => cargarComprobante.mutate()}
                      disabled={cargarComprobante.isPending}
                      className="btn btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {cargarComprobante.isPending ? "Registrando…" : `Cargar comprobante de ${periodoLabel(periodo)}`}
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
                      <p className="text-sm font-medium">{s.empresa ?? "—"}</p>
                    </div>
                    {/* Campos específicos del tipo */}
                    {tipo && (CAMPOS_SERVICIO[tipo] ?? []).map((campo) => {
                      const valor = (s.metadatos as Record<string, string> | null)?.[campo.key] ?? s.numeroCuenta ?? "—";
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
                      <p className="text-sm font-medium">{s.titular ?? "—"}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Tipo de titular
                      </p>
                      <p className="text-sm font-medium">
                        {s.titularTipo ? TITULAR_TIPO_LABELS[s.titularTipo as TitularTipo] : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Responsable de pago
                      </p>
                      <p className="text-sm font-medium">
                        {s.responsablePago ? RESPONSABLE_PAGO_LABELS[s.responsablePago as ResponsablePagoTipo] : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        Vencimiento mensual
                      </p>
                      <p className="text-sm font-medium">
                        {s.vencimientoDia ? `Día ${s.vencimientoDia} de cada mes` : "—"}
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
                        {s.activaBloqueo ? "Sí" : "No"}
                      </span>
                      <button
                        type="button"
                        disabled={toggleBloqueo.isPending}
                        onClick={() => toggleBloqueo.mutate(!s.activaBloqueo)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.activaBloqueo ? "bg-primary" : "bg-surface-highest"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${s.activaBloqueo ? "left-[18px]" : "left-0.5"}`}
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
                        {SERVICIO_TIPOS.map((t) => {
                          const esActual = t === editForm.tipo;
                          return (
                            <div
                              key={t}
                              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.65rem] font-semibold transition-colors ${
                                esActual
                                  ? "border-border-accent bg-primary-dim text-primary"
                                  : "border-border bg-card text-muted-foreground opacity-35"
                              }`}
                            >
                              <span className="text-base">{SERVICIO_TIPO_ICONS[t]}</span>
                              {SERVICIO_TIPO_LABELS_CORTOS[t]}
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
                      <EmpresaCombobox
                        value={editForm.empresa}
                        onChange={(v) => setEditForm((f) => ({ ...f, empresa: v }))}
                      />
                    </div>

                    {/* Campos específicos por tipo */}
                    <CamposServicio
                      tipo={editForm.tipo}
                      valores={editForm.metadatos}
                      onChange={(v) => setEditForm((f) => ({ ...f, metadatos: v }))}
                    />

                    {/* Titular + Tipo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                          Titular
                        </label>
                        <input
                          type="text"
                          value={editForm.titular}
                          onChange={(e) => setEditForm((f) => ({ ...f, titular: e.target.value }))}
                          placeholder="Nombre del titular"
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                          Tipo de titular
                        </label>
                        <select
                          value={editForm.titularTipo}
                          onChange={(e) => setEditForm((f) => ({ ...f, titularTipo: e.target.value as TitularTipo }))}
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none focus:border-primary/40"
                        >
                          {TITULAR_TIPOS.map((t) => (
                            <option key={t} value={t}>{TITULAR_TIPO_LABELS[t]}</option>
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
                          value={editForm.responsablePago}
                          onChange={(e) => setEditForm((f) => ({ ...f, responsablePago: e.target.value as ResponsablePagoTipo }))}
                          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none focus:border-primary/40"
                        >
                          {RESPONSABLE_PAGO_TIPOS.map((t) => (
                            <option key={t} value={t}>{RESPONSABLE_PAGO_LABELS[t]}</option>
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
                          value={editForm.vencimientoDia}
                          onChange={(e) => setEditForm((f) => ({ ...f, vencimientoDia: e.target.value }))}
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
                          {editForm.activaBloqueo ? "Sí" : "No"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, activaBloqueo: !f.activaBloqueo }))}
                          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${editForm.activaBloqueo ? "bg-primary" : "bg-surface-highest"}`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${editForm.activaBloqueo ? "left-[18px]" : "left-0.5"}`}
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
                    {historial.map((comp: { id: string; periodo: string; monto: string | null; cargadoEl: string }) => (
                      <div key={comp.id} className="flex items-start gap-3 border-b border-border py-2.5 last:border-0">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-income" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold capitalize">
                            {(() => {
                              const [y, m] = comp.periodo.split("-").map(Number);
                              return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
                            })()}
                          </p>
                          <p className="text-[0.65rem] text-muted-foreground">
                            Cargado el {new Date(comp.cargadoEl).toLocaleDateString("es-AR")}
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
              {(estado === "en_alerta" || estado === "bloqueado") && !tieneOmision && (
                <div className="px-6 py-5">
                  <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Acciones de emergencia
                  </p>
                  <div className="rounded-xl border border-error/20 bg-error-dim p-4">
                    <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-error">
                      🔓 Omitir bloqueo de alquiler — {periodoLabel(periodo)}
                    </p>
                    <p className="mb-3 text-[0.68rem] text-muted-foreground leading-relaxed">
                      Permite registrar el cobro del alquiler de este mes aunque el comprobante no esté cargado. Esta acción queda registrada con tu usuario, la fecha y el motivo.
                    </p>
                    <textarea
                      value={motivoOmision}
                      onChange={(e) => setMotivoOmision(e.target.value)}
                      placeholder="Motivo de la omisión (ej: el propietario está tramitando la reconexión, comprobante en trámite…)"
                      rows={3}
                      className="w-full resize-y rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-error/30"
                    />
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={() => omitirBloqueo.mutate()}
                        disabled={omitirBloqueo.isPending || motivoOmision.length < 10}
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
                onClick={() => guardarEdicion.mutate()}
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
                {estado !== "al_dia" && (
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
