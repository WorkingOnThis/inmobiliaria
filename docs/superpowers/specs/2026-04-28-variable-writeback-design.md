# Variable Write-back — Design Spec
**Date:** 2026-04-28  
**Status:** Approved  
**Scope:** ContractDocumentSection — variable popover write-back to database

---

## Problem

When a user opens the variable popover for `[[precio_inicial_numero]]` and sees that the value is missing or wrong, today the only option is a **local override** stored in `contract_clause.fieldOverrides` (per-clause JSON). That override only affects one clause and is invisible to the rest of the system.

The goal is to let the user update the **real field in the database** from within the popover, so the corrected value propagates to all clauses and future documents automatically.

---

## Architecture

Four files are added or modified:

| File | Change |
|---|---|
| `src/lib/document-templates/writeback-map.ts` | NEW — shared client+server map |
| `src/app/api/contracts/[id]/variable-writeback/route.ts` | NEW — PATCH endpoint |
| `src/lib/document-templates/variable-popover.tsx` | MODIFIED — radio + write-back UI |
| `src/components/contracts/contract-document-section.tsx` | MODIFIED — new mutation, invalidates `["contract-resolved", contractId]` |

---

## Writeback Map (`writeback-map.ts`)

Shared module imported by both the client (for UI hints) and the server (for routing).

```typescript
type WritebackEntry =
  | {
      entity: "contract" | "property" | "owner" | "tenant_0";
      dbField: string;       // exact Drizzle column name
      label: string;         // human label shown in popover
      inputType: "text" | "number" | "date";
    }
  | {
      entity: "agency";
      settingsPath: string;  // internal route to edit agency data
      label: string;
    };

export const WRITEBACK_MAP: Record<string, WritebackEntry> = { ... };
```

### Writable variables (representative sample)

| path | entity | dbField | inputType |
|---|---|---|---|
| `precio_inicial_numero` | contract | monthlyAmount | number |
| `precio_inicial_formato` | contract | monthlyAmount | number |
| `precio_inicial_letras` | contract | monthlyAmount | number |
| `fecha_inicio` | contract | startDate | date |
| `fecha_fin` | contract | endDate | date |
| `dia_vencimiento` | contract | paymentDay | number |
| `tipo_ajuste` | contract | adjustmentIndex | text |
| `periodo_ajuste_meses` | contract | adjustmentFrequency | number |
| `dia_gracia` | contract | graceDays | number |
| `domicilio_propiedad_completo` | property | address | text |
| `domicilio_propiedad_calle` | property | addressStreet | text |
| `domicilio_propiedad_numero` | property | addressNumber | text |
| `domicilio_propiedad_barrio` | property | zone | text |
| `domicilio_propiedad_ciudad` | property | city | text |
| `domicilio_propiedad_provincia` | property | province | text |
| `tipo_inmueble` | property | type | text |
| `dni_locador` | owner | dni | text |
| `cuit_locador` | owner | cuit | text |
| `email_locador` | owner | email | text |
| `telefono_locador` | owner | phone | text |
| `domicilio_locador` | owner | address | text |
| `nombres_locador` | owner | firstName | text |
| `apellido_locador` | owner | lastName | text |
| `dni_locatario` | tenant_0 | dni | text |
| `email_locatario` | tenant_0 | email | text |
| `telefono_locatario` | tenant_0 | phone | text |
| `nombre_administradora` | agency | *(link)* | — |
| `cuit_administradora` | agency | *(link)* | — |

### Variables WITHOUT write-back (override only)

- `duracion_meses`, `duracion_texto` — depend on BOTH `startDate` and `endDate`; no single source field
- `cantidad_fiadoras` — computed from relations
- Guarantor property variables (`matricula_inmueble_garantia`, `catastro_inmueble_garantia`, etc.) — complex resolution path requiring joins across multiple tables

> **Rule for future variables:** if a variable resolves from a single DB column → add to WRITEBACK_MAP. If it is derived from multiple columns or relations → override only.

---

## API Endpoint

`PATCH /api/contracts/[id]/variable-writeback`

**Request body:**
```json
{ "path": "precio_inicial_numero", "value": "150000" }
```

**Server steps:**
1. Auth + `canManageContracts()` check
2. Look up `path` in `WRITEBACK_MAP` — 400 if not found or entity is `"agency"`
3. Resolve the entity ID from the contract:
   - `contract` → use the route param directly
   - `property` → `SELECT propertyId FROM contract WHERE id = :id`
   - `owner` → resolve legal owner from property ownership (same logic as `/resolve` endpoint)
   - `tenant_0` → `SELECT clientId FROM contract_tenant WHERE contractId = :id AND role = 'primary' LIMIT 1`
4. Validate value against `inputType` (parse number, validate ISO date, reject empty string)
5. `db.update(targetTable).set({ [dbField]: coercedValue }).where(eq(id, resolvedId))`
6. Return `{ ok: true }`

**Error responses:**
- `400` — path not writable, value invalid
- `401` — unauthenticated
- `403` — insufficient role
- `404` — contract / entity not found

---

## UI — Variable Popover

### Layout (writable variable)

```
[[precio_inicial_numero]]
Precio inicial (número)

Valor del contrato
[ $ 120.000,00 ]          ← green if resolved, red if null

Guardar como:
( ● ) Solo esta cláusula
(   ) En la base de datos  ← when selected, shows "Actualizará: Precio mensual"

[ input: nuevo valor ]

[ Aplicar ]               ← label changes to "Guardar en DB" when DB mode selected
```

### Layout (agency variable)

```
[[nombre_administradora]]
Nombre / razón social

Valor del contrato
[ Arce Administración ]

Este dato se edita en la configuración de la agencia →
[ Ir a configuración ↗ ]   ← opens in new tab
```

### Layout (no write-back — override only)

Same as current behavior. No radio, no write-back section.

### Behavior

- Radio default: "Solo esta cláusula" (preserves current behavior for users who don't need write-back)
- Switching to "En la base de datos" shows helper text: *"Actualizará: {entry.label}"*
- Button label: "Aplicar" (local) / "Guardar en DB" (db mode)
- On DB success: popover closes, toast "Campo actualizado", override for this path cleared, `resolved` query invalidated
- On DB error: toast error, popover stays open for retry
- While saving: button shows "Guardando..." and is disabled

---

## Data Flow (end-to-end)

```
1. Click on [[precio_inicial_numero]] in preview
   └─ onPopoverOpen(path, rect) → popoverState set

2. VariablePopover renders
   └─ checks WRITEBACK_MAP[path]
   └─ shows radio if entry exists and entity ≠ "agency"
   └─ shows agency link if entity === "agency"
   └─ shows override-only UI if path not in map

3. User selects "En la base de datos", types "150000", clicks "Guardar en DB"
   └─ onWriteback(path, value) called

4. ContractDocumentSection fires patchWriteback mutation
   └─ PATCH /api/contracts/:contractId/variable-writeback
      { path: "precio_inicial_numero", value: "150000" }

5. Server resolves entity, validates, updates contract.monthlyAmount = "150000"
   └─ returns { ok: true }

6. Client on success:
   └─ clears editOverrides[path] (if any)
   └─ invalidates ["contract-resolved", contractId]
   └─ closes popover
   └─ toast "Campo actualizado"

7. resolved refetch
   └─ resolved["precio_inicial_numero"] = "150000"
   └─ chip renders green
```

---

## Extensibility

Adding a new writable variable in the future:
1. Add variable to `VARIABLES_CATALOG` (existing step)
2. If single-source → add one entry to `WRITEBACK_MAP` with entity + dbField

That's it. The endpoint, popover, and component require no changes.

If a new entity type is added (e.g., co-tenant, second guarantor):
1. Add the entity type to `WritebackEntry`
2. Add the ID resolution logic in the endpoint (one new query)
3. Add entries to `WRITEBACK_MAP`
