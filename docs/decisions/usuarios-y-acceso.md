# Decisiones — Usuarios y Acceso

Roles, autenticación, permisos, acceso de terceros (inquilinos, propietarios).

---

## SEC-6 · Hardening de uploads (private storage + magic bytes) — 2026-05-07 — confirmada

**La decisión:** los archivos subidos por users se guardan en `private-uploads/` (project root, gitignored, fuera de `public/`) y se sirven exclusivamente via `GET /api/files/[scope]/[id]/[filename]` con auth checks + headers seguros. La validación al subir usa whitelist de extensiones + verificación de magic bytes leídos del servidor (NO `file.type` del cliente).

**El contexto:** auditoría detectó que las 3 rutas de upload (`tasks/archivos`, `contracts/documents`, `cash/comprobante`) confiaban en `file.type` (header MIME del cliente, trivialmente falsificable) y guardaban en `public/uploads/...` — donde Next.js sirve archivos directamente con `Content-Type` inferido de la extensión. Un `agent` malicioso podía subir `.html` con script y, al click-ear el link, otro user del equipo se comía el XSS en el origen de la inmobiliaria.

**Las alternativas que existían:**
- **Validation only**: helper `validateUpload()` (whitelist + magic bytes) aplicado en las 3 rutas; archivos siguen en `public/uploads/`. Descartada como solución principal: cierra el vector inmediato pero deja URLs públicas sin auth check (cross-tenancy filtrado por SEC-3 no aplica a archivos estáticos), y deja al `Content-Type` determinado por la extensión del filesystem (sin que nosotros lo controlemos).
- **`escapeHtml()` en filenames + CSP**: irrelevante — el problema no es el filename, es el contenido del archivo y cómo se sirve.
- **Reusar la column `documentTemplate.url` con object storage de una**: prematuro — no hay deploy a Vercel todavía. Mover a S3 cuando haya un trigger real (SEC-7 / deploy).

**Por qué private-storage + serving route:**
1. **Auth checks en cada read** — la URL `/api/files/...` pasa por un route handler que valida sesión + agency + ownership del recurso parent (task/contract/movimiento). SEC-3 ahora aplica también a archivos.
2. **Control sobre Content-Type** — no es la extensión del filesystem la que decide cómo lo sirve el browser, somos nosotros. Whitelist server-side: `pdf jpg jpeg png webp` mapean a sus MIMEs canónicos; cualquier otra cosa sale como `application/octet-stream`.
3. **`Content-Disposition: attachment` siempre** — fuerza descarga, el browser nunca interpreta el archivo como ejecutable. Defense-in-depth: si la validación tiene un bug, el archivo sigue siendo inerte.
4. **`X-Content-Type-Options: nosniff`** — bloquea MIME sniffing del browser (vector histórico donde el browser ignoraba el `Content-Type` y "adivinaba" leyendo bytes).
5. **Path natural a S3 / Vercel Blob**: `saveUpload`/`readUpload`/`deleteUpload` son una abstracción sobre el filesystem; cuando se haga el deploy a Vercel (donde el filesystem es read-only en runtime), solo cambia la implementación interna a `s3.putObject` / `s3.getObject`. Misma forma, distinto backend.

**4 capas de defense-in-depth:**
1. **Validate before save**: ext whitelist (`pdf jpg jpeg png webp`) + magic bytes leídos del buffer del servidor (no `file.type`)
2. **Private storage**: archivos en `private-uploads/<scope>/<id>/<filename>`, fuera del web root, gitignored, con path traversal protection (regex de componentes + `path.resolve` + prefix check con `path.sep`)
3. **Auth + ownership check on read**: route handler `GET /api/files/[scope]/[id]/[filename]` valida sesión + agency + `requireAgencyResource(table, id, agencyId)` antes de leer el archivo
4. **Safe response headers**: `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` + `Cache-Control: private, no-store` + `Content-Type` controlado server-side

**Magic bytes implementados:**
- PDF: `25 50 44 46` en bytes 0-3 (`%PDF`)
- JPEG: `FF D8 FF` en bytes 0-2
- PNG: `89 50 4E 47 0D 0A 1A 0A` en bytes 0-7
- WebP: `52 49 46 46` en bytes 0-3 (`RIFF`) Y `57 45 42 50` en bytes 8-11 (`WEBP`) — descarta otros containers RIFF como AVI/WAV

**Desventajas de lo elegido:**
- **Pérdida de inline preview**: `Content-Disposition: attachment` fuerza descarga. Para imágenes pequeñas (preview de tasks), el user pierde el "click → ver inline". Tradeoff aceptado: para una inmobiliaria, los uploads son evidencia de pagos/contratos que se descargan, no se "leen en el browser".
- **Filename ASCII-only en filesystem**: regex `^[A-Za-z0-9._-]+$` para portabilidad multi-OS. El nombre original (con tildes, espacios) se preserva en el campo `name` del DB y se muestra en la UI; lo que se ve restringido es el filename físico en disk.
- **TS narrowing weaker**: con `strict: false`, el discriminated union `{ ok: true, data } | { ok: false, error }` no narrow-ea bien. Implementación cae en forma plana `{ ok: boolean, data?, error?, status? }` con check defensivo. Cuando el proyecto active `strict: true`, swap fácil.
- **Vercel deployment**: filesystem write a `private-uploads/` no funciona en serverless runtime (read-only). El deploy real necesita migración a S3/Vercel Blob — el adapter ya está armado, solo cambia la implementación. Tracked como SEC-7.

**Cuándo revisarla:** cuando se haga el deploy a Vercel/Railway, swap-ear `saveUpload`/`readUpload`/`deleteUpload` para usar S3 o Vercel Blob. La interfaz no cambia. También cuando se quiera permitir formatos adicionales (Office docs, CSV, etc.) — los magic bytes son hardcoded por ahora, considerar la lib `file-type` si crece la matriz.

**Fuente:**
- Helpers: `src/lib/uploads/validate.ts`, `src/lib/uploads/storage.ts`
- Serving route: `src/app/api/files/[scope]/[id]/[filename]/route.ts`
- Routes modificadas: tasks/archivos, contracts/documents (POST + DELETE), cash/comprobante, cleanup-files cron
- Commits: `06f42fe`

---

## SEC-4 · Chequeo de rol en mutaciones — 2026-05-07 — confirmada

**La decisión:** todo route handler que ejecuta una mutación (POST/PATCH/PUT/DELETE) sobre datos de negocio debe llamar a `canManageX(session.user.role)` después de `requireAgencyId(session)`. Si el helper devuelve `false`, la route responde 403 con `{ error: "No tienes permisos" }`. Tres helpers nuevos en `src/lib/permissions.ts`: `canManageCash`, `canManageFieldNotes`, `canManageAgency`.

**El contexto:** auditoría pre-deploy detectó que 14 de 71 routes con mutaciones no validaban rol del user — solo verificaban que hubiera sesión. Un `visitor` (read-only por contrato) podía crear/editar/borrar movimientos de caja, tareas, comprobantes de servicio, field notes, zonas y settings de la inmobiliaria.

**Las alternativas que existían:**
- **Middleware/proxy global**: chequear rol en `src/proxy.ts` antes de que el request llegue al route handler. Descartada: el proxy ya hace bastante (auth + path-based routing), agregar lógica de rol granular ahí lo vuelve frágil. Además, no toda mutación sigue el mismo patrón de path → permission.
- **Permission checks declarativos por archivo**: convención tipo `export const requiredPermission = "cash.write"` que un wrapper verifica. Descartada: requiere más infraestructura, y por ahora 6 helpers nominales son legibles y discoverable por grep.
- **Único helper genérico `canManage(resource, role)`**: un solo punto, parametrizado por string. Descartada: mata el type-checking — si tipeás `canManage("cas", role)` (typo), TS no te avisa.

**Por qué elegí esta y no las otras:** el patrón `canManageX(role)` ya existía en el codebase (clauses, clients, properties, contracts, services, tasks, document templates). Sumar 3 helpers nuevos sigue la convención sin agregar abstracciones. El check es local al route, fácil de auditar con grep, y type-safe (las funciones son explícitas).

**Cobertura aplicada:**
| Routes | Helper |
|---|---|
| `cash/movimientos/*` (4) | `canManageCash` (nuevo) |
| `tasks/*` (3) | `canManageTasks` |
| `services/[id]/comprobante` (1) | `canManageServices` |
| `field-notes/*` (2) | `canManageFieldNotes` (nuevo) |
| `zones POST` (1) | `canManageProperties` (catalog reuse) |
| `agency PATCH` (1) | `canManageAgency` (nuevo, admin-only) |

**Casos especiales:**
- **`canManageAgency` es `account_admin` solamente** — más estricto que el resto. Editar la configuración de la inmobiliaria (datos fiscales, banking, preferencias de emisión) es operación admin. Cuando V2 sume invitaciones de colaboradores con rol `agent`, los invitados no van a poder cambiar settings de la inmobiliaria (que es lo que queremos).
- **`canManageProperties` cubre `zones POST`** — zones son etiquetas de barrios usadas en el form de propiedades. Quien crea propiedades necesita poder crear zonas inline (`CreatableCombobox`). Crear `canManageZones` separado sería duplicación sin lógica distintiva.
- **GETs no se tocaron** — read access se queda al nivel de agency (todo el equipo de la agency puede ver los datos).
- **Routes exentas**: `register/route.ts`, `register-oauth/route.ts` — anteceden a la sesión completa con role asignado.

**Desventajas de lo elegido:**
- **Sin lint rule que prevenga regresiones**: si alguien suma una route nueva con POST/PATCH/PUT/DELETE y olvida el check, no hay nada que lo bloquee. Mitigación: re-correr el grep audit periódicamente, o sumar un test que recorra `src/app/api` y verifique el patrón.
- **Permisos estáticos por enum** (`["agent", "account_admin"]`) — no hay UI para configurar quién puede qué. Si quisieras que un agente específico tenga permiso de admin, hay que cambiarle el rol entero. Por ahora es deliberado — empezar simple, granular cuando duela.

**Cuándo revisarla:** cuando V2 abra invitaciones de colaboradores con rol `agent`, validar que `canManageAgency` siga siendo admin-only y que el resto de los `canManage*` permitan al rol `agent`. Si en algún momento se quiere granularidad por-feature por-user (ej: "este agente puede pero ese no"), considerar mover a un sistema de capabilities en DB en vez de enums hardcoded.

**Fuente:**
- Helpers: `src/lib/permissions.ts`
- Routes modificadas: 12 — ver commits `dced78a` (routes) y `5c4c239` (helpers)
- Audit: `for f in $(grep -lrE "^export async function (POST|PATCH|PUT|DELETE)" src/app/api); do grep -q "canManage\|canAnnulReceipts" "$f" || echo "$f"; done`

---

## SEC-3 · Multi-tenancy con `agencyId` — 2026-05-06 — confirmada

**La decisión:** las 14 tablas de negocio (`client`, `property`, `contract`, `cash_movement`, `task`, `service`, `guarantee`, `clauseTemplate`, `contract_amendment`, `contract_document`, `contract_participant`, `property_co_owner`, `property_room`, `tenant_ledger`) reciben columna `agencyId NOT NULL` con FK a `agency.id ON DELETE CASCADE`. El `agencyId` se propaga vía Better Auth `additionalFields` (sin queries extra). Toda route handler usa los helpers `requireAgencyId` y `requireAgencyResource` (en `src/lib/auth/agency.ts`) para validar pertenencia. Errores 404 indistinguibles entre "no existe" y "es de otra agency".

**El contexto:** auditoría pre-deploy reveló que cualquier user logueado podía leer/editar/borrar datos de cualquier inmobiliaria. Antes de SEC-3, las rutas filtraban solo por `eq(table.id, id)` sin verificar el inquilino. Verificado en `properties/[id]`, `cash/movimientos`, `tasks/[id]/archivos`, etc.

**Las alternativas que existían:**
- **Postgres Row-Level Security (RLS)**: estándar dorado, motor de DB rechaza queries no scopeadas. Descartada: requiere `SET LOCAL` por transacción, choca con connection pooling de Neon serverless. Errores opacos (`permission denied for table X`) en vez de errores TS legibles.
- **Lookup per-request en DB** (sin tocar Better Auth): helper `getAgencyId(session)` consulta `agency.ownerId = user.id` en cada route. Descartada: +1 query por request, multiplica el problema "2 queries por page load" ya identificado.
- **Header-based via middleware**: el proxy de Next.js inyecta `x-agency-id` al request. Descartada: complejidad arquitectónica, fácil de bypassear si una ruta no pasa por el proxy.

**Por qué elegí esta y no las otras:** Better Auth ya usa `additionalFields` para `role`, sumar `agencyId` cuesta ~10 líneas y mismo patrón. Cero queries extra (la sesión ya viaja con la cookie). Combinada con DB constraint NOT NULL + helpers obligatorios + test E2E, da defense-in-depth real con errores TS debuggables. Si en V2 escala a multi-tenancy serio, RLS queda como capa 5 disponible.

**Las 4 capas de defensa:**
1. **Sesión** — `session.user.agencyId` populado vía Better Auth additionalFields
2. **DB constraint** — `agencyId NOT NULL` + FK con CASCADE
3. **Helpers** — `requireAgencyId(session)` y `requireAgencyResource(table, id, agencyId, [extras])` en toda route
4. **Test E2E** — `scripts/test-cross-agency.ts` valida bidireccionalmente (32/32 pasa)

**Tablas excluidas y por qué:** las "hijas de hijas" (`task_history`, `task_comment`, `task_file`, `service_receipt`, `service_skip`, `contract_clause`, `contract_document_config`, `guarantee_salary_info`, `receipt_allocation`, `receipt_annulment`, `receipt_service_item`) NO reciben `agencyId`. Su padre directo ya tiene la columna; agregarla acá sería 1 nivel de redundancia que no compra seguridad. Toda query a estas tablas debe ir vía un padre ya validado por el helper.

**Cambios de comportamiento documentados:**
- `nextReciboNumero` ahora cuenta por agency. Antes el contador era global, lo que podía generar colisiones de `reciboNumero` entre agencies (problema en `receiptAnnulment` que joinea por número).
- `zones` y `property-features` GET: antes devolvían 200 con array vacío para users sin agency, ahora devuelven 403 (`requireAgencyId` lo hace explícito). Si algún cliente UX dependía del 200, hay que ajustar.
- `document-templates` POST: antes devolvía 422 para missing agency, ahora 403.

**Desventajas de lo elegido:**
- **Stale agencyId en sesión** si en V2 cambia la membresía user↔agency. Hoy no aplica (1 user = 1 agency). Cuando aplique: invalidar sesión al cambiar.
- **Sin Postgres RLS** — si un dev rompe el helper Y rompe el FK Y rompe el test, hay leak. Probabilidad casi cero, pero menor a RLS verdadero.
- **Cross-tabla consistency**: en V2 con multi-agency, un `contract.propertyId` podría apuntar a un property de otra agency si alguien rompe el helper. Hoy no aplica (backfill garantiza coherencia, helpers la mantienen).

**Cuándo revisarla:** cuando V2 abra signup público de nuevas inmobiliarias o se sume invitación de colaboradores. En ese momento revisar (a) Postgres RLS como capa 5 si el código se vuelve más complejo, (b) cross-tabla CHECK constraints o triggers para que `contract.propertyId` apunte a una `property` de la misma agency, (c) refresh forzado de sesión al cambiar membresía.

**Fuente:**
- Plan: `docs/superpowers/plans/2026-05-06-sec-3-multi-tenancy.md`
- Spec: `docs/superpowers/specs/2026-05-06-sec-3-multi-tenancy-design.md`
- Migrations: `docs/migrations/sec-3-add-agency-id.sql`, `docs/migrations/sec-3-add-user-agency-id.sql`
- Helpers: `src/lib/auth/agency.ts` (+ tests `agency.test.ts`)
- Test E2E: `scripts/test-cross-agency.ts`
