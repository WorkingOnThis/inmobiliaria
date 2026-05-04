# Decisiones — Contabilidad

Lógica transversal que afecta cuenta corriente de inquilinos, cuenta corriente de propietarios y caja general.

---

## Cancelación de movimientos (soft delete)

**Estado:** `confirmada`

Los movimientos se cancelan cambiando `estado` a `"cancelado"` en lugar de eliminarse de la base de datos. El motivo de cancelación es opcional. Al cancelar un movimiento padre, sus hijos (punitorios) se cancelan en cascada dentro de una transacción.

**Por qué:** mantener el historial contable íntegro. Borrar filas rompería auditoría y haría imposible rastrear discrepancias.

---

## Conciliación manual ("marcar como ya cobrado" sin emitir recibo)

**Estado:** `postergada`
**Depende de:** login de inquilinos · módulo de carga de comprobantes

El flujo completo es: inquilino sube comprobante en la app → admin da el visto bueno → movimiento pasa a `conciliado`. Construir solo el botón de "marcar como cobrado" sin ese flujo tiene poco valor porque los casos donde se necesita hoy son poco frecuentes, y el riesgo contractual disuade la estafa.

**Cuándo revisarlo:** cuando se ataque el login de inquilinos y la carga de archivos.
