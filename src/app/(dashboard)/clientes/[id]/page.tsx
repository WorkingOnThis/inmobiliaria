// src/app/(dashboard)/clientes/[id]/page.tsx
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Building2, Home } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleToggle } from "@/components/clients/role-toggle";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PeriodEntry {
  period: string;
  estado: string;
  amount: number;
}

interface ContractGroup {
  contractId: string;
  contractNumber: string;
  propertyAddress: string;
  tenantName?: string;
  periods: PeriodEntry[];
  subtotal: number;
}

interface RoleGroup {
  contracts: ContractGroup[];
  total: number;
}

interface ResumenData {
  client: { id: string; firstName: string; lastName: string | null };
  from: string;
  to: string;
  asTenant: RoleGroup | null;
  asOwner: RoleGroup | null;
  net: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatARS(amount: number) {
  return `$${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPeriod(period: string) {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

const ESTADO_LABELS: Record<string, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  en_mora: "En mora",
  pago_parcial: "Pago parcial",
  proyectado: "Proyectado",
};

const ESTADO_VARIANT: Record<string, "active" | "baja" | "draft" | "expiring" | "secondary"> = {
  pagado: "active",
  pendiente: "draft",
  en_mora: "baja",
  pago_parcial: "expiring",
  proyectado: "secondary",
};

// ─── Period presets ───────────────────────────────────────────────────────────

function buildPreset(monthsBack: number): { from: string; to: string } {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fromDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;
  return { from, to };
}

const PRESETS = [
  { label: "Último mes", value: "1m", ...buildPreset(1) },
  { label: "Últimos 3 meses", value: "3m", ...buildPreset(3) },
  { label: "Últimos 6 meses", value: "6m", ...buildPreset(6) },
  { label: "Último año", value: "12m", ...buildPreset(12) },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PeriodRow({ entry }: { entry: PeriodEntry }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground w-24 flex-shrink-0">
        {formatPeriod(entry.period)}
      </span>
      <Badge
        variant={ESTADO_VARIANT[entry.estado] ?? "secondary"}
        className="normal-case font-normal text-xs w-28 justify-center"
      >
        {ESTADO_LABELS[entry.estado] ?? entry.estado}
      </Badge>
      <span className="font-mono text-right flex-1 pl-4">
        {formatARS(entry.amount)}
      </span>
    </div>
  );
}

function ContractCard({ contract, showTenant = false }: { contract: ContractGroup; showTenant?: boolean }) {
  return (
    <div className="border border-border rounded-lg px-4 py-3 space-y-1">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium">{contract.propertyAddress}</p>
          <p className="text-xs text-muted-foreground">
            Contrato #{contract.contractNumber}
            {showTenant && contract.tenantName && ` · Inq: ${contract.tenantName}`}
          </p>
        </div>
        <span className="text-sm font-semibold font-mono text-right flex-shrink-0">
          {formatARS(contract.subtotal)}
        </span>
      </div>
      <div className="divide-y divide-border">
        {contract.periods.map((p) => (
          <PeriodRow key={p.period} entry={p} />
        ))}
      </div>
    </div>
  );
}

function RoleSection({
  title,
  icon,
  group,
  showTenant = false,
  linkHref,
}: {
  title: string;
  icon: React.ReactNode;
  group: RoleGroup;
  showTenant?: boolean;
  linkHref: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold font-mono">{formatARS(group.total)}</span>
          <Button variant="outline" size="sm" asChild>
            <Link href={linkHref}>Ver cuenta</Link>
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {group.contracts.map((c) => (
          <ContractCard key={c.contractId} contract={c} showTenant={showTenant} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientResumenPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const preset = searchParams.get("preset") ?? "3m";
  const selectedPreset = PRESETS.find((p) => p.value === preset) ?? PRESETS[1];

  const { data, isLoading, error } = useQuery<ResumenData>({
    queryKey: ["client-resumen", id, selectedPreset.from, selectedPreset.to],
    queryFn: async () => {
      const res = await fetch(
        `/api/clients/${id}/resumen?from=${selectedPreset.from}&to=${selectedPreset.to}`
      );
      if (!res.ok) throw new Error("Error al cargar el resumen");
      return res.json();
    },
  });

  function setPreset(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", value);
    router.replace(`/clientes/${id}?${params.toString()}`, { scroll: false });
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <p className="text-sm">{(error as Error)?.message ?? "Cliente no encontrado"}</p>
        <Link href="/clientes" className="text-xs text-primary hover:underline flex items-center gap-1">
          <ArrowLeft size={12} /> Volver
        </Link>
      </div>
    );
  }

  const { client, asTenant, asOwner } = data;
  const hasMultipleRoles = asTenant !== null && asOwner !== null;
  const net = hasMultipleRoles ? asOwner!.total - asTenant!.total : null;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border bg-bg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              className="size-14 rounded-[12px] flex-shrink-0"
              style={{ boxShadow: "inset 0 0 0 1px var(--inset-highlight)" }}
            >
              <AvatarFallback
                className="text-[1.375rem] font-bold text-white rounded-[12px]"
                style={{ background: "var(--gradient-tenant)" }}
              >
                {getInitials(client.firstName, client.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1
                className="text-[1.375rem] font-bold text-on-bg font-headline"
                style={{ letterSpacing: "-0.015em" }}
              >
                {client.lastName
                  ? `${client.firstName} ${client.lastName}`
                  : client.firstName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <RoleToggle clientId={id} currentRole="resumen" />
              </div>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex-shrink-0 pt-1">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 space-y-8 max-w-3xl">
        {!asTenant && !asOwner && (
          <p className="text-sm text-muted-foreground">
            No hay movimientos en el período seleccionado.
          </p>
        )}

        {asTenant && (
          <RoleSection
            title="Como inquilino"
            icon={<Home size={15} className="text-muted-foreground" />}
            group={asTenant}
            linkHref={`/inquilinos/${id}`}
          />
        )}

        {asOwner && (
          <RoleSection
            title="Como propietario"
            icon={<Building2 size={15} className="text-muted-foreground" />}
            group={asOwner}
            showTenant
            linkHref={`/propietarios/${id}`}
          />
        )}

        {hasMultipleRoles && net !== null && (
          <div className="border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Total neto
            </h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cobró como propietario</span>
                <span className="font-mono text-income">+{formatARS(asOwner!.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Debe como inquilino</span>
                <span className="font-mono text-destructive">-{formatARS(asTenant!.total)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                <span>Resultado</span>
                <span className={`font-mono ${net >= 0 ? "text-income" : "text-destructive"}`}>
                  {net >= 0 ? "+" : ""}{formatARS(net)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
