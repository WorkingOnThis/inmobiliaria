# Spec: Address Field Split + Property Creation Flow

Date: 2026-05-11

## Problem

The `property` table stores address as a single `address` field (e.g. "Godoy Cruz 2814, 3B"). The schema already has `addressStreet`, `addressNumber`, and `floorUnit` as optional columns but they are unused. The "Nueva propiedad" button in the property list opens a dialog, but the desired UX is to go directly to the full property edit form.

## Goals

1. Split `address` into `addressStreet` (CALLE) + `addressNumber` (NÚMERO) + `floorUnit` (PISO/UNIDAD, already separate)
2. Everywhere "dirección" is displayed: show `addressStreet + " " + addressNumber + " - " + floorUnit` (computed)
3. "Nueva propiedad" from property list → navigate directly to full property form page, no dialog
4. Quick-create dialog (used from owner detail page and other places) → updated to use 3 fields
5. Document generator: add `[[domicilio_propiedad_completo]]` variable

## Out of Scope

- `city` and `province` fields — not changing
- Any other schema changes unrelated to the address split

---

## Section 1: Schema & Migration

### Schema changes (`src/db/schema/property.ts`)

- **Remove** `address` column
- **`addressStreet`**: change from optional to `NOT NULL` (required)
- `addressNumber`: stays optional (TEXT NULL)
- `floorUnit`: stays optional (TEXT NULL) — no change
- **`ownerId`**: change from `NOT NULL` to nullable — the owner can be assigned after creation via OwnersSection. The FK reference to `client.id` is kept (nullable FK is valid). Cascade behavior on delete remains.

### Migration script (`scripts/migrate-address-split.ts`)

Run before schema change:
```sql
UPDATE property
SET address_street = address
WHERE address_street IS NULL OR address_street = '';
```
Then:
```sql
ALTER TABLE property ALTER COLUMN address_street SET NOT NULL;
ALTER TABLE property DROP COLUMN address;
ALTER TABLE property ALTER COLUMN "ownerId" DROP NOT NULL;
```

Result: all existing rows have `addressStreet` = the old `address` value (e.g. "Godoy Cruz 2814, 3B"). User corrects individual records manually afterward.

### Helper function (`src/lib/properties/format-address.ts`)

```ts
export function formatAddress(p: {
  addressStreet: string;
  addressNumber?: string | null;
  floorUnit?: string | null;
}): string {
  const main = [p.addressStreet, p.addressNumber].filter(Boolean).join(" ")
  return p.floorUnit ? `${main} - ${p.floorUnit}` : main
}
```

Used everywhere the full address string needs to be displayed.

---

## Section 2: API Changes

### `POST /api/properties`

- Remove `address` from Zod schema
- Add `addressStreet: z.string().min(1)` (required)
- `addressNumber: z.string().optional()`
- `ownerId` becomes **optional** (nullable in DB too — see schema changes). Owner can be assigned later from OwnersSection in the property detail page.
- Title auto-derivation: use `addressStreet` instead of `address.split(",")[0]`

### `PATCH /api/properties/[id]`

- Remove `address` from Zod schema
- Add `addressStreet: z.string().min(1).optional()`
- `addressNumber: z.string().optional()`

### Other API routes

Any route that selects `property.address` for display must be updated to select `addressStreet`, `addressNumber`, `floorUnit` and use `formatAddress()`, or select all three fields and let the caller format.

---

## Section 3: Display — All `property.address` References

Replace every `property.address` usage with `formatAddress(property)`. Key locations to update:

- Property list table/cards
- Property detail page header/title
- Breadcrumbs
- Property selects in contracts, services, tasks, etc.
- Property detail edit form: "DIRECCIÓN COMPLETA" field changes from editable input to computed read-only display (`formatAddress(property)`)
- `addressStreet` becomes required (red asterisk) in the edit form

---

## Section 4: Creation Flow Changes

### "Nueva propiedad" button in property list (`property-list.tsx`)

**Before**: opens `QuickPropertyForm` inside a Dialog  
**After**: `router.push("/propiedades/nueva")` — no dialog

Remove the Dialog and `dialogOpen` state from `property-list.tsx`.

### Page `/propiedades/nueva`

**Before**: renders `QuickPropertyForm`  
**After**: renders the same full property edit form used in the property detail page

- Auto-focus on `addressStreet` (CALLE) field on mount
- `ownerId` is optional — owner can be assigned later
- On save → `POST /api/properties` → redirect to `/propiedades/[id]`

Implementation note: if the property detail edit form is already a standalone component (e.g. `PropertyEditForm`), reuse it here. If not, extract it from the detail page first, then reuse.

---

## Section 5: QuickPropertyForm Dialog Updates

The `QuickPropertyForm` component is used from:
- Owner detail page (`/propietarios/[id]` → "Agregar propiedad" button)
- Potentially other places

### Field changes

| Before | After |
|--------|-------|
| `address` (single text, required) | `addressStreet` (CALLE, required) |
| — | `addressNumber` (NÚMERO, optional) |
| `floorUnit` (PISO/UNIDAD, optional) | unchanged |
| `type` (TIPO, required) | unchanged |
| `zone` (BARRIO/ZONA, optional) | unchanged |
| `ownerId` (PROPIETARIO, required) | unchanged — always required in the dialog |

Layout suggestion for the 3 address fields:
```
[CALLE *          ] [NÚMERO    ]
[PISO / UNIDAD    ]
```

### Behavior

- `defaultOwnerId` prop: when provided, owner field shows pre-filled and is read-only (as today)
- "Guardar y abrir ficha →" button: creates property → navigates to `/propiedades/[id]`

---

## Section 6: Document Generator

### New variable

Add to `src/lib/document-templates/variables-catalog.ts`:

```ts
{
  path: "domicilio_propiedad_completo",
  label: "Dirección completa de la propiedad",
  category: "propiedad",
  resolver: (ctx) => formatAddress(ctx.property),
}
```

### Existing variables — no change

- `[[domicilio_propiedad_calle]]` → `addressStreet`
- `[[domicilio_propiedad_numero]]` → `addressNumber`
- `[[domicilio_propiedad_ciudad]]` → `city`
- `[[domicilio_propiedad_provincia]]` → `province`

---

## Affected Files (estimated)

| Area | Files |
|------|-------|
| Schema | `src/db/schema/property.ts` |
| Migration | `scripts/migrate-address-split.ts` |
| Helper | `src/lib/properties/format-address.ts` (new) |
| API POST | `src/app/api/properties/route.ts` |
| API PATCH | `src/app/api/properties/[id]/route.ts` |
| Other APIs selecting address | grep for `property.address` in `src/app/api/` |
| Property list | `src/components/properties/property-list.tsx` |
| Nueva page | `src/app/(dashboard)/propiedades/nueva/page.tsx` |
| Property detail edit form | grep in `src/app/(dashboard)/propiedades/` |
| QuickPropertyForm | `src/components/properties/quick-property-form.tsx` |
| Document variables | `src/lib/document-templates/variables-catalog.ts` |
| Display (grep needed) | all files referencing `property.address` or `\.address` on property |
