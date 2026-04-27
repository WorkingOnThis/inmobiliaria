# Pagos Parciales — Cuenta Corriente del Inquilino

**Fecha:** 2026-04-26  
**Scope:** `tenant_ledger` schema + `cobro-panel` + `ledger-table` + `punitorio-popover` + emit receipt endpoint

---

## Contexto

El sistema actual permite cobrar ítems del ledger del inquilino por el monto completo. No existe manera de registrar que el inquilino pagó solo una parte del alquiler y que el saldo restante queda pendiente con su propio historial de punitorios.

---

## Reglas de negocio

1. **Punitorios primero, luego capital.** Cuando hay un pago parcial que no cubre el total, se asigna primero al punitorio (completo) y luego al alquiler.
2. **El saldo restante "reinicia el reloj" de punitorios.** Los punitorios posteriores se calculan sobre el saldo restante desde la fecha del pago parcial, no desde el `dueDate` original.
3. **Múltiples pagos parciales sobre la misma entrada.** Cada pago acumula `montoPagado`. Cuando `montoPagado >= monto` original, la entrada pasa a "registrado".
4. **El monto original nunca se modifica.** El campo `monto` en la DB siempre guarda el valor original del contrato.

---

## Diseño de datos

### Campos nuevos en `tenant_ledger`

| Campo | Tipo | Descripción |
|---|---|---|
| `montoPagado` | `decimal(15,2)` nullable | Acumulado cobrado en pagos parciales. `null` si nunca hubo pago parcial. |
| `ultimoPagoAt` | `text` ("YYYY-MM-DD", solo almacenamiento) | Fecha del último pago parcial. Es el nuevo punto de inicio para calcular punitorios sobre el saldo restante. |

### Nuevo valor de `estado`

Se agrega `"pago_parcial"` al conjunto existente:  
`"proyectado" | "pendiente_revision" | "pendiente" | "registrado" | "conciliado" | "cancelado" | "pago_parcial"`

### Saldo restante (campo derivado, nunca almacenado)

```
saldoRestante = monto - montoPagado
```

Cuando `montoPagado >= monto` → `estado` pasa a `"registrado"` automáticamente.

---

## Diseño de UI

### Trigger del toggle

El toggle "Pago parcial" aparece **solo** cuando el staff edita el monto de una entrada a un valor menor al original (`montoOverride[id] < entry.monto`). No aparece en entradas sin modificar.

### Estado 1 — Editando (toggle visible)

- El toggle aparece inline debajo del nombre del concepto en la fila del ledger.
- Se muestra el saldo que quedaría pendiente: `monto - montoOverride`.
- El monto original aparece tachado encima del input.
- El punitorio se muestra en la fila de arriba (siempre se cobra antes que el capital).

### Estado 2 — Post-recibo (pago parcial registrado)

- Badge ámbar **"Pago parcial"** en la columna de estado.
- El monto grande (columna derecha) = saldo restante.
- Subtexto debajo del concepto: `Original: $120.000 · Pagado: $70.000`.
- La fila queda seleccionable para el próximo cobro.

### Visualización de fechas

- **Almacenamiento en DB:** `YYYY-MM-DD` (consistente con el resto del proyecto).
- **Visualización en UI:** `DD/MM/YYYY` via la función `formatDate()` ya existente.

---

## Flujo de emisión de recibo

Al hacer clic en "Emitir recibo" con al menos una entrada con pago parcial:

1. **Entradas con pago completo** → comportamiento actual sin cambios.
2. **Entrada con pago parcial** (toggle activo):
   - `montoPagado += montoOverride` (acumulativo).
   - `ultimoPagoAt = fecha del recibo`.
   - Si `montoPagado >= monto` → `estado = "registrado"`.
   - Si no → `estado = "pago_parcial"`.
3. El recibo se genera por el monto efectivamente cobrado (el override), no por el monto original.

---

## Cambios al punitorio popover

| Valor | Antes | Con pago parcial |
|---|---|---|
| Base del cálculo | `entry.monto` | `entry.monto - entry.montoPagado` (saldo restante) |
| Fecha de inicio | `entry.dueDate` | `entry.ultimoPagoAt` si existe, sino `entry.dueDate` |

El popover ya recibe estos valores como props — solo hay que pasar los nuevos campos.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/db/schema/tenant-ledger.ts` | Agregar `montoPagado`, `ultimoPagoAt` |
| `src/components/tenants/ledger-table.tsx` | Toggle visible cuando override < original; badge "Pago parcial"; subtexto original/pagado |
| `src/components/tenants/punitorio-popover.tsx` | Usar `ultimoPagoAt` y saldo restante como base |
| `src/app/api/receipts/emit/route.ts` | Lógica de actualización parcial en lugar de marcar como registrado |
| Migración DB | Agregar columnas `montoPagado` y `ultimoPagoAt` a `tenant_ledger` |

---

## Fuera de scope (V1)

- Validación de "punitorios primero" a nivel de backend (se maneja por ordenamiento visual en el ledger).
- Historial de cada pago parcial individual (solo se almacena el acumulado).
- Notificación automática al propietario sobre el saldo pendiente.
