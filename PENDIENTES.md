# Pendientes — Arce Administración

Trabajar de arriba hacia abajo dentro de cada grupo.
Items completados → [HISTORIAL.md](HISTORIAL.md)
Decisiones y contexto → [docs/decisions/](docs/decisions/)

---

## 🚨 Bloqueante para producción (auditoría de seguridad)

Antes de subir el proyecto online. Orden: barato primero → migración grande → operacional. Cada ítem trae archivo:línea y la idea del fix; el detalle completo del exploit está en la sesión de auditoría (LOG.md).

- [x] **SEC-1 · `BETTER_AUTH_SECRET` obligatorio (HIGH)** — `src/lib/auth/index.ts` ahora tira `Error` al boot si la env var falta (fail-fast). `src/app/api/cron/cleanup-files/route.ts` invertido a fail-closed: 503 si no hay `CRON_SECRET`, 401 si no coincide. OAuth de Google se valida cuando se active el provider · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)

- [x] **SEC-2 · Arreglar flujo de registro y verificación de email (HIGH)** — Nuevos registros ahora entran como `visitor` + `emailVerified: false`. `auth.api.sendVerificationEmail()` se dispara post-insert (con rollback del user si el envío falla). `requireEmailVerification: true` en Better Auth. Bloque del proxy descomentado para forzar verificación. Layout de `(dashboard)` chequea agency y redirige a `/register-oauth` si falta — el flujo de creación de inmobiliaria + promoción a `account_admin` queda compartido entre email/password y OAuth · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)

- [x] **SEC-3 · Multi-tenancy real: agregar `agencyId` y scopear todas las queries (HIGH)** — 14 tablas migradas con `agencyId NOT NULL` + FK a `agency.id ON DELETE CASCADE` (`client`, `property`, `contract`, `cajaMovimiento`, `tarea`, `servicio`, `guarantee`, `clauseTemplate`, `contractAmendment`, `contractDocument`, `contractParticipant`, `propertyCoOwner`, `propertyRoom`, `tenantLedger`). `agencyId` propagado vía Better Auth `additionalFields` (cero queries extra). Helpers `requireAgencyId` + `requireAgencyResource` (con tests unitarios) aplicados a las 86 routes de negocio. Validación cross-agency E2E con 2 agencies en Neon ephemeral branch: 32/32 asserciones pasan, ningún listing leakea IDs ajenos. Script en `scripts/test-cross-agency.ts` · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)

- [x] **SEC-4 · Chequeo de rol en mutaciones de Caja (MEDIUM)** — Audit a 71 routes con mutaciones detectó 14 sin check de rol. Scope completo: 12 routes pasaron a tener `canManageX(session.user.role)` después de `requireAgencyId`. Helpers nuevos: `canManageCash`, `canManageFieldNotes`, `canManageAgency` (admin-only). Cobertura: cash/* (4), tasks/* (3), services/[id]/comprobante (1), field-notes/* (2), zones POST (1), agency PATCH (1). Exempts: register/* (signup, anteceden a la sesión completa) · [contabilidad](docs/decisions/contabilidad.md)

- [x] **SEC-5 · Stored XSS en documento HTML de modificación de contrato (MEDIUM)** — Refactorizado a render-on-demand vía JSX. El `POST /document` ya no genera HTML — solo transiciona `status = "document_generated"`. Nueva page route `/contratos/[id]/modificaciones/[aid]` (server component) renderea el documento desde datos usando JSX (React auto-escapa). El `GET /document` redirige (307) al nuevo path. UI actualizada. `documentContent` deprecado en schema (no se borra; legacy data queda intocada pero nunca más se sirve). Bonus: documentos siempre frescos, nunca stale · [contratos](docs/decisions/contratos.md)

- [x] **SEC-6 · Whitelist de tipos de archivo en uploads a `public/` (MEDIUM)** — Refactor completo a private-storage. Helper `validateUpload` con whitelist de extensiones (`pdf jpg jpeg png webp`) + verificación de magic bytes (no `file.type`). Storage en `private-uploads/<scope>/<id>/<filename>` (gitignored, fuera de web root) vía helper `saveUpload`/`readUpload`/`deleteUpload` con protección de path traversal. Nueva route `GET /api/files/[scope]/[id]/[filename]` valida sesión + agency + ownership y sirve con `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` + `Cache-Control: private, no-store`. Cambia las 3 rutas de upload (tasks, contracts, cash/comprobante), el cron `cleanup-files` y el delete de contract documents. 0 archivos a migrar (DB vacía pre-deploy)

- [x] **SEC-7 · Operacional al deployar** — Code/config preparation completa para target Vercel. Storage adapter (`src/lib/uploads/storage.ts`) selecciona entre filesystem local (dev/Railway/VPS) y Vercel Blob (prod) según `BLOB_READ_WRITE_TOKEN`. Cron migrado de `node-cron` interno a Vercel Cron Jobs vía `vercel.json` (el endpoint HTTP `/api/cron/cleanup-files` ya validaba `CRON_SECRET`, compatible directo). `instrumentation.ts` skip en Vercel para evitar registro duplicado del cron interno. `sendEmail` ahora fail-fast en producción si faltan `GMAIL_USER` / `GMAIL_APP_PASSWORD`. Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) en `next.config.ts`. `.env.example` documentando todas las env vars. Deploy checklist completo en `docs/deploy-checklist.md` (8 fases, smoke test E2E, runbook operacional).

- [x] **Deploy a producción** — Primer deploy ejecutado. URL: `https://arce-administracion.vercel.app`. Repo en `Montaigne252/arce-administracion`. Blob Store `arce-uploads` (Private, São Paulo) conectado. Gmail app password **pendiente de corregir** — el envío de emails falla con credenciales actuales (error 535). Smoke test completo pendiente.

---

## 🔴 Prioridad alta

- [ ] **Panel de proyección de alquiler — completar funcionalidad** — base implementada y mejorada (tramo anterior visible, numeración por año, fix de base, estética de meses proyectados). Lo que falta, en orden:
  1. ~~**Verificar en dev**~~ — hecho; se encontraron y corrigieron bugs en la sesión 2026-05-10.
  2. **Ajuste retroactivo al crear contrato** — cuando se genera el ledger de un contrato nuevo con fecha de inicio en el pasado, el sistema no llama a `applyIndexToContracts()`. Si ya existen valores de IPC para los meses del primer tramo, el ajuste debería aplicarse automáticamente en ese momento. Fix: en `POST /api/contracts/[id]/generate-ledger`, después de insertar las entradas, detectar si hay tramos pasados con valores de índice disponibles y disparar `applyIndexToContracts()` para ese índice. · [contabilidad](docs/decisions/contabilidad.md)
  3. **Catálogo de índices mejorado** — en el panel `/contratos` (IndexValuesPanel), mostrar los valores como grilla: índice × mes, con colores para identificar meses faltantes. Hoy la tabla es una lista plana difícil de leer.
  4. **Explicación de aumento pasado** — cuando ya se aplicó un ajuste, mostrar en la cuenta corriente el desglose: qué meses del índice se compusieron, cada % y el factor total. La data ya está en `adjustment_application.periodsUsed` y `valuesUsed` (JSON). Solo falta exponerla en la UI junto a la entrada `ajuste_indice` del ledger.
  5. **Panel equivalente en cuenta corriente del propietario** — mismo panel de proyección para el propietario (con el neto después de honorarios).
  6. **Cron de IPC inaccesible desde Vercel** — la API del gobierno de Córdoba bloquea IPs fuera de Argentina. Alternativa: usuario baja CSV mensual y lo sube desde la UI (drag & drop), o lo carga manualmente campo a campo. · [contabilidad](docs/decisions/contabilidad.md)

- [x] **PDF del recibo** — implementado como mejora de estilos de impresión (`@media print`): sidebar y header ocultos, fondo blanco, tamaño A4, `print-color-adjust: exact`. Sin dependencias nuevas.

- [x] **`db:migrate` falla** — historial de `__drizzle_migrations` desincronizado con `db:push`. Workaround: seguir usando `db:push` en dev. Revisar antes de ir a producción.

- [x] **Eliminar tabla `tenant_charge`** — confirmar que nada la usa antes de borrar

---

## 🟡 Prioridad media

- [x] **Cuenta corriente de propietarios** — dejarla similar a la de inquilinos: misma estructura de tabla, mismo menú `···` con "Ver detalle", misma lógica de flags contables. El `EntryDetailDialog` ya existe como componente reutilizable · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Rango de fechas en cargo manual** — reemplazar el campo "Período (opcional)" por fecha inicio + fecha fin, con posibilidad de setear el fin especificando días desde el inicio (igual que en generación de contratos). Útil para calcular punitorios sobre cargos manuales · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Pago parcial y descuento desde dialog de detalle** — al modificar el monto de un alquiler o punitorio en el dialog, mostrar un campo adicional para indicar si es pago parcial. Incluye un flag: si NO es pago parcial, registrarlo como descuento automáticamente · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Descuentos y bonificaciones — distinción contable** — dos tipos diferenciados: `descuento` (no reduce base de honorarios, el propietario asume la diferencia) y `bonificacion` (reduce base de honorarios, la inmobiliaria también asume). Verificar que los flags `incluirEnBaseComision` e `impactaPropietario` reflejen correctamente esta distinción y que sea claro en la UI cuál es cuál · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Score de cliente** — métrica que refleja qué tanto trabajo da un inquilino. Schema: tabla `client_interaction` con `clientId`, `tipo` (reclamo/consulta/incidente), `descripcion`, `humorScore` (1–5). Score compuesto: frecuencia de reclamos + promedio humorScore + días promedio de pago. UI en ficha del inquilino · [inquilinos](docs/decisions/inquilinos.md)

- [ ] **Alert de próximo ajuste para propietarios multi-contrato** — el componente de inquilinos muestra un alert cuando se acerca un ajuste de índice. Para propietario con varias propiedades, requiere agregación: "Tienes 3 ajustes próximos en X mes" con link a detalle, o un alert por contrato. Necesita diseño · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Notificación post-recibo al propietario** — cuando se emite un recibo (modalidad split), enviar mensaje automático al propietario preguntando si recibió la transferencia. Empezar por mail o link a WhatsApp Web; en el futuro integración WhatsApp directa · [contabilidad](docs/decisions/contabilidad.md)

- [x] **Comprobante de liquidación al propietario (PDF)** — al emitir un recibo, generar también un PDF que el propietario pueda guardar/imprimir con: bruto cobrado, % comisión, neto recibido, datos del contrato y propiedad. Página `/comprobantes/[id]`, link desde cada entry conciliado en la CC · [contabilidad](docs/decisions/contabilidad.md)

---

## 🟢 Prioridad baja

### Deuda técnica heredada de la auditoría de seguridad

- [ ] **Renombrar `/register-oauth` a algo agnóstico** — hoy el flujo de "crear inmobiliaria + promoción a `account_admin`" se reusa para email/password también, así que el nombre quedó confuso. Candidatos: `/completar-registro` o `/nueva-inmobiliaria`. Toca: `src/app/(auth)/register-oauth/`, `src/app/api/register-oauth/`, `src/components/auth/oauth-buttons.tsx:25`, `src/components/auth/register-oauth-form.tsx:34`, y la redirección en `src/app/(dashboard)/layout.tsx`

- [ ] **Schema default `user.role` debería ser `"visitor"`** — `src/db/schema/better-auth.ts:19` hoy es `default("account_admin")`. No es explotable porque todos los inserts pasan rol explícito, pero es contradictorio con el `defaultValue: "visitor"` de Better Auth (`src/lib/auth/index.ts:39`) y rompería defense-in-depth si algún caller futuro olvidara pasarlo. Cambio: `default("visitor")` + `bun run db:push`

- [ ] **Verify-email: mostrar "te mandamos el email a X" cuando viene de register** — hoy `src/app/(auth)/verify-email/page.tsx:60-66` muestra "Hemos enviado un email a X" solo si hay `session?.user`. Después de registrarse no hay sesión todavía, así que cae al texto genérico "Ingresa tu email para recibir un link de verificación". Mejorar: detectar `?email=X&sent=true` y mostrar el mensaje correcto

- [ ] **Performance: 2 queries por page load del dashboard** — `getSession()` (con cookie cache deshabilitado) + nuevo query de agency en layout = 2+ queries en cada navegación. Considerar habilitar cookie cache de Better Auth con TTL corto, o cachear el agency lookup en la sesión. Optimizar solo si se vuelve perf concern

- [ ] **`register-oauth/route.ts` fuerza `role: "account_admin"` sin chequear el rol previo** — `src/app/api/register-oauth/route.ts:90` siempre setea admin. Hoy funciona porque solo viene de visitor → admin, pero si V2 agrega flujo de "invitar colaborador" con rol `agent`, este bypass los rompe. Cuando aparezca el feature de invitaciones, condicionar la promoción

- [ ] **Pool de motivos de cancelación (V2)** — reemplazar el campo de texto libre del dialog de cancelación por un `CreatableCombobox` que guarde y reutilice motivos frecuentes ("Error de carga", "No corresponde cobrar", etc.). Incluye: tabla en DB para los motivos, toggle de obligatorio/opcional por agencia desde un módulo de configuración · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Selector de mes en "Primer mes a cobrar"** — hoy muestra "1 de marzo de 2026" o "23 de marzo de 2026". Debería mostrar solo "Marzo 2026" independientemente del día seleccionado, ya que la granularidad es mensual · [contratos](docs/decisions/contratos.md)

- [ ] **Conectar/deprecar página `/propietarios/[id]/liquidacion`** — existe una página vieja con honorarios fijos en 7%, desconectada de la CC. Decidir: integrarla con la nueva CC, deprecarla, o reescribirla cuando se diseñe el flujo formal de liquidación · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Resumen de liquidaciones del año (CC propietario)** — botón global arriba de la tabla de la CC del propietario que liste todos los comprobantes emitidos en un período (mes/año). Permite imprimir o exportar la serie completa. Diferido del MVP de comprobantes de liquidación · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Generación servidor de PDFs (puppeteer/react-pdf)** — evaluar reemplazo del enfoque `@media print` por generación PDF en servidor. Habilitaría adjuntar PDFs al email (recibos del inquilino + comprobantes del propietario) y generación masiva. Costo: dependencia nueva pesada (Chromium si puppeteer). Revisar cuando el flujo de envío por email se vuelva el principal · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Rediseño estructural del LedgerTable (`shape ledger-table-v2`)** — el critique del componente dejó 3 preguntas estructurales sin resolver: (1) si los períodos deberían ser `<section>` independientes en vez de un grid global, (2) si la vista propietario amerita ser un componente separado del de inquilino (`isOwnerView` se referencia 11 veces), (3) cómo es la "versión quiet" de la fila después de sacar punitorios con tinte naranja, sintéticas en italic, override en tinte primary y mora con tinte destructive. Decisiones de rediseño que requieren brainstorm dedicado, no son polish · [contabilidad](docs/decisions/contabilidad.md)

---

## 🔵 Backlog / Futuro

- [ ] **Pago dividido — punitorios con destino configurable por tipo** — hoy todos los punitorios van al propietario; en V2 permitir configurar por tipo de cargo qué destino aplica en contratos split · [contratos](docs/decisions/contratos.md)

- [ ] **Pago dividido — notificación al inquilino con datos de transferencia** — enviar automáticamente al inquilino los CBU/alias y montos de cada destinatario al generar el recibo en modalidad split · [contratos](docs/decisions/contratos.md)

- [ ] **Pago dividido — confirmación bancaria** — registrar qué CBU recibió efectivamente el dinero (comprobante de transferencia), hoy solo se registra el desglose esperado · [contratos](docs/decisions/contratos.md)

- [ ] **Marcar movimiento como "ya cobrado" sin emitir recibo** — postergado hasta tener login de inquilinos y carga de comprobantes; el flujo completo tiene más valor que el botón solo · ver [contabilidad](docs/decisions/contabilidad.md#conciliación-manual-marcar-como-ya-cobrado-sin-emitir-recibo)

- [ ] **Login de inquilinos** — acceso diferenciado para que los inquilinos vean su cuenta corriente y suban comprobantes de pago · ver [inquilinos](docs/decisions/inquilinos.md) · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)

---

## ✅ Completados → ver [HISTORIAL.md](HISTORIAL.md)

- [x] **Modalidad de pago dividido (honorarios por contrato)** — `paymentModality = "split"`, columna `beneficiario` en ledger, desglose en CobroPanel, cobro directo en cuenta del propietario
- [x] **Eliminar movimiento pendiente desde la UI de cuenta corriente** — soft cancel con menú `...` y dialog de confirmación con motivo opcional
