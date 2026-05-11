# Address Split + Property Creation Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `property.address` into `addressStreet` + `addressNumber` + `floorUnit`, derive the full address string everywhere via a helper, and replace the "Nueva propiedad" dialog with direct navigation to the creation page.

**Architecture:** Data migration populates `addressStreet` from existing `address` values first; then all code replaces `property.address` references with `formatAddress()`; then `bun run db:push` applies the schema change. TypeScript errors after the schema update act as a checklist of remaining usages.

**Tech Stack:** Drizzle ORM, Next.js Route Handlers, React (client components), Zod, Bun

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/migrate-address-split.ts` | Create | Data migration: `address → addressStreet` |
| `src/lib/properties/format-address.ts` | Create | `formatAddress()` helper |
| `src/lib/properties/format-address.test.ts` | Create | Unit tests for helper |
| `src/db/schema/property.ts` | Modify | Remove `address`, NOT NULL `addressStreet`, nullable `ownerId` |
| `src/app/api/properties/route.ts` | Modify | POST schema + GET select + search |
| `src/app/api/properties/[id]/route.ts` | Modify | PATCH schema + GET select |
| `src/app/api/tenants/[id]/route.ts` | Modify | Property address in contract enrichment |
| `src/app/api/tenants/route.ts` | Modify | `propertyAddress` computed field |
| `src/app/api/owners/route.ts` | Modify | Property search + address select |
| `src/app/api/owners/[id]/cuenta-corriente/route.ts` | Modify | Property address select |
| `src/app/api/contracts/route.ts` | Modify | Search + `propertyAddress` field |
| `src/app/api/services/route.ts` | Modify | Search + `propertyAddress` field |
| `src/app/api/tasks/route.ts` | Modify | `propertyAddress` field |
| `src/app/api/guarantees/route.ts` | Modify | `address` field in response |
| `src/app/api/guarantors/[id]/route.ts` | Modify | `address` field in response |
| `src/app/api/cash/movimientos/route.ts` | Modify | `propiedadDireccion` field |
| `src/app/api/index-values/adjustments/route.ts` | Modify | `propertyAddress` field |
| `src/app/api/document-templates/resolve/route.ts` | Modify | Property context for variable resolver |
| `src/lib/receipts/load.ts` | Modify | Property address select + interface |
| `src/lib/comprobantes/load.ts` | Modify | Property address select + interface |
| `src/lib/document-templates/variables-catalog.ts` | Modify | `domicilio_propiedad_completo` resolver |
| `src/app/(dashboard)/propiedades/[id]/page.tsx` | Modify | Remove `address` state/display, use `formatAddress` |
| `src/app/(dashboard)/comprobantes/[id]/page.tsx` | Modify | `direccionPropiedad` computation |
| `src/app/(dashboard)/recibos/[id]/page.tsx` | Modify | `direccionPropiedad` computation |
| `src/app/(dashboard)/caja/caja-general-client.tsx` | Modify | Property label in select |
| `src/app/(dashboard)/propiedades/nueva/page.tsx` | Modify | Remove QuickPropertyForm wrapper, navigation entry |
| `src/components/properties/property-list.tsx` | Modify | Remove dialog, add `router.push` |
| `src/components/properties/quick-property-form.tsx` | Modify | `address` → `addressStreet` + `addressNumber` |
| `src/components/owners/owner-tab-properties.tsx` | Modify | `prop.address` display |
| `src/components/owners/owner-tab-current-account.tsx` | Modify | `p.address` display |
| `src/components/tenants/tenant-tab-contract.tsx` | Modify | `property.address` display |
| `src/components/tenants/tenant-tab-property.tsx` | Modify | `property.address` display |
| `src/components/contracts/contract-form.tsx` | Modify | Property label computation |
| `src/components/tasks/tasks-panel.tsx` | Modify | Property label in select |

---

### Task 1: Write and run data migration script

**Files:**
- Create: `scripts/migrate-address-split.ts`

- [ ] **Step 1: Create migration script**

```ts
// scripts/migrate-address-split.ts
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating property address → addressStreet...");
  const result = await db.execute(sql`
    UPDATE property
    SET "addressStreet" = address
    WHERE "addressStreet" IS NULL OR "addressStreet" = ''
  `);
  console.log("Migration complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Run migration**

```bash
bun run scripts/migrate-address-split.ts
```

Expected output:
```
Migrating property address → addressStreet...
Migration complete.
```

- [ ] **Step 3: Verify (Drizzle Studio or Neon console)**

Run this query to confirm no NULLs remain:
```sql
SELECT COUNT(*) FROM property WHERE "addressStreet" IS NULL;
-- Expected: 0
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-address-split.ts
git commit -m "chore: add address-split data migration script"
```

---

### Task 2: Create `formatAddress` helper with tests

**Files:**
- Create: `src/lib/properties/format-address.ts`
- Create: `src/lib/properties/format-address.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/properties/format-address.test.ts
import { describe, test, expect } from "bun:test";
import { formatAddress } from "./format-address";

describe("formatAddress", () => {
  test("street + number + unit", () => {
    expect(formatAddress({ addressStreet: "Godoy Cruz", addressNumber: "2814", floorUnit: "3B" }))
      .toBe("Godoy Cruz 2814 - 3B");
  });
  test("street + number, no unit", () => {
    expect(formatAddress({ addressStreet: "Godoy Cruz", addressNumber: "2814" }))
      .toBe("Godoy Cruz 2814");
  });
  test("street only", () => {
    expect(formatAddress({ addressStreet: "Av. Colón" })).toBe("Av. Colón");
  });
  test("null number and unit", () => {
    expect(formatAddress({ addressStreet: "Av. Colón", addressNumber: null, floorUnit: null }))
      .toBe("Av. Colón");
  });
  test("empty number string treated as missing", () => {
    expect(formatAddress({ addressStreet: "San Martín", addressNumber: "" }))
      .toBe("San Martín");
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

```bash
bun test src/lib/properties/format-address.test.ts
```

Expected: file not found / import error.

- [ ] **Step 3: Implement helper**

```ts
// src/lib/properties/format-address.ts
export function formatAddress(p: {
  addressStreet: string;
  addressNumber?: string | null;
  floorUnit?: string | null;
}): string {
  const main = [p.addressStreet, p.addressNumber].filter(Boolean).join(" ");
  return p.floorUnit ? `${main} - ${p.floorUnit}` : main;
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
bun test src/lib/properties/format-address.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/properties/format-address.ts src/lib/properties/format-address.test.ts
git commit -m "feat: add formatAddress helper for property display"
```

---

### Task 3: Update POST `/api/properties` and GET list

**Files:**
- Modify: `src/app/api/properties/route.ts`

- [ ] **Step 1: Update `createPropertySchema` and POST handler**

Replace the `createPropertySchema` constant (around line 14) and the POST insert section:

```ts
// src/app/api/properties/route.ts — createPropertySchema
const createPropertySchema = z.object({
  title: z.string().optional().nullable(),
  addressStreet: z.string().min(1, "La calle es requerida"),
  addressNumber: z.string().optional().nullable(),
  type: z.enum(PROPERTY_TYPES, {
    errorMap: () => ({ message: "El tipo de propiedad no es válido" }),
  }),
  rentalStatus: z.enum(RENTAL_STATUSES).default("available"),
  saleStatus: z.enum(SALE_STATUSES).optional().nullable(),
  rentalPrice: z.coerce.number().optional().nullable(),
  rentalPriceCurrency: z.enum(["ARS", "USD"]).default("ARS"),
  salePrice: z.coerce.number().optional().nullable(),
  salePriceCurrency: z.enum(["ARS", "USD"]).default("USD"),
  zone: z.string().optional().nullable(),
  floorUnit: z.string().optional().nullable(),
  rooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  surface: z.coerce.number().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});
```

In the POST handler, replace the owner validation block and insert (around lines 222-260):

```ts
// Owner validation — only if provided
if (data.ownerId) {
  const [existingClient] = await db
    .select()
    .from(client)
    .where(and(eq(client.id, data.ownerId), eq(client.agencyId, agencyId)))
    .limit(1);
  if (!existingClient) {
    return NextResponse.json({ error: "El dueño especificado no existe" }, { status: 400 });
  }
}

const propertyId = generateId();
const now = new Date();

const [newProperty] = await db
  .insert(property)
  .values({
    id: propertyId,
    agencyId,
    title: data.title || data.addressStreet,
    addressStreet: data.addressStreet,
    addressNumber: data.addressNumber ?? null,
    type: data.type,
    rentalStatus: data.rentalStatus,
    saleStatus: data.saleStatus ?? null,
    rentalPrice: data.rentalPrice?.toString() || null,
    rentalPriceCurrency: data.rentalPriceCurrency,
    salePrice: data.salePrice?.toString() || null,
    salePriceCurrency: data.salePriceCurrency,
    zone: data.zone,
    floorUnit: data.floorUnit,
    rooms: data.rooms,
    bathrooms: data.bathrooms,
    surface: data.surface?.toString() || null,
    ownerId: data.ownerId ?? null,
    createdBy: session!.user.id,
    createdAt: now,
    updatedAt: now,
  })
  .returning();
```

- [ ] **Step 2: Update GET select and search**

In the GET handler, replace `address: property.address` in the select (around line 89) with:
```ts
addressStreet: property.addressStreet,
addressNumber: property.addressNumber,
```

Replace the search condition (around line 75):
```ts
// Before
ilike(property.address, term),
// After
ilike(property.addressStreet, term),
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/properties/route.ts
git commit -m "feat(api): replace address with addressStreet in POST + GET /api/properties"
```

---

### Task 4: Update PATCH and GET `/api/properties/[id]`

**Files:**
- Modify: `src/app/api/properties/[id]/route.ts`

- [ ] **Step 1: Remove `address` from `updatePropertySchema`**

In `updatePropertySchema` (around line 16), remove:
```ts
address: z.string().min(1).optional(),
```

- [ ] **Step 2: Remove `address` from GET select**

In the GET handler select (around line 74), remove:
```ts
address: property.address,
```
(`addressStreet` and `addressNumber` are already selected at lines 102-103 — no new lines needed.)

- [ ] **Step 3: Remove `address` from PATCH update logic**

In the PATCH handler (around line 195), remove:
```ts
if (data.address !== undefined) updateData.address = data.address;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/properties/[id]/route.ts
git commit -m "feat(api): remove address field from GET + PATCH /api/properties/[id]"
```

---

### Task 5: Update remaining API routes — batch

**Files:**
- Modify: `src/app/api/tenants/[id]/route.ts`
- Modify: `src/app/api/tenants/route.ts`
- Modify: `src/app/api/owners/route.ts`
- Modify: `src/app/api/owners/[id]/cuenta-corriente/route.ts`
- Modify: `src/app/api/contracts/route.ts`
- Modify: `src/app/api/services/route.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/guarantees/route.ts`
- Modify: `src/app/api/guarantors/[id]/route.ts`
- Modify: `src/app/api/cash/movimientos/route.ts`
- Modify: `src/app/api/index-values/adjustments/route.ts`
- Modify: `src/app/api/document-templates/resolve/route.ts`

Add this import to each file that uses `formatAddress`:
```ts
import { formatAddress } from "@/lib/properties/format-address";
```

**`src/app/api/tenants/[id]/route.ts`** — three changes:

1. Line ~158 — property select for contract enrichment:
```ts
// Before
.select({ id: property.id, address: property.address })
// After
.select({ id: property.id, addressStreet: property.addressStreet, addressNumber: property.addressNumber, floorUnit: property.floorUnit })
```

2. Line ~163 — contractPropMap storage:
```ts
// Before
for (const p of contractProps) contractPropMap[p.id] = p.address;
// After
for (const p of contractProps) contractPropMap[p.id] = formatAddress({ addressStreet: p.addressStreet ?? "", addressNumber: p.addressNumber, floorUnit: p.floorUnit });
```

3. Line ~201 — property address in response:
```ts
// Before
address: property.address,
// After
addressStreet: property.addressStreet,
addressNumber: property.addressNumber,
floorUnit: property.floorUnit,
```
(Frontend consumers of this field will be updated in Task 9.)

**`src/app/api/tenants/route.ts`** — line ~127:
```ts
// Before
propertyAddress: property.address,
// After
propertyAddress: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
```

**`src/app/api/owners/route.ts`** — three changes:

1. Line ~86 — select:
```ts
// Before
.select({ ownerId: property.ownerId, address: property.address })
// After
.select({ ownerId: property.ownerId, addressStreet: property.addressStreet, addressNumber: property.addressNumber, floorUnit: property.floorUnit })
```

2. Line ~95 — search:
```ts
// Before
ilike(property.address, likeQ)
// After
ilike(property.addressStreet, likeQ)
```

3. Line ~101 — map storage:
```ts
// Before
propMatchMap[pm.ownerId] = pm.address;
// After
propMatchMap[pm.ownerId] = formatAddress({ addressStreet: pm.addressStreet ?? "", addressNumber: pm.addressNumber, floorUnit: pm.floorUnit });
```

**`src/app/api/owners/[id]/cuenta-corriente/route.ts`** — line ~111:
```ts
// Before
.selectDistinct({ id: property.id, address: property.address })
// After
.selectDistinct({ id: property.id, addressStreet: property.addressStreet, addressNumber: property.addressNumber, floorUnit: property.floorUnit })
```

Find where `p.address` is used after this select and replace with `formatAddress({ addressStreet: p.addressStreet ?? "", addressNumber: p.addressNumber, floorUnit: p.floorUnit })`.

**`src/app/api/contracts/route.ts`** — two changes:

1. Line ~69 — search:
```ts
// Before
ilike(property.address, `%${q}%`)
// After
ilike(property.addressStreet, `%${q}%`)
```

2. Line ~89 — response field:
```ts
// Before
propertyAddress: property.address,
// After
propertyAddress: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
```

**`src/app/api/services/route.ts`** — two changes:

1. Line ~47 — search:
```ts
// Before
addressSearch ? ilike(property.address, `%${addressSearch}%`) : null,
// After
addressSearch ? ilike(property.addressStreet, `%${addressSearch}%`) : null,
```

2. Line ~63 — response field:
```ts
// Before
propertyAddress: property.address,
// After
propertyAddress: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
```

**`src/app/api/tasks/route.ts`** — line ~49:
```ts
// Before
propertyAddress: property.address,
// After
propertyAddress: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
```

**`src/app/api/guarantees/route.ts`** — line ~69:
```ts
// Before
address: property.address,
// After
addressStreet: property.addressStreet,
addressNumber: property.addressNumber,
floorUnit: property.floorUnit,
```

**`src/app/api/guarantors/[id]/route.ts`** — line ~54:
```ts
// Before
address: property.address,
// After
addressStreet: property.addressStreet,
addressNumber: property.addressNumber,
floorUnit: property.floorUnit,
```

**`src/app/api/cash/movimientos/route.ts`** — line ~63:
```ts
// Before
propiedadDireccion: property.address,
// After
propiedadDireccion: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
```

**`src/app/api/index-values/adjustments/route.ts`** — line ~32:
```ts
// Before
propertyAddress: property.address,
// After
propertyAddress: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
```

**`src/app/api/document-templates/resolve/route.ts`** — line ~175:
```ts
// Before
address: property.address,
// After
addressStreet: property.addressStreet ?? "",
addressNumber: property.addressNumber,
floorUnit: property.floorUnit,
```
(The variables catalog resolver will use `formatAddress` — handled in Task 6.)

- [ ] **Step 1: Apply all changes above across the 12 files**

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tenants/ src/app/api/owners/ src/app/api/contracts/ src/app/api/services/ src/app/api/tasks/ src/app/api/guarantees/ src/app/api/guarantors/ src/app/api/cash/ src/app/api/index-values/ src/app/api/document-templates/
git commit -m "feat(api): replace property.address with addressStreet/addressNumber across routes"
```

---

### Task 6: Update lib files

**Files:**
- Modify: `src/lib/receipts/load.ts`
- Modify: `src/lib/comprobantes/load.ts`
- Modify: `src/lib/document-templates/variables-catalog.ts`

- [ ] **Step 1: Update `src/lib/receipts/load.ts`**

Find the `propiedad` interface (around line 32) and update:
```ts
// Before
propiedad: { address: string; floorUnit: string | null } | null;
// After
propiedad: { addressStreet: string; addressNumber: string | null; floorUnit: string | null } | null;
```

Update the DB select (around line 123):
```ts
// Before
? db.select({ address: property.address, floorUnit: property.floorUnit })
// After
? db.select({ addressStreet: property.addressStreet, addressNumber: property.addressNumber, floorUnit: property.floorUnit })
```

Find all `propRow.address` / `propiedad.address` usages and replace with `formatAddress(propiedad)` (add import from `@/lib/properties/format-address`).

- [ ] **Step 2: Update `src/lib/comprobantes/load.ts`**

Same pattern as receipts/load.ts:
- Interface field: `address: string` → `addressStreet: string; addressNumber: string | null`
- DB select line ~123: `address: property.address` → `addressStreet: property.addressStreet, addressNumber: property.addressNumber`
- Any `propRow.address` usages → `formatAddress(propRow)` (add import)

- [ ] **Step 3: Update `src/lib/document-templates/variables-catalog.ts`**

The `domicilio_propiedad_completo` variable (around line 84) currently resolves `ctx.property?.address ?? null`. Update its resolver:

```ts
// Add import at top of file
import { formatAddress } from "@/lib/properties/format-address";

// Update the resolver (around line 87)
// Before
resolver: (ctx) => ctx.property?.address ?? null,
// After
resolver: (ctx) => ctx.property ? formatAddress(ctx.property) : null,
```

Note: `ctx.property` already has `addressStreet`, `addressNumber`, `floorUnit` from the resolve route. Verify the `TemplateContext` type includes these fields; if `addressStreet` is typed as `string | null`, cast with `addressStreet: ctx.property.addressStreet ?? ""`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/receipts/ src/lib/comprobantes/ src/lib/document-templates/
git commit -m "feat(lib): replace property.address with formatAddress in receipts, comprobantes, variable catalog"
```

---

### Task 7: Update the Drizzle schema

**Files:**
- Modify: `src/db/schema/property.ts`

> ⚠️ After this step, TypeScript will report errors on any remaining `property.address` references — use them as a checklist.

- [ ] **Step 1: Update schema**

In `src/db/schema/property.ts`:

1. Remove line `address: text("address").notNull(),` entirely.

2. Change `addressStreet` from nullable to NOT NULL:
```ts
// Before
addressStreet: text("addressStreet"),
// After
addressStreet: text("addressStreet").notNull(),
```

3. Make `ownerId` nullable:
```ts
// Before
ownerId: text("ownerId")
  .notNull()
  .references(() => client.id, { onDelete: "cascade" }),
// After
ownerId: text("ownerId")
  .references(() => client.id, { onDelete: "cascade" }),
```

- [ ] **Step 2: Check TypeScript errors**

```bash
bun run build 2>&1 | grep "address" | head -30
```

Fix any remaining `property.address` references that were missed (TypeScript will point to exact lines).

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/property.ts
git commit -m "feat(schema): remove address column, NOT NULL addressStreet, nullable ownerId"
```

---

### Task 8: Update property detail page (`/propiedades/[id]/page.tsx`)

**Files:**
- Modify: `src/app/(dashboard)/propiedades/[id]/page.tsx`

This is the largest change. The file has a `Property` interface, form state, and display code.

- [ ] **Step 1: Add import and update `Property` interface**

Add import at the top:
```ts
import { formatAddress } from "@/lib/properties/format-address";
```

In the `Property` interface (around line 99), make these changes:
```ts
// Remove
address: string;
// Change
addressStreet: string | null;  →  addressStreet: string;
```

- [ ] **Step 2: Remove `address` from form state**

In `savedForm` state (around line 1137):
```ts
// Before
address: "", type: "", rentalStatus: "", ...
// After — remove address:
type: "", rentalStatus: "", ...
```

In `form` state (around line 1147):
```ts
// Before
const [form, setForm] = useState({
  address: "",
  type: "",
  ...
// After — remove address: "" line
const [form, setForm] = useState({
  type: "",
  ...
```

- [ ] **Step 3: Remove `address` from form initialization**

In `initializeForm` (around line 1184):
```ts
// Remove this line:
address: prop.address,
```

- [ ] **Step 4: Remove `address` from PATCH call**

In the save handler (around line 1234):
```ts
// Remove this line:
address: form.address || undefined,
```

- [ ] **Step 5: Update breadcrumb and title display**

Around line 1441:
```ts
// Before
{prop.address}
// After
{prop.title || formatAddress(prop)}
```

Around line 1463:
```ts
// Before
{prop.address}
{prop.floorUnit ? ` — ${prop.floorUnit}` : ""}
// After
{formatAddress(prop)}
```

- [ ] **Step 6: Update edit form — remove "Dirección completa" input**

Around line 1704:
```ts
// Remove this block (the col-span-2 EditInput for "Dirección completa"):
<div className="col-span-2">
  <EditInput label="Dirección completa" value={form.address} onChange={set("address")} placeholder="Av. Corrientes 1234" />
</div>

// Make "Calle" show required asterisk:
// Before
<EditInput label="Calle" value={form.addressStreet} onChange={set("addressStreet")} placeholder="Av. Corrientes" />
// After
<EditInput label="Calle *" value={form.addressStreet} onChange={set("addressStreet")} placeholder="Av. Corrientes" />
```

- [ ] **Step 7: Update read view — "Dirección" AnnotatableField**

Around line 1918:
```ts
// Before (col-span-2 AnnotatableField)
<AnnotatableField label="Dirección" value={prop.address} fieldName="address" entityType="property" entityId={prop.id} />
// After — show computed value, read-only, no fieldName needed:
<div className="col-span-2 flex flex-col gap-1">
  <span className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">Dirección</span>
  <span className="text-sm font-medium text-foreground">{formatAddress(prop)}</span>
</div>
```

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/propiedades/[id]/page.tsx
git commit -m "feat(propiedades): replace address field with formatAddress in detail page"
```

---

### Task 9: Update comprobantes and recibos pages

**Files:**
- Modify: `src/app/(dashboard)/comprobantes/[id]/page.tsx`
- Modify: `src/app/(dashboard)/recibos/[id]/page.tsx`

- [ ] **Step 1: Update `comprobantes/[id]/page.tsx`**

Add import:
```ts
import { formatAddress } from "@/lib/properties/format-address";
```

Around line 127:
```ts
// Before
const direccionPropiedad = `${propiedad.address}${propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""}`;
// After
const direccionPropiedad = formatAddress(propiedad);
```

Update the `propiedad` interface type to match what `comprobantes/load.ts` now returns (no `address`, has `addressStreet` + `addressNumber`).

- [ ] **Step 2: Update `recibos/[id]/page.tsx`**

Add import:
```ts
import { formatAddress } from "@/lib/properties/format-address";
```

Around line 159:
```ts
// Before
? `${propiedad.address}${propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""}`
// After
? formatAddress(propiedad)
```

Update the local `propiedad` interface to remove `address: string` and use `addressStreet: string; addressNumber: string | null`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/comprobantes/ src/app/(dashboard)/recibos/
git commit -m "feat(comprobantes/recibos): use formatAddress for property display"
```

---

### Task 10: Update remaining frontend components

**Files:**
- Modify: `src/app/(dashboard)/caja/caja-general-client.tsx`
- Modify: `src/components/owners/owner-tab-properties.tsx`
- Modify: `src/components/owners/owner-tab-current-account.tsx`
- Modify: `src/components/tenants/tenant-tab-contract.tsx`
- Modify: `src/components/tenants/tenant-tab-property.tsx`
- Modify: `src/components/contracts/contract-form.tsx`
- Modify: `src/components/tasks/tasks-panel.tsx`
- Modify: `src/components/guarantees/add-guarantee-modal.tsx`
- Modify: `src/components/guarantees/guarantee-card.tsx`

For each file, add:
```ts
import { formatAddress } from "@/lib/properties/format-address";
```

Then replace `.address` property accesses on property objects. The pattern for each:

**`caja-general-client.tsx`** line ~205:
```ts
// Before
label: p.address,
// After
label: formatAddress(p),
```
Update the property interface in this file to remove `address: string`, add `addressStreet: string; addressNumber: string | null`.

**`owner-tab-properties.tsx`** lines ~177, 182, 237, 240:
```ts
// Before
<PropertyInitial address={prop.address} />
{prop.address}
// After
<PropertyInitial address={formatAddress(prop)} />
{formatAddress(prop)}
```
Update property interface fields.

**`owner-tab-current-account.tsx`** line ~125:
```ts
// Before
<span className="text-sm font-medium">{p.address}</span>
// After
<span className="text-sm font-medium">{formatAddress(p)}</span>
```

**`tenant-tab-contract.tsx`** line ~239:
```ts
// Before
{property.floorUnit ? `${property.address}, ${property.floorUnit}` : property.address}
// After
{formatAddress(property)}
```

**`tenant-tab-property.tsx`**: find and replace `property.address` with `formatAddress(property)`.

**`contract-form.tsx`** lines ~70-71 and ~249:
```ts
// Before (lines 70-71)
? `${property.address}, ${property.floorUnit}`
: property.address;
// After
formatAddress(property);

// Before (line 249)
label: p.address,
// After
label: formatAddress(p),
```

**`tasks-panel.tsx`** line ~570:
```ts
// Before
label: p.address,
// After
label: formatAddress(p),
```

**`add-guarantee-modal.tsx`** and **`guarantee-card.tsx`**: search for `\.address` on property objects and replace with `formatAddress(p)`.

- [ ] **Step 1: Apply all changes above**

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/caja/ src/components/owners/ src/components/tenants/ src/components/contracts/ src/components/tasks/ src/components/guarantees/
git commit -m "feat(ui): replace property.address with formatAddress across frontend components"
```

---

### Task 11: Update `QuickPropertyForm` — `address` → 3 fields

**Files:**
- Modify: `src/components/properties/quick-property-form.tsx`

- [ ] **Step 1: Update state**

Replace `address` state with two fields:
```ts
// Before
const [address, setAddress] = useState("");
// After
const [addressStreet, setAddressStreet] = useState("");
const [addressNumber, setAddressNumber] = useState("");
```

- [ ] **Step 2: Update validation**

In `handleCreateProperty` (around line 120):
```ts
// Before
if (!address || !type || !ownerId) {
// After
if (!addressStreet || !type || !ownerId) {
```

- [ ] **Step 3: Update API call body**

In the `fetch("/api/properties", ...)` body (around line 131):
```ts
// Before
body: JSON.stringify({
  address,
  type,
  zone: zone || null,
  floorUnit: floorUnit || null,
  ownerId,
  rentalStatus: "available",
}),
// After
body: JSON.stringify({
  addressStreet,
  addressNumber: addressNumber || null,
  type,
  zone: zone || null,
  floorUnit: floorUnit || null,
  ownerId,
  rentalStatus: "available",
}),
```

- [ ] **Step 4: Update the form JSX — replace single Dirección with CALLE + NÚMERO**

Replace the "Dirección" input block (around lines 186-198) with:
```tsx
{/* Calle + Número */}
<div className="grid grid-cols-[2fr_1fr] gap-3">
  <div className="flex flex-col gap-2">
    <Label htmlFor="addressStreet" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      Calle <span className="text-primary">*</span>
    </Label>
    <Input
      id="addressStreet"
      value={addressStreet}
      onChange={(e) => setAddressStreet(e.target.value)}
      placeholder="Ej: Godoy Cruz"
      className="bg-surface-mid border-none text-on-surface h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
    />
  </div>
  <div className="flex flex-col gap-2">
    <Label htmlFor="addressNumber" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      Número
    </Label>
    <Input
      id="addressNumber"
      value={addressNumber}
      onChange={(e) => setAddressNumber(e.target.value)}
      placeholder="Ej: 2814"
      className="bg-surface-mid border-none text-on-surface h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
    />
  </div>
</div>
```

- [ ] **Step 5: Update submit button disabled condition**

```ts
// Before
disabled={isPropertySaving || !ownerId}
// After
disabled={isPropertySaving || !ownerId || !addressStreet}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/properties/quick-property-form.tsx
git commit -m "feat(quick-form): replace address with addressStreet + addressNumber fields"
```

---

### Task 12: Update property list + `/propiedades/nueva` page

**Files:**
- Modify: `src/components/properties/property-list.tsx`
- Modify: `src/app/(dashboard)/propiedades/nueva/page.tsx`

- [ ] **Step 1: Update `property-list.tsx` — remove dialog, add navigation**

Add import:
```ts
import { formatAddress } from "@/lib/properties/format-address";
```

Remove `dialogOpen` state and the `QuickPropertyForm` import (around lines 34, 386).

Remove the entire Dialog block (around lines 485-516):
```tsx
{/* Delete this entire block: */}
{/* Modal — Nueva propiedad */}
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  ...
</Dialog>
```

Change the "Nueva propiedad" button onClick (around line 530):
```tsx
// Before
onClick={() => setDialogOpen(true)}
// After
onClick={() => router.push("/propiedades/nueva")}
```

Also remove the `onSuccess` callback that was used to close the dialog (around line 469):
```ts
// Remove this function:
const handlePropertyCreated = (propertyId: string) => {
  setDialogOpen(false);
  router.push(`/propiedades/${propertyId}`);
};
```

Update the `Property` interface (around line 44) to match the new API response:
```ts
// Before
address: string;
// After
addressStreet: string;
addressNumber: string | null;
```

Update display (around line 325):
```ts
// Before
{prop.title || prop.address}
// After
{prop.title || formatAddress(prop)}
```

- [ ] **Step 2: Update `/propiedades/nueva/page.tsx`**

The page currently shows `QuickPropertyForm` in a centered card. Since "Nueva propiedad" from the list now navigates here, and the quick form is still used from propietarios, keep this page but update its layout to be full-width and more prominent (no max-w-lg card):

```tsx
// src/app/(dashboard)/propiedades/nueva/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuickPropertyForm } from "@/components/properties/quick-property-form";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreatePropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login?callbackUrl=/propiedades/nueva");
  }

  if (!canManageProperties(session.user.role)) {
    redirect("/tablero");
  }

  const { ownerId } = await searchParams;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">Nueva propiedad</h1>
        <p className="text-muted-foreground mt-1">
          Completá los datos mínimos para crear la ficha. Podés agregar más información después.
        </p>
      </div>
      <QuickPropertyForm defaultOwnerId={ownerId} />
    </div>
  );
}
```

Note: `QuickPropertyForm` is rendered without the `inline` prop, so it shows its own header and border styling; OR remove the `inline` prop logic and let the page control the wrapping. Either way, autofocus on `addressStreet` is handled by adding `autoFocus` to the first input in the form (add `autoFocus` to the `addressStreet` Input in Task 11 if not already done).

- [ ] **Step 3: Add `autoFocus` to `addressStreet` input in `QuickPropertyForm`**

In the CALLE Input added in Task 11:
```tsx
<Input
  id="addressStreet"
  autoFocus
  value={addressStreet}
  ...
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/properties/property-list.tsx src/app/(dashboard)/propiedades/nueva/page.tsx
git commit -m "feat(propiedades): remove create dialog, navigate to /propiedades/nueva with full form"
```

---

### Task 13: Apply schema migration + verify build

- [ ] **Step 1: Run `bun run db:push`**

```bash
bun run db:push
```

Review the changes Drizzle proposes:
- Should drop the `address` column
- Should set `addressStreet` to NOT NULL
- Should make `ownerId` nullable

Confirm when prompted.

- [ ] **Step 2: Run build to catch any remaining TypeScript errors**

```bash
bun run build
```

If there are TypeScript errors mentioning `property.address` or `prop.address`, find the file and apply the same `formatAddress()` pattern from the tasks above.

- [ ] **Step 3: Manual smoke test**

1. Open the app in the browser
2. Go to `/propiedades` — confirm "Nueva propiedad" navigates to `/propiedades/nueva`
3. At `/propiedades/nueva` — confirm focus lands on CALLE field; fill in CALLE, NÚMERO, TIPO, PROPIETARIO; save; confirm redirect to the property detail page
4. Verify the property shows the address as "Calle Número" (or "Calle Número - Unidad" if set)
5. Go to a propietario detail page — click "Agregar propiedad" — confirm the dialog shows CALLE + NÚMERO + PISO/UNIDAD fields
6. Open the document generator and verify `[[domicilio_propiedad_completo]]` resolves to the full address

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: address split complete — schema migrated, all consumers updated"
```
