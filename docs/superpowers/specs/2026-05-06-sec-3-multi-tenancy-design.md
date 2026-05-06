# SEC-3 — Multi-tenancy real con `agencyId`

**Fecha**: 2026-05-06
**Status**: Approved (brainstorm completo, listo para writing-plans)
**Origen**: Auditoría de seguridad pre-deploy. Item 3 de 7 en `PENDIENTES.md > 🚨 Bloqueante para producción`.

---

## Problema

Las tablas de negocio (`property`, `client`, `contract`, `cajaMovimiento`, `tarea`, `servicio`, `clauseTemplate`, `contractAmendment`, `contractDocument`, `contractParticipant`, `propertyCoOwner`, `propertyRoom`, `tenantLedger`, `guarantee`) no tienen columna `agencyId`. Las route handlers solo filtran por `eq(table.id, id)` sin verificar a qué inmobiliaria pertenece el recurso.

**Impacto**: cualquier usuario autenticado puede leer, editar o borrar datos de cualquier otra inmobiliaria. Verificado en `properties/[id]`, `cash/movimientos`, `tasks/[id]/archivos` y otras.

**Hoy en prod**: una sola inmobiliaria real (la del usuario), entonces el agujero no es explotable mientras siga así. El fix tiene que estar en su lugar **antes** de habilitar el alta de una segunda inmobiliaria.

---

## Solución — 4 capas de defense-in-depth

Si una capa se rompe, las otras lo atrapan.

| # | Capa | Mecanismo | Falla cerrada cuando… |
|---|---|---|---|
| 1 | **Sesión** | `session.user.agencyId` populado vía Better Auth `additionalFields` | sin agencyId → helper tira 403 antes de tocar la DB |
| 2 | **DB constraint** | columna `agencyId NOT NULL` + FK a `agency.id ON DELETE CASCADE` en 14 tablas | insert sin agencyId → Postgres rechaza |
| 3 | **Helpers obligatorios** | `requireAgencyId()`, `requireAgencyResource()` — toda route los usa | route nueva que se olvide de filtrar → TS no compila (la columna NOT NULL hace que falte el campo en `.values()`) o select devuelve 404 |
| 4 | **Test cross-agencia** | dos agencies en DB de test, cada route con cada role debe dar 404 al cruzar | regresión futura → CI rompe |

### Filosofía de errores

`requireAgencyResource` siempre devuelve **404 con mismo mensaje**, sea porque el recurso no existe o porque pertenece a otra agency. Nunca "no autorizado" — eso le diría a un atacante que el recurso existe.

> **Regla:** un atacante no debe poder distinguir "no existe" de "existe pero no es tuyo".

### Por qué no Postgres RLS (Row-Level Security)

RLS sería el estándar dorado pero está descartado para este stack:
- Requiere `SET LOCAL app.current_agency_id = '...'` en cada request, dentro de transacción → choca con connection pooling de Neon serverless
- Drizzle tiene soporte experimental, no canónico
- Errores opacos (`permission denied for table X`) en vez de errores TS legibles

Si en V2 escala a multi-tenancy real con muchas agencies y queda dudoso el aislamiento, se puede sumar RLS como capa 5. No es necesario hoy.

---

## Tablas que reciben `agencyId` (14)

Tablas "raíz operativa" — entidades que pueden consultarse directamente desde una route:

- `client`
- `property`
- `contract`
- `cajaMovimiento` (caja)
- `tarea`
- `servicio`
- `clauseTemplate`
- `contractAmendment`
- `contractDocument`
- `contractParticipant`
- `propertyCoOwner`
- `propertyRoom`
- `tenantLedger`
- `guarantee`

### Tablas que NO reciben `agencyId` (excepción documentada)

Hijas de hijas. El padre directo ya tiene `agencyId`, entonces son 1 nivel de redundancia, no 2:

- `tarea_history`, `tarea_comment`, `tarea_file` (hijas de `tarea`)
- `receipt_allocation`, `receipt_annulment`, `receipt_service_item` (hijas de `cajaMovimiento`)
- `contract_clause`, `contract_document_config` (hijas de `contract` o `contract_document`)
- `guarantee_salary_info` (hija de `guarantee`)

Toda query a estas tablas debe ir vía un padre ya validado. Nunca un `select().from(tarea_history).where(eq(id, X))` directo.

### Tablas que YA tienen `agencyId` (no tocar)

- `documentTemplate`
- `zone`
- `propertyFeature`
- `fieldNote`

---

## Las 5 fases

Cada fase es un PR independiente, mergeable y reversible. Las fases 1-3 son **aditivas** — agregan capacidad sin cambiar comportamiento. La fase 4 es el cutover atómico.

### Fase 1 — Schema migration

Hand-written SQL en `docs/migrations/sec-3-add-agency-id.sql` (versionado en git).

```sql
BEGIN;

-- Para cada tabla en la lista de 14:
ALTER TABLE property ADD COLUMN "agencyId" text;
UPDATE property SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE property ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE property ADD CONSTRAINT property_agencyId_fk
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- … repetir para las otras 13 tablas

COMMIT;
```

**Por qué SQL a mano y no `db:push`:**
- `db:push` no genera archivo versionable — sin trail para deploy a prod
- No permite intercalar el `UPDATE` (backfill) entre `ADD COLUMN` y `SET NOT NULL`
- Una transacción atómica garantiza que o todas las tablas migran, o ninguna

**Por qué el backfill es trivial**: hoy hay una sola agency real en la DB. `(SELECT id FROM agency LIMIT 1)` resuelve a esa única agency. Si en el futuro hay multi-agency con datos legacy, el backfill se diseña distinto — pero ese problema no existe hoy.

**Después de aplicar el SQL**: actualizar los archivos `src/db/schema/*.ts` agregando `agencyId: text("agencyId").notNull().references(() => agency.id, { onDelete: "cascade" })` para que Drizzle quede sincronizado con la DB real.

### Fase 2 — Sesión (Better Auth)

En `src/lib/auth/index.ts`, agregar a `user.additionalFields`:

```ts
agencyId: {
  type: "string",
  required: false,
  input: false,
}
```

En `src/app/api/register-oauth/route.ts`, después de crear la agency, persistir el `agencyId` en el user. La API exacta de Better Auth para actualizar fields adicionales se confirma en la fase de plan (puede ser `auth.api.updateUser` o un `db.update(user)` directo + invalidación de sesión). Aceptable cualquiera de las dos siempre que la próxima request del user lea `session.user.agencyId` populado.

**Backfill one-time** del único user existente:
```sql
UPDATE "user"
SET "agencyId" = (SELECT id FROM agency WHERE "ownerId" = "user".id);
```

**Simplificación del layout**: en `src/app/(dashboard)/layout.tsx`, reemplazar el lookup actual por `if (!session?.user?.agencyId) redirect("/register-oauth")`. Elimina una query por page load.

### Fase 3 — Helpers + tipos

Nuevo archivo `src/lib/auth/agency.ts`:

```ts
export class AgencyAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function requireAgencyId(session: Session | null): string {
  if (!session?.user) {
    throw new AgencyAccessError(401, "No autenticado");
  }
  if (!session.user.agencyId) {
    throw new AgencyAccessError(403, "No has completado el registro de inmobiliaria");
  }
  return session.user.agencyId;
}

// Tipo: solo acepta tablas con columna agencyId
type ScopedTable = PgTable & { agencyId: PgColumn };

export async function requireAgencyResource<T extends ScopedTable>(
  table: T,
  id: string,
  agencyId: string,
): Promise<InferSelectModel<T>> {
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.agencyId, agencyId)))
    .limit(1);
  if (!row) {
    throw new AgencyAccessError(404, "Recurso no encontrado");
  }
  return row;
}
```

Helper para route handlers:

```ts
export function handleAgencyError(err: unknown): NextResponse | null {
  if (err instanceof AgencyAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
```

**Tests unitarios** (~4 cases): sin sesión → 401; sin agencyId → 403; recurso de otra agency → 404; recurso propio → ok.

### Fase 4 — Cutover de routes (la fase crítica)

Una sola branch, varios commits agrupados por dominio para que cada uno sea revisable. Merge único cuando todos los commits están listos. Sub-grupos sugeridos:

1. `cash/*` (movimientos, comprobante, conciliar)
2. `clients/*` + `owners/*` + `tenants/*` + `guarantors/*` + `guarantees/*`
3. `properties/*` (incluye co-owners, features, rooms)
4. `contracts/*` (incluye amendments, documents, clauses, participants, generate-ledger, variable-writeback, guarantees nested, tenant-ledger)
5. `tasks/*` (incluye archivos, comentarios)
6. `services/*`
7. `clauses/*`, `document-templates/*`
8. `dashboard/*`, `arrears/*`, `comprobantes/*`, `receipts/*`, `field-notes/*`, `agency`, `adjustment-indexes`

**Patrón uniforme** en cada route:

```ts
export async function GET(request, { params }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    const { id } = await params;

    // En detalle: helper directo
    const property = await requireAgencyResource(property, id, agencyId);

    // En listado: filtrar por agencyId
    const list = await db.select().from(property).where(eq(property.agencyId, agencyId));

    // En insert: agencyId siempre — TS lo exige
    const inserted = await db.insert(property).values({ ..., agencyId });

    return NextResponse.json(...);
  } catch (err) {
    const errResp = handleAgencyError(err);
    if (errResp) return errResp;
    throw err;
  }
}
```

### Fase 5 — Test de integración cross-agencia

Archivo nuevo `tests/sec-3-cross-agency.test.ts`. Setup (la elección de runner — vitest, bun:test, etc. — y de DB de test se confirma en la fase de plan, ya que el proyecto no tiene infraestructura de tests automatizados todavía):
- DB de test (Neon branch efímera vía `mcp__neon__create_branch` es la opción más alineada con el stack actual)
- Crear `agencyA` y `agencyB`, cada una con un user, dos clients, una property y un contract
- Para cada route que recibe `[id]`: hacer request autenticado como user de `agencyA` apuntando a un id de `agencyB` → assert 404
- Para cada route de listado: hacer request autenticado como user de `agencyA` → assert que el response no contiene ids de `agencyB`

Template parametrizado para no escribir un test por cada ruta:

```ts
const ROUTES_WITH_ID = [
  { path: "/api/properties/:id", method: "GET" },
  { path: "/api/properties/:id", method: "PATCH" },
  // ... lista completa
];

for (const route of ROUTES_WITH_ID) {
  test(`${route.method} ${route.path} → 404 cross-agency`, async () => {
    const path = route.path.replace(":id", agencyB.propertyId);
    const res = await fetch(path, { method: route.method, headers: agencyA.cookieHeader });
    expect(res.status).toBe(404);
  });
}
```

---

## Edge cases y exempciones

| Route / componente | Decisión | Razón |
|---|---|---|
| `/api/cron/cleanup-files` | exempt | Sistémica, sin sesión. SEC-1 ya la cerró con `CRON_SECRET` |
| `/api/auth/*` (Better Auth) | exempt | Por definición, gestiona la sesión |
| `/api/register`, `/api/register-oauth` | exempt | Preceden a la creación de agency |

Cualquier route nueva agregada en el futuro: si maneja recursos de negocio, **debe** llamar `requireAgencyId()`. La review de PR lo verifica.

---

## Riesgos asumidos

1. **Stale agencyId en sesión** si en V2 cambia la membresía user↔agency. Hoy no aplica (1 user = 1 agency). Cuando aplique: invalidar sesión al cambiar.
2. **Ventana entre fase 1 y fase 4**: schema con `agencyId` pero routes sin filtrar. No explotable mientras haya una sola agency en la DB. Control: no habilitar signup de segunda inmobiliaria entre fases.
3. **Sin Postgres RLS**. Si un developer rompe el helper Y rompe el FK Y rompe el test, hay leak. Probabilidad casi cero. RLS es overkill para Neon serverless hoy.
4. **Cross-tabla consistency**: en V2 con multi-agency, un `contract.propertyId` podría apuntar a un property de otra agency si alguien rompe el helper. Para V1 (1 agency real), backfill garantiza coherencia y los helpers la mantienen. No agregamos triggers/CHECK constraints — YAGNI.

---

## Criterios de éxito

- [ ] 14 tablas con `agencyId NOT NULL` + FK a `agency.id`
- [ ] `session.user.agencyId` accesible en todas las route handlers vía Better Auth
- [ ] `requireAgencyId()` y `requireAgencyResource()` implementados y con tests unitarios
- [ ] Las 91 routes de negocio scopeadas según el patrón uniforme
- [ ] Test de integración cross-agencia pasa (todas las routes con `[id]` devuelven 404 al cruzar; listados no leakean ids ajenos)
- [ ] `db:push` desde un schema limpio reproduce la estructura final (sin diff con la DB real)
- [ ] Build (`bun run build`) y lint (`bun run lint`) pasan
- [ ] Manual smoke test: el user existente sigue pudiendo entrar, ver sus propiedades, crear movimientos, etc.

---

## Próximo paso

Invocar `superpowers:writing-plans` para generar el plan de ejecución en pasos concretos con verificación por paso.
