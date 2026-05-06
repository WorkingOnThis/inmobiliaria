# Decisiones — Usuarios y Acceso

Roles, autenticación, permisos, acceso de terceros (inquilinos, propietarios).

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
