# Ledger Table UI Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar la UI de la tabla de cuenta corriente de inquilinos (limpieza visual + información de vencimiento + recibo en descripción) antes de replicar el patrón a propietarios.

**Architecture:** Todos los cambios están en `src/components/tenants/ledger-table.tsx`. No hay nuevos archivos ni cambios en la API. Los cambios son puramente de render — ninguna prop nueva necesaria, el callback `onAnularRecibo` existente se mueve de botón standalone al menú `···`.

**Tech Stack:** React 19, TypeScript, shadcn/ui (Badge, Button, DropdownMenu, Checkbox), Tailwind v4, date arithmetic con `Date` nativo.

---

## Archivos modificados

| Archivo | Qué cambia |
|---|---|
| `src/components/tenants/ledger-table.tsx` | Todos los cambios de UI: `↳` removido, umbral "Sel. mes", subtext de vencimiento, recibo en descripción, anular en `···` |

---

## Task 1: Remover `↳` y ajustar botón "Sel. mes"

**Files:**
- Modify: `src/components/tenants/ledger-table.tsx`

- [ ] **Step 1: Remover el prefijo `↳` del label de punitorio**

En `ledger-table.tsx`, encontrá esta línea dentro del span de descripción:

```tsx
{isPunitorio && "↳ "}
{formatDescription(entry.descripcion)}
```

Reemplazala por:

```tsx
{formatDescription(entry.descripcion)}
```

- [ ] **Step 2: Cambiar el umbral del botón "Sel. mes" de 1 a 2**

Encontrá esta sección en el render del period header:

```tsx
const hasSelectable = periodEntries.some(isSelectable);
const selectableIds = periodEntries.filter(isSelectable).map((e) => e.id);
const isMonthSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
```

Y más abajo la condición que muestra el botón:

```tsx
{hasSelectable ? (
  <Button ...>
    {isMonthSelected ? "Deseleccionar" : "Seleccionar mes"}
  </Button>
) : (
  <div className="h-6 w-[110px]" />
)}
```

Reemplazá esa sección completa por:

```tsx
{selectableIds.length >= 2 ? (
  <Button
    variant="ghost"
    size="sm"
    className={cn(
      "h-6 text-xs px-2.5 font-medium transition-colors",
      isMonthSelected
        ? "bg-primary/15 text-primary hover:bg-primary/10"
        : "bg-muted text-foreground/70 hover:text-foreground hover:bg-muted/70"
    )}
    onClick={() => isMonthSelected ? onDeselectMonth(period) : onSelectMonth(period)}
  >
    {isMonthSelected ? "Desel. mes" : "Sel. mes"}
  </Button>
) : (
  <div className="h-6 w-[110px]" />
)}
```

Nota: `hasSelectable` queda sin uso tras este cambio — eliminala de la desestructuración:

```tsx
// antes
const hasSelectable = periodEntries.some(isSelectable);
const selectableIds = ...

// después — eliminar la línea hasSelectable
const selectableIds = periodEntries.filter(isSelectable).map((e) => e.id);
```

- [ ] **Step 3: Verificar que compila sin errores**

```bash
bun run build 2>&1 | tail -20
```

Esperado: sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/components/tenants/ledger-table.tsx
git commit -m "fix(ledger-table): remove arrow prefix from punitorio, show select-month button only with 2+ items"
```

---

## Task 2: Subtext de vencimiento bajo la descripción

**Files:**
- Modify: `src/components/tenants/ledger-table.tsx`

- [ ] **Step 1: Agregar helper `getDueDateSubtext` antes del componente `LedgerTable`**

Agregalo después de la función `formatDescription` (~línea 109):

```tsx
const SHOW_DUEDATE_STATES = new Set(["pendiente", "registrado", "pendiente_revision", "pago_parcial"]);

function getDueDateSubtext(
  entry: LedgerEntry,
  today: string
): { text: string; dateLabel: string; color: string } | null {
  if (!entry.dueDate || !SHOW_DUEDATE_STATES.has(entry.estado)) return null;

  const due = entry.dueDate;
  const [dy, dm, dd] = due.split("-");
  const dateLabel = `${dd}/${dm}`;

  if (due > today) {
    const diffMs = new Date(due).getTime() - new Date(today).getTime();
    const days = Math.round(diffMs / 86_400_000);
    return { text: `${days} día${days !== 1 ? "s" : ""} hasta vencimiento`, dateLabel: `vence ${dateLabel}`, color: "text-warning" };
  }
  if (due === today) {
    return { text: "Vence hoy", dateLabel: dateLabel, color: "text-warning" };
  }
  const diffMs = new Date(today).getTime() - new Date(due).getTime();
  const days = Math.round(diffMs / 86_400_000);
  return { text: `${days} día${days !== 1 ? "s" : ""} de mora`, dateLabel: `vencía ${dateLabel}`, color: "text-destructive" };
}
```

- [ ] **Step 2: Renderizar el subtext bajo la descripción**

Dentro del JSX de cada `entry`, encontrá el bloque de descripción que actualmente termina con el subtext de pago parcial:

```tsx
{/* Descripcion */}
<div className="pl-2">
  <span className={cn(
    "truncate",
    isPunitorio && "text-punitorio italic text-xs",
    entry.monto === null && "text-warning"
  )}>
    {formatDescription(entry.descripcion)}
  </span>
  {/* Subtext: mutually exclusive — DB pago_parcial info OR live partial-override indicator */}
  {entry.estado === "pago_parcial" && entry.montoPagado !== null ? (
    ...
  ) : isPartialOverride(entry, montoOverrides) ? (
    ...
  ) : null}
</div>
```

Reemplazá el div completo por:

```tsx
{/* Descripcion */}
<div className="pl-2">
  <span className={cn(
    "truncate",
    isPunitorio && "text-punitorio italic text-xs",
    entry.monto === null && "text-warning"
  )}>
    {formatDescription(entry.descripcion)}
  </span>
  {/* Subtext: pago parcial info OR live partial override OR due date */}
  {entry.estado === "pago_parcial" && entry.montoPagado !== null ? (
    <div className="flex gap-3 mt-0.5">
      <span className="text-[10px] text-muted-foreground">
        Original: ${Number(entry.monto ?? 0).toLocaleString("es-AR")}
      </span>
      <span className="text-[10px] text-income">
        Pagado: ${Number(entry.montoPagado).toLocaleString("es-AR")}
      </span>
    </div>
  ) : isPartialOverride(entry, montoOverrides) ? (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] font-semibold text-warning">
        Pago parcial
      </span>
      <span className="text-[10px] text-muted-foreground">
        · Saldo: ${(Number(entry.monto) - Number(montoOverrides[entry.id])).toLocaleString("es-AR")}
      </span>
    </div>
  ) : (() => {
    const due = getDueDateSubtext(entry, today);
    if (!due) return null;
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={cn("text-[10px] font-semibold", due.color)}>{due.text}</span>
        <span className="text-[10px] text-muted-foreground">· {due.dateLabel}</span>
      </div>
    );
  })()}
</div>
```

- [ ] **Step 3: Verificar que compila sin errores**

```bash
bun run build 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 4: Verificar visualmente**

```bash
bun dev
```

Abrí la ficha de un inquilino con contrato activo y mora. Verificá:
- Entradas en mora muestran `"X días de mora · vencía DD/MM"` en rojo bajo la descripción
- Entradas por vencer muestran `"X días hasta vencimiento · vence DD/MM"` en amber
- Entradas pagadas o proyectadas no muestran subtext de fecha
- El subtext de pago parcial sigue funcionando (no se pisó)

- [ ] **Step 5: Commit**

```bash
git add src/components/tenants/ledger-table.tsx
git commit -m "feat(ledger-table): add due date subtext below entry description"
```

---

## Task 3: Mover número de recibo a subtext + anular en menú `···`

**Files:**
- Modify: `src/components/tenants/ledger-table.tsx`

- [ ] **Step 1: Agregar número de recibo como subtext de la descripción**

Dentro del mismo bloque de descripción del Task 2, agregá debajo del subtext de vencimiento un segundo subtext para el recibo. El bloque `<div className="pl-2">` quedaría así (añadís el fragmento de recibo al final, después del bloque de due date):

```tsx
{/* Descripcion */}
<div className="pl-2">
  <span className={cn(
    "truncate",
    isPunitorio && "text-punitorio italic text-xs",
    entry.monto === null && "text-warning"
  )}>
    {formatDescription(entry.descripcion)}
  </span>
  {/* Subtext: pago parcial info OR live partial override OR due date */}
  {entry.estado === "pago_parcial" && entry.montoPagado !== null ? (
    <div className="flex gap-3 mt-0.5">
      <span className="text-[10px] text-muted-foreground">
        Original: ${Number(entry.monto ?? 0).toLocaleString("es-AR")}
      </span>
      <span className="text-[10px] text-income">
        Pagado: ${Number(entry.montoPagado).toLocaleString("es-AR")}
      </span>
    </div>
  ) : isPartialOverride(entry, montoOverrides) ? (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] font-semibold text-warning">
        Pago parcial
      </span>
      <span className="text-[10px] text-muted-foreground">
        · Saldo: ${(Number(entry.monto) - Number(montoOverrides[entry.id])).toLocaleString("es-AR")}
      </span>
    </div>
  ) : (() => {
    const due = getDueDateSubtext(entry, today);
    if (!due) return null;
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={cn("text-[10px] font-semibold", due.color)}>{due.text}</span>
        <span className="text-[10px] text-muted-foreground">· {due.dateLabel}</span>
      </div>
    );
  })()}
  {/* Recibo como subtext */}
  {entry.reciboNumero && (
    <div
      className="flex items-center gap-1 mt-0.5 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        window.open(`/recibos/n/${entry.reciboNumero}`, "_blank", "noopener,noreferrer");
      }}
    >
      <span className="text-[10px] text-primary hover:underline">{entry.reciboNumero}</span>
      <span className="text-[10px] text-muted-foreground">· ver recibo</span>
    </div>
  )}
</div>
```

- [ ] **Step 2: Mover "Anular recibo" al menú `···` y limpiar la columna de acciones**

Encontrá el bloque de Actions al final de cada entry:

```tsx
{/* Actions */}
<div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button ... >
        <MoreHorizontal size={14} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onViewDetail(entry)}>
        Ver detalle
      </DropdownMenuItem>
      {isPunitorio && entry.estado !== "conciliado" && (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onCancelEntry(entry)}
        >
          Cancelar punitorio
        </DropdownMenuItem>
      )}
      {!isPunitorio && isCancelable(entry) && (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onCancelEntry(entry)}
        >
          Cancelar movimiento
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
  {entry.reciboNumero && (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.open(`/recibos/n/${entry.reciboNumero}`, "_blank", "noopener,noreferrer")}
        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
        title={`Ver recibo ${entry.reciboNumero}`}
      >
        {entry.reciboNumero}
      </Button>
      {["conciliado", "pago_parcial"].includes(entry.estado) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAnularRecibo(entry.reciboNumero!)}
          aria-label="Anular recibo"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          title="Anular recibo"
        >
          ✕
        </Button>
      )}
    </div>
  )}
</div>
```

Reemplazalo completamente por:

```tsx
{/* Actions */}
<div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        aria-label="Acciones"
      >
        <MoreHorizontal size={14} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onViewDetail(entry)}>
        Ver detalle
      </DropdownMenuItem>
      {isPunitorio && entry.estado !== "conciliado" && (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onCancelEntry(entry)}
        >
          Cancelar punitorio
        </DropdownMenuItem>
      )}
      {!isPunitorio && isCancelable(entry) && (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onCancelEntry(entry)}
        >
          Cancelar movimiento
        </DropdownMenuItem>
      )}
      {entry.reciboNumero && ["conciliado", "pago_parcial"].includes(entry.estado) && (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onAnularRecibo(entry.reciboNumero!)}
        >
          Anular recibo
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

- [ ] **Step 3: Verificar que compila sin errores**

```bash
bun run build 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 4: Verificar visualmente**

```bash
bun dev
```

Verificá en un inquilino con recibos emitidos:
- El número de recibo aparece como subtext azul clickeable bajo la descripción del concepto
- Al clickear abre el recibo en nueva pestaña
- La columna de acciones (`···`) solo muestra el ícono, sin botones adicionales
- El menú `···` en entradas con recibo pagado/parcial incluye "Anular recibo" en rojo
- "Anular recibo" abre el dialog de confirmación existente

- [ ] **Step 5: Commit**

```bash
git add src/components/tenants/ledger-table.tsx
git commit -m "feat(ledger-table): move receipt number to description subtext, move void action to dropdown"
```

---

## Task 4: Auditoría shadcn en filtros + smoke test final

**Files:**
- Modify: `src/components/tenants/tenant-tab-current-account.tsx` (solo si hay botones HTML crudos en la toolbar)

- [ ] **Step 1: Verificar componentes shadcn en la toolbar de filtros**

Abrí `src/components/tenants/tenant-tab-current-account.tsx` y confirmá que el `ToggleGroup` de filtros usa los componentes de `@/components/ui/toggle-group`:

```tsx
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
...
<ToggleGroup type="multiple" value={[...activeFilters]} onValueChange={(v) => setActiveFilters(new Set(v))}>
  <ToggleGroupItem value="overdue" className="text-xs h-8 px-3">En mora</ToggleGroupItem>
  <ToggleGroupItem value="pending" className="text-xs h-8 px-3">Pendientes</ToggleGroupItem>
  <ToggleGroupItem value="paid" className="text-xs h-8 px-3">Pagados</ToggleGroupItem>
  <ToggleGroupItem value="future" className="text-xs h-8 px-3">Futuros</ToggleGroupItem>
</ToggleGroup>
```

Si ya usa `ToggleGroup` y `ToggleGroupItem` de shadcn (como está en el archivo actual) → no hay nada que cambiar.

Si hubiera `<button>` HTML crudo → reemplazar por `<Button variant="outline">` de shadcn con `cn()` para el estado activo.

- [ ] **Step 2: Verificar que los 4 filtros funcionan correctamente**

```bash
bun dev
```

Abrí un inquilino con historial mixto (mora, pagados, futuros). Para cada filtro:

| Filtro | Qué debe mostrar |
|---|---|
| En mora | Entradas en `PENDING_STATES` cuyo `dueDate` ya pasó |
| Pendientes | Entradas en `PENDING_STATES` cuyo `dueDate` es futuro o nulo, en período no futuro |
| Pagados | Entradas con `estado === "conciliado"` |
| Futuros | Entradas cuyo `period` es mayor al mes actual |

Activá y desactivá cada uno y verificá que los períodos aparecen y desaparecen correctamente.

- [ ] **Step 3: Smoke test completo de los cambios**

Con `bun dev` activo, verificá toda la tabla de un inquilino con datos variados:

- [ ] `↳` no aparece en ningún punitorio
- [ ] El botón "Sel. mes" solo aparece en períodos con 2 o más items seleccionables
- [ ] En períodos con 1 solo item pendiente, no hay botón "Sel. mes"
- [ ] Entradas en mora muestran días de mora en rojo
- [ ] Entradas próximas a vencer muestran días restantes en amber
- [ ] Entradas pagadas y proyectadas no muestran subtext de fecha
- [ ] Número de recibo visible bajo descripción, abre recibo al clickear
- [ ] Menú `···` en entrada pagada incluye "Anular recibo"
- [ ] Dialog de anulación sigue funcionando normalmente
- [ ] Selección de entradas y emisión de recibo siguen funcionando

- [ ] **Step 4: Commit final si hubo cambios en el parent**

Solo si el Step 1 requirió cambios:

```bash
git add src/components/tenants/tenant-tab-current-account.tsx
git commit -m "fix(ledger): use shadcn ToggleGroup for filter buttons"
```
