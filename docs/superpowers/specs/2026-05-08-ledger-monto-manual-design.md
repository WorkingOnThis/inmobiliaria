# Spec: Edición manual de monto en ledger

**Fecha:** 2026-05-08  
**Estado:** Aprobado

## Objetivo

Permitir que el administrador modifique manualmente el monto de cualquier ítem del `tenant_ledger` antes de cobrar, manteniendo trazabilidad del monto original generado por el contrato.

## Base de datos

### Cambios en `tenant_ledger`

Dos columnas nuevas:

| Columna | Tipo | Descripción |
|---|---|---|
| `montoOriginal` | `decimal(15,2)`, nullable | Monto generado automáticamente por el contrato. Se setea al generar el ledger y **nunca se modifica**. |
| `montoManual` | `decimal(15,2)`, nullable | Override manual. `null` = usar `monto`. Si el usuario edita, se guarda acá. |

**Lógica de monto efectivo:** `montoManual ?? monto`

**Al generar el ledger** (`buildLedgerEntries`): setear `montoOriginal = monto` en cada entrada creada.

**Migración:** `bun run db:generate` + `bun run db:migrate`. Ambas columnas son nullable con default `null` — sin rotura de filas existentes.

## API

### `PATCH /api/tenant-ledger/[id]`

**Body:**
```ts
{ montoManual: string | null }
```

- `string`: nuevo monto en pesos (ej. `"85000.00"`) — debe ser > 0
- `null`: revierte al monto original

**Guards:**
- Autenticación requerida
- `canManageClients(session.user.role)` → 403 si falla
- `agencyId` scoping — el ítem debe pertenecer a la agencia del usuario
- Solo editable si `estado` es uno de: `"proyectado"`, `"pendiente"`, `"pendiente_revision"`, `"registrado"` → 422 si el estado no lo permite
- Validación Zod: `montoManual` es `z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable()`

**Response:** fila actualizada (mismo shape que `TenantLedger`).

**Ruta del archivo:** `src/app/api/tenant-ledger/[id]/route.ts`

### Cambio en `POST /api/receipts/emit`

Sin cambios en la firma. El `montoOverrides` que ya recibe sigue siendo para ajustes de último momento al emitir. La base sobre la que se aplica pasa a ser `montoManual ?? monto`.

Actualizar `getEffectiveAmount` para que lea `montoManual` si existe:

```ts
function getEffectiveAmount(entry, overrides) {
  const override = overrides[entry.id];
  if (override !== undefined) return Number(override);
  if (entry.montoManual !== null) return Number(entry.montoManual);
  return Number(entry.monto);
}
```

## UI

### Cambios en `LedgerEntry` (tipo)

Agregar dos campos:
```ts
montoOriginal: string | null;
montoManual: string | null;
```

El monto efectivo a mostrar: `montoManual ?? monto`.

### Cambios en `LedgerTable`

**Nueva prop:**
```ts
onMontoManualChange: (id: string, value: string | null) => Promise<void>
```

**Estados editables:** `proyectado`, `pendiente`, `pendiente_revision`, `registrado`.  
**Estados NO editables:** `conciliado`, `cancelado`, `pago_parcial`.

**El lápiz solo aparece cuando `isOwnerView` es `false`** (la vista del propietario es de solo lectura).

**Comportamiento en la columna Monto:**

1. En filas editables y cuando `!isOwnerView`, mostrar un `Pencil` (12px, `lucide-react`) junto al monto, visible al hacer hover (`opacity-0 group-hover:opacity-100`).
2. Al hacer clic en el lápiz: el monto se reemplaza por un `Input` shadcn inline (mismo estilo que el existente al seleccionar: `h-7 w-24 text-right text-xs font-mono`). Confirmar con Enter o blur.
3. Al confirmar: llamar `onMontoManualChange(id, value)` → el padre hace el PATCH y actualiza el estado local.
4. Si `montoManual` está seteado (diferente de `monto`): mostrar subtext debajo del monto con `original: $X.XXX` en `text-muted-foreground text-[10px]` + un botón `×` (ghost, xs) para revertir (`onMontoManualChange(id, null)`).

**Componentes shadcn a usar:**
- `Input` (ya importado)
- `Button` variant `ghost` size `icon` (para el lápiz y el ×)
- `Tooltip` para el lápiz (texto: "Editar monto")

### Cambios en el componente padre

El componente padre (página del inquilino o contrato que renderiza `LedgerTable`) maneja:

1. Estado local de los entries del ledger (ya lo hace con TanStack Query o similar).
2. Handler `handleMontoManualChange(id, value)`:
   - Llama `PATCH /api/tenant-ledger/[id]` con `{ montoManual: value }`
   - En caso de éxito: invalida o actualiza optimísticamente el entry en el estado local
   - En caso de error: muestra `toast` de error (shadcn `sonner` o similar)

### Cambios en la query del API que sirve las entradas

La query que carga los `tenant_ledger` entries debe incluir `montoOriginal` y `montoManual` en el SELECT.

## Flujo completo

```
Contrato activo
  → generate-ledger: crea filas con monto = $100.000, montoOriginal = $100.000, montoManual = null
  → Admin ve la tabla, hace clic en el lápiz de Agosto 2026
  → Ingresa $95.000, confirma
  → PATCH /api/tenant-ledger/:id { montoManual: "95000" }
  → La fila muestra $95.000 con subtext "original: $100.000"
  → Admin selecciona la fila y emite recibo
  → emit usa $95.000 como base (montoManual)
  → Si necesita ajuste de último momento, montoOverrides lo overridea sobre $95.000
```

## Archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `src/db/schema/tenant-ledger.ts` | Agregar `montoOriginal`, `montoManual` |
| `src/lib/ledger/generate-contract-ledger.ts` | Setear `montoOriginal` al generar |
| `src/app/api/tenant-ledger/[id]/route.ts` | Crear (PATCH) |
| `src/app/api/receipts/emit/route.ts` | Actualizar `getEffectiveAmount` para leer `montoManual` |
| `src/components/tenants/ledger-table.tsx` | Agregar prop, tipo, lápiz inline, subtext original |
| `src/components/tenants/tenant-tab-current-account.tsx` | Agregar handler `handleMontoManualChange` + PATCH call + actualizar `getMonto` para leer `montoManual` |
| `src/components/owners/owner-tab-current-account.tsx` | Solo pasar `onMontoManualChange={() => {}}` (no editing en vista propietario) |
| `src/db/schema/index.ts` | Re-exportar si es necesario |
| Migración DB | `bun run db:generate` + `bun run db:migrate` |
