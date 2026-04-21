"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTabCurrentAccount } from "@/components/tenants/tenant-tab-current-account";
import { TenantTabContract } from "@/components/tenants/tenant-tab-contract";
import { TenantTabProperty } from "@/components/tenants/tenant-tab-property";
import { TenantTabOwner } from "@/components/tenants/tenant-tab-owner";
import { ServiceTabProperty } from "@/components/services/service-tab-property";
import { ClientRolesBadges } from "@/components/clients/client-roles-badges";

type Tab = "cc" | "contrato" | "property" | "propietario" | "servicios" | "tareas" | "documentos" | "notificaciones";

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMonto(val: string | number | null) {
  if (!val) return "—";
  return "$" + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

const estadoBadge: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  activo:          { label: "Tenant activo",  variant: "active" },
  en_mora:         { label: "En mora",         variant: "baja" },
  por_vencer:      { label: "Por vencer",      variant: "expiring" },
  sin_contrato:    { label: "Sin contrato",    variant: "draft" },
  pendiente_firma: { label: "Por firmar",      variant: "reserved" },
  historico:       { label: "Histórico",       variant: "draft" },
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as Tab) ?? "cc";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/inquilinos/${id}?${params.toString()}`, { scroll: false });
  };

  const { data, isLoading, error } = useQuery<{
    tenant: {
      id: string;
      firstName: string;
      lastName: string | null;
      dni: string | null;
      email: string | null;
      phone: string | null;
      status: string;
      estado: string;
      diasMora: number;
    };
    contrato: {
      id: string;
      contractNumber: string;
      status: string;
      contractType: string;
      startDate: string;
      endDate: string;
      monthlyAmount: string;
      depositAmount: string | null;
      agencyCommission: string | null;
      paymentDay: number;
      paymentModality: string;
      adjustmentIndex: string;
      adjustmentFrequency: number;
    } | null;
    property: {
      id: string;
      address: string;
      type: string;
      status: string;
      floorUnit: string | null;
      zone: string | null;
      rooms: number | null;
      bathrooms: number | null;
      surface: string | null;
      price: string | null;
      title: string | null;
    } | null;
    owner: {
      id: string;
      firstName: string;
      lastName: string | null;
      dni: string | null;
      email: string | null;
      phone: string | null;
      cbu: string | null;
      alias: string | null;
      bank: string | null;
      cuit: string | null;
      accountType: string | null;
    } | null;
    movimientos: {
      id: string;
      date: string;
      description: string;
      tipo: string;
      amount: string;
      categoria: string | null;
      comprobante: string | null;
      note: string | null;
      contratoId: string | null;
    }[];
  } | null>({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el tenant");
      }
      return res.json();
    },
  });

  const tenant = data?.tenant;
  const estadoInfo = estadoBadge[tenant?.estado ?? "sin_contrato"];

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "cc", label: "💰 Cuenta Corriente" },
    { key: "contrato", label: "📄 Contrato" },
    { key: "property", label: "🏢 Propiedad" },
    { key: "propietario", label: "🏠 Propietario" },
    { key: "servicios", label: "⚡ Servicios" },
    { key: "tareas", label: "✅ Tareas" },
    { key: "documentos", label: "📁 Documentos" },
    { key: "notificaciones", label: "🔔 Notificaciones" },
  ];

  return (
    <>
      {isLoading ? (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !tenant ? (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="text-[0.85rem]">
            {(error as Error)?.message ?? "Tenant no encontrado"}
          </div>
          <button
            onClick={() => router.push("/inquilinos")}
            className="text-[0.72rem] text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver a la lista
          </button>
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          {/* Breadcrumb */}
          <div className="h-14 bg-surface border-b border-border flex items-center px-7 gap-2.5 flex-shrink-0">
            <button
              onClick={() => router.push("/inquilinos")}
              className="text-[0.8rem] text-text-secondary hover:text-primary transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              Inquilinos
            </button>
            <span className="text-muted-foreground">›</span>
            <span className="text-[0.8rem] font-semibold text-on-bg">
              {tenant.lastName
                ? `${tenant.lastName}, ${tenant.firstName}`
                : tenant.firstName}
            </span>
          </div>

          {/* Perfil header */}
          <div className="bg-surface border-b border-border px-7 py-5">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="size-14 rounded-full bg-purple/10 border-2 border-purple/30 flex items-center justify-center font-headline text-[1.3rem] text-purple flex-shrink-0">
                {getInitials(tenant.firstName, tenant.lastName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-[1.3rem] font-bold text-on-bg font-headline tracking-[-0.02em] mb-1">
                  {tenant.lastName
                    ? `${tenant.firstName} ${tenant.lastName}`
                    : tenant.firstName}
                </h1>
                <div className="flex items-center flex-wrap gap-4 text-[0.78rem] text-text-secondary mb-3">
                  {tenant.email && <span>✉ {tenant.email}</span>}
                  {tenant.phone && <span>📱 {tenant.phone}</span>}
                  {tenant.dni && <span>🪪 DNI {tenant.dni}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge variant={estadoInfo.variant}>
                    {estadoInfo.label}
                  </StatusBadge>
                  {tenant.estado === "en_mora" && data?.tenant.diasMora ? (
                    <Badge variant="baja">
                      ⚠ {data.tenant.diasMora} días en mora
                    </Badge>
                  ) : null}
                  {data?.contrato && ["active", "expiring_soon"].includes(data.contrato.status) && (
                    <Badge variant="reserved">
                      Contrato vigente
                    </Badge>
                  )}
                  {data?.contrato?.adjustmentIndex && data.contrato.adjustmentIndex !== "none" && (
                    <Badge variant="secondary">
                      Índice {data.contrato.adjustmentIndex}
                    </Badge>
                  )}
                  <ClientRolesBadges clientId={tenant.id} currentRole="tenant" />
                </div>
              </div>

              {/* Stats */}
              <div className="flex border-l border-border pl-5 gap-0">
                <div className="px-5 text-center border-r border-border last:border-r-0">
                  <div className="font-headline text-[1.25rem] text-primary leading-none mb-1">
                    {data?.contrato ? formatMonto(data.contrato.monthlyAmount) : "—"}
                  </div>
                  <div className="text-[0.62rem] text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap">
                    Alquiler actual
                  </div>
                </div>
                {tenant.estado === "en_mora" && data?.contrato && (
                  <div className="px-5 text-center border-r border-border last:border-r-0">
                    <div className="font-headline text-[1.25rem] text-error leading-none mb-1">
                      {formatMonto(data.contrato.monthlyAmount)}
                    </div>
                    <div className="text-[0.62rem] text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap">
                      Deuda actual
                    </div>
                  </div>
                )}
                <div className="px-5 text-center border-r border-border last:border-r-0">
                  <div className="font-headline text-[1.25rem] text-on-bg leading-none mb-1">
                    {data?.movimientos.filter((m) => m.tipo === "income").length ?? 0}
                  </div>
                  <div className="text-[0.62rem] text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap">
                    Pagos registrados
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-surface border-b border-border px-7">
            <Tabs value={activeTab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList className="flex gap-0 overflow-x-auto bg-transparent p-0 h-auto rounded-none">
                {tabs.map(({ key, label }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="px-4 py-3 text-[0.8rem] font-semibold border-b-2 transition-all whitespace-nowrap rounded-none bg-transparent shadow-none data-[state=active]:border-purple data-[state=active]:text-purple data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground hover:text-text-secondary"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Contenido del tab activo */}
          <div className="flex-1 overflow-y-auto bg-bg">
            {activeTab === "cc" && (
              <TenantTabCurrentAccount
                tenantId={tenant.id}
                tenantName={
                  tenant.lastName
                    ? `${tenant.firstName} ${tenant.lastName}`
                    : tenant.firstName
                }
                estado={tenant.estado}
                diasMora={tenant.diasMora}
                contrato={data?.contrato ?? null}
                movimientos={data?.movimientos ?? []}
                propertyId={data?.property?.id ?? null}
              />
            )}

            {activeTab === "contrato" && (
              <TenantTabContract contrato={data?.contrato ?? null} />
            )}

            {activeTab === "property" && (
              <TenantTabProperty
                property={data?.property ?? null}
                ownerName={
                  data?.owner
                    ? data.owner.lastName
                      ? `${data.owner.firstName} ${data.owner.lastName}`
                      : data.owner.firstName
                    : undefined
                }
                onVerOwner={() => setTab("propietario")}
              />
            )}

            {activeTab === "propietario" && (
              <TenantTabOwner
                owner={data?.owner ?? null}
                contrato={data?.contrato ?? null}
              />
            )}

            {activeTab === "servicios" && data?.property?.id && (
              <div className="p-7">
                <ServiceTabProperty propertyId={data.property.id} />
              </div>
            )}
            {activeTab === "servicios" && !data?.property?.id && (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
                <div className="text-3xl opacity-30">⚡</div>
                <div className="text-[0.85rem]">Este tenant no tiene propiedad vinculada</div>
              </div>
            )}

            {(activeTab === "tareas" || activeTab === "documentos" || activeTab === "notificaciones") && (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
                <div className="text-3xl opacity-30">
                  {activeTab === "tareas" ? "✅" : activeTab === "documentos" ? "📁" : "🔔"}
                </div>
                <div className="text-[0.85rem]">
                  {activeTab === "tareas"
                    ? "Gestión de tareas"
                    : activeTab === "documentos"
                    ? "Documentación del tenant"
                    : "Notificaciones vinculadas"}{" "}
                  — próximamente
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
