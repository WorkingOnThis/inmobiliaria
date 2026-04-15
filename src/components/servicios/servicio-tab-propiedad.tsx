"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronRight, AlertTriangle } from "lucide-react";
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
import { ServicioDrawerDetalle } from "./servicio-drawer-detalle";
import { ServicioFormNuevo } from "./servicio-form-nuevo";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

const ESTADO_CONFIG: Record<ServicioEstado, { label: string; variant: StatusBadgeVariant }> = {
  al_dia:    { label: "Al día",    variant: "income" },
  pendiente: { label: "Pendiente", variant: "draft" },
  en_alerta: { label: "En alerta", variant: "suspended" },
  bloqueado: { label: "Bloqueado", variant: "baja" },
};

type Props = {
  propertyId: string;
  initialServicioId?: string | null;
};

type ServicioItem = {
  id: string;
  tipo: string;
  empresa: string | null;
  numeroCuenta: string | null;
  titular: string | null;
  titularTipo: string;
  responsablePago: string;
  vencimientoDia: number | null;
  activaBloqueo: boolean;
  estado: ServicioEstado;
  diasSinComprobante: number;
  periodo: string;
};

function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function periodoLabel(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}


export function ServicioTabPropiedad({ propertyId, initialServicioId }: Props) {
  const queryClient = useQueryClient();
  const periodo = periodoActual();
  const [drawerServicioId, setDrawerServicioId] = useState<string | null>(null);
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["servicios", propertyId, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/servicios?propertyId=${propertyId}&periodo=${periodo}&limit=50`);
      if (!res.ok) throw new Error("Error al cargar servicios");
      return res.json() as Promise<{ items: ServicioItem[] }>;
    },
  });

  const servicios = data?.items ?? [];
  const hayAlertas = servicios.some((s) => s.estado === "en_alerta" || s.estado === "bloqueado");
  const serviciosEnAlerta = servicios.filter((s) => s.estado === "en_alerta" || s.estado === "bloqueado");

  // Abrir el drawer automáticamente si se llegó con un servicioId en la URL
  useEffect(() => {
    if (initialServicioId && servicios.some((s) => s.id === initialServicioId)) {
      setDrawerServicioId(initialServicioId);
    }
  }, [initialServicioId, servicios]);

  return (
    <div>
      {/* Nota de alerta */}
      {hayAlertas && (
        <div className="mb-4 flex items-start gap-2 rounded-r-lg border border-border border-l-4 border-l-mustard bg-mustard-dim px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-mustard mt-0.5" />
          <div>
            {serviciosEnAlerta.map((s) => (
              <p key={s.id}>
                <strong className="text-foreground">
                  {SERVICIO_TIPO_LABELS[s.tipo as ServicioTipo] ?? s.tipo}
                </strong>{" "}
                lleva {s.diasSinComprobante} días sin comprobante cargado.
                {s.estado === "bloqueado" && (
                  <span className="text-error"> El cobro del alquiler está bloqueado.</span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[0.67rem] font-bold uppercase tracking-widest text-muted-foreground">
          Servicios configurados · {periodoLabel(periodo)}
        </p>
        <button
          onClick={() => setMostrarFormNuevo(true)}
          className="btn btn-primary btn-xs flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar servicio
        </button>
      </div>

      {/* Formulario nuevo servicio (inline) */}
      {mostrarFormNuevo && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="mb-4 text-sm font-bold text-primary">Nuevo servicio</p>
          <ServicioFormNuevo
            propertyId={propertyId}
            onSuccess={() => {
              setMostrarFormNuevo(false);
              queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
              queryClient.invalidateQueries({ queryKey: ["servicios-resumen"] });
            }}
            onCancel={() => setMostrarFormNuevo(false)}
          />
        </div>
      )}

      {/* Lista de servicios */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : servicios.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10">
          <p className="text-sm text-muted-foreground">No hay servicios configurados para esta propiedad</p>
          <button
            onClick={() => setMostrarFormNuevo(true)}
            className="mt-1 text-xs text-primary hover:underline"
          >
            + Agregar el primero
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {servicios.map((s) => {
            const tipo = s.tipo as ServicioTipo;
            const icon = SERVICIO_TIPO_ICONS[tipo] ?? "📋";
            const nombre = SERVICIO_TIPO_LABELS[tipo] ?? s.tipo;

            return (
              <div
                key={s.id}
                onClick={() => setDrawerServicioId(s.id)}
                className={`flex cursor-pointer items-center gap-3.5 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30 hover:bg-surface-mid ${
                  s.estado === "bloqueado"
                    ? "border-error/30 border-l-4 border-l-error"
                    : s.estado === "en_alerta"
                    ? "border-mustard/20 border-l-4 border-l-mustard"
                    : "border-border"
                }`}
              >
                {/* Icono */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-mid text-lg">
                  {icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{nombre}</p>
                  <p className="text-[0.67rem] text-muted-foreground truncate">
                    {s.empresa ?? "Sin empresa"}
                    {s.titular && ` · Titular: ${s.titular} (${TITULAR_TIPO_LABELS[s.titularTipo as TitularTipo] ?? s.titularTipo})`}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    Paga: {RESPONSABLE_PAGO_LABELS[s.responsablePago as ResponsablePagoTipo] ?? s.responsablePago}
                  </p>
                  {s.numeroCuenta && (
                    <p className="mt-0.5 font-mono text-[0.66rem] text-muted-foreground">
                      N° cuenta: {s.numeroCuenta}
                    </p>
                  )}
                </div>

                {/* Estado */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge variant={ESTADO_CONFIG[s.estado].variant}>
                    {ESTADO_CONFIG[s.estado].label}
                  </StatusBadge>
                  <span className={`text-[0.6rem] font-bold rounded-full px-2 py-0.5 ${s.activaBloqueo ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground"}`}>
                    {s.activaBloqueo ? "Activa bloqueo" : "No bloquea"}
                  </span>
                  {s.diasSinComprobante > 0 && (
                    <span className={`text-[0.63rem] ${s.estado === "en_alerta" ? "text-mustard" : "text-muted-foreground"}`}>
                      {s.diasSinComprobante} días sin comprobante
                    </span>
                  )}
                  {s.estado === "al_dia" && s.vencimientoDia && (
                    <span className="text-[0.63rem] text-muted-foreground">
                      Vence día {s.vencimientoDia}
                    </span>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer de detalle */}
      <ServicioDrawerDetalle
        servicioId={drawerServicioId}
        propertyId={propertyId}
        periodo={periodo}
        open={!!drawerServicioId}
        onClose={() => setDrawerServicioId(null)}
      />
    </div>
  );
}
