# Historial — Arce Administración

Funcionalidades completadas, de más reciente a más antigua.

---

## 2026-05

### Modalidad de pago dividido
Nueva modalidad `"split"` en contratos: el inquilino transfiere directamente una parte al propietario y otra a la administración (por razones impositivas). Cada entrada del ledger lleva su `beneficiario` (`"propietario"` / `"administracion"` / `"split"`); el CobroPanel muestra el desglose con nombre, CBU y alias de cada destinatario; el admin puede cambiar el destino de forma efímera desde el dialog de detalle (con advertencia). Al emitir el recibo se persiste el `splitBreakdown` real en el historial. La cuenta del propietario distingue visualmente los cobros que llegaron directo desde el inquilino (fondo azul + badge "Cobro directo desde inquilino").

Archivos clave: `tenant-ledger.ts` (schema) · `cobro-panel.tsx` · `tenant-tab-current-account.tsx` · `entry-detail-dialog.tsx` · `add-manual-charge-dialog.tsx` · `ledger-table.tsx` · `receipts/emit/route.ts`

Ver decisión: [contratos.md](docs/decisions/contratos.md)

### Flags contables en cargo manual + dialog de detalle de movimientos
Tres flags contables (`impactaPropietario`, `incluirEnBaseComision`, `impactaCaja`) ahora visibles y editables al crear un cargo manual. Al cambiar el tipo de cargo los flags se auto-resetean a los defaults. Dialog de detalle accesible desde el menú `···` de cualquier movimiento: editable para entradas manuales, solo lectura para auto-generadas. Menú `···` unificado para todas las filas (incluye punitorios, que ahora usan menú en lugar de X). Componentes reutilizables en `src/components/ledger/` para cuenta corriente de propietarios y caja.

Módulos afectados: cuenta corriente de inquilinos · `src/components/ledger/` (componentes compartidos).
Ver decisión: [contabilidad.md](docs/decisions/contabilidad.md)

### Cancelación de movimientos en cuenta corriente
Soft cancel desde el menú contextual `···` de la tabla de cuenta corriente (inquilinos). Dialog de confirmación con motivo opcional. Al cancelar un padre, los punitorios se cancelan en cascada dentro de una transacción. El estado pasa a `cancelado` y el movimiento queda visible en el historial.

Módulos afectados: cuenta corriente de inquilinos · cuenta corriente de propietarios (vista).
Ver decisión: [contabilidad.md](docs/decisions/contabilidad.md#cancelación-de-movimientos-soft-delete)
