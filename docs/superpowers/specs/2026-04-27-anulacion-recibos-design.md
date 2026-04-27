# Anulación de Recibos — Design Spec

**Fecha:** 2026-04-27  
**Estado:** Aprobado  
**Autor:** Gastón · Arce Administración

---

## Contexto

Hoy los movimientos de caja generados por recibos (`source: "contract"`) están bloqueados con un candado (🔒) y no pueden eliminarse. El objetivo es permitir **anular** esos recibos de forma controlada, manteniendo trazabilidad del número correlativo y recalculando el saldo del ledger del inquilino automáticamente.

---

## Alcance

- Anulación de recibos desde la caja y desde la vista del recibo
- Solo accesible para `account_admin` (futuro: cualquier rol con permiso explícito)
- Soporte para pagos parciales encadenados
- Advertencia (no bloqueo) cuando el recibo ya fue liquidado al propietario

---

## Modelo de datos

### Tabla nueva: `receipt_annulment`

Registra cada anulación como un hecho permanente e inamovible.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | text (UUID) | PK |
| `reciboNumero` | text | Número de recibo anulado |
| `motivo` | text (nullable) | Razón libre escrita por el admin |
| `teniaPagosLiquidados` | boolean | Si algún movimiento tenía `settledAt` al momento de anular |
| `anuladoPor` | text → FK user | Quién realizó la anulación |
| `anuladoAt` | timestamp | defaultNow() |

### Cambios en `cash_movement` (3 columnas nuevas)

| Campo | Tipo | Notas |
|---|---|---|
| `anuladoAt` | timestamp (nullable) | Cuándo fue anulado |
| `anuladoPor` | text → FK user (nullable) | Quién lo anuló |
| `annulmentId` | text → FK receipt_annulment (nullable) | Apunta al registro de anulación |

Los movimientos anulados **permanecen en la DB** — solo quedan marcados con estos campos.

---

## API

### `POST /api/receipts/[reciboNumero]/annul`

**Auth:** solo `account_admin`

**Body:**
```json
{ "motivo": "texto libre opcional" }
```

**Pasos (dentro de una transacción):**
1. Buscar todos los `cash_movement` con ese `reciboNumero`
2. Si no existen o todos ya están anulados → 422
3. Detectar si alguno tiene `settledAt` → guardar como `teniaPagosLiquidados`
4. Crear registro en `receipt_annulment`
5. Marcar todos los movimientos: `anuladoAt`, `anuladoPor`, `annulmentId`
6. Obtener `ledgerEntryId`s desde `receipt_allocation` para ese `reciboNumero`
7. Eliminar las `receipt_allocation` de ese `reciboNumero`
8. Por cada `ledgerEntryId` afectado:
   - Recalcular `montoPagado` = suma de allocations restantes válidas
   - Recalcular `estado`: `conciliado` / `pago_parcial` / `pendiente`
   - Actualizar `tenantLedger`

**Respuestas:**

| Código | Situación |
|---|---|
| `200` | Anulación exitosa. Devuelve `annulmentId` y `teniaPagosLiquidados` |
| `403` | Usuario no es `account_admin` |
| `404` | `reciboNumero` no encontrado |
| `422` | Recibo ya anulado, o estado inválido |

---

## UI

### Punto 1 — Desde la caja (`caja-general-client.tsx`)

**Lista de movimientos:**
- El 🔒 actual se vuelve clickeable para `account_admin` cuando el movimiento tiene `reciboNumero`
- Click abre el modal de anulación (ver abajo)
- Movimientos anulados: texto tachado, colores apagados, badge rojo "Anulado"

**Modal de anulación:**
- Muestra: número de recibo, fecha, monto total, nombre del inquilino
- Si `teniaPagosLiquidados`: aviso naranja *"Este recibo incluye pagos ya liquidados al propietario. Deberás corregir el descuadre manualmente."*
- Si hay recibos posteriores sobre el mismo ledger: aviso informativo *"Hay otros pagos aplicados a este ítem. Se recalculará el saldo automáticamente."*
- Campo opcional: *"Motivo de anulación"*
- Botón: *"Anular recibo R-XXXX"* (requiere click explícito de confirmación)
- Post-confirm: toast de éxito + refresh de la lista

### Punto 2 — Desde la vista del recibo

- Botón "Anular recibo" visible solo para `account_admin` y solo si el recibo no está anulado
- Abre el mismo modal de anulación descrito arriba

---

## Casos borde

### Bloqueantes (422)

| Situación | Mensaje |
|---|---|
| Recibo ya anulado | *"Este recibo ya fue anulado."* |
| `reciboNumero` no existe | *"No se encontró el recibo."* |

### Con advertencia (se permite, se avisa)

| Situación | Comportamiento |
|---|---|
| Algún movimiento tiene `settledAt` | Aviso naranja pre-confirmación. Anulación procede. |
| Pago parcial con recibos posteriores (R002, R003 sobre el mismo ledger) | Aviso informativo. Ledger se recalcula correctamente. Recibos posteriores intactos. |

### Recálculo del estado del ledger

| Estado previo | Pagado restante | Estado resultante |
|---|---|---|
| `conciliado` | < 100% | `pago_parcial` |
| `conciliado` | 0% | `pendiente` |
| `pago_parcial` | < 100% | `pago_parcial` |
| `pago_parcial` | 0% | `pendiente` |

---

## Lo que NO entra en este spec

- Anulación de movimientos manuales (ya existe, no cambia)
- Anulación de liquidaciones al propietario (`source: "settlement"`)
- Vista de historial de anulaciones (auditoría, futuro)
- Notificaciones al inquilino sobre anulación
