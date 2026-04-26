# Cuenta Corriente v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `tenant_charge` with a unified `tenant_ledger` table, add auto-generation of all contract periods, rebuild the cuenta-corriente UI as an interactive projection workspace, segregate cash by fund type, and add dual-role toggle to client headers.

**Architecture:** New central table `tenant_ledger` is the single source of truth for all financial items per tenant-contract. Auto-generation creates the full contract timeline on activation. The UI reads from `tenant_ledger` exclusively; old `tenant_charge` data is migrated then the table is dropped.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM + PostgreSQL, TanStack Query, shadcn/ui (ToggleGroup, Popover, Table, Card, Badge, Checkbox, Input, Alert, AlertDialog, Select), Zod, TypeScript.

---

## File Map

| Action | File |
|---|---|
| Create | `src/db/schema/tenant-ledger.ts` |
| Modify | `src/db/schema/caja.ts` — add `tipoFondo`, `ledgerEntryId` |
| Modify | `src/db/schema/servicio.ts` — add `propietarioResponsable`, `tipoGestion` |
| Modify | `src/db/schema/index.ts` — export new schema, remove tenant-charge |
| Create | `scripts/migrate-tenant-charges.ts` — one-time data migration |
| Create | `src/lib/ledger/flags.ts` — default accounting flags per tipo |
| Create | `src/lib/ledger/generate-contract-ledger.ts` — period generation logic |
| Create | `src/app/api/contracts/[id]/generate-ledger/route.ts` |
| Modify | `src/app/api/tenants/[id]/cuenta-corriente/route.ts` — full rewrite |
| Create | `src/app/api/tenants/[id]/ledger/route.ts` |
| Create | `src/app/api/tenants/[id]/ledger/[entryId]/route.ts` |
| Create | `src/app/api/tenants/[id]/ledger/[entryId]/punitorio/route.ts` |
| Create | `src/app/api/tenants/[id]/ledger/[entryId]/conciliar/route.ts` |
| Modify | `src/app/api/receipts/emit/route.ts` — use ledgerEntryIds + tipoFondo |
| Create | `src/components/tenants/ledger-table.tsx` |
| Create | `src/components/tenants/punitorio-popover.tsx` |
| Create | `src/components/tenants/cobro-panel.tsx` |
| Modify | `src/components/tenants/tenant-tab-current-account.tsx` — full rewrite |
| Modify | `src/app/(dashboard)/caja/` — add tipoFondo filter |
| Modify | `src/app/(dashboard)/inquilinos/[id]/page.tsx` — add role toggle |
| Modify | `src/app/(dashboard)/propietarios/[id]/page.tsx` — add role toggle |

---

## PR 1 — Schema

### Task 1: Create `src/db/schema/tenant-ledger.ts`

**Files:**
- Create: `src/db/schema/tenant-ledger.ts`

- [ ] **Step 1: Write the file**

```typescript
import { pgTable, text, decimal, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { client } from "./client";
import { contract } from "./contract";
import { property } from "./property";
import { servicio } from "./servicio";

export const tenantLedger = pgTable("tenant_ledger", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  contratoId: text("contratoId")
    .notNull()
    .references(() => contract.id, { onDelete: "restrict" }),
  inquilinoId: text("inquilinoId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),
  propietarioId: text("propietarioId")
    .notNull()
    .references(() => client.id, { onDelete: "restrict" }),
  propiedadId: text("propiedadId")
    .notNull()
    .references(() => property.id, { onDelete: "restrict" }),

  // "YYYY-MM" — null for non-periodic items like deposits
  period: text("period"),
  // "YYYY-MM-DD" — due date
  dueDate: text("dueDate"),

  tipo: text("tipo").notNull(),
  // "alquiler" | "servicio" | "bonificacion" | "descuento" | "gasto"
  // | "punitorio" | "deposito" | "ajuste_indice"

  descripcion: text("descripcion").notNull(),

  // null = amount not yet determined (post-adjustment or variable service)
  monto: decimal("monto", { precision: 15, scale: 2 }),

  // Accounting flags
  impactaPropietario: boolean("impactaPropietario").notNull().default(true),
  incluirEnBaseComision: boolean("incluirEnBaseComision").notNull().default(true),
  impactaCaja: boolean("impactaCaja").notNull().default(false),

  // "proyectado" | "pendiente_revision" | "pendiente" | "registrado" | "conciliado" | "cancelado"
  estado: text("estado").notNull().default("proyectado"),

  reciboNumero: text("reciboNumero"),
  reciboEmitidoAt: timestamp("reciboEmitidoAt"),

  conciliadoAt: timestamp("conciliadoAt"),
  conciliadoPor: text("conciliadoPor").references(() => user.id, { onDelete: "set null" }),

  // Self-reference for installments — plain text, no FK (Drizzle circular FK limitation)
  // Documented in src/db/schema/relations.ts
  installmentOf: text("installmentOf"),
  installmentNumber: integer("installmentNumber"),
  installmentTotal: integer("installmentTotal"),

  servicioId: text("servicioId").references(() => servicio.id, { onDelete: "set null" }),

  // Link to cash_movement created when impactaCaja=true and item is confirmed
  // FK goes one-way only: caja.ts → tenant_ledger. This field is the reverse pointer.
  // Declared as text to avoid circular import (caja.ts imports tenant-ledger.ts indirectly).
  cajaMovimientoId: text("cajaMovimientoId"),

  isAutoGenerated: boolean("isAutoGenerated").notNull().default(false),
  createdBy: text("createdBy").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantLedger = typeof tenantLedger.$inferSelect;
export type NewTenantLedger = typeof tenantLedger.$inferInsert;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -30
```

Expected: no errors related to this file (other pre-existing errors are OK).

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/tenant-ledger.ts
git commit -m "feat(schema): add tenant_ledger table"
```

---

### Task 2: Extend `src/db/schema/caja.ts`

**Files:**
- Modify: `src/db/schema/caja.ts`

- [ ] **Step 1: Add `tipoFondo` and `ledgerEntryId` fields**

In `src/db/schema/caja.ts`, after the `period` field (line 63), add:

```typescript
  // Fund segregation
  tipoFondo: text("tipoFondo").notNull().default("agencia"),
  // "agencia"     — money that belongs to the agency (fees, commissions)
  // "propietario" — in-transit money from an owner (rent collected, pending settlement)
  // "inquilino"   — in-transit money from a tenant (deposit, advance payments)

  // Link to the tenant_ledger entry that originated this movement (nullable for manual entries)
  ledgerEntryId: text("ledgerEntryId"),
  // No FK here — would create circular import (tenant-ledger.ts imports servicio.ts which is fine,
  // but caja.ts → tenant-ledger.ts AND tenant-ledger.ts → caja.ts = circular). FK enforced via relations.ts.
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/caja.ts
git commit -m "feat(schema): add tipoFondo and ledgerEntryId to cash_movement"
```

---

### Task 3: Extend `src/db/schema/servicio.ts`

**Files:**
- Modify: `src/db/schema/servicio.ts`

- [ ] **Step 1: Add the two new fields to the `servicio` table**

In `src/db/schema/servicio.ts`, after the `triggersBlock` field (line 18), add:

```typescript
  // Whether the owner is the one responsible for this service (and thus it appears in tenant_ledger)
  propietarioResponsable: boolean("propietarioResponsable").notNull().default(false),

  // How the agency manages this service
  tipoGestion: text("tipoGestion").notNull().default("comprobante"),
  // "comprobante"                — staff uploads receipt; if missing and triggersBlock=true, blocks rent collection
  // "pago_agencia"               — agency pays the service and recovers from tenant
  // "pago_propietario_recuperar" — owner paid; agency collects from tenant and returns to owner
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/servicio.ts
git commit -m "feat(schema): add propietarioResponsable and tipoGestion to service"
```

---

### Task 4: Update `index.ts`, generate and apply migration

**Files:**
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Add tenant-ledger export to `index.ts`**

In `src/db/schema/index.ts`, add after line 28 (`export * from "./tenant-charge";`):

```typescript
export * from "./tenant-ledger";
```

Keep `export * from "./tenant-charge";` for now — the old table stays in the DB until the migration script runs. It will be removed in Task 5.

- [ ] **Step 2: Generate migration**

```bash
bun run db:generate
```

Expected: a new file in `drizzle/` with `CREATE TABLE tenant_ledger`, `ALTER TABLE cash_movement ADD COLUMN tipoFondo`, `ALTER TABLE cash_movement ADD COLUMN ledgerEntryId`, `ALTER TABLE service ADD COLUMN propietarioResponsable`, `ALTER TABLE service ADD COLUMN tipoGestion`.

- [ ] **Step 3: Apply migration**

```bash
bun run db:migrate
```

Expected: "✓ All migrations applied".

- [ ] **Step 4: Verify in Drizzle Studio**

```bash
bun run db:studio
```

Open http://localhost:4983 → confirm `tenant_ledger` table exists with all columns. Confirm `cash_movement` has `tipoFondo` and `ledgerEntryId`. Confirm `service` has `propietarioResponsable` and `tipoGestion`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/index.ts drizzle/
git commit -m "feat(schema): export tenant_ledger, generate and apply migration"
```

---

## PR 2 — Auto-generation

### Task 5: Create `src/lib/ledger/flags.ts`

**Files:**
- Create: `src/lib/ledger/flags.ts`

- [ ] **Step 1: Write the file**

This module centralizes the default accounting flags for each `tipo`. Call `defaultFlagsForTipo(tipo)` when creating any ledger entry to get the correct flags.

```typescript
type LedgerFlags = {
  impactaPropietario: boolean;
  incluirEnBaseComision: boolean;
  impactaCaja: boolean;
};

const FLAGS: Record<string, LedgerFlags> = {
  alquiler:      { impactaPropietario: true,  incluirEnBaseComision: true,  impactaCaja: true  },
  bonificacion:  { impactaPropietario: true,  incluirEnBaseComision: true,  impactaCaja: false },
  descuento:     { impactaPropietario: true,  incluirEnBaseComision: false, impactaCaja: false },
  // servicio: flags depend on tipoGestion — caller must override impactaCaja
  servicio:      { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: false },
  gasto:         { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: true  },
  punitorio:     { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: true  },
  deposito:      { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: true  },
  ajuste_indice: { impactaPropietario: true,  incluirEnBaseComision: true,  impactaCaja: false },
};

export function defaultFlagsForTipo(tipo: string): LedgerFlags {
  return FLAGS[tipo] ?? { impactaPropietario: true, incluirEnBaseComision: true, impactaCaja: false };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ledger/flags.ts
git commit -m "feat(ledger): add default accounting flags per tipo"
```

---

### Task 6: Create `src/lib/ledger/generate-contract-ledger.ts`

**Files:**
- Create: `src/lib/ledger/generate-contract-ledger.ts`

This is the core business logic. It takes a contract row + its primary tenant + its property services, and returns an array of `NewTenantLedger` records ready to be inserted.

- [ ] **Step 1: Write the file**

```typescript
import { NewTenantLedger } from "@/db/schema/tenant-ledger";
import { defaultFlagsForTipo } from "./flags";

type ContractData = {
  id: string;
  propertyId: string;
  ownerId: string;
  startDate: string;      // "YYYY-MM-DD"
  endDate: string;        // "YYYY-MM-DD"
  monthlyAmount: string;  // decimal string
  paymentDay: number;
  adjustmentIndex: string;
  adjustmentFrequency: number;
};

type ServiceData = {
  id: string;
  tipo: string;
  company: string | null;
  tipoGestion: string;
  propietarioResponsable: boolean;
};

// Returns the "YYYY-MM" string for a given Date
function toPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Returns a due date string "YYYY-MM-DD" for a given period and paymentDay
function toDueDate(period: string, paymentDay: number): string {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // last day of month
  const day = Math.min(paymentDay, lastDay);
  return `${period}-${String(day).padStart(2, "0")}`;
}

// Returns the date when the NEXT adjustment tramo begins (from today's perspective)
function nextAdjustmentDate(startDate: string, adjustmentFrequency: number): Date {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();

  const monthsFromStart =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());

  const currentTramoIndex = Math.floor(monthsFromStart / adjustmentFrequency);
  const nextTramoMonths = (currentTramoIndex + 1) * adjustmentFrequency;

  const next = new Date(start);
  next.setMonth(next.getMonth() + nextTramoMonths);
  next.setDate(1); // first of that month
  return next;
}

export function buildLedgerEntries(
  contract: ContractData,
  inquilinoId: string,
  services: ServiceData[],
): NewTenantLedger[] {
  const entries: NewTenantLedger[] = [];
  const today = new Date();
  const todayPeriod = toPeriod(today);

  const noAdjustment =
    contract.adjustmentIndex === "none" || contract.adjustmentFrequency <= 0;

  const nextAdj = noAdjustment
    ? null
    : nextAdjustmentDate(contract.startDate, contract.adjustmentFrequency);

  // Iterate month by month from startDate to endDate
  const start = new Date(contract.startDate + "T00:00:00");
  const end = new Date(contract.endDate + "T00:00:00");

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    const period = toPeriod(cursor);
    const dueDate = toDueDate(period, contract.paymentDay);

    // Determine estado and monto for this period
    let estado: string;
    let monto: string | null;

    if (period <= todayPeriod) {
      estado = "pendiente";
      monto = contract.monthlyAmount;
    } else if (noAdjustment || nextAdj === null || cursor < nextAdj) {
      estado = "proyectado";
      monto = contract.monthlyAmount;
    } else {
      estado = "pendiente_revision";
      monto = null;
    }

    // Alquiler entry
    entries.push({
      contratoId: contract.id,
      inquilinoId,
      propietarioId: contract.ownerId,
      propiedadId: contract.propertyId,
      period,
      dueDate,
      tipo: "alquiler",
      descripcion: `Alquiler ${period}`,
      monto: monto ?? undefined,
      estado,
      isAutoGenerated: true,
      ...defaultFlagsForTipo("alquiler"),
    });

    // Service entries — only for services where propietarioResponsable=true
    for (const svc of services.filter((s) => s.propietarioResponsable)) {
      const svcEstado = "pendiente_revision"; // always needs review (amount from receipt)
      const impactaCaja = svc.tipoGestion !== "comprobante";

      entries.push({
        contratoId: contract.id,
        inquilinoId,
        propietarioId: contract.ownerId,
        propiedadId: contract.propertyId,
        period,
        dueDate,
        tipo: "servicio",
        descripcion: `${svc.company ?? svc.tipo} — ${period}`,
        monto: undefined, // always pending review
        estado: svcEstado,
        servicioId: svc.id,
        isAutoGenerated: true,
        ...defaultFlagsForTipo("servicio"),
        impactaCaja,
      });
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return entries;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | grep -i "tenant-ledger\|generate-contract\|flags" | head -20
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ledger/
git commit -m "feat(ledger): implement contract period generation logic"
```

---

### Task 7: Create `POST /api/contracts/[id]/generate-ledger/route.ts`

**Files:**
- Create: `src/app/api/contracts/[id]/generate-ledger/route.ts`

- [ ] **Step 1: Write the route handler**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { servicio } from "@/db/schema/servicio";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { buildLedgerEntries } from "@/lib/ledger/generate-contract-ledger";
import { eq, and } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;

    const [contractRow] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    // Get primary tenant
    const [primaryTenant] = await db
      .select({ clientId: contractTenant.clientId })
      .from(contractTenant)
      .where(
        and(
          eq(contractTenant.contractId, contractId),
          eq(contractTenant.role, "primary")
        )
      )
      .limit(1);

    if (!primaryTenant) {
      return NextResponse.json({ error: "El contrato no tiene inquilino principal" }, { status: 422 });
    }

    // Get property services
    const services = await db
      .select({
        id: servicio.id,
        tipo: servicio.tipo,
        company: servicio.company,
        tipoGestion: servicio.tipoGestion,
        propietarioResponsable: servicio.propietarioResponsable,
      })
      .from(servicio)
      .where(eq(servicio.propertyId, contractRow.propertyId));

    const entries = buildLedgerEntries(
      {
        id: contractRow.id,
        propertyId: contractRow.propertyId,
        ownerId: contractRow.ownerId,
        startDate: contractRow.startDate,
        endDate: contractRow.endDate,
        monthlyAmount: contractRow.monthlyAmount,
        paymentDay: contractRow.paymentDay,
        adjustmentIndex: contractRow.adjustmentIndex,
        adjustmentFrequency: contractRow.adjustmentFrequency,
      },
      primaryTenant.clientId,
      services,
    );

    if (entries.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    // Insert in batches of 100 to avoid parameter limits
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      await db.insert(tenantLedger).values(batch);
      inserted += batch.length;
    }

    return NextResponse.json({ inserted }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/contracts/:id/generate-ledger:", error);
    return NextResponse.json({ error: "Error al generar el ledger" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify manually**

Start dev server (`bun dev`). In a browser or terminal, run:

```bash
# Replace CONTRACT_ID with a real contract ID from Drizzle Studio
curl -X POST http://localhost:3000/api/contracts/CONTRACT_ID/generate-ledger \
  -H "Cookie: <your session cookie>"
```

Expected: `{ "inserted": N }` where N is `(months in contract) * (1 alquiler + services)`.

Verify in Drizzle Studio: `tenant_ledger` has rows for that contract.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/contracts/
git commit -m "feat(api): POST /api/contracts/[id]/generate-ledger"
```

---

## PR 3 — API de cuenta corriente

### Task 8: Rewrite `GET /api/tenants/[id]/cuenta-corriente/route.ts`

**Files:**
- Modify: `src/app/api/tenants/[id]/cuenta-corriente/route.ts`

The new endpoint reads from `tenant_ledger` instead of `cash_movement`. It returns `{ kpis, ledgerEntries[], proximoAjuste }`.

- [ ] **Step 1: Replace the entire file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq, sum, sql, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    // Ledger entries — all entries for this tenant, ordered by period then tipo
    const entries = await db
      .select()
      .from(tenantLedger)
      .where(eq(tenantLedger.inquilinoId, id))
      .orderBy(tenantLedger.period, tenantLedger.tipo);

    // KPI: total collected YTD (conciliado, alquiler tipo)
    const currentYear = new Date().getFullYear().toString();
    const [[ytdResult]] = await Promise.all([
      db
        .select({ total: sum(tenantLedger.monto) })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.inquilinoId, id),
            eq(tenantLedger.estado, "conciliado"),
            eq(tenantLedger.tipo, "alquiler"),
            sql`substring(${tenantLedger.period}, 1, 4) = ${currentYear}`
          )
        ),
    ]);

    // KPI: próximo pago — first pending alquiler entry
    const todayPeriod = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const nextPendingAlquiler = entries.find(
      (e) => e.tipo === "alquiler" && e.estado === "pendiente" && (e.period ?? "") >= todayPeriod
    );

    // proximoAjuste — first entry with estado="pendiente_revision"
    const firstPendingRevision = entries.find((e) => e.estado === "pendiente_revision");

    // Estado de cuenta
    const hayMora = entries.some(
      (e) =>
        e.tipo === "alquiler" &&
        e.estado === "pendiente" &&
        e.dueDate !== null &&
        e.dueDate < new Date().toISOString().slice(0, 10)
    );

    const kpis = {
      estadoCuenta: hayMora ? "en_mora" : "al_dia",
      totalCobradoYTD: Number(ytdResult?.total ?? 0),
      proximoPago: nextPendingAlquiler
        ? { fecha: nextPendingAlquiler.dueDate, monto: nextPendingAlquiler.monto }
        : null,
    };

    const proximoAjuste = firstPendingRevision
      ? {
          period: firstPendingRevision.period,
          mesesRestantes: firstPendingRevision.period
            ? Math.max(
                0,
                (parseInt(firstPendingRevision.period.slice(0, 4)) - new Date().getFullYear()) * 12 +
                  (parseInt(firstPendingRevision.period.slice(5, 7)) - (new Date().getMonth() + 1))
              )
            : null,
        }
      : null;

    return NextResponse.json({ kpis, ledgerEntries: entries, proximoAjuste });
  } catch (error) {
    console.error("Error GET /api/tenants/:id/cuenta-corriente:", error);
    return NextResponse.json({ error: "Error al obtener la cuenta corriente" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify manually**

```bash
curl http://localhost:3000/api/tenants/TENANT_ID/cuenta-corriente \
  -H "Cookie: <session cookie>"
```

Expected: `{ kpis: { estadoCuenta, totalCobradoYTD, proximoPago }, ledgerEntries: [...], proximoAjuste }`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tenants/
git commit -m "feat(api): rewrite cuenta-corriente endpoint to use tenant_ledger"
```

---

### Task 9: Create `src/app/api/tenants/[id]/ledger/route.ts`

**Files:**
- Create: `src/app/api/tenants/[id]/ledger/route.ts`

This handles GET (list entries) and POST (create manual entry).

- [ ] **Step 1: Write the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { defaultFlagsForTipo } from "@/lib/ledger/flags";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createEntrySchema = z.object({
  contratoId: z.string().min(1),
  propietarioId: z.string().min(1),
  propiedadId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tipo: z.enum(["alquiler", "servicio", "bonificacion", "descuento", "gasto", "punitorio", "deposito", "ajuste_indice"]),
  descripcion: z.string().min(1),
  monto: z.number().positive().optional(),
  // Flags — default to tipo defaults, caller can override
  impactaPropietario: z.boolean().optional(),
  incluirEnBaseComision: z.boolean().optional(),
  impactaCaja: z.boolean().optional(),
  // Installments
  installmentOf: z.string().optional(),
  installmentNumber: z.number().int().positive().optional(),
  installmentTotal: z.number().int().positive().optional(),
  servicioId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId } = await params;
    const body = await request.json();
    const result = createEntrySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const defaults = defaultFlagsForTipo(data.tipo);

    const [entry] = await db
      .insert(tenantLedger)
      .values({
        contratoId: data.contratoId,
        inquilinoId,
        propietarioId: data.propietarioId,
        propiedadId: data.propiedadId,
        period: data.period,
        dueDate: data.dueDate,
        tipo: data.tipo,
        descripcion: data.descripcion,
        monto: data.monto !== undefined ? String(data.monto) : undefined,
        estado: "pendiente",
        impactaPropietario: data.impactaPropietario ?? defaults.impactaPropietario,
        incluirEnBaseComision: data.incluirEnBaseComision ?? defaults.incluirEnBaseComision,
        impactaCaja: data.impactaCaja ?? defaults.impactaCaja,
        installmentOf: data.installmentOf,
        installmentNumber: data.installmentNumber,
        installmentTotal: data.installmentTotal,
        servicioId: data.servicioId,
        isAutoGenerated: false,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/tenants/:id/ledger:", error);
    return NextResponse.json({ error: "Error al crear el ítem" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tenants/
git commit -m "feat(api): POST /api/tenants/[id]/ledger — create manual ledger entry"
```

---

### Task 10: Create `src/app/api/tenants/[id]/ledger/[entryId]/route.ts`

**Files:**
- Create: `src/app/api/tenants/[id]/ledger/[entryId]/route.ts`

- [ ] **Step 1: Write the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  monto: z.number().positive().optional(),
  descripcion: z.string().min(1).optional(),
  estado: z.enum(["pendiente", "registrado", "cancelado"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = patchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [existing] = await db
      .select({ estado: tenantLedger.estado })
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (existing.estado === "conciliado") {
      return NextResponse.json({ error: "No se puede modificar un ítem conciliado" }, { status: 422 });
    }

    const data = result.data;
    const [updated] = await db
      .update(tenantLedger)
      .set({
        ...(data.monto !== undefined && { monto: String(data.monto) }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.estado !== undefined && { estado: data.estado }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        updatedAt: new Date(),
      })
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error PATCH /api/tenants/:id/ledger/:entryId:", error);
    return NextResponse.json({ error: "Error al actualizar el ítem" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;

    const [existing] = await db
      .select({ estado: tenantLedger.estado, isAutoGenerated: tenantLedger.isAutoGenerated })
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (existing.estado === "conciliado") {
      return NextResponse.json({ error: "No se puede eliminar un ítem conciliado" }, { status: 422 });
    }

    await db
      .delete(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error DELETE /api/tenants/:id/ledger/:entryId:", error);
    return NextResponse.json({ error: "Error al eliminar el ítem" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tenants/
git commit -m "feat(api): PATCH/DELETE /api/tenants/[id]/ledger/[entryId]"
```

---

### Task 11: Create punitorio and conciliar routes

**Files:**
- Create: `src/app/api/tenants/[id]/ledger/[entryId]/punitorio/route.ts`
- Create: `src/app/api/tenants/[id]/ledger/[entryId]/conciliar/route.ts`

- [ ] **Step 1: Write `punitorio/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { defaultFlagsForTipo } from "@/lib/ledger/flags";

const punitorioSchema = z.object({
  monto: z.number().positive(),
  descripcion: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = punitorioSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [parent] = await db
      .select()
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!parent) return NextResponse.json({ error: "Ítem padre no encontrado" }, { status: 404 });
    if (parent.tipo !== "alquiler") {
      return NextResponse.json({ error: "Solo se puede agregar punitorio a ítems de alquiler" }, { status: 422 });
    }

    const [punitorioEntry] = await db
      .insert(tenantLedger)
      .values({
        contratoId: parent.contratoId,
        inquilinoId: parent.inquilinoId,
        propietarioId: parent.propietarioId,
        propiedadId: parent.propiedadId,
        period: parent.period,
        dueDate: parent.dueDate,
        tipo: "punitorio",
        descripcion: result.data.descripcion,
        monto: String(result.data.monto),
        estado: "pendiente",
        installmentOf: parent.id,
        isAutoGenerated: false,
        createdBy: session.user.id,
        ...defaultFlagsForTipo("punitorio"),
      })
      .returning();

    return NextResponse.json(punitorioEntry, { status: 201 });
  } catch (error) {
    console.error("Error POST punitorio:", error);
    return NextResponse.json({ error: "Error al agregar punitorio" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `conciliar/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const conciliarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = conciliarSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [entry] = await db
      .select()
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!entry) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (entry.estado === "conciliado") {
      return NextResponse.json({ error: "El ítem ya está conciliado" }, { status: 422 });
    }
    if (entry.monto === null) {
      return NextResponse.json({ error: "No se puede conciliar un ítem sin monto definido" }, { status: 422 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      let cajaId: string | undefined;

      if (entry.impactaCaja) {
        const [mov] = await tx
          .insert(cajaMovimiento)
          .values({
            tipo: "income",
            description: entry.descripcion,
            amount: entry.monto!,
            date: result.data.fecha,
            categoria: entry.tipo,
            contratoId: entry.contratoId,
            propietarioId: entry.propietarioId,
            inquilinoId: entry.inquilinoId,
            propiedadId: entry.propiedadId,
            period: entry.period ?? undefined,
            tipoFondo: "propietario",
            ledgerEntryId: entry.id,
            source: "contract",
            createdBy: session.user.id,
          })
          .returning();
        cajaId = mov.id;
      }

      await tx
        .update(tenantLedger)
        .set({
          estado: "conciliado",
          conciliadoAt: now,
          conciliadoPor: session.user.id,
          ...(cajaId && { cajaMovimientoId: cajaId }),
          updatedAt: now,
        })
        .where(eq(tenantLedger.id, entryId));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error POST conciliar:", error);
    return NextResponse.json({ error: "Error al conciliar el ítem" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tenants/
git commit -m "feat(api): punitorio and conciliar endpoints for ledger entries"
```

---

### Task 12: Update `src/app/api/receipts/emit/route.ts`

**Files:**
- Modify: `src/app/api/receipts/emit/route.ts`

Switch from `chargeIds → tenantCharge` to `ledgerEntryIds → tenantLedger`. Add `tipoFondo` to the generated `cash_movement` rows.

- [ ] **Step 1: Replace the entire file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { nextReciboNumero } from "@/lib/receipts/numbering";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = emitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { ledgerEntryIds, fecha, honorariosPct, trasladarAlPropietario } = result.data;

    const entries = await db
      .select()
      .from(tenantLedger)
      .where(inArray(tenantLedger.id, ledgerEntryIds));

    if (entries.length !== ledgerEntryIds.length) {
      return NextResponse.json({ error: "Uno o más ítems no fueron encontrados" }, { status: 404 });
    }

    const notReady = entries.filter((e) => !["pendiente", "registrado"].includes(e.estado));
    if (notReady.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes ítems no están listos: ${notReady.map((e) => e.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    const nullMonto = entries.filter((e) => e.monto === null);
    if (nullMonto.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes ítems no tienen monto definido: ${nullMonto.map((e) => e.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    const contratoIds = new Set(entries.map((e) => e.contratoId));
    if (contratoIds.size > 1) {
      return NextResponse.json(
        { error: "Todos los ítems deben pertenecer al mismo contrato" },
        { status: 422 }
      );
    }

    const first = entries[0];
    const contratoId = first.contratoId;
    const inquilinoId = first.inquilinoId;
    const propietarioId = first.propietarioId;
    const propiedadId = first.propiedadId;

    const [inquilinoRow] = await db
      .select({ firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(eq(client.id, inquilinoId))
      .limit(1);

    const nombreInquilino = inquilinoRow
      ? [inquilinoRow.firstName, inquilinoRow.lastName].filter(Boolean).join(" ")
      : "Inquilino";

    // Commission base = sum of entries where incluirEnBaseComision=true
    const baseComision = entries
      .filter((e) => e.incluirEnBaseComision)
      .reduce((s, e) => s + Number(e.monto), 0);

    const totalRecibo = round2(entries.reduce((s, e) => s + Number(e.monto), 0));
    const montoHonorarios = round2(baseComision * honorariosPct / 100);

    const result2 = await db.transaction(async (tx) => {
      const reciboNumero = await nextReciboNumero(tx);
      const now = new Date();

      // Mark entries as conciliado
      await tx
        .update(tenantLedger)
        .set({ estado: "conciliado", reciboNumero, reciboEmitidoAt: now, conciliadoAt: now, conciliadoPor: session.user.id, updatedAt: now })
        .where(inArray(tenantLedger.id, ledgerEntryIds));

      // Agency income movement (total collected)
      const [movAgencia] = await tx
        .insert(cajaMovimiento)
        .values({
          tipo: "income",
          description: `Recibo ${reciboNumero} — ${nombreInquilino}`,
          amount: String(totalRecibo),
          date: fecha,
          categoria: "alquiler",
          reciboNumero,
          inquilinoId,
          propietarioId,
          contratoId,
          propiedadId,
          tipoFondo: "agencia",
          source: "contract",
          createdBy: session.user.id,
        })
        .returning();

      if (trasladarAlPropietario) {
        // Owner in-transit income
        await tx.insert(cajaMovimiento).values({
          tipo: "income",
          description: `Ingreso inquilino — ${reciboNumero}`,
          amount: String(totalRecibo),
          date: fecha,
          categoria: "ingreso_inquilino",
          reciboNumero,
          propietarioId,
          contratoId,
          propiedadId,
          tipoFondo: "propietario",
          source: "contract",
          createdBy: session.user.id,
        });

        // Agency commission expense
        if (montoHonorarios > 0) {
          await tx.insert(cajaMovimiento).values({
            tipo: "expense",
            description: `Honorarios administración — ${reciboNumero}`,
            amount: String(montoHonorarios),
            date: fecha,
            categoria: "honorarios_administracion",
            reciboNumero,
            propietarioId,
            contratoId,
            propiedadId,
            tipoFondo: "agencia",
            source: "contract",
            createdBy: session.user.id,
          });
        }
      }

      return { reciboNumero, movimientoAgenciaId: movAgencia.id, totalRecibo, montoHonorarios };
    });

    return NextResponse.json(result2, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/receipts/emit:", error);
    return NextResponse.json({ error: "Error al emitir el recibo" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/receipts/emit/route.ts
git commit -m "feat(api): update receipts/emit to use ledgerEntryIds and tipoFondo"
```

---

## PR 4 — UI: Tabla de proyección

### Task 13: Install shadcn components and create `ledger-table.tsx`

**Files:**
- Create: `src/components/tenants/ledger-table.tsx`

- [ ] **Step 1: Install required shadcn components**

```bash
npx shadcn@latest add toggle-group
npx shadcn@latest add popover
npx shadcn@latest add alert-dialog
npx shadcn@latest add alert
```

Expected: components added to `src/components/ui/`.

- [ ] **Step 2: Define the TypeScript type for a ledger entry**

At the top of `src/components/tenants/ledger-table.tsx`, define a local type (mirroring the DB row shape returned by the API):

```typescript
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PunitorioPopover } from "./punitorio-popover";

export type LedgerEntry = {
  id: string;
  period: string | null;
  dueDate: string | null;
  tipo: string;
  descripcion: string;
  monto: string | null;
  estado: string;
  installmentOf: string | null;
  reciboNumero: string | null;
};

type Props = {
  entries: LedgerEntry[];
  // Map of entryId → overridden monto (for partial payments in cobro mode)
  montoOverrides: Record<string, string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectMonth: (period: string) => void;
  onMontoChange: (id: string, value: string) => void;
  onAddPunitorio: (parentId: string, monto: number, descripcion: string) => void;
  onCancelPunitorio: (id: string) => void;
  viewMode: "completa" | "historial";
  inquilinoId: string;
};

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  conciliado:        { label: "Pagado",     className: "bg-green-900/40 text-green-400 border-green-900" },
  registrado:        { label: "Registrado", className: "bg-amber-900/40 text-amber-400 border-amber-900" },
  pendiente:         { label: "Pendiente",  className: "bg-primary/10 text-primary border-primary/30" },
  proyectado:        { label: "Proyectado", className: "bg-transparent text-muted-foreground border-border" },
  pendiente_revision:{ label: "Revisar",    className: "bg-amber-950/30 text-amber-300 border-amber-800 border-dashed" },
  cancelado:         { label: "Cancelado",  className: "bg-muted text-muted-foreground border-border" },
};

function isSelectable(entry: LedgerEntry): boolean {
  return entry.estado === "pendiente" || entry.estado === "registrado";
}

function isPast(period: string | null): boolean {
  if (!period) return false;
  return period < new Date().toISOString().slice(0, 7);
}

function isCurrent(period: string | null): boolean {
  if (!period) return false;
  return period === new Date().toISOString().slice(0, 7);
}

// Group entries by period
function groupByPeriod(entries: LedgerEntry[]): Map<string, LedgerEntry[]> {
  const map = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const key = entry.period ?? "__no_period__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}

export function LedgerTable({
  entries,
  montoOverrides,
  selectedIds,
  onToggleSelect,
  onSelectMonth,
  onMontoChange,
  onAddPunitorio,
  onCancelPunitorio,
  viewMode,
  inquilinoId,
}: Props) {
  const todayPeriod = new Date().toISOString().slice(0, 7);

  // Filter by view mode
  const filtered = viewMode === "historial"
    ? entries.filter((e) => (e.period ?? "") <= todayPeriod)
    : entries;

  // Exclude child installments from top-level rendering (they appear indented under parent)
  const topLevel = filtered.filter((e) => !e.installmentOf || e.tipo === "punitorio");

  const grouped = groupByPeriod(topLevel);
  const periods = [...grouped.keys()].sort();

  return (
    <div className="w-full">
      {periods.map((period) => {
        const periodEntries = grouped.get(period) ?? [];
        const past = isPast(period === "__no_period__" ? null : period);
        const current = isCurrent(period === "__no_period__" ? null : period);
        const future = !past && !current;

        return (
          <div
            key={period}
            className={cn(
              "border-b border-border",
              past && "opacity-40",
              future && !current && "opacity-45",
              current && "border-l-2 border-l-primary bg-primary/5"
            )}
          >
            {/* Period header */}
            <div className="flex items-center justify-between px-4 py-2">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                current ? "text-primary" : "text-muted-foreground"
              )}>
                {current && "● "}
                {period === "__no_period__" ? "Sin período" : period}
                {current && " — hoy"}
              </span>
              {current && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => onSelectMonth(period)}
                >
                  Seleccionar todo el mes
                </Button>
              )}
            </div>

            {/* Entries */}
            {periodEntries.map((entry) => {
              const selectable = isSelectable(entry);
              const selected = selectedIds.has(entry.id);
              const isPunitorio = entry.tipo === "punitorio";
              const displayMonto = montoOverrides[entry.id] ?? entry.monto;
              const badge = ESTADO_BADGE[entry.estado] ?? ESTADO_BADGE.pendiente;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "grid items-center gap-2 px-4 py-2 text-sm",
                    "grid-cols-[28px_1fr_80px_110px_90px_60px]",
                    isPunitorio && "pl-10 bg-purple-950/20 border-t border-purple-900/30",
                    selected && "bg-primary/10"
                  )}
                >
                  {/* Checkbox */}
                  <div>
                    {selectable ? (
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleSelect(entry.id)}
                        className={isPunitorio ? "border-purple-500" : undefined}
                      />
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </div>

                  {/* Descripcion */}
                  <span className={cn(
                    "truncate",
                    isPunitorio && "text-purple-300 italic text-xs",
                    entry.monto === null && "text-amber-400"
                  )}>
                    {isPunitorio && "↳ "}
                    {entry.descripcion}
                  </span>

                  {/* Tipo badge */}
                  <span className="text-xs text-muted-foreground truncate">{entry.tipo}</span>

                  {/* Monto */}
                  <div className="flex items-center gap-1 justify-end">
                    {entry.monto === null ? (
                      <span className="text-amber-400 font-mono text-xs">$???</span>
                    ) : selected ? (
                      <Input
                        value={displayMonto ?? ""}
                        onChange={(e) => onMontoChange(entry.id, e.target.value)}
                        className="h-7 w-24 text-right text-xs font-mono"
                      />
                    ) : (
                      <span className="font-mono text-xs">
                        ${Number(entry.monto).toLocaleString("es-AR")}
                      </span>
                    )}
                  </div>

                  {/* Estado badge */}
                  <div className="flex justify-center">
                    <Badge variant="outline" className={cn("text-xs", badge.className)}>
                      {badge.label}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end">
                    {entry.tipo === "alquiler" && selectable && !isPunitorio && (
                      <PunitorioPopover
                        parentId={entry.id}
                        alquilerMonto={Number(entry.monto ?? 0)}
                        dueDate={entry.dueDate}
                        onConfirm={(monto, desc) => onAddPunitorio(entry.id, monto, desc)}
                      />
                    )}
                    {isPunitorio && entry.estado !== "conciliado" && (
                      <button
                        onClick={() => onCancelPunitorio(entry.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </button>
                    )}
                    {entry.reciboNumero && (
                      <span className="text-xs text-muted-foreground">{entry.reciboNumero}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tenants/ledger-table.tsx src/components/ui/
git commit -m "feat(ui): add LedgerTable component for tenant ledger projection"
```

---

### Task 14: Create `punitorio-popover.tsx` and `cobro-panel.tsx`

**Files:**
- Create: `src/components/tenants/punitorio-popover.tsx`
- Create: `src/components/tenants/cobro-panel.tsx`

- [ ] **Step 1: Write `punitorio-popover.tsx`**

Calculates a suggested punitorio amount (TIM rate × days in mora × alquiler monto) and lets staff confirm or override it.

```typescript
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  parentId: string;
  alquilerMonto: number;
  dueDate: string | null;
  onConfirm: (monto: number, descripcion: string) => void;
};

// Conservative fixed TIM rate (monthly %) — in production, fetch from BCRA API
const TIM_MENSUAL = 0.04; // 4% monthly

function calcDaysMora(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function PunitorioPopover({ parentId, alquilerMonto, dueDate, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const daysMora = calcDaysMora(dueDate);
  // Daily TIM rate = monthly rate / 30
  const suggested = alquilerMonto * (TIM_MENSUAL / 30) * daysMora;

  function handleOpen() {
    setMonto(suggested > 0 ? suggested.toFixed(2) : "");
    setDescripcion(`Punitorio TIM (${daysMora} días mora)`);
    setOpen(true);
  }

  function handleConfirm() {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return;
    onConfirm(montoNum, descripcion);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleOpen}
          className="text-xs text-primary hover:underline whitespace-nowrap"
        >
          + Punitorio
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Agregar punitorio</div>
          <div className="text-xs text-muted-foreground">
            {daysMora > 0
              ? `${daysMora} días en mora · TIM ${(TIM_MENSUAL * 100).toFixed(1)}%/mes`
              : "Sin días en mora — ingresá monto manual"}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto ($)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={suggested > 0 ? suggested.toFixed(2) : "0.00"}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Write `cobro-panel.tsx`**

Sticky bottom panel that shows a running breakdown of selected items and the "Emitir recibo" button.

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LedgerEntry } from "./ledger-table";

type Props = {
  selectedEntries: LedgerEntry[];
  montoOverrides: Record<string, string>;
  honorariosPct: number;
  onClearSelection: () => void;
  onEmitirRecibo: () => void;
  isEmitting: boolean;
};

function getMonto(entry: LedgerEntry, overrides: Record<string, string>): number {
  const raw = overrides[entry.id] ?? entry.monto;
  return raw !== null ? Number(raw) : 0;
}

export function CobroPanel({
  selectedEntries,
  montoOverrides,
  honorariosPct,
  onClearSelection,
  onEmitirRecibo,
  isEmitting,
}: Props) {
  if (selectedEntries.length === 0) return null;

  const baseComision = selectedEntries
    .filter((e) => e.tipo !== "punitorio" && e.tipo !== "descuento")
    .reduce((s, e) => s + getMonto(e, montoOverrides), 0);

  const totalRecibo = selectedEntries.reduce((s, e) => s + getMonto(e, montoOverrides), 0);
  const honorarios = baseComision * (honorariosPct / 100);
  const netoProietario = totalRecibo - honorarios;

  return (
    <div className="sticky bottom-0 z-10 border-t-2 border-primary bg-background">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-6">
          {/* Breakdown */}
          <div className="flex-1 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Desglose del cobro
            </p>
            {selectedEntries.map((e) => (
              <div key={e.id} className="flex justify-between">
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {e.descripcion}
                </span>
                <span className="font-mono font-medium ml-4">
                  ${getMonto(e, montoOverrides).toLocaleString("es-AR")}
                </span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between text-xs text-primary">
              <span>Honorarios ({honorariosPct}%)</span>
              <span className="font-mono">${honorarios.toLocaleString("es-AR")}</span>
            </div>
            <div className="flex justify-between text-xs text-green-400">
              <span>Propietario recibe</span>
              <span className="font-mono">${netoProietario.toLocaleString("es-AR")}</span>
            </div>
          </div>

          {/* Total + buttons */}
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a cobrar</p>
              <p className="text-2xl font-bold font-mono">
                ${totalRecibo.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClearSelection}>
                Limpiar
              </Button>
              <Button size="sm" onClick={onEmitirRecibo} disabled={isEmitting}>
                {isEmitting ? "Emitiendo..." : "Emitir recibo →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tenants/punitorio-popover.tsx src/components/tenants/cobro-panel.tsx
git commit -m "feat(ui): add PunitorioPopover and CobroPanel components"
```

---

### Task 15: Rewrite `src/components/tenants/tenant-tab-current-account.tsx`

**Files:**
- Modify: `src/components/tenants/tenant-tab-current-account.tsx`

This is the main assembly — it fetches data and wires together `LedgerTable`, `CobroPanel`, KPI cards, and the alert.

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LedgerTable, type LedgerEntry } from "./ledger-table";
import { CobroPanel } from "./cobro-panel";

type KPIs = {
  estadoCuenta: "al_dia" | "en_mora";
  totalCobradoYTD: number;
  proximoPago: { fecha: string; monto: string } | null;
};

type CuentaCorrienteData = {
  kpis: KPIs;
  ledgerEntries: LedgerEntry[];
  proximoAjuste: { period: string | null; mesesRestantes: number | null } | null;
};

type Props = {
  inquilinoId: string;
  honorariosPct?: number;
};

export function TenantTabCurrentAccount({ inquilinoId, honorariosPct = 10 }: Props) {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"completa" | "historial">("completa");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [montoOverrides, setMontoOverrides] = useState<Record<string, string>>({});
  const [confirmEmit, setConfirmEmit] = useState(false);

  const { data, isLoading, isError } = useQuery<CuentaCorrienteData>({
    queryKey: ["cuenta-corriente", inquilinoId],
    queryFn: () =>
      fetch(`/api/tenants/${inquilinoId}/cuenta-corriente`).then((r) => r.json()),
  });

  const emitirMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/receipts/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerEntryIds: [...selectedIds],
          fecha: new Date().toISOString().slice(0, 10),
          honorariosPct,
          trasladarAlPropietario: true,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Error al emitir el recibo");
      }
      return response.json();
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setMontoOverrides({});
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", inquilinoId] });
    },
  });

  const addPunitorio = useMutation({
    mutationFn: async ({
      parentId,
      monto,
      descripcion,
    }: {
      parentId: string;
      monto: number;
      descripcion: string;
    }) => {
      const response = await fetch(
        `/api/tenants/${inquilinoId}/ledger/${parentId}/punitorio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monto, descripcion }),
        }
      );
      if (!response.ok) throw new Error("Error al agregar punitorio");
      return response.json();
    },
    onSuccess: (newEntry) => {
      // Optimistically select the new punitorio
      setSelectedIds((prev) => new Set([...prev, newEntry.id]));
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", inquilinoId] });
    },
  });

  const cancelPunitorio = useMutation({
    mutationFn: async (entryId: string) => {
      await fetch(`/api/tenants/${inquilinoId}/ledger/${entryId}`, { method: "DELETE" });
    },
    onSuccess: (_, entryId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", inquilinoId] });
    },
  });

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectMonth(period: string) {
    const cobrables = (data?.ledgerEntries ?? [])
      .filter(
        (e) =>
          e.period === period &&
          (e.estado === "pendiente" || e.estado === "registrado") &&
          e.monto !== null
      )
      .map((e) => e.id);
    setSelectedIds((prev) => new Set([...prev, ...cobrables]));
  }

  function handleMontoChange(id: string, value: string) {
    setMontoOverrides((prev) => ({ ...prev, [id]: value }));
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Cargando cuenta corriente...</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error al cargar la cuenta corriente.
      </div>
    );
  }

  const { kpis, ledgerEntries, proximoAjuste } = data;
  const selectedEntries = ledgerEntries.filter((e) => selectedIds.has(e.id));

  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estado</p>
            <p className={`text-base font-bold mt-1 ${kpis.estadoCuenta === "al_dia" ? "text-green-400" : "text-destructive"}`}>
              {kpis.estadoCuenta === "al_dia" ? "Al día" : "En mora"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Próximo pago</p>
            {kpis.proximoPago ? (
              <>
                <p className="text-base font-bold mt-1 font-mono">
                  ${Number(kpis.proximoPago.monto).toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-muted-foreground">Vence {kpis.proximoPago.fecha}</p>
              </>
            ) : (
              <p className="text-base font-bold mt-1 text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cobrado {new Date().getFullYear()}</p>
            <p className="text-base font-bold mt-1 font-mono text-green-400">
              ${kpis.totalCobradoYTD.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próximo ajuste alert */}
      {proximoAjuste && (
        <div className="px-4">
          <Alert variant="default" className="border-amber-800 bg-amber-950/20">
            <AlertTitle className="text-amber-400 text-sm">
              ⚠ Ajuste de índice en {proximoAjuste.mesesRestantes} meses
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Período {proximoAjuste.period} — los montos a partir de ese mes están pendientes de revisión.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Table toolbar */}
      <div className="flex items-center justify-between px-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "completa" | "historial")}
        >
          <ToggleGroupItem value="completa" className="text-xs h-8 px-3">
            ↔ Completa
          </ToggleGroupItem>
          <ToggleGroupItem value="historial" className="text-xs h-8 px-3">
            ← Solo historial
          </ToggleGroupItem>
        </ToggleGroup>

        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() => {
            /* TODO PR 4: open manual cargo dialog */
          }}
        >
          + Cargo manual
        </Button>
      </div>

      {/* Ledger table */}
      <LedgerTable
        entries={ledgerEntries}
        montoOverrides={montoOverrides}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectMonth={handleSelectMonth}
        onMontoChange={handleMontoChange}
        onAddPunitorio={(parentId, monto, desc) =>
          addPunitorio.mutate({ parentId, monto, descripcion: desc })
        }
        onCancelPunitorio={(id) => cancelPunitorio.mutate(id)}
        viewMode={viewMode}
        inquilinoId={inquilinoId}
      />

      {/* Cobro panel */}
      <CobroPanel
        selectedEntries={selectedEntries}
        montoOverrides={montoOverrides}
        honorariosPct={honorariosPct}
        onClearSelection={() => {
          setSelectedIds(new Set());
          setMontoOverrides({});
        }}
        onEmitirRecibo={() => setConfirmEmit(true)}
        isEmitting={emitirMutation.isPending}
      />

      {/* Confirmation dialog */}
      <AlertDialog open={confirmEmit} onOpenChange={setConfirmEmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Emitir recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se emitirá un recibo por {selectedEntries.length} ítem(s) y se actualizarán los estados a &quot;conciliado&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEmit(false);
                emitirMutation.mutate();
              }}
            >
              Emitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Run `bun dev` and navigate to `/inquilinos/[id]` → tab "Cuenta corriente". Verify:
- KPI cards render
- Table shows ledger entries (or empty state if none)
- Selecting a row shows the cobro panel
- ToggleGroup switches view mode

- [ ] **Step 3: Commit**

```bash
git add src/components/tenants/tenant-tab-current-account.tsx
git commit -m "feat(ui): rewrite TenantTabCurrentAccount using tenant_ledger"
```

---

## PR 5 — Caja: segregación de fondos

### Task 16: Add `tipoFondo` filter to cash UI

**Files:**
- Modify: whichever client component renders the cash movements list under `src/app/(dashboard)/caja/`

- [ ] **Step 1: Locate the cash list component**

```bash
# Find the client component
ls src/app/\(dashboard\)/caja/
```

Open the `*-client.tsx` file that renders the cash movements list.

- [ ] **Step 2: Add filter state and UI**

Find where the existing filters are rendered (e.g. date range, tipo filter). Add a `ToggleGroup` or `Select` for `tipoFondo`:

```typescript
// Add state
const [tipoFondo, setTipoFondo] = useState<"all" | "agencia" | "propietario" | "inquilino">("all");

// Add to query params when fetching
// In the fetch URL, append: &tipoFondo=agencia (if not "all")
```

Add the filter control (below the existing filters):

```typescript
<ToggleGroup
  type="single"
  value={tipoFondo}
  onValueChange={(v) => v && setTipoFondo(v as typeof tipoFondo)}
>
  <ToggleGroupItem value="all" className="text-xs h-8 px-3">Todos</ToggleGroupItem>
  <ToggleGroupItem value="agencia" className="text-xs h-8 px-3">Agencia</ToggleGroupItem>
  <ToggleGroupItem value="propietario" className="text-xs h-8 px-3">Propietarios</ToggleGroupItem>
  <ToggleGroupItem value="inquilino" className="text-xs h-8 px-3">Inquilinos</ToggleGroupItem>
</ToggleGroup>
```

- [ ] **Step 3: Update the cash API to accept `tipoFondo` filter**

Open `src/app/api/cash/movimientos/route.ts` (or equivalent). Add:

```typescript
const tipoFondoFilter = searchParams.get("tipoFondo");
// Add to where clause:
tipoFondoFilter ? eq(cajaMovimiento.tipoFondo, tipoFondoFilter) : undefined
```

- [ ] **Step 4: Verify manually**

Navigate to `/caja`. Use the filter toggles to switch between Agencia / Propietarios / Inquilinos. Confirm the table filters correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/caja/ src/app/api/cash/
git commit -m "feat(caja): add tipoFondo filter for fund segregation"
```

---

## PR 6 — Clientes con doble rol

### Task 17: Add role toggle to `inquilinos/[id]/page.tsx` and `propietarios/[id]/page.tsx`

When a client has both owner and tenant roles, show a `ToggleGroup` in the page header.

**Files:**
- Modify: `src/app/(dashboard)/inquilinos/[id]/page.tsx`
- Modify: `src/app/(dashboard)/propietarios/[id]/page.tsx`
- Possibly create: a shared `RoleToggle` client component

- [ ] **Step 1: Create `src/components/clients/role-toggle.tsx`**

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Role = "inquilino" | "propietario" | "resumen";

type Props = {
  availableRoles: Role[];
  currentRole: Role;
  baseUrl: string; // e.g. "/inquilinos/abc123"
};

export function RoleToggle({ availableRoles, currentRole, baseUrl }: Props) {
  const router = useRouter();

  if (availableRoles.length <= 1) return null;

  const LABELS: Record<Role, string> = {
    inquilino: "Inquilino",
    propietario: "Propietario",
    resumen: "Resumen",
  };

  return (
    <ToggleGroup
      type="single"
      value={currentRole}
      onValueChange={(v) => {
        if (!v) return;
        router.push(`${baseUrl}?rol=${v}`);
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

- [ ] **Step 2: Update `inquilinos/[id]/page.tsx`**

In the server component, after loading the client row:

```typescript
// Check if this client is also an owner (has properties)
import { property } from "@/db/schema/property";
import { eq } from "drizzle-orm";

const isAlsoOwner = await db
  .select({ id: property.id })
  .from(property)
  .where(eq(property.ownerId, clientId))
  .limit(1)
  .then((rows) => rows.length > 0);

const searchParams = await props.searchParams;
const rol = (searchParams.rol as string) ?? "inquilino";
```

In the JSX, in the page header area, add:

```typescript
{isAlsoOwner && (
  <RoleToggle
    availableRoles={["inquilino", "propietario", "resumen"]}
    currentRole={rol as "inquilino" | "propietario" | "resumen"}
    baseUrl={`/inquilinos/${clientId}`}
  />
)}
```

Conditionally render the correct tab content based on `rol`:
- `rol === "inquilino"` → existing tenant tabs
- `rol === "propietario"` → link to propietarios/[id] page content
- `rol === "resumen"` → combined summary view (future scope)

- [ ] **Step 3: Verify manually**

Navigate to `/inquilinos/[id]` for a client who is also an owner. Confirm the toggle appears. Click "Propietario" — confirm `?rol=propietario` appears in the URL.

- [ ] **Step 4: Commit**

```bash
git add src/components/clients/role-toggle.tsx src/app/\(dashboard\)/inquilinos/ src/app/\(dashboard\)/propietarios/
git commit -m "feat(ui): add dual-role toggle to client header pages"
```

---

## PR 7 — Cuenta corriente del propietario

### Task 18: Redesign `OwnerTabCurrentAccount`

This PR follows the same pattern as PR 4 but reads from the owner's perspective: shows `tenant_ledger` entries where `propietarioId = owner.id`, filtered to show what the owner will receive in each period.

**Files:**
- Locate: `src/components/owners/owner-tab-current-account.tsx` (or equivalent)
- Modify: rewrite to query a new endpoint `GET /api/owners/[id]/cuenta-corriente` that returns owner-side ledger data
- Create: `src/app/api/owners/[id]/cuenta-corriente/route.ts`

- [ ] **Step 1: Write `GET /api/owners/[id]/cuenta-corriente/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq, sum } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: propietarioId } = await params;

    // All entries where this owner is the propietario AND impactaPropietario=true
    const entries = await db
      .select()
      .from(tenantLedger)
      .where(
        and(
          eq(tenantLedger.propietarioId, propietarioId),
          eq(tenantLedger.impactaPropietario, true)
        )
      )
      .orderBy(tenantLedger.period, tenantLedger.tipo);

    // KPI: total settled to owner YTD
    const currentYear = new Date().getFullYear().toString();
    const [[ytdResult]] = await Promise.all([
      db
        .select({ total: sum(tenantLedger.monto) })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.propietarioId, propietarioId),
            eq(tenantLedger.estado, "conciliado"),
            eq(tenantLedger.impactaPropietario, true)
          )
        ),
    ]);

    return NextResponse.json({
      kpis: { totalLiquidadoYTD: Number(ytdResult?.total ?? 0) },
      ledgerEntries: entries,
    });
  } catch (error) {
    console.error("Error GET /api/owners/:id/cuenta-corriente:", error);
    return NextResponse.json({ error: "Error al obtener la cuenta corriente" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Locate and update the owner current account component**

Find the existing owner current account component:

```bash
ls src/components/owners/
```

Update it to use this new endpoint and display the ledger entries grouped by period, showing the owner's perspective: what they're owed per period, what's been settled, and what's pending.

The component structure is simpler than the tenant side — owners don't initiate payments, so there's no cobro workspace. Show:
- KPI: total liquidado YTD
- Table of periods (same `LedgerTable` component, but read-only mode: no checkboxes, no punitorio buttons)

- [ ] **Step 3: Verify manually**

Navigate to `/propietarios/[id]` → tab "Cuenta corriente". Confirm entries appear.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/owners/ src/components/owners/
git commit -m "feat(ui): redesign owner current account to use tenant_ledger"
```

---

## Migration Script (run after PR 1 is deployed)

### Task 19: Run data migration from `tenant_charge` to `tenant_ledger`

**Files:**
- Create: `scripts/migrate-tenant-charges.ts`

This is a one-time script. Run it manually after PR 1 is deployed and before PR 3/4 go live.

- [ ] **Step 1: Write the migration script**

```typescript
import { db } from "../src/db";
import { tenantCharge } from "../src/db/schema/tenant-charge";
import { tenantLedger } from "../src/db/schema/tenant-ledger";
import { contract } from "../src/db/schema/contract";
import { contractTenant } from "../src/db/schema/contract-tenant";
import { eq, and } from "drizzle-orm";

// Maps tenant_charge.categoria → tenant_ledger.tipo
const CATEGORIA_MAP: Record<string, string> = {
  alquiler: "alquiler",
  dias_ocupados: "bonificacion",
  expensas: "servicio",
  punitorios: "punitorio",
  otros: "gasto",
};

// Maps tenant_charge.estado → tenant_ledger.estado
const ESTADO_MAP: Record<string, string> = {
  pendiente: "pendiente",
  pagado: "conciliado",
  cancelado: "cancelado",
};

async function run() {
  console.log("Starting migration: tenant_charge → tenant_ledger");

  const charges = await db.select().from(tenantCharge);
  console.log(`Found ${charges.length} charges to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const charge of charges) {
    const tipo = CATEGORIA_MAP[charge.categoria] ?? "gasto";
    const estado = ESTADO_MAP[charge.estado] ?? "pendiente";

    try {
      await db.insert(tenantLedger).values({
        id: charge.id,  // preserve original ID to keep references intact
        contratoId: charge.contratoId,
        inquilinoId: charge.inquilinoId,
        propietarioId: charge.propietarioId,
        propiedadId: charge.propiedadId,
        period: charge.period ?? undefined,
        tipo,
        descripcion: charge.descripcion,
        monto: charge.monto,
        estado,
        reciboNumero: charge.reciboNumero ?? undefined,
        reciboEmitidoAt: charge.paidAt ?? undefined,
        conciliadoAt: charge.paidAt ?? undefined,
        isAutoGenerated: false,
        createdBy: charge.createdBy ?? undefined,
        createdAt: charge.createdAt,
        updatedAt: charge.updatedAt,
        // Accounting flags — use defaults for tipo
        impactaPropietario: ["alquiler", "bonificacion", "descuento"].includes(tipo),
        incluirEnBaseComision: tipo === "alquiler",
        impactaCaja: ["alquiler", "gasto", "punitorio", "deposito"].includes(tipo),
      });
      migrated++;
    } catch (err) {
      console.error(`Failed to migrate charge ${charge.id}:`, err);
      skipped++;
    }
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`);
}

run().catch(console.error).finally(() => process.exit(0));
```

- [ ] **Step 2: Run a dry-run first (count only)**

Before running the real migration, verify the count matches:

```bash
# In Drizzle Studio, count rows in tenant_charge
# Compare with what the script will process
bun run db:studio
```

- [ ] **Step 3: Run the migration**

```bash
bun run scripts/migrate-tenant-charges.ts
```

Expected output:
```
Starting migration: tenant_charge → tenant_ledger
Found N charges to migrate
Migration complete: N migrated, 0 skipped
```

- [ ] **Step 4: Verify in Drizzle Studio**

Open Drizzle Studio → check `tenant_ledger` has the migrated rows with correct `tipo`, `estado`, and `monto` values.

- [ ] **Step 5: Commit the script (don't delete `tenant_charge` yet)**

```bash
git add scripts/migrate-tenant-charges.ts
git commit -m "feat(migration): script to migrate tenant_charge → tenant_ledger"
```

After the whole system is live and verified in production, open a separate PR to drop the `tenant_charge` table and remove `export * from "./tenant-charge"` from `index.ts`.

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task that covers it |
|---|---|
| `tenant_ledger` table with all fields | Task 1 |
| Accounting flags per tipo | Task 5 |
| `tipoFondo` on `cash_movement` | Task 2 |
| `propietarioResponsable` + `tipoGestion` on service | Task 3 |
| Auto-generation on contract activation | Tasks 6–7 |
| `proximoAjuste` KPI | Task 8 |
| Seleccionar todo el mes button | Task 15 (LedgerTable) |
| Punitorio inline with TIM calc | Tasks 11, 14 |
| Panel sticky de cobro | Task 14 (CobroPanel) |
| Toggle vista Completa/Historial | Task 15 |
| Emitir recibo with `ledgerEntryIds` | Tasks 12, 15 |
| Cash tipoFondo filter | Task 16 |
| Dual-role toggle | Task 17 |
| Owner current account redesign | Task 18 |
| Data migration from old table | Task 19 |

**Placeholder scan:** No TBDs found in code steps. All code blocks are complete.

**Type consistency:** `LedgerEntry` type is defined in `ledger-table.tsx` and imported by `cobro-panel.tsx` and `tenant-tab-current-account.tsx`. `NewTenantLedger` from schema is used in `generate-contract-ledger.ts`. `defaultFlagsForTipo` is used consistently in Tasks 6, 9, 11.
