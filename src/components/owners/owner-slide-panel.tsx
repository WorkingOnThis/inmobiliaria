"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Owner {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  dni: string | null;
  cbu: string | null;
  status: string;
  propiedadesCount: number;
  contratosActivosCount: number;
}

interface CuentaCorrienteData {
  kpis: {
    liquidadoAcumulado: number;
    proximaLiquidacionEstimada: number;
    pendienteConfirmar: number;
  };
  movimientos: Array<{
    id: string;
    fecha: string;
    descripcion: string;
    tipo: string;
    monto: string;
    origen: string;
    propiedadAddress: string | null;
    periodo: string | null;
  }>;
}

interface OwnerSlidePanelProps {
  owner: Owner | null;
  open: boolean;
  onClose: () => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function getInitials(firstName: string, lastName: string | null) {
  const parts = [firstName, lastName].filter(Boolean);
  return parts
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function OwnerSlidePanel({
  owner,
  open,
  onClose,
}: OwnerSlidePanelProps) {
  const router = useRouter();

  const { data: ccData, isLoading: ccLoading } = useQuery<CuentaCorrienteData>({
    queryKey: ["owner-cc", owner?.id],
    queryFn: async () => {
      const res = await fetch(`/api/owners/${owner!.id}/cuenta-corriente`);
      if (!res.ok) throw new Error("Error al cargar cuenta corriente");
      return res.json();
    },
    enabled: !!owner?.id && open,
  });

  const handleVerFicha = () => {
    if (owner) router.push(`/owners/${owner.id}`);
  };

  // Últimas 3 liquidaciones del historial
  const ultimasLiquidaciones =
    ccData?.movimientos
      .filter((m) => m.origen === "liquidacion")
      .slice(0, 3) ?? [];

  return (
    <>
      {/* Overlay para cerrar al hacer click afuera */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] bg-surface border-l border-white/7 z-50 flex flex-col transition-transform duration-[280ms] cubic-bezier-[0.4,0,0.2,1] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        {!owner ? null : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-white/7 bg-card flex-shrink-0">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-[12px] bg-primary-dark flex items-center justify-center text-[0.85rem] font-extrabold text-white font-brand flex-shrink-0">
                  {getInitials(owner.firstName, owner.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface text-[0.95rem] leading-tight truncate">
                    {owner.lastName
                      ? `${owner.lastName}, ${owner.firstName}`
                      : owner.firstName}
                  </div>
                  {owner.dni && (
                    <div className="text-[0.68rem] text-text-muted mt-1">
                      DNI {owner.dni}
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-on-surface hover:bg-surface-high rounded-[6px] p-1 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-4 mt-3 flex-wrap">
                {owner.phone && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                      Teléfono
                    </span>
                    <span className="text-[0.75rem] text-text-secondary">{owner.phone}</span>
                  </div>
                )}
                {owner.cbu ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                      CBU
                    </span>
                    <span className="text-[0.72rem] text-text-secondary font-mono tracking-[0.02em]">
                      {owner.cbu.slice(0, 8)}…
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                      CBU
                    </span>
                    <span className="text-[0.72rem] text-mustard italic">Sin CBU</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                    Propiedades
                  </span>
                  <span className="text-[0.75rem] text-text-secondary">
                    {owner.propiedadesCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {ccLoading ? (
                <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                  Cargando…
                </div>
              ) : ccData ? (
                <>
                  {/* Período actual */}
                  <div className="p-4 border-b border-white/7">
                    <div className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-text-muted flex items-center gap-2 mb-3">
                      <span className="w-3 h-0.5 bg-primary rounded-sm block" />
                      Período actual
                    </div>
                    <div className="bg-surface-mid border border-white/7 rounded-[12px] p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[0.68rem] font-semibold text-text-secondary uppercase tracking-[0.06em]">
                            A liquidar
                          </div>
                          <div className="text-[1.3rem] font-bold text-on-surface font-headline">
                            {formatMoney(ccData.kpis.proximaLiquidacionEstimada)}
                          </div>
                          <div className="text-[0.65rem] text-text-muted mt-0.5">
                            Ingresos pendientes de liquidación
                          </div>
                        </div>
                      </div>
                    </div>

                    {ccData.kpis.pendienteConfirmar > 0 && (
                      <div className="flex items-center justify-between py-2 border-b border-white/7">
                        <div>
                          <div className="text-[0.78rem] text-mustard font-medium">
                            ⏳ Pendiente de confirmar
                          </div>
                          <div className="text-[0.65rem] text-text-muted mt-0.5">
                            Transferencia sin confirmar
                          </div>
                        </div>
                        <div className="text-[0.9rem] font-bold text-mustard font-headline">
                          {formatMoney(ccData.kpis.pendienteConfirmar)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Historial */}
                  <div className="p-4 border-b border-white/7">
                    <div className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-text-muted flex items-center gap-2 mb-3">
                      <span className="w-3 h-0.5 bg-primary rounded-sm block" />
                      Historial
                    </div>

                    {ultimasLiquidaciones.length === 0 ? (
                      <div className="text-[0.75rem] text-text-muted italic">
                        Sin liquidaciones registradas
                      </div>
                    ) : (
                      <div>
                        {ultimasLiquidaciones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-start gap-2.5 py-2.5 border-b border-white/7 last:border-0"
                          >
                            <div className="size-2 rounded-full bg-green mt-1 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-[0.78rem] font-semibold text-on-surface">
                                {m.descripcion}
                              </div>
                              <div className="text-[0.65rem] text-text-muted mt-0.5">
                                {m.fecha
                                  ? format(new Date(m.fecha), "dd/MM/yyyy", { locale: es })
                                  : "—"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[0.88rem] font-bold text-on-surface font-headline">
                                {formatMoney(Number(m.monto))}
                              </div>
                              <Badge variant="income" className="mt-1">Liquidado</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-[0.68rem] text-text-muted">
                      Acumulado {new Date().getFullYear()}:{" "}
                      <span className="text-on-surface font-semibold">
                        {formatMoney(ccData.kpis.liquidadoAcumulado)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                  Sin datos
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-white/7 bg-card flex flex-col gap-2 flex-shrink-0">
              <Button onClick={handleVerFicha} className="w-full">
                Ver ficha completa
                <ChevronRight size={14} />
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
