"use client";

import { useRouter } from "next/navigation";

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
  B: "Modalidad B — Pago directo al propietario",
};

const tipoLabel: Record<string, string> = {
  vivienda: "Vivienda",
  oficina: "Oficina",
  local: "Local comercial",
  otro: "Otro",
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Vigente", cls: "bg-success/10 text-success border-success/20" },
  expiring_soon: { label: "Por vencer", cls: "bg-warning/10 text-warning border-warning/20" },
  expired: { label: "Vencido", cls: "bg-error/10 text-error border-error/20" },
  terminated: { label: "Rescindido", cls: "bg-text-muted/10 text-text-muted border-text-muted/20" },
  draft: { label: "Borrador", cls: "bg-surface-highest text-text-muted border-border" },
  pending_signature: { label: "Pendiente firma", cls: "bg-blue/10 text-blue border-blue/20" },
};

export function InquilinoTabContrato({ contrato }: Props) {
  const router = useRouter();

  if (!contrato) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <div className="text-2xl opacity-40">📄</div>
        <div className="text-[0.85rem] text-text-muted">Este inquilino no tiene contrato activo</div>
      </div>
    );
  }

  const status = statusLabel[contrato.status] ?? { label: contrato.status, cls: "bg-surface-highest text-text-muted border-border" };
  const duracion = calcularDuracionMeses(contrato.startDate, contrato.endDate);

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Mini card de contrato — clickeable para navegar */}
      <div
        className="bg-surface-mid border border-blue/20 rounded-[8px] px-4 py-3.5 flex items-center gap-4 cursor-pointer hover:border-blue/40 hover:bg-blue/5 transition-all"
        onClick={() => router.push(`/contratos/${contrato.id}`)}
      >
        <div className="w-9 h-9 bg-blue/10 rounded-[8px] flex items-center justify-center text-base flex-shrink-0">
          📄
        </div>
        <div className="flex-1">
          <div className="text-[0.8rem] font-semibold text-blue">{contrato.contractNumber}</div>
          <div className="text-[0.75rem] text-text-muted mt-0.5">
            Vigente desde {formatFecha(contrato.startDate)} · Vence {formatFecha(contrato.endDate)}
          </div>
        </div>
        <span
          className={`text-[0.7rem] font-semibold px-2.5 py-1 rounded-full border ${status.cls}`}
        >
          {status.label}
        </span>
        <span className="text-text-muted text-lg ml-1">›</span>
      </div>

      {/* Resumen del contrato */}
      <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <div className="text-[0.82rem] font-semibold text-on-bg">Resumen del contrato</div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
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
        </div>
      </div>
    </div>
  );
}
