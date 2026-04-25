# Pendientes técnicos

Lista de limitaciones conocidas, deuda técnica y decisiones postergadas a propósito.

---

## Recibos

### Modalidad de pago no se guarda en el movimiento de caja
**Archivo afectado:** `src/app/api/receipts/emit/route.ts`, `src/db/schema/caja.ts`

La modalidad de pago (A o B) que se usa al emitir un recibo no queda guardada en el movimiento de caja (`cajaMovimiento`). El recibo muestra la modalidad del contrato *al momento de consultarlo*, no la que tenía cuando se emitió.

Si el contrato cambia de modalidad después, los recibos viejos mostrarán la modalidad nueva, lo cual es incorrecto históricamente.

**Solución:** agregar columna `paymentModality` a `cajaMovimiento`, completarla en `POST /api/receipts/emit`, y leerla desde ahí en la página del recibo en lugar de leerla desde el contrato.

**Requiere:** migración de base de datos (`bun run db:generate` + `bun run db:migrate`).
