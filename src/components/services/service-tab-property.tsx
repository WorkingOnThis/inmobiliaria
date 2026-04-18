"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronRight, AlertTriangle } from "lucide-react";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  HOLDER_TYPE_LABELS,
  PAYMENT_RESPONSIBLE_LABELS,
  type ServiceType,
  type ServiceStatus,
  type HolderType,
  type PaymentResponsibleType,
} from "@/lib/services/constants";
import { ServiceDrawerDetail } from "./service-drawer-detail";
import { ServiceFormNew } from "./service-form-new";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";

const STATUS_CONFIG: Record<ServiceStatus, { label: string; variant: StatusBadgeVariant }> = {
  current: { label: "Al día",    variant: "income" },
  pending: { label: "Pendiente", variant: "draft" },
  alert:   { label: "En alerta", variant: "suspended" },
  blocked: { label: "Bloqueado", variant: "baja" },
};

type Props = {
  propertyId: string;
  initialServiceId?: string | null;
};

type ServiceItem = {
  id: string;
  tipo: string;
  company: string | null;
  accountNumber: string | null;
  holder: string | null;
  holderType: string;
  paymentResponsible: string;
  dueDay: number | null;
  activaBloqueo: boolean;
  estado: ServiceStatus;
  diasSinComprobante: number;
  periodo: string;
  propertyId: string;
  tieneOmision: boolean;
  inquilinoNombre: string | null;
  inquilinoId: string | null;
};

function currentPeriod(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}


export function ServiceTabProperty({ propertyId, initialServiceId }: Props) {
  const queryClient = useQueryClient();
  const period = currentPeriod();
  const [drawerServiceId, setDrawerServiceId] = useState<string | null>(null);
  const [showFormNew, setShowFormNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["servicios", propertyId, period],
    queryFn: async () => {
      const res = await fetch(`/api/servicios?propertyId=${propertyId}&period=${period}&limit=50`);
      if (!res.ok) throw new Error("Error al cargar servicios");
      return res.json() as Promise<{ items: ServiceItem[] }>;
    },
  });

  const servicios = data?.items ?? [];
  const hayAlertas = servicios.some((s) => s.estado === "alert" || s.estado === "blocked");
  const serviciosEnAlerta = servicios.filter((s) => s.estado === "alert" || s.estado === "blocked");

  // Abrir el drawer automáticamente si se llegó con un serviceId en la URL
  useEffect(() => {
    if (initialServiceId && servicios.some((s) => s.id === initialServiceId)) {
      setDrawerServiceId(initialServiceId);
    }
  }, [initialServiceId, servicios]);

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
                  {SERVICE_TYPE_LABELS[s.tipo as ServiceType] ?? s.tipo}
                </strong>{" "}
                lleva {s.diasSinComprobante} días sin comprobante cargado.
                {s.estado === "blocked" && (
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
          Servicios configurados · {periodLabel(period)}
        </p>
        <button
          onClick={() => setShowFormNew(true)}
          className="btn btn-primary btn-xs flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar servicio
        </button>
      </div>

      {/* Formulario nuevo servicio (inline) */}
      {showFormNew && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="mb-4 text-sm font-bold text-primary">Nuevo servicio</p>
          <ServiceFormNew
            propertyId={propertyId}
            onSuccess={() => {
              setShowFormNew(false);
              queryClient.invalidateQueries({ queryKey: ["servicios", propertyId] });
              queryClient.invalidateQueries({ queryKey: ["servicios-resumen"] });
            }}
            onCancel={() => setShowFormNew(false)}
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
            onClick={() => setShowFormNew(true)}
            className="mt-1 text-xs text-primary hover:underline"
          >
            + Agregar el primero
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {servicios.map((s) => {
            const type = s.tipo as ServiceType;
            const icon = SERVICE_TYPE_ICONS[type] ?? "📋";
            const nombre = SERVICE_TYPE_LABELS[type] ?? s.tipo;

            return (
              <div
                key={s.id}
                onClick={() => setDrawerServiceId(s.id)}
                className={`flex cursor-pointer items-center gap-3.5 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30 hover:bg-surface-mid ${
                  s.estado === "blocked"
                    ? "border-error/30 border-l-4 border-l-error"
                    : s.estado === "alert"
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
                    {s.company ?? "Sin company"}
                    {s.holder && ` · Titular: ${s.holder} (${HOLDER_TYPE_LABELS[s.holderType as HolderType] ?? s.holderType})`}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    Paga: {PAYMENT_RESPONSIBLE_LABELS[s.paymentResponsible as PaymentResponsibleType] ?? s.paymentResponsible}
                  </p>
                  {s.accountNumber && (
                    <p className="mt-0.5 font-mono text-[0.66rem] text-muted-foreground">
                      N° cuenta: {s.accountNumber}
                    </p>
                  )}
                </div>

                {/* Estado */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge variant={STATUS_CONFIG[s.estado].variant}>
                    {STATUS_CONFIG[s.estado].label}
                  </StatusBadge>
                  <span className={`text-[0.6rem] font-bold rounded-full px-2 py-0.5 ${s.activaBloqueo ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground"}`}>
                    {s.activaBloqueo ? "Activa bloqueo" : "No bloquea"}
                  </span>
                  {s.diasSinComprobante > 0 && (
                    <span className={`text-[0.63rem] ${s.estado === "alert" ? "text-mustard" : "text-muted-foreground"}`}>
                      {s.diasSinComprobante} días sin comprobante
                    </span>
                  )}
                  {s.estado === "current" && s.dueDay && (
                    <span className="text-[0.63rem] text-muted-foreground">
                      Vence día {s.dueDay}
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
      <ServiceDrawerDetail
        serviceId={drawerServiceId}
        propertyId={propertyId}
        period={period}
        open={!!drawerServiceId}
        onClose={() => setDrawerServiceId(null)}
      />
    </div>
  );
}
