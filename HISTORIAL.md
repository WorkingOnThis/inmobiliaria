# Historial — Arce Administración

Funcionalidades completadas, de más reciente a más antigua.

---

## 2026-05

### Cancelación de movimientos en cuenta corriente
Soft cancel desde el menú contextual `···` de la tabla de cuenta corriente (inquilinos). Dialog de confirmación con motivo opcional. Al cancelar un padre, los punitorios se cancelan en cascada dentro de una transacción. El estado pasa a `cancelado` y el movimiento queda visible en el historial.

Módulos afectados: cuenta corriente de inquilinos · cuenta corriente de propietarios (vista).
Ver decisión: [contabilidad.md](docs/decisions/contabilidad.md#cancelación-de-movimientos-soft-delete)
