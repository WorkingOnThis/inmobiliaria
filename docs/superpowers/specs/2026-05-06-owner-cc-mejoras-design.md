# Diseño — Cuenta corriente del propietario · Mejoras

**Fecha:** 2026-05-06
**Estado:** Aprobado
**Scope:** 4 mejoras a la CC del propietario MVP

---

## Contexto

El MVP de cuenta corriente de propietarios quedó funcional pero con gaps de
visibilidad. El propietario no ve cuánto le tocó realmente vs. el bruto, no se
diferencia entre propiedades cuando hay varias, y el empty state no respeta
filtros activos.

---

## Qué entra en este scope

1. **(a) KPIs en neto** — los totales de "Liquidado YTD" y "Pendiente" deben
   reflejar lo que el propietario efectivamente recibe (después de honorarios
   de administración), no el bruto.

2. **(b) Desglose por fila — filas sintéticas de honorarios** — cuando una
   entrada genera comisión, mostrar dos filas: el alquiler bruto y los
   honorarios como fila negativa derivada.

3. **(e) Empty state con filtros activos** — cuando hay entradas en la base
   pero ninguna calza con los filtros activos, mostrar mensaje en vez de tabla
   con headers vacía.

4. **(g) Agrupar por propiedad** — cuando el propietario tiene 2 o más
   propiedades, separar las entradas por propiedad usando `Accordion` de
   shadcn.

---

## Qué NO está en scope (anotado en PENDIENTES)

- Alert de próximo ajuste para multi-contrato (ítem d)
- Conectar/deprecar la página `/propietarios/[id]/liquidacion` (ítem f)
- Notificación post-recibo al propietario por mail/WhatsApp
- Comprobante de liquidación en PDF (Plan B)

---

## Arquitectura

### Filas sintéticas — qué son y qué no son

Las filas de honorarios **no se persisten en la base**. Se calculan en la API
de cuenta corriente del propietario al momento de armar la respuesta. Por cada
entrada del ledger con `impactaPropietario = true` y comisión > 0, la API
genera una fila adicional con:

```json
{
  "id": "synthetic-honorarios-<originalId>",
  "tipo": "honorarios_admin",
  "descripcion": "Honorarios administración (10%)",
  "monto": "-55000",
  "estado": "<mismo que el padre>",
  "period": "<mismo que el padre>",
  "isSynthetic": true,
  ...
}
```

**Reglas:**

- La fila sintética se posiciona inmediatamente después de su entrada padre
  en el array `ledgerEntries`.
- El UI no permite seleccionar, editar ni anular filas sintéticas.
- Hacer click en una fila sintética **no** abre el `EntryDetailDialog`.
- Visualmente: indentado (`pl-10`), color muted, sin checkbox.

**Por qué sintéticas y no reales:**

- Cero cambios al schema (no hay flag nuevo `impactaInquilino`).
- Aplica retroactivamente a todos los entries existentes.
- Si cambia el `managementCommissionPct` del contrato, la CC del propietario
  refleja el nuevo % automáticamente.
- Si en el futuro se necesita editar honorarios manualmente, se promueve a
  filas reales con un flujo separado.

---

### Cómo se calcula el neto/comisión por entrada

Para cada entrada `e` donde `impactaPropietario = true`:

```
si e.splitBreakdown existe (entrada conciliada en split):
  comision = splitBreakdown.administracion
  neto    = splitBreakdown.propietario

sino si !e.incluirEnBaseComision:
  comision = 0
  neto    = e.monto

sino:
  comision = e.monto * contract.managementCommissionPct / 100
  neto    = e.monto - comision
```

La API necesita unir `tenant_ledger` con `contract` para obtener
`managementCommissionPct` por entrada (cada entrada puede pertenecer a un
contrato distinto cuando el propietario tiene varias propiedades).

---

## Cambios — 4 archivos

### 1. `src/app/api/owners/[id]/cuenta-corriente/route.ts`

**Modificaciones:**

- Cambiar el query principal para hacer `LEFT JOIN` con `contract` y traer
  `managementCommissionPct`.
- Agregar query para listar las propiedades únicas con su address.
- Calcular comisión y neto por entrada usando la lógica descripta arriba.
- Generar filas sintéticas de honorarios e intercalarlas en el array de
  entries (justo después de cada padre).
- Recalcular KPIs:
  - `totalLiquidadoYTD` = suma de **netos** de entradas conciliadas en el año
    actual.
  - `totalPendiente` = suma de **netos** de entradas pendientes/registradas.

**Response shape final:**

```ts
{
  kpis: {
    totalLiquidadoYTD: number,  // neto, no bruto
    totalPendiente: number,     // neto, no bruto
  },
  ledgerEntries: LedgerEntry[],  // incluye filas sintéticas intercaladas
  properties: { id: string; address: string }[]  // dirs de propiedades únicas
}
```

---

### 2. `src/components/tenants/ledger-table.tsx`

**Modificaciones:**

- Agregar `isSynthetic?: boolean` a `LedgerEntry` (campo opcional).
- En el render del row, cuando `entry.isSynthetic === true`:
  - Aplicar clases `pl-10 bg-muted/20 text-muted-foreground italic`
  - No renderizar el checkbox (mostrar div vacío)
  - No renderizar el `···` menu
  - El `onClick` del row no llama a `onViewDetail`
- Cuando después de filtrar `filtered.length === 0`, retornar un `<div>` con
  el mensaje "No hay entradas con los filtros actuales." en vez de tabla con
  headers vacía. Esto resuelve el ítem (e).

---

### 3. `src/components/owners/owner-tab-current-account.tsx`

**Modificaciones:**

- Actualizar el tipo `CuentaCorrienteData` para incluir `properties`.
- Agrupar `ledgerEntries` por `propiedadId` antes de renderizar.
- Si hay **1 propiedad**: renderizar `LedgerTable` como hoy.
- Si hay **2+ propiedades**: renderizar un `Accordion type="multiple"` (shadcn)
  con un `AccordionItem` por propiedad.
  - Trigger: dirección · cantidad de entradas filtradas · neto YTD de esa
    propiedad
  - Content: `LedgerTable` con solo las entries de esa propiedad
  - Por defecto, todos abiertos (`defaultValue={properties.map(p => p.id)}`)
- El cálculo del neto YTD por propiedad se hace en el cliente sumando los
  netos de las entries conciliadas de cada propiedad.

**Nota sobre filtros:** los filtros (`activeFilters`) se aplican dentro del
`LedgerTable`. Cada propiedad muestra sus entries filtradas independientemente.
Si una propiedad termina con 0 entries filtradas, el `AccordionItem` muestra
el empty state interno (gracias al cambio en `LedgerTable`).

---

### 4. Instalar `Accordion` de shadcn (si no está)

```bash
npx shadcn@latest add accordion
```

Si ya está, salteamos este paso.

---

## Tipo `LedgerEntry` extendido

Agregar campo opcional para identificar filas sintéticas:

```ts
export type LedgerEntry = {
  // ... campos existentes ...
  isSynthetic?: boolean;
};
```

El campo es opcional para mantener compatibilidad con la vista de inquilino
que no usa filas sintéticas.

---

## Decisiones explícitas

- **Filas sintéticas vs reales**: sintéticas (decisión de diseño documentada
  en sección "Arquitectura").
- **Computación del neto**: server-side en la API, no cliente.
- **Visual de la fila sintética**: indentado + muted + italic, sin checkbox
  ni acciones.
- **Multi-propiedad**: `Accordion type="multiple"` con todos abiertos por
  defecto (el usuario colapsa lo que no le interesa).
- **Empty state con filtros**: el cambio se aplica en `LedgerTable`, no en
  `OwnerTabCurrentAccount`. Beneficia también a la vista del inquilino.

---

## Notas para el futuro

- Si en el futuro se necesita editar honorarios manualmente (caso raro pero
  posible), las filas sintéticas pueden promoverse a filas reales con un
  flujo de creación al emitir recibo y un flag `impactaInquilino` en el
  schema.
- La página `/propietarios/[id]/liquidacion` actualmente vive desconectada;
  cuando se diseñe el flujo formal de liquidación, conectarla con la CC.
