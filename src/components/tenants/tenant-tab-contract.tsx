"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface ContratoData {
  id: string;
  contractNumber: string;
  status: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyAmount: string;
  paymentDay: number;
  paymentModality: string;
  adjustmentIndex: string;
  adjustmentFrequency: number;
  agencyCommission: string | null;
  depositAmount: string | null;
}

interface Props {
  contrato: ContratoData | null;
}

function formatFecha(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatMonto(val: string | number | null) {
  if (val === null || val === undefined) return "—";
  return "$" + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function calcularDuracionMeses(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

const modalidadLabel: Record<string, string> = {
  A: "Modalidad A — CBU Inmobiliaria",
  B: "Modalidad B — Pago directo al owner",
};

const tipoLabel: Record<string, string> = {
  vivienda: "Vivienda",
  oficina: "Oficina",
  local: "Local comercial",
  otro: "Otro",
};

const statusLabel: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  active:            { label: "Vigente",         variant: "active" },
  expiring_soon:     { label: "Por vencer",      variant: "expiring" },
  expired:           { label: "Vencido",         variant: "baja" },
  terminated:        { label: "Rescindido",      variant: "draft" },
  draft:             { label: "Borrador",        variant: "draft" },
  pending_signature: { label: "Pendiente firma", variant: "reserved" },
};

export function TenantTabContract({ contrato }: Props) {
  const router = useRouter();

  if (!contrato) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <div className="text-2xl opacity-40">📄</div>
        <div className="text-[0.85rem] text-text-muted">Este tenant no tiene contrato activo</div>
      </div>
    );
  }

  const status = statusLabel[contrato.status] ?? { label: contrato.status, variant: "draft" as StatusBadgeVariant };
  const duracion = calcularDuracionMeses(contrato.startDate, contrato.endDate);

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Mini card de contrato — clickeable para navegar */}
      <Card
        className={cn("rounded-[8px] border-blue/20 bg-surface-mid cursor-pointer hover:border-blue/40 hover:bg-blue/5 transition-all py-0 gap-0")}
        onClick={() => router.push(`/contratos/${contrato.id}`)}
      >
        <CardContent className="px-4 py-3.5 flex items-center gap-4">
          <div className="size-9 bg-blue/10 rounded-[8px] flex items-center justify-center text-base flex-shrink-0">
            📄
          </div>
          <div className="flex-1">
            <div className="text-[0.8rem] font-semibold text-blue">{contrato.contractNumber}</div>
            <div className="text-[0.75rem] text-text-muted mt-0.5">
              Vigente desde {formatFecha(contrato.startDate)} · Vence {formatFecha(contrato.endDate)}
            </div>
          </div>
          <StatusBadge variant={status.variant}>
            {status.label}
          </StatusBadge>
          <span className="text-text-muted text-lg ml-1">›</span>
        </CardContent>
      </Card>

      {/* Resumen del contrato */}
      <Card className="rounded-[10px] border py-0 gap-0 overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0">
          <CardTitle className="text-[0.82rem] font-semibold">Resumen del contrato</CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Tipo de contrato</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{tipoLabel[contrato.contractType] ?? contrato.contractType}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Duración</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{duracion} meses</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Inicio</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{formatFecha(contrato.startDate)}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Fin</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{formatFecha(contrato.endDate)}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Alquiler vigente</div>
            <div className="text-[0.85rem] font-medium text-on-bg">{formatMonto(contrato.monthlyAmount)}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Día de pago</div>
            <div className="text-[0.85rem] font-medium text-on-bg">Día {contrato.paymentDay} de cada mes</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Índice de actualización</div>
            <div className="text-[0.85rem] font-medium text-on-bg">
              {contrato.adjustmentIndex === "sin_ajuste"
                ? "Sin ajuste"
                : `${contrato.adjustmentIndex} (cada ${contrato.adjustmentFrequency} meses)`}
            </div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Modalidad de pago</div>
            <div className="text-[0.85rem] font-medium text-on-bg">
              {modalidadLabel[contrato.paymentModality] ?? contrato.paymentModality}
            </div>
          </div>
          {contrato.depositAmount && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Depósito</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{formatMonto(contrato.depositAmount)}</div>
            </div>
          )}
          {contrato.agencyCommission && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Honorarios inmobiliaria</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{contrato.agencyCommission}%</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
