# Historial — Arce Administración

Funcionalidades completadas, de más reciente a más antigua.

---

## 2026-05

### Cuenta corriente del propietario — Mejoras
KPIs en neto (no bruto), filas sintéticas de honorarios derivadas del alquiler que se intercalan después de cada entry padre, agrupación por propiedad con `Accordion` cuando hay 2+ propiedades, empty state cuando los filtros activos no matchean ninguna entrada. La API `/api/owners/[id]/cuenta-corriente` ahora hace `INNER JOIN` con `contract` para obtener `managementCommissionPct` por entry, devuelve un dictionary de `properties` y calcula neto/comisión por entrada (usando `splitBreakdown` cuando está conciliado, o `incluirEnBaseComision` + pct del contrato como fallback). En el `LedgerTable` las filas sintéticas se renderizan indentadas, en italic, sin checkbox ni `···`, sin click-to-detail.

Archivos clave: `src/app/api/owners/[id]/cuenta-corriente/route.ts` · `src/components/owners/owner-tab-current-account.tsx` · `src/components/tenants/ledger-table.tsx` · `src/components/ui/accordion.tsx`

### Cuenta corriente de propietarios
Implementación MVP similar a la de inquilinos: tabla con movimientos, filtros (Pendientes/Pagados/Futuros), dos KPI cards (liquidado YTD + pendiente), EntryDetailDialog conectado al menú `···` en modo lectura. Acciones destructivas (cancelar, anular) ocultas en vista propietario. Componentes reutilizables `LedgerTable`, `LedgerFilters`, `EntryDetailDialog` en `src/components/ledger/` compartidos entre módulos.

Archivos clave: `src/components/owners/owner-tab-current-account.tsx` · `src/components/ledger/entry-detail-dialog.tsx` · `src/components/tenants/ledger-table.tsx` · `src/app/api/owners/[id]/cuenta-corriente/route.ts`

### Eliminación de `tenant_charge`
Tabla y código del sistema de cargos original, reemplazado por `tenant_ledger`. La única fila que quedaba tenía `reciboNumero: null` y nunca apareció en ningún recibo. Se eliminaron: tabla en la DB (migración 0018), schema `tenant-charge.ts`, rutas API `tenants/[id]/charges/`, script de migración `migrate-tenant-charges.ts`. Se limpió el fallback `charges` en `recibos/[id]/page.tsx` y `email-template.ts` — ambos usan ahora solo `ledgerItems`.

Nota de proceso: `Remove-Item` de PowerShell falla silenciosamente con rutas que contienen corchetes (`[id]`); requiere `-LiteralPath`.

### `db:migrate` resincronizado con la base real
La tabla `drizzle.__drizzle_migrations` tenía 14 entradas de las 18 migraciones existentes. Las 4 faltantes (0010, 0011, 0012, 0017) habían sido aplicadas con `db:push` sin dejar registro. Fix: se calculó el SHA256 del contenido de cada archivo SQL con `crypto.createHash('sha256')` y se insertaron las 4 filas faltantes con sus timestamps del journal. Verificado: `bun run db:migrate` corre sin errores. A partir de ahora usar `db:migrate` en vez de `db:push`.

### Email a cualquier destinatario (Gmail + Nodemailer)
El pendiente decía que el envío de emails solo funcionaba para `arce.guillermo.gaston@gmail.com` por restricción de Resend (plan gratuito). Ya no aplica: el sistema migró a Gmail con Nodemailer (`src/lib/auth/email.ts`), que puede mandar a cualquier dirección sin restricción de dominio. Item cerrado sin cambios de código.

### PDF del recibo (impresión optimizada)
El botón "Imprimir recibo" ya existía y llamaba a `window.print()`. Se descartó agregar una librería de PDF (`@react-pdf/renderer`) porque el flujo real del negocio es: imprimir en papel cuando viene el inquilino, o enviar por email (ya funcionaba). Guardar como archivo nunca era necesario.

Se implementaron estilos de impresión con cero dependencias nuevas:
- `@media print` global en `globals.css`: tamaño A4, márgenes 1,5 cm, fondo blanco, `print-color-adjust: exact`
- `dashboard-layout.tsx`: `print:hidden` en sidebar y breadcrumb header
- `recibos/[id]/page.tsx`: fondo blanco en el contenedor raíz y `print:!bg-white` en el card del recibo (para pisar el inline style con `!important`)

Archivos clave: `globals.css` · `dashboard-layout.tsx` · `recibos/[id]/page.tsx`

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
