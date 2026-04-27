# Pagos Parciales — Cuenta Corriente del Inquilino

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar pagos parciales de alquiler en la cuenta corriente del inquilino, mostrando el saldo restante y recalculando punitorios sobre ese saldo desde la fecha del pago.

**Architecture:** Se añaden dos campos al schema `tenant_ledger` (`montoPagado` acumulativo y `ultimoPagoAt`). El saldo restante siempre se deriva: `monto - montoPagado`. El toggle en el ledger aparece cuando el staff edita el monto a menos del original. El endpoint de emisión de recibos recibe los overrides de monto y aplica la lógica parcial/total.

**Tech Stack:** Next.js Route Handlers · Drizzle ORM · PostgreSQL · React (TanStack Query) · Zod · TypeScript

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---|---|---|
| `src/db/schema/tenant-ledger.ts` | Modificar | Agrega `montoPagado`, `ultimoPagoAt` |
| `src/components/tenants/ledger-table.tsx` | Modificar | Tipo `LedgerEntry`, badge, toggle, subtext |
| `src/components/tenants/punitorio-popover.tsx` | Modificar | Usa saldo restante y `ultimoPagoAt` |
| `src/app/api/receipts/emit/route.ts` | Modificar | Acepta `montoOverrides`, lógica pago parcial |
| `src/components/tenants/tenant-tab-current-account.tsx` | Modificar | Envía `montoOverrides` en emit mutation |
| `src/app/api/tenants/[id]/cuenta-corriente/route.ts` | Modificar | Mora y auto-punitorios sobre saldo restante |

---

## Task 1: Schema — agregar `montoPagado` y `ultimoPagoAt`

**Files:**
- Modify: `src/db/schema/tenant-ledger.ts`

- [ ] **Paso 1: Agregar los dos campos al schema**

Abrir `src/db/schema/tenant-ledger.ts` y agregar después de `monto`:

```typescript
// Pago parcial — acumulado cobrado. null si nunca hubo pago parcial.
montoPagado: decimal("montoPagado", { precision: 15, scale: 2 }),

// Fecha del último pago parcial (YYYY-MM-DD, solo almacenamiento).
// Es el nuevo "día 0" para calcular punitorios sobre el saldo restante.
ultimoPagoAt: text("ultimoPagoAt"),
```

El bloque queda así (líneas 38-41 aprox):

```typescript
monto: decimal("monto", { precision: 15, scale: 2 }),

montoPagado: decimal("montoPagado", { precision: 15, scale: 2 }),
ultimoPagoAt: text("ultimoPagoAt"),
```

- [ ] **Paso 2: Generar la migración**

```bash
bun run db:generate
```

Esperado: crea un archivo en `drizzle/migrations/` con dos `ALTER TABLE tenant_ledger ADD COLUMN ...`.

- [ ] **Paso 3: Aplicar la migración**

```bash
bun run db:migrate
```

Esperado: `All migrations applied successfully` (sin errores).

- [ ] **Paso 4: Verificar en Drizzle Studio**

```bash
bun run db:studio
```

Abrir en el navegador, ir a la tabla `tenant_ledger` y confirmar que aparecen las columnas `montoPagado` (nullable) y `ultimoPagoAt` (nullable) en todas las filas existentes como `null`.

- [ ] **Paso 5: Commit**

```bash
git add src/db/schema/tenant-ledger.ts drizzle/
git commit -m "feat(schema): add montoPagado + ultimoPagoAt to tenant_ledger"
```

---

## Task 2: LedgerEntry tipo + badge `pago_parcial` + `isSelectable`

**Files:**
- Modify: `src/components/tenants/ledger-table.tsx`

- [ ] **Paso 1: Agregar los nuevos campos al tipo `LedgerEntry`**

Localizar el type `LedgerEntry` (línea 10) y agregar dos campos:

```typescript
export type LedgerEntry = {
  id: string;
  contratoId: string;
  propietarioId: string;
  propiedadId: string;
  period: string | null;
  dueDate: string | null;
  tipo: string;
  descripcion: string;
  monto: string | null;
  estado: string;
  installmentOf: string | null;
  reciboNumero: string | null;
  lateInterestPct: string | null;
  montoPagado: string | null;      // nuevo
  ultimoPagoAt: string | null;     // nuevo
};
```

- [ ] **Paso 2: Agregar `pago_parcial` al mapa `ESTADO_BADGE`**

Localizar `ESTADO_BADGE` (línea 37) y agregar la entrada:

```typescript
const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  conciliado:         { label: "Pagado",        className: "bg-income-dim text-income border-[var(--income)]" },
  registrado:         { label: "Registrado",    className: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)]" },
  pendiente:          { label: "Pendiente",     className: "bg-primary/10 text-primary border-primary/30" },
  proyectado:         { label: "Proyectado",    className: "bg-transparent text-muted-foreground border-border" },
  pendiente_revision: { label: "Revisar",       className: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)] border-dashed" },
  cancelado:          { label: "Cancelado",     className: "bg-muted text-muted-foreground border-border" },
  pago_parcial:       { label: "Pago parcial",  className: "bg-[var(--warning-dim)] text-[var(--warning)] border-[var(--warning)]" },
};
```

- [ ] **Paso 3: Hacer que `pago_parcial` sea seleccionable**

Localizar la función `isSelectable` (línea 46) y actualizar:

```typescript
function isSelectable(entry: LedgerEntry): boolean {
  return ["pendiente", "registrado", "pago_parcial"].includes(entry.estado);
}
```

- [ ] **Paso 4: Commit**

```bash
git add src/components/tenants/ledger-table.tsx
git commit -m "feat(ledger): add pago_parcial badge and selectable state"
```

---

## Task 3: LedgerTable UI — toggle pago parcial + subtext saldo

**Files:**
- Modify: `src/components/tenants/ledger-table.tsx`

- [ ] **Paso 1: Agregar helper `isPartialOverride`**

Agregar esta función después de `isCurrent` (línea 58 aprox):

```typescript
function isPartialOverride(entry: LedgerEntry, overrides: Record<string, string>): boolean {
  if (entry.tipo === "punitorio") return false;
  if (entry.monto === null) return false;
  const override = overrides[entry.id];
  if (override === undefined) return false;
  return Number(override) < Number(entry.monto);
}
```

- [ ] **Paso 2: Agregar subtext de "Original / Pagado" cuando hay pago parcial previo**

Dentro del render de cada entrada, localizar el bloque `{/* Descripcion */}` (línea 207 aprox) y extenderlo:

```tsx
{/* Descripcion */}
<div>
  <span className={cn(
    "truncate",
    isPunitorio && "text-punitorio italic text-xs",
    entry.monto === null && "text-[var(--warning)]"
  )}>
    {isPunitorio && "↳ "}
    {formatDescription(entry.descripcion)}
  </span>
  {/* Subtext pago parcial: aparece cuando ya hubo un pago parcial anterior */}
  {entry.estado === "pago_parcial" && entry.montoPagado !== null && (
    <div className="flex gap-3 mt-0.5">
      <span className="text-[10px] text-muted-foreground">
        Original: ${Number(entry.monto).toLocaleString("es-AR")}
      </span>
      <span className="text-[10px] text-income">
        Pagado: ${Number(entry.montoPagado).toLocaleString("es-AR")}
      </span>
    </div>
  )}
  {/* Toggle: aparece solo cuando el staff edita el monto a menos del original */}
  {isPartialOverride(entry, montoOverrides) && (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] font-semibold text-[var(--warning)]">
        Pago parcial
      </span>
      <span className="text-[10px] text-muted-foreground">
        · Saldo: ${(Number(entry.monto) - Number(montoOverrides[entry.id])).toLocaleString("es-AR")}
      </span>
    </div>
  )}
</div>
```

Nota: el span original de descripción pasa a estar dentro de un `<div>` wrapper. Ajustar el `<span>` original para eliminar el `truncate` del className de nivel superior si lo tenía en un tag sin wrapper — simplemente envolverlo en el `<div>` ya lo contiene.

- [ ] **Paso 3: Verificar visualmente**

Arrancar el servidor:
```bash
bun dev
```

Ir a la cuenta corriente de cualquier inquilino con entradas pendientes. Seleccionar un alquiler y bajar su monto en el input. Confirmar que aparece el subtext "Pago parcial · Saldo: $X". Confirmar que las filas con `estado = "pago_parcial"` muestran "Original / Pagado" debajo del concepto (si hay datos existentes).

- [ ] **Paso 4: Commit**

```bash
git add src/components/tenants/ledger-table.tsx
git commit -m "feat(ledger): show partial payment toggle and saldo subtext"
```

---

## Task 4: PunitorioPopover — usar saldo restante y `ultimoPagoAt`

**Files:**
- Modify: `src/components/tenants/punitorio-popover.tsx`

- [ ] **Paso 1: Agregar `montoPagado` y `ultimoPagoAt` al tipo Props**

Localizar el type `Props` (línea 11) y agregar los campos opcionales:

```typescript
type Props = {
  parentId: string;
  alquilerMonto: number;
  dueDate: string | null;
  lateInterestPct: string | null;
  onConfirm: (monto: number, descripcion: string) => void;
  montoPagado?: number | null;    // nuevo — saldo ya cobrado
  ultimoPagoAt?: string | null;  // nuevo — fecha del último pago parcial
};
```

- [ ] **Paso 2: Agregar al destructuring del componente**

Localizar la línea `export function PunitorioPopover({...})` (línea 51) y agregar los nuevos params:

```typescript
export function PunitorioPopover({
  parentId,
  alquilerMonto,
  dueDate,
  lateInterestPct,
  onConfirm,
  montoPagado,
  ultimoPagoAt,
}: Props) {
```

- [ ] **Paso 3: Calcular `baseParaPunitorio` y `fechaBase`**

Agregar estas dos constantes justo después de la línea `const hasContractRate = ...` (línea 59):

```typescript
// Si hay pago parcial previo, los punitorios se calculan sobre el saldo restante
// desde la fecha del último pago (no desde dueDate original).
const baseParaPunitorio = montoPagado != null
  ? Math.max(0, alquilerMonto - montoPagado)
  : alquilerMonto;

const fechaBase: string | null = ultimoPagoAt ?? dueDate;
```

- [ ] **Paso 4: Reemplazar usos de `alquilerMonto` y `dueDate` en el cuerpo del componente**

Hay tres lugares que usan estas variables. Reemplazar todos con las nuevas constantes:

1. En `applyTipo` (línea 70):
```typescript
const sugerido = dailyRate !== null && daysMora > 0
  ? calcMonto(baseParaPunitorio, dailyRate, daysMora)
  : 0;
```

2. En `handleManualPctChange` (línea 79):
```typescript
setMonto(calcMonto(baseParaPunitorio, dailyRate, daysMora).toFixed(2));
```

3. En `handleMontoChange` (línea 90-94):
```typescript
const dailyRate = montoNum / (baseParaPunitorio * daysMora);
```

4. El `daysMora` ya se calcula con `calcDaysMora(dueDate)` — reemplazar por `calcDaysMora(fechaBase)`:
```typescript
const daysMora = calcDaysMora(fechaBase);
```

- [ ] **Paso 5: Pasar los nuevos props donde se usa `PunitorioPopover`**

Buscar todos los usos del componente:
```bash
grep -r "PunitorioPopover" src/ --include="*.tsx" -l
```

En cada lugar donde se usa, agregar los props (si la entrada tiene `montoPagado` y `ultimoPagoAt` disponibles):

```tsx
<PunitorioPopover
  parentId={entry.id}
  alquilerMonto={Number(entry.monto)}
  dueDate={entry.dueDate}
  lateInterestPct={entry.lateInterestPct}
  montoPagado={entry.montoPagado !== null ? Number(entry.montoPagado) : null}
  ultimoPagoAt={entry.ultimoPagoAt ?? null}
  onConfirm={(monto, desc) => onAddPunitorio(entry.id, monto, desc)}
/>
```

Si el componente no está siendo usado directamente aún, este paso es no-op por ahora.

- [ ] **Paso 6: Commit**

```bash
git add src/components/tenants/punitorio-popover.tsx
git commit -m "feat(punitorio): calculate on remaining balance from ultimoPagoAt"
```

---

## Task 5: Emit API — aceptar `montoOverrides` y lógica de pago parcial

**Files:**
- Modify: `src/app/api/receipts/emit/route.ts`

- [ ] **Paso 1: Agregar `montoOverrides` al schema Zod**

Localizar `emitSchema` (línea 13) y agregar el campo:

```typescript
const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
  montoOverrides: z.record(z.string(), z.string()).default({}),
});
```

- [ ] **Paso 2: Agregar helper `getEffectiveAmount`**

Agregar después de `function round2` (línea 21):

```typescript
function getEffectiveAmount(
  entryId: string,
  originalMonto: string,
  overrides: Record<string, string>
): number {
  const override = overrides[entryId];
  return override !== undefined ? Number(override) : Number(originalMonto);
}
```

- [ ] **Paso 3: Actualizar desestructuración y validación de estado**

Actualizar la desestructuración (línea 40):

```typescript
const { ledgerEntryIds, fecha, honorariosPct, trasladarAlPropietario, montoOverrides } = parsed.data;
```

Actualizar la validación `notReady` (línea 51) para aceptar `pago_parcial`:

```typescript
const notReady = entries.filter(
  (e) => !["pendiente", "registrado", "pago_parcial"].includes(e.estado)
);
```

- [ ] **Paso 4: Usar `montoOverrides` en los totales**

Reemplazar el cálculo de `baseComision` y `totalRecibo` (líneas 92-96):

```typescript
const totalRecibo = round2(
  entries.reduce((s, e) => s + getEffectiveAmount(e.id, e.monto!, montoOverrides), 0)
);
const baseComision = entries
  .filter((e) => e.incluirEnBaseComision)
  .reduce((s, e) => s + getEffectiveAmount(e.id, e.monto!, montoOverrides), 0);
```

- [ ] **Paso 5: Reemplazar el UPDATE masivo por un loop por entrada**

Localizar el bloque dentro de `db.transaction` donde se hace el UPDATE (líneas 103-114). Reemplazarlo con un loop que aplica la lógica parcial/total para cada entrada:

```typescript
const now = new Date();
const reciboNumero = await nextReciboNumero(tx);

for (const entry of entries) {
  const effectiveAmount = getEffectiveAmount(entry.id, entry.monto!, montoOverrides);
  const prevPagado = Number(entry.montoPagado ?? 0);
  const newMontoPagado = round2(prevPagado + effectiveAmount);
  const isFullyPaid = newMontoPagado >= Number(entry.monto);

  await tx
    .update(tenantLedger)
    .set({
      estado: isFullyPaid ? "conciliado" : "pago_parcial",
      montoPagado: String(newMontoPagado),
      ultimoPagoAt: fecha,
      reciboNumero,
      reciboEmitidoAt: now,
      ...(isFullyPaid
        ? { conciliadoAt: now, conciliadoPor: session.user.id }
        : {}),
      updatedAt: now,
    })
    .where(eq(tenantLedger.id, entry.id));
}
```

- [ ] **Paso 6: Probar manualmente el endpoint**

Con el servidor corriendo (`bun dev`), ir a la cuenta corriente de un inquilino, seleccionar un alquiler, bajar el monto, clic en "Emitir recibo". Verificar en Drizzle Studio que:
- `montoPagado` tiene el monto cobrado
- `ultimoPagoAt` tiene la fecha del recibo
- `estado` = `"pago_parcial"`

- [ ] **Paso 7: Commit**

```bash
git add src/app/api/receipts/emit/route.ts
git commit -m "feat(emit): support partial payments with montoOverrides"
```

---

## Task 6: TenantTabCurrentAccount — enviar `montoOverrides` en emit mutation

**Files:**
- Modify: `src/components/tenants/tenant-tab-current-account.tsx`

- [ ] **Paso 1: Pasar `montoOverrides` en la mutation de emisión**

Localizar la función `emitirMutation` (línea 93) y agregar `montoOverrides` en el body:

```typescript
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
        montoOverrides,   // <-- agregar esta línea
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? "Error al emitir el recibo");
    }
    return response.json();
  },
  // ... resto igual
```

- [ ] **Paso 2: Commit**

```bash
git add src/components/tenants/tenant-tab-current-account.tsx
git commit -m "feat(cuenta-corriente): send montoOverrides to emit endpoint"
```

---

## Task 7: Cuenta-corriente route — mora y auto-punitorios sobre saldo restante

**Files:**
- Modify: `src/app/api/tenants/[id]/cuenta-corriente/route.ts`

- [ ] **Paso 1: Incluir entradas `pago_parcial` en el fetch de overdue**

Localizar el WHERE del primer query `overdueWithRate` (línea 57-63). Cambiar el filtro de estado para incluir `pago_parcial`:

```typescript
.where(
  and(
    eq(tenantLedger.inquilinoId, id),
    eq(tenantLedger.tipo, "alquiler"),
    inArray(tenantLedger.estado, ["pendiente", "pago_parcial"]),  // <-- cambio
    lt(tenantLedger.dueDate, today),
    isNotNull(contract.lateInterestPct),
  )
);
```

También agregar `montoPagado` al select de `overdueWithRate`:

```typescript
const overdueWithRate = await db
  .select({
    id: tenantLedger.id,
    contratoId: tenantLedger.contratoId,
    inquilinoId: tenantLedger.inquilinoId,
    propietarioId: tenantLedger.propietarioId,
    propiedadId: tenantLedger.propiedadId,
    period: tenantLedger.period,
    dueDate: tenantLedger.dueDate,
    ultimoPagoAt: tenantLedger.ultimoPagoAt,   // nuevo
    monto: tenantLedger.monto,
    montoPagado: tenantLedger.montoPagado,      // nuevo
    lateInterestPct: contract.lateInterestPct,
  })
  ...
```

- [ ] **Paso 2: Calcular punitorios automáticos sobre el saldo restante**

En el loop `for (const alquiler of overdueWithRate)` (línea 83), actualizar el cálculo para usar el saldo restante y la fecha del último pago:

```typescript
for (const alquiler of overdueWithRate) {
  const dailyRate = Number(alquiler.lateInterestPct) / 100;
  if (dailyRate <= 0 || !alquiler.monto) continue;

  // Usar saldo restante si hay pago parcial, sino el monto original
  const baseParaPunitorio = alquiler.montoPagado !== null
    ? Math.max(0, Number(alquiler.monto) - Number(alquiler.montoPagado))
    : Number(alquiler.monto);

  if (baseParaPunitorio <= 0) continue;

  // Usar ultimoPagoAt como fecha base si hay pago parcial
  const fechaBase = alquiler.ultimoPagoAt ?? alquiler.dueDate;
  const daysMora = calcDaysMora(fechaBase);
  if (daysMora <= 0) continue;

  const monto = (baseParaPunitorio * dailyRate * daysMora).toFixed(2);
  const descripcion = `Punitorio (${(dailyRate * 100).toFixed(2)}%/día, ${daysMora} días mora)`;

  // ... resto del upsert igual
}
```

- [ ] **Paso 3: Incluir `pago_parcial` en el cálculo de mora del KPI**

Localizar la línea `overdueAlquileres` (línea 166) y actualizar:

```typescript
const overdueAlquileres = entries.filter(
  (e) =>
    e.tipo === "alquiler" &&
    ["pendiente", "pago_parcial"].includes(e.estado) &&
    e.dueDate !== null &&
    e.dueDate < today
);
```

Y actualizar `capitalEnMora` para usar el saldo restante:

```typescript
const capitalEnMora = overdueAlquileres.reduce(
  (s, e) =>
    s + (e.montoPagado !== null
      ? Math.max(0, Number(e.monto ?? 0) - Number(e.montoPagado))
      : Number(e.monto ?? 0)),
  0
);
```

- [ ] **Paso 4: Verificar KPI "En mora" en la UI**

Con el servidor corriendo, ir a la cuenta corriente de un inquilino que tenga un pago parcial registrado. Verificar que:
- El KPI "Estado" muestra "En mora" con el saldo restante (no el monto original)
- El punitorio auto-generado usa el saldo restante como base
- El badge en la fila dice "Pago parcial"

- [ ] **Paso 5: Commit**

```bash
git add src/app/api/tenants/[id]/cuenta-corriente/route.ts
git commit -m "feat(cuenta-corriente): partial payment mora and auto-punitorio on remaining balance"
```

---

## Verificación final end-to-end

- [ ] Ir a la cuenta corriente de un inquilino con alquiler en mora
- [ ] Seleccionar el punitorio y el alquiler
- [ ] Cambiar el monto del alquiler a un valor menor → confirmar que aparece "Pago parcial · Saldo: $X"
- [ ] Clic en "Emitir recibo"
- [ ] Confirmar que la fila del alquiler muestra badge "Pago parcial" y el subtext "Original / Pagado"
- [ ] Recargar la página → confirmar que el punitorio auto-generado usa el saldo restante
- [ ] Seleccionar la entrada parcial → volver a bajar el monto → emitir → confirmar que `montoPagado` se acumula
- [ ] Cuando `montoPagado >= monto` → confirmar que el estado pasa a "conciliado"
