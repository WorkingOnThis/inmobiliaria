# Client Multi-Rol — Pantalla de Resumen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la pantalla `/clientes/[id]` que muestra el resumen financiero de un cliente por período, agrupando sus cuentas como inquilino y como propietario, con navegación entre roles desde el `RoleToggle`.

**Architecture:** Nuevo endpoint `GET /api/clients/[id]/resumen` agrega datos de `tenant_ledger` filtrando por `inquilinoId` (rol inquilino) y por `propietarioId + impactaPropietario=true` (rol propietario). La página client-side consume ese endpoint con TanStack Query y renderiza dos grupos colapsables con subtotales y neto combinado. El `RoleToggle` existente agrega una tercera opción "Resumen" que solo aparece cuando hay 2+ roles.

**Tech Stack:** Next.js App Router · React 19 · TypeScript · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4

---

## File Map

| Acción | Archivo |
|--------|---------|
| Crear | `src/app/api/clients/[id]/resumen/route.ts` |
| Crear | `src/app/(dashboard)/clientes/[id]/page.tsx` |
| Modificar | `src/components/clients/role-toggle.tsx` |
| Modificar | `src/components/contracts/contract-form.tsx` (línea ~117) |

---

## Task 1: API endpoint `GET /api/clients/[id]/resumen`

**Files:**
- Create: `src/app/api/clients/[id]/resumen/route.ts`

- [ ] **Step 1: Crear el archivo con auth guard**

```typescript
// src/app/api/clients/[id]/resumen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

function defaultPeriodRange() {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;
  return { from, to };
}

function deriveEstado(estados: string[]): string {
  if (estados.some((e) => e === "en_mora")) return "en_mora";
  if (estados.every((e) => e === "conciliado")) return "pagado";
  if (estados.some((e) => e === "pago_parcial")) return "pago_parcial";
  return "pendiente";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const defaults = defaultPeriodRange();
    const from = sp.get("from") ?? defaults.from;
    const to = sp.get("to") ?? defaults.to;

    const [clientRow] = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
      })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!clientRow)
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // ── AS TENANT ────────────────────────────────────────────────────────────
    const tenantContractLinks = await db
      .select({ contractId: contractTenant.contractId })
      .from(contractTenant)
      .where(eq(contractTenant.clientId, id));

    const tenantContractIds = tenantContractLinks.map((r) => r.contractId);

    let asTenant: {
      contracts: Array<{
        contractId: string;
        contractNumber: string;
        propertyAddress: string;
        periods: Array<{ period: string; estado: string; amount: number }>;
        subtotal: number;
      }>;
      total: number;
    } | null = null;

    if (tenantContractIds.length > 0) {
      const [contractDetails, ledgerEntries] = await Promise.all([
        db
          .select({
            id: contract.id,
            contractNumber: contract.contractNumber,
            propertyAddress: property.address,
          })
          .from(contract)
          .leftJoin(property, eq(contract.propertyId, property.id))
          .where(inArray(contract.id, tenantContractIds)),

        db
          .select()
          .from(tenantLedger)
          .where(
            and(
              eq(tenantLedger.inquilinoId, id),
              inArray(tenantLedger.contratoId, tenantContractIds),
              isNotNull(tenantLedger.period),
              gte(tenantLedger.period, from),
              lte(tenantLedger.period, to)
            )
          )
          .orderBy(tenantLedger.period),
      ]);

      const contracts = contractDetails
        .map((c) => {
          const entries = ledgerEntries.filter((e) => e.contratoId === c.id);
          const periodMap = new Map<string, { amount: number; estados: string[] }>();
          for (const e of entries) {
            const p = e.period!;
            const existing = periodMap.get(p) ?? { amount: 0, estados: [] };
            existing.amount += Number(e.monto ?? 0);
            existing.estados.push(e.estado);
            periodMap.set(p, existing);
          }
          const periods = Array.from(periodMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, { amount, estados }]) => ({
              period,
              estado: deriveEstado(estados),
              amount,
            }));
          const subtotal = periods.reduce((s, p) => s + p.amount, 0);
          return {
            contractId: c.id,
            contractNumber: c.contractNumber,
            propertyAddress: c.propertyAddress ?? "",
            periods,
            subtotal,
          };
        })
        .filter((c) => c.periods.length > 0);

      const total = contracts.reduce((s, c) => s + c.subtotal, 0);
      if (contracts.length > 0) asTenant = { contracts, total };
    }

    // ── AS OWNER ──────────────────────────────────────────────────────────────
    const ownerContractDetails = await db
      .select({
        id: contract.id,
        contractNumber: contract.contractNumber,
        propertyAddress: property.address,
      })
      .from(contract)
      .leftJoin(property, eq(contract.propertyId, property.id))
      .where(eq(contract.ownerId, id));

    let asOwner: {
      contracts: Array<{
        contractId: string;
        contractNumber: string;
        propertyAddress: string;
        tenantName: string;
        periods: Array<{ period: string; estado: string; amount: number }>;
        subtotal: number;
      }>;
      total: number;
    } | null = null;

    if (ownerContractDetails.length > 0) {
      const ownerContractIds = ownerContractDetails.map((c) => c.id);

      const [ledgerEntries, tenantRows] = await Promise.all([
        db
          .select()
          .from(tenantLedger)
          .where(
            and(
              eq(tenantLedger.propietarioId, id),
              eq(tenantLedger.impactaPropietario, true),
              inArray(tenantLedger.contratoId, ownerContractIds),
              isNotNull(tenantLedger.period),
              gte(tenantLedger.period, from),
              lte(tenantLedger.period, to)
            )
          )
          .orderBy(tenantLedger.period),

        db
          .select({
            contractId: contractTenant.contractId,
            firstName: client.firstName,
            lastName: client.lastName,
          })
          .from(contractTenant)
          .leftJoin(client, eq(contractTenant.clientId, client.id))
          .where(inArray(contractTenant.contractId, ownerContractIds)),
      ]);

      const contracts = ownerContractDetails
        .map((c) => {
          const entries = ledgerEntries.filter((e) => e.contratoId === c.id);
          const periodMap = new Map<string, { amount: number; estados: string[] }>();
          for (const e of entries) {
            const p = e.period!;
            const existing = periodMap.get(p) ?? { amount: 0, estados: [] };
            existing.amount += Number(e.monto ?? 0);
            existing.estados.push(e.estado);
            periodMap.set(p, existing);
          }
          const periods = Array.from(periodMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, { amount, estados }]) => ({
              period,
              estado: deriveEstado(estados),
              amount,
            }));
          const subtotal = periods.reduce((s, p) => s + p.amount, 0);

          const tenant = tenantRows.find((t) => t.contractId === c.id);
          const tenantName = tenant
            ? [tenant.firstName, tenant.lastName].filter(Boolean).join(" ")
            : "";

          return {
            contractId: c.id,
            contractNumber: c.contractNumber,
            propertyAddress: c.propertyAddress ?? "",
            tenantName,
            periods,
            subtotal,
          };
        })
        .filter((c) => c.periods.length > 0);

      const total = contracts.reduce((s, c) => s + c.subtotal, 0);
      if (contracts.length > 0) asOwner = { contracts, total };
    }

    const net =
      asTenant !== null && asOwner !== null
        ? (asOwner?.total ?? 0) - (asTenant?.total ?? 0)
        : null;

    return NextResponse.json({ client: clientRow, from, to, asTenant, asOwner, net });
  } catch (error) {
    console.error("Error GET /api/clients/:id/resumen:", error);
    return NextResponse.json({ error: "Error al obtener el resumen" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar que el servidor compila sin errores**

```bash
bun run build 2>&1 | grep -E "error|Error" | head -20
```

Si hay errores de TypeScript, corregirlos antes de continuar.

- [ ] **Step 3: Probar el endpoint en el browser**

Con el servidor corriendo (`bun dev`), abrir:
```
http://localhost:3000/api/clients/[ID_REAL]/resumen
```
Reemplazar `[ID_REAL]` con el ID de un cliente que tenga contratos. Debe devolver JSON con `asTenant` y/o `asOwner`. Si el cliente no tiene contratos en el período por defecto, agregar `?from=2024-01&to=2026-12` para ampliar el rango.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clients/[id]/resumen/route.ts
git commit -m "feat: add GET /api/clients/[id]/resumen endpoint"
```

---

## Task 2: Pantalla `/clientes/[id]`

**Files:**
- Create: `src/app/(dashboard)/clientes/[id]/page.tsx`

- [ ] **Step 1: Crear el archivo de la página**

```typescript
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

  const { client, asTenant, asOwner, net } = data;
  const hasMultipleRoles = asTenant !== null && asOwner !== null;

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
```

- [ ] **Step 2: Verificar que la página carga sin errores en el browser**

Con `bun dev` corriendo, navegar a:
```
http://localhost:3000/clientes/[ID_REAL]
```
Debe mostrar el header con el nombre del cliente, el selector de período y las secciones de roles con datos. Si el cliente no tiene contratos en el período por defecto, cambiar el selector a "Último año".

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/clientes/[id]/page.tsx"
git commit -m "feat: add /clientes/[id] resumen page"
```

---

## Task 3: Actualizar `RoleToggle` — agregar opción "Resumen"

**Files:**
- Modify: `src/components/clients/role-toggle.tsx`

- [ ] **Step 1: Reemplazar el contenido del archivo**

```typescript
// src/components/clients/role-toggle.tsx
"use client";

import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery } from "@tanstack/react-query";

type Role = "inquilino" | "propietario" | "resumen";

const LABELS: Record<Role, string> = {
  inquilino: "Inquilino",
  propietario: "Propietario",
  resumen: "Resumen",
};

const URLS: Record<Role, (id: string) => string> = {
  inquilino: (id) => `/inquilinos/${id}`,
  propietario: (id) => `/propietarios/${id}`,
  resumen: (id) => `/clientes/${id}`,
};

type Props = {
  clientId: string;
  currentRole: Role;
};

export function RoleToggle({ clientId, currentRole }: Props) {
  const router = useRouter();

  const { data } = useQuery<{ roles: string[] }>({
    queryKey: ["client-roles", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/roles`);
      if (!res.ok) throw new Error("Error al obtener roles del cliente");
      return res.json();
    },
    staleTime: 60_000,
  });

  const roles = data?.roles ?? [];
  const hasTenant = roles.includes("tenant");
  const hasOwner = roles.includes("owner");
  const hasMultipleRoles = hasTenant && hasOwner;

  const availableRoles: Role[] = [];
  if (hasTenant) availableRoles.push("inquilino");
  if (hasOwner) availableRoles.push("propietario");
  if (hasMultipleRoles) availableRoles.push("resumen");

  if (availableRoles.length <= 1 && currentRole !== "resumen") return null;

  return (
    <ToggleGroup
      type="single"
      value={currentRole}
      onValueChange={(v) => {
        if (!v || v === currentRole) return;
        router.push(URLS[v as Role](clientId));
      }}
    >
      {availableRoles.map((role) => (
        <ToggleGroupItem key={role} value={role} className="text-xs h-8 px-3">
          {LABELS[role]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
```

- [ ] **Step 2: Verificar en el browser**

Navegar a la ficha de un inquilino que también sea propietario. El toggle debe mostrar tres opciones: "Inquilino", "Propietario", "Resumen". Hacer click en "Resumen" debe navegar a `/clientes/{id}`. Desde `/clientes/{id}`, el toggle debe mostrar las tres opciones con "Resumen" seleccionado.

- [ ] **Step 3: Commit**

```bash
git add src/components/clients/role-toggle.tsx
git commit -m "feat: add Resumen option to RoleToggle"
```

---

## Task 4: Fix contrato — buscar inquilino en todos los clientes

**Files:**
- Modify: `src/components/contracts/contract-form.tsx` (~línea 114–121)

- [ ] **Step 1: Quitar el filtro de tipo en la búsqueda de inquilinos**

Encontrar el bloque:

```typescript
  // Cargar inquilinos (ambos valores de type: español heredado e inglés nuevo)
  const { data: tenantsData } = useQuery({
    queryKey: ["clients", "tenant", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=inquilino,tenant&limit=100");
      if (!res.ok) throw new Error("Error cargando inquilinos");
      return res.json();
    },
  });
```

Reemplazarlo con:

```typescript
  // Buscar cualquier cliente como inquilino (el rol surge del contrato, no del type)
  const { data: tenantsData } = useQuery({
    queryKey: ["clients", "all", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?limit=200");
      if (!res.ok) throw new Error("Error cargando clientes");
      return res.json();
    },
  });
```

- [ ] **Step 2: Verificar en el browser**

Ir a `/contratos/nuevo`. En el selector de inquilino, buscar el nombre de un cliente que esté cargado solo como propietario. Debe aparecer en la lista. La creación del contrato debe completarse sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/contracts/contract-form.tsx
git commit -m "fix: search all clients when selecting tenant in contract form"
```

---

## Verificación final

- [ ] Navegar a la ficha de un inquilino con doble rol → el toggle muestra 3 opciones
- [ ] Click en "Resumen" → lleva a `/clientes/{id}` con datos correctos
- [ ] Click en "Propietario" desde el resumen → lleva a `/propietarios/{id}`
- [ ] Click en "Inquilino" desde el resumen → lleva a `/inquilinos/{id}`
- [ ] Selector de período cambia los datos mostrados
- [ ] El total neto aparece solo cuando hay datos en ambos roles
- [ ] En `/contratos/nuevo`, un cliente "propietario" puede ser seleccionado como inquilino
