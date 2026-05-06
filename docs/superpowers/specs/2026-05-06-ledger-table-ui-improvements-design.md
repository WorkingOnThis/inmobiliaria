# Spec: Mejoras de UI — Tabla Cuenta Corriente de Inquilinos

**Fecha:** 2026-05-06  
**Archivo afectado:** `src/components/tenants/ledger-table.tsx`  
**Objetivo:** Limpiar y mejorar la tabla antes de replicar el patrón a propietarios.

---

## Cambios aprobados

### 1. Columna Tipo — sin cambios
Se mantiene. Es necesaria porque no todos los conceptos son "alquiler" — hay `descuento`, `bonificacion`, `punitorio`, etc. que no se infieren de la descripción.

### 2. Header de período — sin cambios
El diseño actual ya funciona: período a la derecha, botón de selección a la izquierda, separados por un divisor. No requiere modificación.

### 3. Fechas de vencimiento como subtext (nuevo)
**Dónde:** Bajo la descripción del concepto, solo en entradas con `dueDate` no nulo y en estados pendientes (`pendiente`, `registrado`, `pago_parcial`, `pendiente_revision`).

**Lógica de presentación:**
- Si `dueDate` es futuro → `"X días hasta vencimiento · vence DD/MM"` (color amber)
- Si `dueDate` es hoy → `"Vence hoy · DD/MM"` (color amber)
- Si `dueDate` es pasado y el estado sigue pendiente → `"X días de mora · vencía DD/MM"` (color rojo)
- Si `dueDate` es nulo o el estado es `conciliado`/`cancelado`/`proyectado` → no se muestra nada

### 4. Número de recibo — mueve a subtext de descripción
**Antes:** El número de recibo aparecía como botón en la columna de acciones junto al `✕` de anular.  
**Después:**
- El número de recibo aparece como texto pequeño bajo la descripción: `R-00042 · ver recibo` (link azul clickeable, abre en nueva pestaña).
- El botón `✕` para anular recibo se mueve al menú `···` como ítem `"Anular recibo"`, junto a los ítems ya existentes.

### 5. Botón "Seleccionar mes" — solo con 2+ seleccionables
**Antes:** Aparecía (o dejaba un espacio vacío) aunque el período tuviera 0 o 1 item seleccionable.  
**Después:** El botón solo se renderiza cuando `selectableIds.length >= 2`. Con 0 o 1 item, el espacio queda vacío sin placeholder.  
**Texto:** Acortado de `"Seleccionar mes"` / `"Deseleccionar"` a `"Sel. mes"` / `"Desel. mes"` para reducir el ancho fijo.

### 6. Flecha en punitorio — eliminada
**Antes:** `"↳ Punitorio 04/2025 — 3 días"` 
**Después:** `"Punitorio 04/2025 — 3 días"` — el indent visual ya comunica la jerarquía.

### 7. Auditoría de componentes shadcn
Verificar que todos los elementos interactivos usen componentes de `@/components/ui/`. En particular:
- Los botones de filtro del panel padre (pendiente/pagado/futuro/mora) deben usar `<Badge>` o `<Button variant="outline">` de shadcn, no `<button>` HTML crudo.
- Verificar que los filtros `overdue`, `pending`, `paid`, `future` funcionen correctamente y muestren/oculten los períodos esperados.

---

## Lo que NO cambia
- Lógica de selección de entradas y de mes
- Comportamiento de checkboxes y override de monto
- DestinoBadge para contratos split
- Estructura de columnas (`grid-template-columns`)
- Opacidad de períodos pasados/futuros
- Highlight del período actual con borde azul

---

## Archivos a modificar
- `src/components/tenants/ledger-table.tsx` — todos los cambios de la tabla
- El componente padre que renderiza los botones de filtro (identificar durante implementación)

---

## Criterio de éxito
- Tabla renderiza subtext de vencimiento correcto según estado y fecha
- Número de recibo visible bajo descripción, clickeable
- Anular recibo disponible en menú `···`
- Botón "Sel. mes" solo aparece con 2+ seleccionables
- Sin `↳` en punitorios
- Todos los botones de filtro usan componentes shadcn
- Filtros muestran y ocultan entradas correctamente
