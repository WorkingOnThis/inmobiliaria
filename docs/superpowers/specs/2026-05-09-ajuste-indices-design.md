# Spec: Actualización de alquileres por índice

**Fecha:** 2026-05-09  
**Estado:** Aprobado  
**Autor:** Gastón (diseño) + Claude Code (spec)

---

## Resumen

Implementar un sistema de carga manual de valores de índices (ICL, IPC, CER, UVA) que actualice automáticamente el monto de alquiler de los contratos correspondientes, con trazabilidad completa del cálculo y un mecanismo de valor provisorio cuando el índice no está publicado aún al momento del cobro.

---

## Contexto de negocio

### Regla central de cálculo (ejemplo IPC trimestral)

El ajuste que rige a partir del mes X se calcula con los IPC de los N meses inmediatamente anteriores (X-N ... X-1). El mes que se está cobrando **nunca entra en su propio cálculo**.

**Ejemplo con ajuste trimestral y base $100.000:**

| Período | IPC usados | Factor compuesto | Monto resultante |
|---|---|---|---|
| Ene–Mar | (primer trimestre, sin ajuste) | — | $100.000 |
| Abr–Jun | Ene 2%, Feb 3%, Mar 2% | 1,02 × 1,03 × 1,02 = 1,07212 | $107.212 |
| Jul–Sep | Abr 5%, May 1%, Jun 4% | 1,05 × 1,01 × 1,04 = 1,10571 | $117.571 |

El IPC de Julio (3%) se usará recién en el tercer ajuste (Octubre).

### Reglas de implementación

- El cálculo es multiplicación encadenada de factores `(1 + ipc/100)`, **nunca suma de porcentajes**.
- El base de cada período es el valor resultante del período anterior, no el valor original del contrato.
- El IPC del mes que se está por cobrar puede no estar publicado — eso es normal y esperado.
- Cada índice tiene sus propios tiempos de publicación (ICL y IPC suelen publicarse alrededor del 15 del mes siguiente); los inquilinos pagan hasta el día 10, lo que crea una ventana donde el cálculo puede estar incompleto.

### Formato de fechas en UI

- Períodos: `MM/YYYY` (ej. 03/2026)
- Fechas completas: `DD/MM/YYYY` (ej. 15/03/2026)
- Almacenamiento interno (DB): `YYYY-MM` y `YYYY-MM-DD` (ISO, sin cambios)

---

## Flujo completo

```
Usuario carga "IPC Junio 2026 = 4%"
           │
           ▼
Sistema detecta contratos activos con adjustmentIndex = "IPC"
           │
           ├─ ¿Se completan los N meses requeridos para el próximo ajuste?
           │
           ├─ SÍ → Calcular factor compuesto → Aplicar → Registrar adjustment_application
           │         Cambiar estado ledger "pendiente_revision" → "pendiente"/"proyectado"
           │         Crear entrada ajuste_indice en ledger (informativa)
           │
           └─ NO → Aplicar valor provisorio (monto período anterior)
                    isProvisional = true → badge "Provisorio" en UI y recibo
                    Cuando se cargue el valor faltante → recalcular y generar ajuste correctivo
```

---

## Base de datos

### Tabla `adjustment_index_value`

Un registro por mes por tipo de índice.

```ts
{
  id: text PK,
  agencyId: text FK → agency.id ON DELETE CASCADE,
  indexType: text,          // "ICL" | "IPC" | "CER" | "UVA"
  period: text,             // "YYYY-MM" — mes al que corresponde el valor
  value: decimal(6, 4),     // ej. 2.0000 (representa 2%)
  loadedAt: timestamp,
  loadedBy: text FK → user.id,
}
```

**Restricción única:** `(agencyId, indexType, period)` — no se puede cargar dos veces el mismo índice para el mismo mes.

---

### Tabla `adjustment_application`

Historial de ajustes aplicados. Un registro por contrato por tramo de ajuste.

```ts
{
  id: text PK,
  agencyId: text FK → agency.id ON DELETE CASCADE,
  contratoId: text FK → contract.id ON DELETE RESTRICT,
  adjustmentPeriod: text,   // "YYYY-MM" — mes desde el que rige el nuevo valor
  previousAmount: decimal(15, 2),
  newAmount: decimal(15, 2),
  factor: decimal(12, 8),   // producto compuesto, ej. 1.07212000
  periodsUsed: text,        // JSON: ["2026-01","2026-02","2026-03"]
  valuesUsed: text,         // JSON: [2.0, 3.0, 2.0]
  isProvisional: boolean,   // true si se usó valor anterior por datos faltantes
  appliedAt: timestamp,
  appliedBy: text FK → user.id,
}
```

---

## Lógica de aplicación

### Función `applyIndexToContracts(indexType, loadedPeriod, agencyId)`

Se ejecuta cada vez que se carga un nuevo valor de índice.

1. Buscar todos los contratos `active` con `adjustmentIndex = indexType` y `agencyId`.
2. Para cada contrato:
   a. Determinar el próximo tramo de ajuste: período de inicio = `nextAdjustmentDate(startDate, adjustmentFrequency)`.
   b. Determinar los N meses de índice requeridos (los N meses anteriores al tramo).
   c. Buscar esos valores en `adjustment_index_value`.
   d. **Si todos disponibles**: calcular `factor = Π(1 + value_i/100)`, nuevo monto = `monthlyAmount × factor`.
   e. **Si alguno falta**: usar `monthlyAmount` actual como valor provisorio, `isProvisional = true`.
3. En ambos casos:
   - Actualizar `contract.monthlyAmount` al nuevo valor.
   - Cambiar estado de entries `pendiente_revision` del contrato:
     - Períodos ≤ hoy → `pendiente`
     - Períodos > hoy → `proyectado`
   - Actualizar `monto` y `montoOriginal` de esas entries.
   - Crear entry `ajuste_indice` en `tenantLedger` (ver formato abajo).
   - Insertar registro en `adjustment_application`.

### Recalculo cuando se completan datos faltantes

Si al cargar un nuevo valor se detecta que un contrato tiene un `adjustment_application` con `isProvisional = true` cuyo tramo ahora puede calcularse correctamente:

1. Calcular el monto correcto.
2. Insertar un `adjustment_application` nuevo (no modificar el anterior — es auditoría).
3. Crear una entry `ajuste_indice` correctiva en el ledger: "Corrección de ajuste provisorio".
4. Actualizar `contract.monthlyAmount` con el valor correcto.
5. Actualizar las entries `pendiente` o `proyectado` del tramo con el monto correcto.

---

## Entrada `ajuste_indice` en el ledger

**Flags:**
```ts
{
  tipo: "ajuste_indice",
  impactaPropietario: false,
  impactaCaja: false,
  incluirEnBaseComision: false,
  isAutoGenerated: true,
}
```

**Descripción (caso normal):**
```
Ajuste IPC — rige desde 07/2026
Valores: Abr 5% · May 1% · Jun 4%
Factor: × 1,10571
De $107.212 → $117.571
```

**Descripción (caso provisorio):**
```
Ajuste IPC (Provisorio) — rige desde 07/2026
IPC de Junio aún no publicado. Se usa valor del período anterior.
⚠ Se recalculará automáticamente cuando se cargue el índice faltante.
```

---

## Rutas API

| método | ruta | descripción |
|---|---|---|
| `GET` | `/api/index-values` | Listar valores cargados (con filtros por tipo y rango de período) |
| `POST` | `/api/index-values` | Cargar un nuevo valor → dispara `applyIndexToContracts` |
| `GET` | `/api/index-values/adjustments` | Historial de ajustes aplicados (con filtro por contrato) |
| `DELETE` | `/api/index-values/:id` | Revertir un valor → revierte el ajuste en contratos afectados |

---

## UI — Panel "Índices" dentro de Contratos

### Ubicación

Sección colapsable o tab en la page `/contratos`, sin ítem de menú separado.

### Componentes

**Formulario de carga:**
- Select: tipo de índice (ICL / IPC / CER / UVA)
- Input mes/año: formato `MM/YYYY`
- Input valor: porcentaje con decimales
- Botón "Cargar"

**Tabla de valores cargados:**
- Columnas: Tipo | Período (MM/YYYY) | Valor (%) | Cargado por | Fecha | Contratos afectados | Acciones
- Badge "Provisorio" cuando el valor completó parcialmente un tramo
- Botón "Revertir" por fila

**Historial de ajustes:**
- Por contrato: período de inicio | monto anterior | factor | monto nuevo | provisorio (sí/no)
- Expandible para ver el detalle de meses usados

**Listado de contratos:**
- Badge "⚠ Ajuste pendiente" en contratos con entradas `pendiente_revision`

---

## Lo que NO entra en este spec (V2)

- Integración con API del BCRA para traer valores automáticamente
- Múltiples ajustes acumulados sin datos (más de un tramo de deuda de índice)
- Ajuste retroactivo sobre entradas ya conciliadas/cobradas

---

## Preguntas cerradas durante el diseño

| Pregunta | Decisión |
|---|---|
| ¿% directo al contrato o tabla central? | Tabla central con valores mensuales |
| ¿Automático o requiere confirmación? | Automático al cargar el valor |
| ¿Dónde gestionar índices? | Dentro del módulo Contratos (sin menú separado) |
| ¿Qué pasa si el índice no está publicado? | Valor provisorio (monto período anterior) + badge + recalculo automático al completar datos |
| ¿Formato de fechas en UI? | `MM/YYYY` para períodos, `DD/MM/YYYY` para fechas — almacenamiento interno sigue en ISO |
| ¿Índice por período o por mes? | Un valor por mes — el cálculo es multiplicación encadenada de N meses |
