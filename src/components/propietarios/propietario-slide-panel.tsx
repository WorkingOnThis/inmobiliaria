"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, User, Phone, CreditCard, Building2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Propietario {
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

interface PropietarioSlidePanelProps {
  propietario: Propietario | null;
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

export function PropietarioSlidePanel({
  propietario,
  open,
  onClose,
}: PropietarioSlidePanelProps) {
  const router = useRouter();

  const { data: ccData, isLoading: ccLoading } = useQuery<CuentaCorrienteData>({
    queryKey: ["propietario-cc", propietario?.id],
    queryFn: async () => {
      const res = await fetch(`/api/propietarios/${propietario!.id}/cuenta-corriente`);
      if (!res.ok) throw new Error("Error al cargar cuenta corriente");
      return res.json();
    },
    enabled: !!propietario?.id && open,
  });

  const handleVerFicha = () => {
    if (propietario) router.push(`/propietarios/${propietario.id}`);
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
        className={`fixed top-0 right-0 h-full w-[380px] bg-[#191c1e] border-l border-white/[0.07] z-50 flex flex-col transition-transform duration-[280ms] cubic-bezier-[0.4,0,0.2,1] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        {!propietario ? null : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-white/[0.07] bg-[#1d2022] flex-shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#6b1702] flex items-center justify-center text-[0.85rem] font-extrabold text-white font-[Montserrat] flex-shrink-0">
                  {getInitials(propietario.firstName, propietario.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#e1e2e4] text-[0.95rem] leading-tight truncate">
                    {propietario.lastName
                      ? `${propietario.lastName}, ${propietario.firstName}`
                      : propietario.firstName}
                  </div>
                  {propietario.dni && (
                    <div className="text-[0.68rem] text-[#6b6d70] mt-1">
                      DNI {propietario.dni}
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="text-[#6b6d70] hover:text-[#e1e2e4] hover:bg-[#282a2c] rounded-[6px] p-1 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-4 mt-3 flex-wrap">
                {propietario.phone && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70]">
                      Teléfono
                    </span>
                    <span className="text-[0.75rem] text-[#a8a9ac]">{propietario.phone}</span>
                  </div>
                )}
                {propietario.cbu ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70]">
                      CBU
                    </span>
                    <span className="text-[0.72rem] text-[#a8a9ac] font-mono tracking-[0.02em]">
                      {propietario.cbu.slice(0, 8)}…
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70]">
                      CBU
                    </span>
                    <span className="text-[0.72rem] text-[#ffdea8] italic">Sin CBU</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70]">
                    Propiedades
                  </span>
                  <span className="text-[0.75rem] text-[#a8a9ac]">
                    {propietario.propiedadesCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {ccLoading ? (
                <div className="flex items-center justify-center h-32 text-[#6b6d70] text-sm">
                  Cargando…
                </div>
              ) : ccData ? (
                <>
                  {/* Período actual */}
                  <div className="p-4 border-b border-white/[0.07]">
                    <div className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#6b6d70] flex items-center gap-2 mb-3">
                      <span className="w-3 h-0.5 bg-[#ffb4a2] rounded-sm block" />
                      Período actual
                    </div>
                    <div className="bg-[#222527] border border-white/[0.07] rounded-[12px] p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[0.68rem] font-semibold text-[#a8a9ac] uppercase tracking-[0.06em]">
                            A liquidar
                          </div>
                          <div className="text-[1.3rem] font-bold text-[#e1e2e4] font-[Space_Grotesk]">
                            {formatMoney(ccData.kpis.proximaLiquidacionEstimada)}
                          </div>
                          <div className="text-[0.65rem] text-[#6b6d70] mt-0.5">
                            Ingresos pendientes de liquidación
                          </div>
                        </div>
                      </div>
                    </div>

                    {ccData.kpis.pendienteConfirmar > 0 && (
                      <div className="flex items-center justify-between py-2 border-b border-white/[0.07]">
                        <div>
                          <div className="text-[0.78rem] text-[#ffdea8] font-medium">
                            ⏳ Pendiente de confirmar
                          </div>
                          <div className="text-[0.65rem] text-[#6b6d70] mt-0.5">
                            Transferencia sin confirmar
                          </div>
                        </div>
                        <div className="text-[0.9rem] font-bold text-[#ffdea8] font-[Space_Grotesk]">
                          {formatMoney(ccData.kpis.pendienteConfirmar)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Historial */}
                  <div className="p-4 border-b border-white/[0.07]">
                    <div className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#6b6d70] flex items-center gap-2 mb-3">
                      <span className="w-3 h-0.5 bg-[#ffb4a2] rounded-sm block" />
                      Historial
                    </div>

                    {ultimasLiquidaciones.length === 0 ? (
                      <div className="text-[0.75rem] text-[#6b6d70] italic">
                        Sin liquidaciones registradas
                      </div>
                    ) : (
                      <div>
                        {ultimasLiquidaciones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.07] last:border-0"
                          >
                            <div className="w-2 h-2 rounded-full bg-[#7fd3a0] mt-1 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-[0.78rem] font-semibold text-[#e1e2e4]">
                                {m.descripcion}
                              </div>
                              <div className="text-[0.65rem] text-[#6b6d70] mt-0.5">
                                {m.fecha
                                  ? format(new Date(m.fecha), "dd/MM/yyyy", { locale: es })
                                  : "—"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[0.88rem] font-bold text-[#e1e2e4] font-[Space_Grotesk]">
                                {formatMoney(Number(m.monto))}
                              </div>
                              <div className="text-[0.58rem] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(127,211,160,0.12)] text-[#7fd3a0] mt-1 inline-block">
                                Liquidado
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-[0.68rem] text-[#6b6d70]">
                      Acumulado {new Date().getFullYear()}:{" "}
                      <span className="text-[#e1e2e4] font-semibold">
                        {formatMoney(ccData.kpis.liquidadoAcumulado)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-32 text-[#6b6d70] text-sm">
                  Sin datos
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-white/[0.07] bg-[#1d2022] flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleVerFicha}
                className="w-full flex items-center justify-center gap-2 bg-[#ffb4a2] text-[#561100] text-[0.72rem] font-semibold px-3.5 py-2 rounded-[12px] hover:brightness-110 transition-all"
              >
                Ver ficha completa
                <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
