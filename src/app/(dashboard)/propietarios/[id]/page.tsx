"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, MoreHorizontal, Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerTabData } from "@/components/owners/owner-tab-data";
import { OwnerTabCurrentAccount } from "@/components/owners/owner-tab-current-account";
import { OwnerTabProperties } from "@/components/owners/owner-tab-properties";
import { OwnerTabDocuments } from "@/components/owners/owner-tab-documents";
import { ClientRolesBadges } from "@/components/clients/client-roles-badges";

interface Owner {
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
  bank: string | null;
  accountType: string | null;
  condicionFiscal: string | null;
  nationality: string | null;
  occupation: string | null;
  internalNotes: string | null;
  confianzaNombre: string | null;
  confianzaApellido: string | null;
  confianzaDni: string | null;
  confianzaEmail: string | null;
  confianzaTelefono: string | null;
  confianzaVinculo: string | null;
  status: string;
  createdAt: string;
}

interface PropertyData {
  id: string;
  title: string | null;
  address: string;
  rentalPrice: string | null;
  rentalPriceCurrency: string;
  salePrice: string | null;
  salePriceCurrency: string;
  type: string;
  rentalStatus: string;
  saleStatus: string | null;
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

type Tab = "datos" | "cuenta-corriente" | "propiedades" | "documentos" | "historial";

const statusVariantMap: Record<string, { variant: "active" | "suspended" | "baja" | "draft"; label: string }> = {
  activo:     { variant: "active",    label: "Activo" },
  suspendido: { variant: "suspended", label: "Suspendido" },
  baja:       { variant: "baja",      label: "Baja" },
};

function computeCompletitud(p: Owner) {
  const fields = [
    { weight: 3,   value: p.cbu },
    { weight: 2,   value: p.dni },
    { weight: 2,   value: p.cuit },
    { weight: 1.5, value: p.condicionFiscal },
    { weight: 1.5, value: p.phone },
    { weight: 1.5, value: p.email },
    { weight: 1,   value: p.alias },
    { weight: 1,   value: p.bank },
    { weight: 1,   value: p.accountType },
    { weight: 1,   value: p.address },
    { weight: 0.5, value: p.birthDate },
    { weight: 0.5, value: p.nationality },
    { weight: 0.5, value: p.occupation },
    { weight: 0.5, value: p.internalNotes },
  ];
  const total = fields.reduce((s, f) => s + f.weight, 0);
  const done  = fields.reduce((s, f) => s + (f.value ? f.weight : 0), 0);
  return {
    pct: Math.round((done / total) * 100),
    missingCount: fields.filter((f) => !f.value).length,
  };
}

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const activeTab = (searchParams.get("tab") as Tab) ?? "cuenta-corriente";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/propietarios/${id}?${params.toString()}`, { scroll: false });
  };

  const { data, isLoading, error } = useQuery<{
    owner: Owner;
    propiedades: PropertyData[];
    contratosActivos: ContratoActivo[];
  }>({
    queryKey: ["propietario", id],
    queryFn: async () => {
      const res = await fetch(`/api/owners/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el propietario");
      }
      return res.json();
    },
  });

  const owner = data?.owner;
  const propiedadesCount = data?.propiedades?.length ?? 0;
  const [ccPendingCount, setCcPendingCount] = useState(0);

  const handleStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: ["propietario", id] });
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "cuenta-corriente", label: "Cuenta corriente", count: ccPendingCount },
    { key: "datos",            label: "Datos" },
    { key: "propiedades",      label: "Propiedades", count: propiedadesCount },
    { key: "documentos",       label: "Documentos",  count: 0 },
    { key: "historial",        label: "Historial" },
  ];

  return (
    <>
      {isLoading ? (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !owner ? (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
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
          {/* Page head */}
          <div className="px-6 pt-5 pb-0 bg-bg border-b border-border">
            {/* Owner row */}
            <div className="flex items-start justify-between gap-6 mb-4">
              <div className="flex items-center gap-4">
                <Avatar
                  className="size-14 rounded-[12px] flex-shrink-0"
                  style={{ boxShadow: "inset 0 0 0 1px var(--inset-highlight)" }}
                >
                  <AvatarFallback
                    className="text-[1.375rem] font-bold text-white rounded-[12px]"
                    style={{ background: "var(--gradient-owner)" }}
                  >
                    {getInitials(owner.firstName, owner.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1
                    className="text-[1.375rem] font-bold text-on-bg font-headline"
                    style={{ letterSpacing: "-0.015em" }}
                  >
                    {owner.lastName
                      ? `${owner.firstName} ${owner.lastName}`
                      : owner.firstName}
                  </h1>
                  <div className="flex items-center flex-wrap gap-2.5 mt-1">
                    <Badge
                      variant={statusVariantMap[owner.status]?.variant ?? "draft"}
                      className="normal-case font-medium text-[0.75rem] tracking-normal gap-1.5"
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full bg-current flex-shrink-0",
                          owner.status === "activo" && "animate-pulse"
                        )}
                      />
                      {statusVariantMap[owner.status]?.label ?? owner.status}
                    </Badge>
                    {owner.dni && (
                      <span className="text-[0.72rem] text-muted-foreground font-mono">
                        DNI {owner.dni}
                      </span>
                    )}
                    <ClientRolesBadges clientId={owner.id} currentRole="owner" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal size={15} />
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bell size={13} /> Notificar
                </Button>
              </div>
            </div>

            {/* Compact completitud chip — only on cuenta-corriente */}
            {(() => {
              const { pct, missingCount } = computeCompletitud(owner);
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
              <OwnerTabData
                owner={owner}
                onStatusChange={handleStatusChange}
                focusField={pendingFocus}
                onFocusHandled={() => setPendingFocus(null)}
              />
            )}
            {activeTab === "cuenta-corriente" && (
              <OwnerTabCurrentAccount ownerId={owner.id} onPendingCount={setCcPendingCount} />
            )}
            {activeTab === "propiedades" && (
              <OwnerTabProperties
                ownerId={owner.id}
                propiedades={data?.propiedades ?? []}
                contratosActivos={data?.contratosActivos ?? []}
              />
            )}
            {activeTab === "documentos" && (
              <OwnerTabDocuments
                ownerId={owner.id}
                ownerName={
                  owner.lastName
                    ? `${owner.firstName} ${owner.lastName}`
                    : owner.firstName
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
