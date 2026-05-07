# Decisiones — Usuarios y Acceso

Roles, autenticación, permisos, acceso de terceros (inquilinos, propietarios).

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
