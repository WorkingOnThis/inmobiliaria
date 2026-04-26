"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, MoreHorizontal, Bell, ChevronRight, PlusCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTabData } from "@/components/tenants/tenant-tab-data";
import { TenantTabContract } from "@/components/tenants/tenant-tab-contract";
import { TenantTabProperty } from "@/components/tenants/tenant-tab-property";
import { TenantTabCurrentAccount } from "@/components/tenants/tenant-tab-current-account";
import { TenantTabDocuments } from "@/components/tenants/tenant-tab-documents";
import { ClientRolesBadges } from "@/components/clients/client-roles-badges";
import { RoleToggle } from "@/components/clients/role-toggle";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressZone: string | null;
  addressCity: string | null;
  addressProvince: string | null;
  birthDate: string | null;
  condicionFiscal: string | null;
  nationality: string | null;
  occupation: string | null;
  internalNotes: string | null;
  status: string;
  estado: string;
  diasMora: number;
  createdAt: string;
}

interface Contrato {
  id: string;
  contractNumber: string;
  propertyId: string;
  propertyAddress: string | null;
  ownerId: string;
  status: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyAmount: string;
  depositAmount: string | null;
  agencyCommission: string | null;
  managementCommissionPct: string | null;
  paymentDay: number;
  paymentModality: string;
  adjustmentIndex: string;
  adjustmentFrequency: number;
}

interface PropertyData {
  id: string;
  address: string;
  type: string;
  rentalStatus: string;
  saleStatus: string | null;
  floorUnit: string | null;
  zone: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  rentalPrice: string | null;
  rentalPriceCurrency: string;
  salePrice: string | null;
  salePriceCurrency: string;
  title: string | null;
}

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Tab = "datos" | "contrato" | "propiedad" | "cuenta-corriente" | "documentos" | "historial";

const estadoVariantMap: Record<string, { variant: "active" | "suspended" | "baja" | "draft" | "expiring" | "reserved"; label: string }> = {
  activo:       { variant: "active",    label: "Activo" },
  en_mora:      { variant: "baja",      label: "En mora" },
  por_vencer:   { variant: "expiring",  label: "Por vencer" },
  sin_contrato: { variant: "draft",     label: "Sin contrato" },
};

function computeCompletitud(t: Tenant) {
  const fields = [
    { weight: 2,   value: t.dni },
    { weight: 2,   value: t.cuit },
    { weight: 1.5, value: t.phone },
    { weight: 1.5, value: t.email },
    { weight: 1.5, value: t.condicionFiscal },
    { weight: 1,   value: t.address },
    { weight: 0.5, value: t.birthDate },
    { weight: 0.5, value: t.nationality },
    { weight: 0.5, value: t.occupation },
    { weight: 0.5, value: t.internalNotes },
  ];
  const total = fields.reduce((s, f) => s + f.weight, 0);
  const done  = fields.reduce((s, f) => s + (f.value ? f.weight : 0), 0);
  return {
    pct: Math.round((done / total) * 100),
    missingCount: fields.filter((f) => !f.value).length,
  };
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const activeTab = (searchParams.get("tab") as Tab) ?? "cuenta-corriente";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/inquilinos/${id}?${params.toString()}`, { scroll: false });
  };

  const { data, isLoading, error } = useQuery<{
    tenant: Tenant;
    contrato: Contrato | null;
    contratos: Contrato[];
    property: PropertyData | null;
    owner: { id: string; firstName: string; lastName: string | null } | null;
    movimientos: unknown[];
    guarantees: unknown[];
  } | null>({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el inquilino");
      }
      return res.json();
    },
  });

  const tenant = data?.tenant;

  const handleDataChange = () => {
    queryClient.invalidateQueries({ queryKey: ["tenant", id] });
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "datos",           label: "Datos" },
    { key: "contrato",        label: "Contrato" },
    { key: "propiedad",       label: "Propiedad" },
    { key: "cuenta-corriente",label: "Cuenta corriente" },
    { key: "documentos",      label: "Documentos" },
    { key: "historial",       label: "Historial" },
  ];

  return (
    <>
      {isLoading ? (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !tenant ? (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="text-sm">{(error as Error)?.message ?? "Inquilino no encontrado"}</div>
          <Link
            href="/inquilinos"
            className="text-[0.72rem] text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver a la lista
          </Link>
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          {/* Page head */}
          <div className="px-6 pt-5 pb-0 bg-bg border-b border-border">
            {/* Tenant row */}
            <div className="flex items-start justify-between gap-6 mb-4">
              <div className="flex items-center gap-4">
                <Avatar
                  className="size-14 rounded-[12px] flex-shrink-0"
                  style={{ boxShadow: "inset 0 0 0 1px var(--inset-highlight)" }}
                >
                  <AvatarFallback
                    className="text-[1.375rem] font-bold text-white rounded-[12px]"
                    style={{ background: "var(--gradient-tenant)" }}
                  >
                    {getInitials(tenant.firstName, tenant.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1
                    className="text-[1.375rem] font-bold text-on-bg font-headline"
                    style={{ letterSpacing: "-0.015em" }}
                  >
                    {tenant.lastName
                      ? `${tenant.firstName} ${tenant.lastName}`
                      : tenant.firstName}
                  </h1>
                  <div className="flex items-center flex-wrap gap-2.5 mt-1">
                    <Badge
                      variant={estadoVariantMap[tenant.estado]?.variant ?? "draft"}
                      className="normal-case font-medium text-[0.75rem] tracking-normal gap-1.5"
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full bg-current flex-shrink-0",
                          tenant.estado === "activo" && "animate-pulse"
                        )}
                      />
                      {estadoVariantMap[tenant.estado]?.label ?? tenant.estado}
                    </Badge>
                    {tenant.dni && (
                      <span className="text-[0.72rem] text-muted-foreground font-mono">
                        DNI {tenant.dni}
                      </span>
                    )}
                    <ClientRolesBadges clientId={tenant.id} currentRole="tenant" />
                    <RoleToggle clientId={tenant.id} currentRole="inquilino" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal size={15} />
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={`/contratos/nuevo?tenantId=${tenant.id}`}>
                    <PlusCircle size={13} /> Agregar contrato
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bell size={13} /> Notificar
                </Button>
              </div>
            </div>

            {/* Completitud chip — hidden on datos tab */}
            {(() => {
              const { pct, missingCount } = computeCompletitud(tenant);
              return activeTab !== "datos" && missingCount > 0 ? (
                <button
                  onClick={() => { setTab("datos"); setPendingFocus(null); }}
                  className="mb-4 inline-flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-border bg-surface-mid text-left hover:border-primary transition-colors"
                >
                  <div
                    className="size-9 rounded-full grid place-items-center relative flex-shrink-0"
                    style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--border) 0)` }}
                  >
                    <div className="absolute size-[27px] rounded-full bg-bg" />
                    <span className="relative z-10 text-[10.5px] font-bold font-mono">{pct}%</span>
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10.5px] uppercase tracking-[.06em] text-muted-foreground">Completitud de ficha</span>
                    <span className="text-[12.5px] mt-0.5 text-on-surface">
                      <b className="text-primary font-semibold">{missingCount} pts</b> pendientes
                    </span>
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground ml-1" />
                </button>
              ) : null;
            })()}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList
                variant="line"
                className="w-full justify-start h-auto rounded-none bg-transparent p-0 gap-0"
              >
                {tabs.map(({ key, label, count }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="px-4 py-3 text-[0.8rem] gap-2 rounded-none flex-none after:bg-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {label}
                    {count !== undefined && count > 0 && (
                      <Badge className="font-mono text-[11px] px-[7px] py-[2px] h-auto rounded-[4px] bg-surface-mid border-border normal-case tracking-normal font-normal leading-none">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-bg">
            {activeTab === "datos" && (
              <TenantTabData
                tenant={tenant}
                onStatusChange={handleDataChange}
                focusField={pendingFocus}
                onFocusHandled={() => setPendingFocus(null)}
              />
            )}
            {activeTab === "contrato" && (
              <TenantTabContract
                contrato={data?.contrato ?? null}
                contratos={data?.contratos ?? []}
                property={data?.property ?? null}
                owner={data?.owner ?? null}
                tenantId={tenant.id}
                guarantees={(data?.guarantees ?? []) as Parameters<typeof TenantTabContract>[0]["guarantees"]}
              />
            )}
            {activeTab === "propiedad" && (
              <TenantTabProperty
                property={data?.property ?? null}
                ownerName={
                  data?.owner
                    ? data.owner.lastName
                      ? `${data.owner.firstName} ${data.owner.lastName}`
                      : data.owner.firstName
                    : undefined
                }
                onVerOwner={() => setTab("contrato")}
              />
            )}
            {activeTab === "cuenta-corriente" && (
              <TenantTabCurrentAccount
                inquilinoId={tenant.id}
              />
            )}
            {activeTab === "documentos" && (
              <TenantTabDocuments
                tenantId={tenant.id}
                tenantName={
                  tenant.lastName
                    ? `${tenant.firstName} ${tenant.lastName}`
                    : tenant.firstName
                }
              />
            )}
            {activeTab === "historial" && (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Historial próximamente
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
