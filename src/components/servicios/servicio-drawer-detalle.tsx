"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload, CheckCircle2, AlertTriangle, Lock, Clock } from "lucide-react";
import {
  SERVICIO_TIPO_LABELS,
  SERVICIO_TIPO_ICONS,
  TITULAR_TIPO_LABELS,
  RESPONSABLE_PAGO_LABELS,
  type ServicioTipo,
  type ServicioEstado,
  type TitularTipo,
  type ResponsablePagoTipo,
} from "@/lib/servicios/constants";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

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
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 mb-3">
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

export function ServicioDrawerDetalle({ servicioId, propertyId, periodo, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [motivoOmision, setMotivoOmision] = useState("");
  const [montoComprobante, setMontoComprobante] = useState("");

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

  const s = data?.item;
  const estado: ServicioEstado = data?.estado ?? "pendiente";
  const diasSinComprobante: number = data?.diasSinComprobante ?? 0;
  const historial = data?.historial ?? [];
  const tieneOmision = !!data?.omisionPeriodo;

  const tipo = s?.tipo as ServicioTipo | undefined;
  const icon = tipo ? (SERVICIO_TIPO_ICONS[tipo] ?? "📋") : "📋";
  const nombre = tipo ? SERVICIO_TIPO_LABELS[tipo] : "Servicio";

  return (
    <Drawer direction="right" open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="ml-auto flex h-full w-[460px] max-w-[95vw] flex-col rounded-l-2xl border-l border-white/7 bg-surface p-0">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-white/7 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-xl">
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
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
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
              <div className="border-b border-white/7 px-6 py-5">
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
                        className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </div>
                    <button
                      onClick={() => cargarComprobante.mutate()}
                      disabled={cargarComprobante.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2 text-sm font-semibold text-[#561100] transition-opacity hover:brightness-110 disabled:opacity-60"
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

              {/* Datos del servicio */}
              {s && (
                <div className="border-b border-white/7 px-6 py-5">
                  <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Datos del servicio
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Empresa prestadora", value: s.empresa ?? "—" },
                      { label: "N° de cuenta", value: s.numeroCuenta ?? "—", mono: true },
                      { label: "Titular", value: s.titular ?? "—" },
                      { label: "Tipo de titular", value: s.titularTipo ? TITULAR_TIPO_LABELS[s.titularTipo as TitularTipo] : "—" },
                      { label: "Responsable de pago", value: s.responsablePago ? RESPONSABLE_PAGO_LABELS[s.responsablePago as ResponsablePagoTipo] : "—" },
                      { label: "Vencimiento mensual", value: s.vencimientoDia ? `Día ${s.vencimientoDia} de cada mes` : "—" },
                    ].map(({ label, value, mono }) => (
                      <div key={label}>
                        <p className="mb-0.5 text-[0.62rem] font-semibold uppercase tracking-widest text-muted-foreground">
                          {label}
                        </p>
                        <p className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggle obligatoriedad */}
              {s && (
                <div className="border-b border-white/7 px-6 py-5">
                  <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Configuración
                  </p>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
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
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.activaBloqueo ? "bg-primary" : "bg-white/20"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${s.activaBloqueo ? "left-[18px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de comprobantes */}
              <div className="border-b border-white/7 px-6 py-5">
                <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
                  Historial de comprobantes
                </p>
                {historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin comprobantes registrados</p>
                ) : (
                  <div>
                    {historial.map((comp: { id: string; periodo: string; monto: string | null; cargadoEl: string }) => (
                      <div key={comp.id} className="flex items-start gap-3 border-b border-white/7 py-2.5 last:border-0">
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
                <div className="mt-3 cursor-pointer rounded-xl border-2 border-dashed border-white/10 p-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
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
                      className="w-full resize-y rounded-lg border border-white/10 bg-[#222527] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-error/30"
                    />
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={() => omitirBloqueo.mutate()}
                        disabled={omitirBloqueo.isPending || motivoOmision.length < 10}
                        className="rounded-xl border border-error/20 bg-error-dim px-4 py-1.5 text-sm font-semibold text-error transition-colors hover:bg-error/20 disabled:opacity-50"
                      >
                        {omitirBloqueo.isPending ? "Registrando…" : "Confirmar omisión"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tieneOmision && (
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Bloqueo omitido para este período. El alquiler puede cobrarse normalmente.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/7 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/5"
          >
            Cerrar
          </button>
          {estado !== "al_dia" && (
            <button
              onClick={() => cargarComprobante.mutate()}
              disabled={cargarComprobante.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-1.5 text-sm font-semibold text-[#561100] transition-opacity hover:brightness-110 disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {cargarComprobante.isPending ? "Registrando…" : "Cargar comprobante"}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
