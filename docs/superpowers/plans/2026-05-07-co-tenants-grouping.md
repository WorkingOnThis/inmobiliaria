# Co-Tenant Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group tenants that share the same best contract into a single collapsible row in `/inquilinos`, with the primary tenant visible by default and co-tenants revealed via a toggle.

**Architecture:** A new pure function `groupTenants()` lives in `src/lib/tenants/grouping.ts` and transforms the flat enriched-tenant array into `TenantGroup[]`. The API route calls it after enrichment and returns `groups` instead of `tenants`. The UI component adds a `TenantGroupRow` sub-component that handles the toggle state locally.

**Tech Stack:** Next.js 15 App Router · TypeScript · Drizzle ORM · TanStack Query · Tailwind v4 · shadcn/ui · lucide-react · `bun` as runtime/package manager

---

## File Map

| Action | File | What changes |
|---|---|---|
| **Create** | `src/lib/tenants/grouping.ts` | `TenantRow`, `TenantGroup` types, `resolveGroupEstado()`, `groupTenants()` |
| **Modify** | `src/app/api/tenants/route.ts` | Add participantOrder query; call `groupTenants()`; move search to in-memory; return `groups` |
| **Modify** | `src/components/tenants/tenants-list.tsx` | Add `TenantGroup` type, `TenantGroupRow` sub-component, toggle column, updated CSV export |

---

## Task 1 — Pure grouping function (`src/lib/tenants/grouping.ts`)

**Files:**
- Create: `src/lib/tenants/grouping.ts`

- [ ] **Step 1.1 — Create the file with types and helpers**

```typescript
// src/lib/tenants/grouping.ts

export type EstadoInquilino =
  | "activo"
  | "pendiente"
  | "en_mora"
  | "por_vencer"
  | "sin_contrato"
  | "pendiente_firma"
  | "historico";

export interface TenantRow {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  contrato: {
    id: string;
    numero: string;
    status: string;
    endDate: string;
    completitud: number | null;
  } | null;
  property: string | null;
  ultimoPago: string | null;
  estado: EstadoInquilino;
  diasMora: number;
}

export interface TenantGroup {
  contractId: string | null;
  primary: TenantRow;
  coTenants: TenantRow[];
  groupEstado: EstadoInquilino;
  diasMora: number;
  ultimoPago: string | null;
}

const ESTADO_SEVERITY: Record<EstadoInquilino, number> = {
  en_mora:        6,
  pendiente:      5,
  por_vencer:     4,
  activo:         3,
  sin_contrato:   2,
  pendiente_firma: 1,
  historico:      0,
};

export function resolveGroupEstado(members: TenantRow[]): EstadoInquilino {
  return members.reduce<EstadoInquilino>((worst, m) => {
    return (ESTADO_SEVERITY[m.estado] ?? 0) > (ESTADO_SEVERITY[worst] ?? 0)
      ? m.estado
      : worst;
  }, "historico");
}

export function groupTenants(
  enriched: TenantRow[],
  participantOrder: Map<string, Date | null>
): TenantGroup[] {
  const byContract = new Map<string, TenantRow[]>();
  const noContract: TenantRow[] = [];

  for (const tenant of enriched) {
    const cid = tenant.contrato?.id ?? null;
    if (cid === null) {
      noContract.push(tenant);
    } else {
      const existing = byContract.get(cid) ?? [];
      existing.push(tenant);
      byContract.set(cid, existing);
    }
  }

  const groups: TenantGroup[] = [];

  for (const [contractId, members] of byContract) {
    const sorted = [...members].sort((a, b) => {
      const aDate = participantOrder.get(a.id);
      const bDate = participantOrder.get(b.id);
      if (aDate && bDate) return aDate.getTime() - bDate.getTime();
      if (aDate) return -1;
      if (bDate) return 1;
      return a.firstName.localeCompare(b.firstName);
    });

    const [primary, ...coTenants] = sorted;
    const groupEstado = resolveGroupEstado(sorted);
    const diasMora = Math.max(...sorted.map((m) => m.diasMora));
    const ultimoPago =
      sorted
        .map((m) => m.ultimoPago)
        .filter((d): d is string => d !== null)
        .sort()
        .at(-1) ?? null;

    groups.push({ contractId, primary, coTenants, groupEstado, diasMora, ultimoPago });
  }

  for (const tenant of noContract) {
    groups.push({
      contractId: null,
      primary: tenant,
      coTenants: [],
      groupEstado: tenant.estado,
      diasMora: tenant.diasMora,
      ultimoPago: tenant.ultimoPago,
    });
  }

  return groups;
}
```

- [ ] **Step 1.2 — Verify it compiles**

```bash
bun run build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 1.3 — Commit**

```bash
git add src/lib/tenants/grouping.ts
git commit -m "feat: add groupTenants pure function and TenantGroup types"
```

---

## Task 2 — Update API route (`src/app/api/tenants/route.ts`)

**Files:**
- Modify: `src/app/api/tenants/route.ts`

This task replaces the final third of the route handler. The queries for tenants, contracts, payments and ledger do not change. What changes: (1) we stop filtering at DB level for search, (2) we add a participantOrder query, (3) we call `groupTenants()`, (4) we filter/paginate over groups.

- [ ] **Step 2.1 — Add import for groupTenants**

At the top of the file, after the existing imports, add:

```typescript
import { groupTenants, type TenantGroup } from "@/lib/tenants/grouping";
```

- [ ] **Step 2.2 — Remove the DB-level search filter from the `allTenants` query**

Find the block that builds `searchCondition` and the `allTenants` query. Replace both so `allTenants` always fetches all tenants for the agency (search is now in-memory after grouping).

Replace this block:

```typescript
    const searchCondition = search
      ? and(
          agencyCondition,
          tenantCondition,
          or(
            ilike(client.firstName, `%${search}%`),
            ilike(client.lastName, `%${search}%`),
            ilike(client.dni, `%${search}%`),
            ilike(client.phone, `%${search}%`)
          )
        )
      : and(agencyCondition, tenantCondition);

    const allTenants = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        phone: client.phone,
        email: client.email,
        createdAt: client.createdAt,
      })
      .from(client)
      .where(searchCondition)
      .orderBy(desc(client.createdAt));
```

With:

```typescript
    const allTenants = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        phone: client.phone,
        email: client.email,
        createdAt: client.createdAt,
      })
      .from(client)
      .where(and(agencyCondition, tenantCondition))
      .orderBy(desc(client.createdAt));
```

Also remove the unused `ilike` and `or` from the drizzle imports at the top of the file (they were used only in `searchCondition`):

```typescript
import { and, desc, eq, inArray } from "drizzle-orm";
```

- [ ] **Step 2.3 — Add participantOrder query**

Insert this block immediately after `const ids = allTenants.map((t) => t.id);` (before the `contracts` query):

```typescript
    // Fetch contract_participant createdAt to determine group primary order
    const participantDates = await db
      .select({ clientId: contractParticipant.clientId, createdAt: contractParticipant.createdAt })
      .from(contractParticipant)
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        eq(contractParticipant.role, "tenant"),
        inArray(contractParticipant.clientId, ids),
      ));

    const participantOrder = new Map<string, Date | null>(
      participantDates.map((p) => [p.clientId, p.createdAt])
    );
```

- [ ] **Step 2.4 — Update the empty-state early return**

Find the early return when `allTenants.length === 0` and update its shape:

```typescript
    if (allTenants.length === 0) {
      return NextResponse.json({
        groups: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
        stats: { total: 0, conContratoActivo: 0, enMora: 0, pendiente: 0, porVencer: 0, sinContrato: 0, pendienteFirma: 0, historico: 0 },
      });
    }
```

- [ ] **Step 2.5 — Replace stats / filter / paginate with group-based logic**

Find the block starting at `const stats = {` through the final `return NextResponse.json({`. Replace the entire block with:

```typescript
    const groups = groupTenants(enriched, participantOrder);

    function groupMatchesSearch(g: TenantGroup, term: string): boolean {
      const t = term.toLowerCase();
      return [g.primary, ...g.coTenants].some(
        (m) =>
          m.firstName.toLowerCase().includes(t) ||
          (m.lastName?.toLowerCase().includes(t) ?? false) ||
          (m.dni?.toLowerCase().includes(t) ?? false) ||
          (m.phone?.toLowerCase().includes(t) ?? false)
      );
    }

    const searched = search
      ? groups.filter((g) => groupMatchesSearch(g, search))
      : groups;

    const filtered =
      estadoFilter === "todos"
        ? searched
        : searched.filter((g) => g.groupEstado === estadoFilter);

    const stats = {
      total: groups.length,
      conContratoActivo: groups.filter((g) =>
        ["activo", "pendiente", "por_vencer", "en_mora"].includes(g.groupEstado)
      ).length,
      enMora:        groups.filter((g) => g.groupEstado === "en_mora").length,
      pendiente:     groups.filter((g) => g.groupEstado === "pendiente").length,
      porVencer:     groups.filter((g) => g.groupEstado === "por_vencer").length,
      sinContrato:   groups.filter((g) => g.groupEstado === "sin_contrato").length,
      pendienteFirma: groups.filter((g) => g.groupEstado === "pendiente_firma").length,
      historico:     groups.filter((g) => g.groupEstado === "historico").length,
    };

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      groups: paginated,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats,
    });
```

- [ ] **Step 2.6 — Verify it compiles**

```bash
bun run build
```

Expected: build succeeds. If TypeScript complains about `TenantRow` type mismatch (the `createdAt` field on the enriched object is a `Date` from Drizzle but declared as `string` in `TenantRow`), update `TenantRow.createdAt` in `grouping.ts` to `string | Date` or cast at the call site.

- [ ] **Step 2.7 — Commit**

```bash
git add src/app/api/tenants/route.ts src/lib/tenants/grouping.ts
git commit -m "feat: group tenants by shared contract in API response"
```

---

## Task 3 — Update UI component (`src/components/tenants/tenants-list.tsx`)

**Files:**
- Modify: `src/components/tenants/tenants-list.tsx`

- [ ] **Step 3.1 — Update lucide-react imports**

Replace the current lucide-react import block with:

```typescript
import {
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Download,
  Loader2,
  PlusCircle,
  Search,
  Users,
  AlertCircle,
  Clock,
  UserX,
} from "lucide-react";
```

- [ ] **Step 3.2 — Add TenantGroup type and update TenantsResponse**

After the existing `TenantRow` interface, add:

```typescript
interface TenantGroup {
  contractId: string | null;
  primary: TenantRow;
  coTenants: TenantRow[];
  groupEstado: EstadoInquilino;
  diasMora: number;
  ultimoPago: string | null;
}
```

Replace the `TenantsResponse` interface:

```typescript
interface TenantsResponse {
  groups: TenantGroup[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  stats: Stats;
}
```

- [ ] **Step 3.3 — Add TenantGroupRow sub-component**

Insert this after the `ProgressBar` function and before the `FILTROS` constant:

```typescript
// ─── Fila de grupo (primario + co-inquilinos colapsables) ─────────────────────

function TenantGroupRow({
  group,
  onNavigate,
}: {
  group: TenantGroup;
  onNavigate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasCoTenants = group.coTenants.length > 0;
  const { primary } = group;
  const nombre = `${primary.firstName} ${primary.lastName ?? ""}`.trim();

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => onNavigate(primary.id)}
      >
        {/* Toggle */}
        <TableCell className="w-8 p-2 text-center">
          {hasCoTenants && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="inline-flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {open ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
          )}
        </TableCell>

        {/* Tenant */}
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <EntityAvatar
                initials={getInitials(primary.firstName, primary.lastName)}
                size="md"
                colorSeed={primary.firstName}
              />
              {hasCoTenants && (
                <EntityAvatar
                  initials={getInitials(
                    group.coTenants[0].firstName,
                    group.coTenants[0].lastName
                  )}
                  size="sm"
                  colorSeed={group.coTenants[0].firstName}
                  className="absolute -bottom-1 -right-1 ring-1 ring-background"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{nombre}</p>
              {hasCoTenants && (
                <p className="text-xs text-muted-foreground">
                  +{group.coTenants.length} co-inquilino
                  {group.coTenants.length > 1 ? "s" : ""}
                </p>
              )}
              {primary.dni && (
                <p className="text-xs text-muted-foreground">DNI {primary.dni}</p>
              )}
            </div>
          </div>
        </TableCell>

        {/* Propiedad */}
        <TableCell>
          <span className="text-sm">
            {primary.property ?? <span className="field-value empty" />}
          </span>
        </TableCell>

        {/* Contrato */}
        <TableCell>
          {primary.contrato ? (
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {primary.contrato.numero}
            </span>
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Vencimiento */}
        <TableCell>
          {primary.contrato?.endDate ? (
            <span className="text-sm">{formatFecha(primary.contrato.endDate)}</span>
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Último pago (más reciente del grupo) */}
        <TableCell>
          {group.ultimoPago ? (
            <span className="text-sm">{formatFecha(group.ultimoPago)}</span>
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Completitud */}
        <TableCell>
          {primary.contrato?.completitud != null ? (
            <ProgressBar value={primary.contrato.completitud} />
          ) : (
            <span className="field-value empty" />
          )}
        </TableCell>

        {/* Estado */}
        <TableCell>
          <EstadoBadge estado={group.groupEstado} diasMora={group.diasMora} />
        </TableCell>
      </TableRow>

      {/* Sub-filas de co-inquilinos */}
      {open &&
        group.coTenants.map((ct) => {
          const ctNombre = `${ct.firstName} ${ct.lastName ?? ""}`.trim();
          return (
            <TableRow
              key={ct.id}
              className="bg-muted/5 hover:bg-muted/15 transition-colors"
            >
              <TableCell className="w-8 p-2" />
              <TableCell className="border-l-2 border-primary/40 pl-10">
                <button
                  className="flex items-center gap-2 text-left hover:underline underline-offset-2"
                  onClick={() => onNavigate(ct.id)}
                >
                  <EntityAvatar
                    initials={getInitials(ct.firstName, ct.lastName)}
                    size="sm"
                    colorSeed={ct.firstName}
                  />
                  <span className="text-sm font-medium">{ctNombre}</span>
                </button>
              </TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell>
                {ct.ultimoPago ? (
                  <span className="text-sm">{formatFecha(ct.ultimoPago)}</span>
                ) : (
                  <span className="field-value empty" />
                )}
              </TableCell>
              <TableCell><span className="text-muted-foreground/40 text-sm">—</span></TableCell>
              <TableCell>
                <EstadoBadge estado={ct.estado} diasMora={ct.diasMora} />
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
```

Note: `EntityAvatar` with `size="sm"` and `className` prop — check if `EntityAvatar` accepts `className`. If it doesn't, wrap the second avatar in a `<div className="absolute -bottom-1 -right-1 ring-1 ring-background">` instead.

- [ ] **Step 3.4 — Update the CSV export function**

The CSV now receives `TenantGroup[]` and flattens it to rows:

Replace the `exportarCSV` function signature and its `filas` computation:

```typescript
function exportarCSV(groups: TenantGroup[]) {
  const encabezados = [
    "Nombre",
    "DNI",
    "Teléfono",
    "Propiedad",
    "Contrato",
    "Vencimiento",
    "Último Pago",
    "Completitud",
    "Estado",
    "Rol",
  ];
  const estadoLabel: Record<EstadoInquilino, string> = {
    activo: "Al día",
    pendiente: "Pendiente",
    en_mora: "En mora",
    por_vencer: "Por vencer",
    sin_contrato: "Postulante",
    pendiente_firma: "Por firmar",
    historico: "Histórico",
  };

  const filas: string[][] = [];
  for (const g of groups) {
    const allMembers = [
      { tenant: g.primary, rol: g.coTenants.length > 0 ? "Principal" : "" },
      ...g.coTenants.map((ct) => ({ tenant: ct, rol: "Co-inquilino" })),
    ];
    for (const { tenant: i, rol } of allMembers) {
      filas.push([
        `${i.firstName} ${i.lastName ?? ""}`.trim(),
        i.dni ?? "",
        i.phone ?? "",
        i.property ?? "",
        i.contrato?.numero ?? "",
        i.contrato?.endDate ? formatFecha(i.contrato.endDate) : "",
        i.ultimoPago ? formatFecha(i.ultimoPago) : "",
        i.contrato?.completitud != null ? `${i.contrato.completitud}%` : "",
        estadoLabel[i.estado],
        rol,
      ]);
    }
  }

  const csv = [encabezados, ...filas]
    .map((fila) => fila.map((c) => `"${c}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inquilinos_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3.5 — Update the main component body**

In `TenantsList`, replace the line:

```typescript
  const inquilinos = data?.tenants ?? [];
```

With:

```typescript
  const groups = data?.groups ?? [];
```

Also update the `exportarCSV` call in the Exportar button:

```typescript
onClick={() => groups.length > 0 && exportarCSV(groups)}
disabled={groups.length === 0}
```

- [ ] **Step 3.6 — Add toggle column to table header**

Find the `<TableHeader>` block and add a narrow first column:

```tsx
<TableHeader>
  <TableRow className="bg-muted/40 hover:bg-muted/40">
    <TableHead className="w-8" />
    <TableHead className="font-semibold">Tenant</TableHead>
    <TableHead className="font-semibold">Propiedad</TableHead>
    <TableHead className="font-semibold">Contrato</TableHead>
    <TableHead className="font-semibold">Vencimiento</TableHead>
    <TableHead className="font-semibold">Último pago</TableHead>
    <TableHead className="font-semibold">Completitud</TableHead>
    <TableHead className="font-semibold">Estado</TableHead>
  </TableRow>
</TableHeader>
```

- [ ] **Step 3.7 — Replace the table body render loop**

Find the `<TableBody>` block with `inquilinos.map(...)`. Replace the entire `{inquilinos.length > 0 ? ( ... ) : ( <empty state> )}` block with:

```tsx
{groups.length > 0 ? (
  groups.map((group) => (
    <TenantGroupRow
      key={group.primary.id}
      group={group}
      onNavigate={(id) => router.push(`/inquilinos/${id}`)}
    />
  ))
) : (
  <TableRow>
    <TableCell colSpan={8} className="h-32 text-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Users className="size-8" />
        <p className="text-sm">No hay inquilinos para mostrar.</p>
        {search && (
          <p className="text-xs">
            Probá con otra búsqueda o limpiá el filtro.
          </p>
        )}
      </div>
    </TableCell>
  </TableRow>
)}
```

- [ ] **Step 3.8 — Update the pagination "Mostrando" text**

Find the text that says `de {pagination.total} tenant`. Update it:

```tsx
de {pagination.total} grupo{pagination.total !== 1 ? "s" : ""}
```

- [ ] **Step 3.9 — Verify build and runtime**

```bash
bun run build
```

Expected: clean build. Then start dev server and open `/inquilinos` in the browser:

```bash
bun dev
```

Verify:
- Los Paggi aparecen como una única fila con toggle `▶`
- Click en toggle abre la sub-fila de Malena
- Click en la fila navega a `/inquilinos/[id de Guido]`
- Click en el nombre de Malena en la sub-fila navega a `/inquilinos/[id de Malena]`
- El KPI "TOTAL INQUILINOS" muestra 1 (un grupo), no 2
- El filtro "Al día" muestra el grupo

- [ ] **Step 3.10 — Commit**

```bash
git add src/components/tenants/tenants-list.tsx
git commit -m "feat: collapsible co-tenant grouping in tenant list UI"
```
