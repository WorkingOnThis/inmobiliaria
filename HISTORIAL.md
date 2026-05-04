# Historial — Arce Administración

Funcionalidades completadas, de más reciente a más antigua.

---

## 2026-05

### Flags contables en cargo manual + dialog de detalle de movimientos
Tres flags contables (`impactaPropietario`, `incluirEnBaseComision`, `impactaCaja`) ahora visibles y editables al crear un cargo manual. Al cambiar el tipo de cargo los flags se auto-resetean a los defaults. Dialog de detalle accesible desde el menú `···` de cualquier movimiento: editable para entradas manuales, solo lectura para auto-generadas. Menú `···` unificado para todas las filas (incluye punitorios, que ahora usan menú en lugar de X). Componentes reutilizables en `src/components/ledger/` para cuenta corriente de propietarios y caja.

Módulos afectados: cuenta corriente de inquilinos · `src/components/ledger/` (componentes compartidos).
Ver decisión: [contabilidad.md](docs/decisions/contabilidad.md)

### Cancelación de movimientos en cuenta corriente
Soft cancel desde el menú contextual `···` de la tabla de cuenta corriente (inquilinos). Dialog de confirmación con motivo opcional. Al cancelar un padre, los punitorios se cancelan en cascada dentro de una transacción. El estado pasa a `cancelado` y el movimiento queda visible en el historial.

Módulos afectados: cuenta corriente de inquilinos · cuenta corriente de propietarios (vista).
Ver decisión: [contabilidad.md](docs/decisions/contabilidad.md#cancelación-de-movimientos-soft-delete)
