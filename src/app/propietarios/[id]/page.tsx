"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PropietarioCompletitudBar } from "@/components/propietarios/propietario-completitud-bar";
import { PropietarioTabDatos } from "@/components/propietarios/propietario-tab-datos";
import { PropietarioTabCuentaCorriente } from "@/components/propietarios/propietario-tab-cuenta-corriente";

interface Propietario {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  birthDate: string | null;
  cbu: string | null;
  alias: string | null;
  banco: string | null;
  tipoCuenta: string | null;
  status: string;
  createdAt: string;
}

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Tab = "datos" | "cuenta-corriente";

export default function PropietarioFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const activeTab = (searchParams.get("tab") as Tab) ?? "datos";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/propietarios/${id}?${params.toString()}`, { scroll: false });
  };

  const { data, isLoading, error } = useQuery<{ propietario: Propietario }>({
    queryKey: ["propietario", id],
    queryFn: async () => {
      const res = await fetch(`/api/propietarios/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el propietario");
      }
      return res.json();
    },
  });

  const propietario = data?.propietario;

  const handleChipClick = (fieldId: string) => {
    setTab("datos");
    setPendingFocus(fieldId);
  };

  const handleStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: ["propietario", id] });
  };

  return (
    <DashboardLayout>
      {isLoading ? (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#6b6d70]" />
        </div>
      ) : error || !propietario ? (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-[#6b6d70]">
          <div className="text-sm">{(error as Error)?.message ?? "Propietario no encontrado"}</div>
          <button
            onClick={() => router.push("/propietarios")}
            className="text-[0.72rem] text-[#ffb4a2] hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver a la lista
          </button>
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          {/* Topbar / breadcrumb */}
          <div className="h-14 bg-[#191c1e] border-b border-white/[0.07] flex items-center px-7 gap-2.5 flex-shrink-0">
            <button
              onClick={() => router.push("/propietarios")}
              className="text-[0.8rem] text-[#a8a9ac] hover:text-[#ffb4a2] transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              Propietarios
            </button>
            <span className="text-[#6b6d70]">›</span>
            <span className="text-[0.8rem] font-semibold text-[#e1e2e4]">
              {propietario.lastName
                ? `${propietario.firstName} ${propietario.lastName}`
                : propietario.firstName}
            </span>
          </div>

          {/* Profile header */}
          <div className="bg-[#191c1e] border-b border-white/[0.07] px-7 py-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-[12px] bg-[#6b1702] flex items-center justify-center text-[1rem] font-extrabold text-white font-[Montserrat] flex-shrink-0">
                {getInitials(propietario.firstName, propietario.lastName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[1.3rem] font-bold text-[#e1e2e4] font-[Space_Grotesk] tracking-[-0.02em]">
                    {propietario.lastName
                      ? `${propietario.firstName} ${propietario.lastName}`
                      : propietario.firstName}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[0.6rem] font-bold rounded-full ${
                      propietario.status === "activo"
                        ? "bg-[rgba(127,211,160,0.12)] text-[#7fd3a0]"
                        : propietario.status === "suspendido"
                        ? "bg-[rgba(253,222,168,0.15)] text-[#ffdea8]"
                        : "bg-[#333537] text-[#6b6d70]"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current block" />
                    {propietario.status === "activo"
                      ? "Activo"
                      : propietario.status === "suspendido"
                      ? "Suspendido"
                      : "Baja"}
                  </span>
                  {propietario.dni && (
                    <span className="text-[0.72rem] text-[#6b6d70]">
                      DNI {propietario.dni}
                    </span>
                  )}
                </div>

                <PropietarioCompletitudBar
                  propietario={propietario}
                  onChipClick={handleChipClick}
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-[#191c1e] border-b border-white/[0.07] px-7">
            <div className="flex gap-0">
              {[
                { key: "datos" as Tab, label: "Datos" },
                { key: "cuenta-corriente" as Tab, label: "Cuenta corriente" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-3 text-[0.8rem] font-semibold border-b-2 transition-all ${
                    activeTab === key
                      ? "border-[#ffb4a2] text-[#ffb4a2]"
                      : "border-transparent text-[#6b6d70] hover:text-[#a8a9ac]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                disabled
                className="px-4 py-3 text-[0.8rem] font-semibold border-b-2 border-transparent text-[#333537] cursor-not-allowed"
                title="Próximamente"
              >
                Propiedades
              </button>
              <button
                disabled
                className="px-4 py-3 text-[0.8rem] font-semibold border-b-2 border-transparent text-[#333537] cursor-not-allowed"
                title="Próximamente"
              >
                Documentos
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-[#111314]">
            {activeTab === "datos" && (
              <PropietarioTabDatos
                propietario={propietario}
                onStatusChange={handleStatusChange}
                focusField={pendingFocus}
                onFocusHandled={() => setPendingFocus(null)}
              />
            )}
            {activeTab === "cuenta-corriente" && (
              <PropietarioTabCuentaCorriente propietarioId={propietario.id} />
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
