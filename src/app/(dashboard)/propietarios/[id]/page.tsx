"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { PropietarioCompletitudBar } from "@/components/propietarios/propietario-completitud-bar";
import { PropietarioTabDatos } from "@/components/propietarios/propietario-tab-datos";
import { PropietarioTabCuentaCorriente } from "@/components/propietarios/propietario-tab-cuenta-corriente";
import { PropietarioTabPropiedades } from "@/components/propietarios/propietario-tab-propiedades";
import { PropietarioTabDocumentos } from "@/components/propietarios/propietario-tab-documentos";

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

interface PropertyData {
  id: string;
  title: string | null;
  address: string;
  price: string | null;
  type: string;
  status: string;
  zone: string | null;
  floorUnit: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  ownerId: string;
}

interface ContratoActivo {
  id: string;
  contractNumber: string;
  propertyId: string;
  status: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyAmount: string;
}

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Tab = "datos" | "cuenta-corriente" | "propiedades" | "documentos";

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

  const { data, isLoading, error } = useQuery<{
    propietario: Propietario;
    propiedades: PropertyData[];
    contratosActivos: ContratoActivo[];
  }>({
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
    <>
      {isLoading ? (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-text-muted" />
        </div>
      ) : error || !propietario ? (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-text-muted">
          <div className="text-sm">{(error as Error)?.message ?? "Propietario no encontrado"}</div>
          <Link
            href="/propietarios"
            className="text-[0.72rem] text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver a la lista
          </Link>
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          {/* Topbar / breadcrumb */}
          <div className="h-14 bg-surface border-b border-border flex items-center px-7 gap-2.5 flex-shrink-0">
            <Link
              href="/propietarios"
              className="text-[0.8rem] text-text-secondary hover:text-primary transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              Propietarios
            </Link>
            <span className="text-text-muted">›</span>
            <span className="text-[0.8rem] font-semibold text-on-bg">
              {propietario.lastName
                ? `${propietario.firstName} ${propietario.lastName}`
                : propietario.firstName}
            </span>
          </div>

          {/* Profile header */}
          <div className="bg-surface border-b border-border px-7 py-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="size-12 rounded-[12px] bg-primary-dark flex items-center justify-center text-[1rem] font-extrabold text-white font-brand flex-shrink-0">
                {getInitials(propietario.firstName, propietario.lastName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[1.3rem] font-bold text-on-bg font-headline tracking-[-0.02em]">
                    {propietario.lastName
                      ? `${propietario.firstName} ${propietario.lastName}`
                      : propietario.firstName}
                  </h1>
                  <StatusBadge
                    variant={
                      propietario.status === "activo"
                        ? "active"
                        : propietario.status === "suspendido"
                        ? "suspended"
                        : "baja"
                    }
                  >
                    {propietario.status === "activo"
                      ? "Activo"
                      : propietario.status === "suspendido"
                      ? "Suspendido"
                      : "Baja"}
                  </StatusBadge>
                  {propietario.dni && (
                    <span className="text-[0.72rem] text-text-muted">
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
          <div className="bg-surface border-b border-border px-7">
            <div className="flex gap-0">
              {[
                { key: "datos" as Tab, label: "Datos" },
                { key: "cuenta-corriente" as Tab, label: "Cuenta corriente" },
                { key: "propiedades" as Tab, label: "Propiedades" },
                { key: "documentos" as Tab, label: "Documentos" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-4 py-3 text-[0.8rem] font-semibold border-b-2 transition-all",
                    activeTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted hover:text-text-secondary"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-bg">
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
            {activeTab === "propiedades" && (
              <PropietarioTabPropiedades
                propietarioId={propietario.id}
                propiedades={data?.propiedades ?? []}
                contratosActivos={data?.contratosActivos ?? []}
              />
            )}
            {activeTab === "documentos" && (
              <PropietarioTabDocumentos
                propietarioId={propietario.id}
                propietarioName={
                  propietario.lastName
                    ? `${propietario.firstName} ${propietario.lastName}`
                    : propietario.firstName
                }
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
