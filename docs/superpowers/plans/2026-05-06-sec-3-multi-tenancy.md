# SEC-3 Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar `agencyId` a 14 tablas de negocio, propagarlo vía sesión de Better Auth, y forzar que todas las route handlers filtren por agencia para cerrar el agujero de multi-tenancy.

**Architecture:** 4 capas de defense-in-depth — sesión (`session.user.agencyId` vía Better Auth additionalFields) + DB constraint (`NOT NULL` + FK) + helpers obligatorios (`requireAgencyId`, `requireAgencyResource`) + script de validación cross-agencia. Cutover en 5 fases: 3 aditivas (no cambian comportamiento) + 1 cutover atómico de 86 routes + 1 validación.

**Tech Stack:** Drizzle ORM · PostgreSQL (Neon serverless) · Better Auth · Next.js Route Handlers · bun:test · Neon MCP para migraciones y ephemeral branches.

**Spec:** [`docs/superpowers/specs/2026-05-06-sec-3-multi-tenancy-design.md`](../specs/2026-05-06-sec-3-multi-tenancy-design.md)

---

## File Structure

**Create:**
- `docs/migrations/sec-3-add-agency-id.sql` — migration SQL hand-written, versionada en git como trail de deploy
- `docs/migrations/sec-3-add-user-agency-id.sql` — migration para agregar `agencyId` a tabla `user`
- `src/lib/auth/agency.ts` — helpers `requireAgencyId`, `requireAgencyResource`, `AgencyAccessError`, `handleAgencyError`
- `src/lib/auth/agency.test.ts` — unit tests para los helpers
- `scripts/test-cross-agency.ts` — script manual de validación cross-agencia (no es parte de CI; se corre una vez después del cutover)

**Modify:**
- `src/db/schema/{client,property,contract,caja,tarea,servicio,guarantee,clause,contract-amendment,contract-document,contract-participant,property-co-owner,property-room,tenant-ledger}.ts` — agregar columna `agencyId`
- `src/db/schema/better-auth.ts` — agregar `agencyId` a tabla `user`
- `src/lib/auth/index.ts` — agregar `agencyId` a `additionalFields`
- `src/app/api/register-oauth/route.ts` — populate `agencyId` después de crear la agency
- `src/app/(dashboard)/layout.tsx` — leer `agencyId` desde la sesión (eliminar query)
- 86 route handlers en `src/app/api/**/route.ts` — agregar scoping (lista completa en cada task de Fase 4)

---

## Phase 1 — Schema Migration

### Task 1.1: Escribir SQL de migración para las 14 tablas

**Files:**
- Create: `docs/migrations/sec-3-add-agency-id.sql`

- [ ] **Step 1: Crear el archivo SQL con la migración completa**

```sql
-- SEC-3: Add agencyId to 14 business tables
-- Backfill assumes a single agency exists in DB (true in production at time of migration).
-- For multi-agency scenarios, redesign backfill before applying.

BEGIN;

-- 1. client
ALTER TABLE "client" ADD COLUMN "agencyId" text;
UPDATE "client" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "client" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "client" ADD CONSTRAINT "client_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 2. property
ALTER TABLE "property" ADD COLUMN "agencyId" text;
UPDATE "property" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "property" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "property" ADD CONSTRAINT "property_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 3. contract
ALTER TABLE "contract" ADD COLUMN "agencyId" text;
UPDATE "contract" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract" ADD CONSTRAINT "contract_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 4. cash_movement
ALTER TABLE "cash_movement" ADD COLUMN "agencyId" text;
UPDATE "cash_movement" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "cash_movement" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 5. task
ALTER TABLE "task" ADD COLUMN "agencyId" text;
UPDATE "task" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "task" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "task" ADD CONSTRAINT "task_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 6. service
ALTER TABLE "service" ADD COLUMN "agencyId" text;
UPDATE "service" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "service" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "service" ADD CONSTRAINT "service_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 7. guarantee
ALTER TABLE "guarantee" ADD COLUMN "agencyId" text;
UPDATE "guarantee" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "guarantee" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "guarantee" ADD CONSTRAINT "guarantee_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 8. clauseTemplate (note: camelCase table name)
ALTER TABLE "clauseTemplate" ADD COLUMN "agencyId" text;
UPDATE "clauseTemplate" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "clauseTemplate" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "clauseTemplate" ADD CONSTRAINT "clauseTemplate_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 9. contract_amendment
ALTER TABLE "contract_amendment" ADD COLUMN "agencyId" text;
UPDATE "contract_amendment" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract_amendment" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 10. contract_document
ALTER TABLE "contract_document" ADD COLUMN "agencyId" text;
UPDATE "contract_document" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract_document" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 11. contract_participant
ALTER TABLE "contract_participant" ADD COLUMN "agencyId" text;
UPDATE "contract_participant" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract_participant" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract_participant" ADD CONSTRAINT "contract_participant_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 12. property_co_owner
ALTER TABLE "property_co_owner" ADD COLUMN "agencyId" text;
UPDATE "property_co_owner" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "property_co_owner" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "property_co_owner" ADD CONSTRAINT "property_co_owner_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 13. property_room
ALTER TABLE "property_room" ADD COLUMN "agencyId" text;
UPDATE "property_room" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "property_room" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "property_room" ADD CONSTRAINT "property_room_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 14. tenant_ledger
ALTER TABLE "tenant_ledger" ADD COLUMN "agencyId" text;
UPDATE "tenant_ledger" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "tenant_ledger" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "tenant_ledger" ADD CONSTRAINT "tenant_ledger_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

COMMIT;
```

- [ ] **Step 2: Commit la SQL**

```bash
git add docs/migrations/sec-3-add-agency-id.sql
git commit -m "feat(sec-3): add agencyId migration SQL for 14 business tables"
```

---

### Task 1.2: Aplicar la migración a la DB de dev

**Files:** ninguno (solo se ejecuta SQL contra Neon)

- [ ] **Step 1: Snapshot pre-migración**

Usar `mcp__neon__run_sql` con la query:
```sql
SELECT
  (SELECT COUNT(*) FROM "client") AS clients,
  (SELECT COUNT(*) FROM "property") AS properties,
  (SELECT COUNT(*) FROM "contract") AS contracts,
  (SELECT COUNT(*) FROM "cash_movement") AS cash_movements,
  (SELECT COUNT(*) FROM "task") AS tasks,
  (SELECT COUNT(*) FROM "service") AS services,
  (SELECT COUNT(*) FROM "guarantee") AS guarantees,
  (SELECT COUNT(*) FROM "clauseTemplate") AS clause_templates,
  (SELECT COUNT(*) FROM "contract_amendment") AS contract_amendments,
  (SELECT COUNT(*) FROM "contract_document") AS contract_documents,
  (SELECT COUNT(*) FROM "contract_participant") AS contract_participants,
  (SELECT COUNT(*) FROM "property_co_owner") AS property_co_owners,
  (SELECT COUNT(*) FROM "property_room") AS property_rooms,
  (SELECT COUNT(*) FROM "tenant_ledger") AS tenant_ledger;
```

Anotar los counts en una nota mental — son la baseline.

- [ ] **Step 2: Verificar que existe exactamente una agency**

```sql
SELECT COUNT(*) FROM agency;
```

Expected: `1`. Si es ≥2, **PARAR** y revisar el plan: el backfill `(SELECT id FROM agency LIMIT 1)` no es seguro con múltiples agencies.

- [ ] **Step 3: Aplicar la migración**

Leer el archivo `docs/migrations/sec-3-add-agency-id.sql` y ejecutarlo vía `mcp__neon__run_sql_transaction` (envuelve todo en una transacción atómica). El BEGIN/COMMIT del archivo se mantiene aunque la herramienta también haga su propia transacción — Postgres soporta nested transactions vía savepoints implícitos.

- [ ] **Step 4: Verificación post-migración**

```sql
-- Todas las 14 tablas deben tener la columna agencyId NOT NULL con FK
SELECT
  t.table_name,
  c.is_nullable,
  c.data_type,
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = t.table_name
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = t.table_name || '_agencyId_fk'
  ) AS has_fk
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name = t.table_name AND c.column_name = 'agencyId'
WHERE t.table_name IN (
  'client', 'property', 'contract', 'cash_movement', 'task', 'service',
  'guarantee', 'clauseTemplate', 'contract_amendment', 'contract_document',
  'contract_participant', 'property_co_owner', 'property_room', 'tenant_ledger'
);
```

Expected: 14 rows, todas con `is_nullable = 'NO'` y `has_fk = true`.

- [ ] **Step 5: Verificación de counts post-migración**

Re-ejecutar el query de Step 1. Cada count debe ser **idéntico** al baseline. Si alguno cambió → la migración rompió datos, hay que investigar.

```sql
SELECT
  (SELECT COUNT(*) FROM "client" WHERE "agencyId" IS NULL) AS clients_null,
  (SELECT COUNT(*) FROM "property" WHERE "agencyId" IS NULL) AS properties_null;
-- ... repetir para las 14 si querés ser paranoico
```

Expected: todos `0`.

---

### Task 1.3: Actualizar los 14 schema files de Drizzle

**Files (Modify):**
- `src/db/schema/client.ts`
- `src/db/schema/property.ts`
- `src/db/schema/contract.ts`
- `src/db/schema/caja.ts`
- `src/db/schema/tarea.ts`
- `src/db/schema/servicio.ts`
- `src/db/schema/guarantee.ts`
- `src/db/schema/clause.ts`
- `src/db/schema/contract-amendment.ts`
- `src/db/schema/contract-document.ts`
- `src/db/schema/contract-participant.ts`
- `src/db/schema/property-co-owner.ts`
- `src/db/schema/property-room.ts`
- `src/db/schema/tenant-ledger.ts`

- [ ] **Step 1: Para cada uno de los 14 archivos, agregar el import de `agency` y la columna `agencyId`**

El patrón a aplicar en cada archivo:

```ts
// Al tope, junto a otros imports de schema:
import { agency } from "./agency";

// Dentro del pgTable(...), preferentemente cerca del id (al inicio del bloque de columnas):
agencyId: text("agencyId")
  .notNull()
  .references(() => agency.id, { onDelete: "cascade" }),
```

**Importante:** la columna debe quedar en el orden y posición que prefieras pero **siempre `notNull()` y con la FK** — debe coincidir con la estructura real de la DB después de Task 1.2.

Para `caja.ts` el nombre del export es `cajaMovimiento` y la tabla es `"cash_movement"` — no confundir; la columna se agrega al pgTable `cajaMovimiento`.

Para `clause.ts` el export es `clauseTemplate`. Para los archivos con sintaxis `pgTable("name", { ... }, (t) => [ ... ])` (índices/uniques en el segundo arg), agregar la columna en el primer objeto de columnas, antes del callback de constraints.

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
bun run build
```

Expected: build pasa. Si hay errores tipo "Property 'agencyId' is missing in type" en algún `db.insert(...).values({ ... })` → eso es **esperado** y se va a arreglar en Fase 4. Por ahora **ignorar esos errores** y verificar que solo aparecen ahí.

**Nota:** si el build falla por otros errores (no relacionados con `agencyId`), pararse a investigar — la migración no debería romper otra cosa.

- [ ] **Step 3: Verificar que `db:push` no detecta diff**

```bash
bun run db:push
```

Expected: el output dice "No changes detected" o similar. Si Drizzle quiere agregar/modificar la columna `agencyId` → hay un mismatch entre el schema TS y la DB (probablemente un typo en el `.notNull()` o el nombre de columna). Diagnose: comparar exactamente con la SQL de Task 1.1.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/
git commit -m "feat(sec-3): add agencyId column to 14 schema files"
```

---

## Phase 2 — Better Auth Session

### Task 2.1: Agregar columna `agencyId` a la tabla `user` y backfill

**Files:**
- Create: `docs/migrations/sec-3-add-user-agency-id.sql`
- Modify: `src/db/schema/better-auth.ts`

- [ ] **Step 1: Escribir el SQL de migración**

```sql
-- SEC-3: Add agencyId to user table for Better Auth additionalFields
-- Backfill via agency.ownerId = user.id

BEGIN;

ALTER TABLE "user" ADD COLUMN "agencyId" text;

-- Backfill: cada user que tenga una agency, recibe el agencyId
UPDATE "user"
SET "agencyId" = (
  SELECT a.id FROM agency a WHERE a."ownerId" = "user".id LIMIT 1
);

-- agencyId queda nullable: visitors recién registrados aún no tienen agency
ALTER TABLE "user" ADD CONSTRAINT "user_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE SET NULL;

COMMIT;
```

Crear el archivo en `docs/migrations/sec-3-add-user-agency-id.sql`.

**Por qué nullable y no NOT NULL**: a diferencia de las 14 tablas de negocio, la tabla `user` tiene users que aún no completaron el registro de agencia (visitors recién inscriptos). Esos usuarios no deberían bloquearse ni tener agencyId fake. El helper `requireAgencyId` se encarga de tirar 403 si la sesión no tiene agencyId.

**Por qué `ON DELETE SET NULL` y no `CASCADE`**: si por algún motivo se borra una agency, no queremos borrar al user owner — preferimos que el user sobreviva sin agencia (puede crearse una nueva).

- [ ] **Step 2: Aplicar la migración a la DB de dev**

Ejecutar el SQL vía `mcp__neon__run_sql_transaction`.

- [ ] **Step 3: Verificación**

```sql
-- El user owner existente debe tener agencyId populado
SELECT id, email, role, "agencyId" FROM "user";
```

Expected: el user único existente tiene `agencyId` no-nulo y matchea con `agency.id`.

```sql
SELECT u.id, u."agencyId", a.id, a."ownerId"
FROM "user" u
LEFT JOIN agency a ON a."ownerId" = u.id
WHERE u."agencyId" IS DISTINCT FROM a.id;
```

Expected: 0 rows (consistencia user.agencyId ↔ agency.ownerId).

- [ ] **Step 4: Actualizar `src/db/schema/better-auth.ts`**

Modificar el schema del export `user` agregando la columna después de `role`:

```ts
import { pgTable, text, timestamp, boolean, bigint, varchar } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("account_admin"),
  agencyId: text("agencyId"), // nullable: visitors no la tienen hasta crear su agency
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
```

**Nota:** no se agrega la `references()` en Drizzle porque hay una circular import potencial con `agency.ts` (agency referencia user.id, user referenciaría agency.id). La FK ya está enforced en la DB; Drizzle no la necesita conocer para hacer queries básicas. Si querés agregarla con `relations()`, hacelo en un step separado.

- [ ] **Step 5: Verificar build y db:push sin diff**

```bash
bun run build
bun run db:push
```

Expected: build pasa, db:push dice "No changes detected".

- [ ] **Step 6: Commit**

```bash
git add docs/migrations/sec-3-add-user-agency-id.sql src/db/schema/better-auth.ts
git commit -m "feat(sec-3): add agencyId column to user table"
```

---

### Task 2.2: Agregar `agencyId` a Better Auth `additionalFields`

**Files:**
- Modify: `src/lib/auth/index.ts`

- [ ] **Step 1: Editar `src/lib/auth/index.ts`**

Encontrar el bloque `user: { additionalFields: { ... } }` y agregar `agencyId`:

```ts
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "visitor",
        input: false,
      },
      agencyId: {
        type: "string",
        required: false,
        input: false, // No se setea en signup; se setea al completar registro de agencia
      },
    },
  },
```

- [ ] **Step 2: Verificar que TypeScript reconoce `session.user.agencyId`**

Crear un test rápido en `src/app/api/agency/route.ts` (sin commitear):

```ts
const session = await auth.api.getSession({ headers: await headers() });
const x: string | null | undefined = session?.user.agencyId;
//                                                  ^^^^^^^^ debería compilar
```

Si TypeScript no reconoce el field, posiblemente Better Auth necesita regenerar tipos. Volver a correr `bun run build`. Si persiste, agregar el field también al type local:

```ts
export type Session = typeof auth.$Infer.Session;
```

(esa línea ya existe al final de `src/lib/auth/index.ts` y debería refrescar automáticamente el tipo)

Borrar el código de prueba antes de commitear.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/index.ts
git commit -m "feat(sec-3): expose agencyId via Better Auth additionalFields"
```

---

### Task 2.3: Populate `agencyId` en `register-oauth/route.ts`

**Files:**
- Modify: `src/app/api/register-oauth/route.ts`

- [ ] **Step 1: Editar `register-oauth/route.ts` para actualizar `user.agencyId` dentro de la transacción**

Encontrar el bloque de transacción (líneas ~76-92):

```ts
await db.transaction(async (tx) => {
  // Create Agency
  await tx.insert(agency).values({
    id: agencyId,
    name: agencyName.trim(),
    ownerId: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Ensure user has role set
  await tx
    .update(user)
    .set({ role: "account_admin" })
    .where(eq(user.id, userId));
});
```

Modificar el `update(user).set(...)` para incluir también `agencyId`:

```ts
await db.transaction(async (tx) => {
  // Create Agency
  await tx.insert(agency).values({
    id: agencyId,
    name: agencyName.trim(),
    ownerId: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Ensure user has role set + link to agency
  await tx
    .update(user)
    .set({ role: "account_admin", agencyId })
    .where(eq(user.id, userId));
});
```

Importante: el `agencyId` que se setea acá es el local de la transacción, ya declarado en la línea `const agencyId = crypto.randomUUID();`.

- [ ] **Step 2: Verificación manual (smoke test)**

Si tenés acceso a un user de prueba (no el principal), o querés crear uno temporal:
1. Login con un OAuth provider o email/password recién registrado (visitor sin agency)
2. Llegás al flow `/register-oauth`
3. Creás una agency
4. Hacés `mcp__neon__run_sql` con `SELECT id, "agencyId" FROM "user" WHERE id = '<test-user-id>';`
5. Expected: `agencyId` populado, no nulo

Si no querés crear un user de prueba, podés saltar este step y validar en Fase 5.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/register-oauth/route.ts
git commit -m "feat(sec-3): persist agencyId on user during registration"
```

---

### Task 2.4: Simplificar el layout para leer `agencyId` desde la sesión

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Reemplazar el lookup de agency por la lectura del campo de sesión**

Editar `src/app/(dashboard)/layout.tsx` con este contenido completo:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/dashboard-layout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user && !session.user.agencyId) {
    redirect("/register-oauth");
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}
```

Eliminados: imports de `db`, `agency`, `eq`, y el query a `agency`. La lógica equivalente ahora vive en la sesión (1 query en lugar de 2 por page load).

- [ ] **Step 2: Smoke test manual**

```bash
bun dev
```

Abrir `http://localhost:3000/tablero` (o cualquier ruta de `(dashboard)`):
- Si estás logueado y tenés agency → entrás normal
- Si estás logueado y NO tenés agency → redirige a `/register-oauth`
- Si no estás logueado → comportamiento normal (lo que el proxy hace)

Si el primer caso falla con redirect inesperado, posiblemente la sesión todavía no tiene el `agencyId` populado. Logout + login para refrescar la sesión, o usar `mcp__neon__run_sql` con `SELECT * FROM "user" WHERE id = '<your-user-id>';` para confirmar que el campo está populado.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "refactor(sec-3): read agencyId from session in dashboard layout"
```

---

## Phase 3 — Helpers

### Task 3.1: Implementar `src/lib/auth/agency.ts`

**Files:**
- Create: `src/lib/auth/agency.ts`

- [ ] **Step 1: Crear el archivo con los helpers**

```ts
import { NextResponse } from "next/server";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import type { auth } from "./index";

type Session = typeof auth.$Infer.Session;

/**
 * Tipo para tablas que tienen una columna `agencyId`. Usado por
 * `requireAgencyResource` para garantizar a nivel de tipos que solo
 * podés llamarlo con tablas que estén scoped por agency.
 */
type AgencyScopedTable = PgTable & {
  id: PgColumn;
  agencyId: PgColumn;
};

/**
 * Error que llevás cuando una route no puede acceder a un recurso
 * por razones de tenancy. Se mapea a HTTP status vía `handleAgencyError`.
 */
export class AgencyAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message: string
  ) {
    super(message);
    this.name = "AgencyAccessError";
  }
}

/**
 * Toda route handler que accede a recursos de negocio empieza con esto.
 * Tira:
 *   - 401 si no hay sesión (user no logueado)
 *   - 403 si la sesión no tiene agencyId (visitor sin agency)
 *
 * Devuelve el agencyId del user — ese valor se pasa después a queries
 * y a `requireAgencyResource`.
 */
export function requireAgencyId(session: Session | null): string {
  if (!session?.user) {
    throw new AgencyAccessError(401, "No autenticado");
  }
  if (!session.user.agencyId) {
    throw new AgencyAccessError(
      403,
      "No has completado el registro de inmobiliaria"
    );
  }
  return session.user.agencyId;
}

/**
 * Carga un recurso de una tabla scoped por agency, validando que pertenece
 * a la agency dada. Si no existe O pertenece a otra agency, tira 404
 * con mensaje genérico (no leak de existencia).
 *
 * Uso típico:
 *   const session = await auth.api.getSession({ headers: await headers() });
 *   const agencyId = requireAgencyId(session);
 *   const { id } = await params;
 *   const prop = await requireAgencyResource(property, id, agencyId);
 */
export async function requireAgencyResource<T extends AgencyScopedTable>(
  table: T,
  id: string,
  agencyId: string,
  extraConditions: SQL[] = []
): Promise<Record<string, unknown>> {
  const conditions = [
    eq(table.id, id),
    eq(table.agencyId, agencyId),
    ...extraConditions,
  ];
  const [row] = await db
    .select()
    .from(table as PgTable)
    .where(and(...conditions))
    .limit(1);
  if (!row) {
    throw new AgencyAccessError(404, "Recurso no encontrado");
  }
  return row;
}

/**
 * Helper para usar dentro del catch de cada route handler.
 * Si el error es un AgencyAccessError, devuelve la NextResponse adecuada.
 * Si no, devuelve null para que la route lo re-tire o lo maneje.
 *
 * Uso:
 *   try { ... }
 *   catch (err) {
 *     const resp = handleAgencyError(err);
 *     if (resp) return resp;
 *     // ... manejar otros errores
 *   }
 */
export function handleAgencyError(err: unknown): NextResponse | null {
  if (err instanceof AgencyAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
bun run build
```

Expected: build pasa. Si TypeScript se queja del genérico `<T extends AgencyScopedTable>` con un mensaje sobre tipos incompatibles de Drizzle, ablandar la firma temporalmente a:

```ts
export async function requireAgencyResource(
  table: any,
  id: string,
  agencyId: string,
  extraConditions: SQL[] = []
): Promise<Record<string, unknown>> { ... }
```

(con un comentario explicando por qué el `any` y un TODO para tightear cuando termine SEC-3). El objetivo del genérico es prevención de uso incorrecto en compile-time, pero si no podemos hacerlo sin batalla con tipos de Drizzle, no es un blocker para la seguridad real (que la dan los helpers + las queries explícitas).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/agency.ts
git commit -m "feat(sec-3): add requireAgencyId and requireAgencyResource helpers"
```

---

### Task 3.2: Unit tests para los helpers

**Files:**
- Create: `src/lib/auth/agency.test.ts`

- [ ] **Step 1: Escribir el test file**

```ts
import { describe, expect, test } from "bun:test";
import {
  AgencyAccessError,
  handleAgencyError,
  requireAgencyId,
} from "./agency";

describe("requireAgencyId", () => {
  test("tira 401 si no hay sesión", () => {
    expect(() => requireAgencyId(null)).toThrow(
      expect.objectContaining({ status: 401 })
    );
  });

  test("tira 401 si la sesión existe pero no tiene user", () => {
    expect(() => requireAgencyId({ user: null } as any)).toThrow(
      expect.objectContaining({ status: 401 })
    );
  });

  test("tira 403 si el user no tiene agencyId", () => {
    const session = { user: { id: "u1", agencyId: null } } as any;
    expect(() => requireAgencyId(session)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  test("tira 403 si agencyId es string vacío", () => {
    const session = { user: { id: "u1", agencyId: "" } } as any;
    expect(() => requireAgencyId(session)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  test("devuelve agencyId si todo está populado", () => {
    const session = { user: { id: "u1", agencyId: "agency-123" } } as any;
    expect(requireAgencyId(session)).toBe("agency-123");
  });
});

describe("handleAgencyError", () => {
  test("devuelve NextResponse con status correcto para AgencyAccessError", async () => {
    const err = new AgencyAccessError(403, "test message");
    const resp = handleAgencyError(err);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
    const body = await resp!.json();
    expect(body).toEqual({ error: "test message" });
  });

  test("devuelve null para errores que no son AgencyAccessError", () => {
    expect(handleAgencyError(new Error("otro error"))).toBeNull();
    expect(handleAgencyError("string error")).toBeNull();
    expect(handleAgencyError(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test**

```bash
bun test src/lib/auth/agency.test.ts
```

Expected: 7 tests pass. Si Bun no encuentra el módulo `next/server` cuando carga `agency.ts`, agregar un mock simple al inicio del test file:

```ts
import { mock } from "bun:test";
mock.module("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/agency.test.ts
git commit -m "test(sec-3): unit tests for agency helpers"
```

---

## Phase 4 — Cutover de routes

> **Routes EXEMPTAS — no tocar en ninguna task de Fase 4**:
>
> - `src/app/api/auth/[...all]/route.ts` (Better Auth, gestiona la sesión)
> - `src/app/api/register/route.ts` (precede a la creación de agency)
> - `src/app/api/register-oauth/route.ts` (modificada en Fase 2 únicamente)
> - `src/app/api/cron/cleanup-files/route.ts` (sistémica, ya cerrada con CRON_SECRET en SEC-1)
> - `src/app/api/[...slugs]/route.ts` (ElysiaJS catch-all, solo health check hoy — si en el futuro suma rutas de negocio se scopea entonces)
>
> **Patrón uniforme a aplicar en cada route** (no exempta):
>
> ```ts
> // GET /api/<resource>/[id] (detalle)
> export async function GET(_req, { params }) {
>   try {
>     const session = await auth.api.getSession({ headers: await headers() });
>     const agencyId = requireAgencyId(session);
>     const { id } = await params;
>     const row = await requireAgencyResource(<table>, id, agencyId);
>     return NextResponse.json(row);
>   } catch (err) {
>     const resp = handleAgencyError(err);
>     if (resp) return resp;
>     console.error(err);
>     return NextResponse.json({ error: "Error interno" }, { status: 500 });
>   }
> }
>
> // GET /api/<resource> (listado)
> export async function GET(req) {
>   try {
>     const session = await auth.api.getSession({ headers: await headers() });
>     const agencyId = requireAgencyId(session);
>     const list = await db.select().from(<table>)
>       .where(and(eq(<table>.agencyId, agencyId), /* otros filtros */));
>     return NextResponse.json(list);
>   } catch (err) { /* ...mismo catch... */ }
> }
>
> // POST / PATCH / DELETE
> // - Antes de cualquier mutation, requireAgencyResource(<table>, id, agencyId) para verificar ownership
> // - Inserts pasan agencyId siempre
> // - Listas filtradas por eq(<table>.agencyId, agencyId)
> ```
>
> **Reglas adicionales:**
> 1. Si la route ya tenía `if (!session?.user) return 401`, reemplazarlo por `requireAgencyId(session)` dentro del try.
> 2. Si la route ya tenía `canManage*()` checks (por permisos), **mantenerlos** después del `requireAgencyId`.
> 3. Para queries que joinan otras tablas que también tienen `agencyId` (ej: `client → property → contract`), filtrar por `agencyId` en la tabla raíz (la que tiene el `[id]`). Las hijas heredan vía FK.
> 4. Si una route necesita acceder a una tabla "hija de hija" (ej: `task_history`, `contract_clause`), ir vía un padre validado primero. Nunca un select directo a la hija con solo `eq(id, X)`.
> 5. Para inserts en tablas con `agencyId NOT NULL`, TypeScript va a obligarte a pasar el campo. Si no lo hace (porque relajaste el tipo en `agency.ts`), pasalo igual.

---

### Task 4.1: Cutover — `cash/*` (4 routes)

**Files (Modify):**
- `src/app/api/cash/movimientos/route.ts`
- `src/app/api/cash/movimientos/[id]/route.ts`
- `src/app/api/cash/movimientos/[id]/comprobante/route.ts`
- `src/app/api/cash/movimientos/[id]/conciliar/route.ts`

- [ ] **Step 1: Aplicar el patrón uniforme a cada uno de los 4 archivos**

Para cada handler en cada archivo:
1. Reemplazar `if (!session?.user) return 401` por `const agencyId = requireAgencyId(session)` dentro de un `try` con `catch (err) { const resp = handleAgencyError(err); if (resp) return resp; ... }`
2. En GETs de listado: agregar `eq(cajaMovimiento.agencyId, agencyId)` al where
3. En GETs/PATCHs/DELETEs con `[id]`: usar `await requireAgencyResource(cajaMovimiento, id, agencyId)` antes de cualquier mutation
4. En POSTs: agregar `agencyId` en `.values({...})`

- [ ] **Step 2: Smoke test manual**

```bash
bun dev
```

- Abrir `/caja` (o la ruta del módulo de Caja) — debe seguir cargando movimientos
- Crear un movimiento manual — debe persistir
- Editar el movimiento — debe persistir
- Borrar el movimiento — debe borrar

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cash/
git commit -m "feat(sec-3): scope cash/* routes by agencyId"
```

---

### Task 4.2: Cutover — `clients/*` + `owners/*` + `tenants/*` + `guarantors/*` + `guarantees/*` (23 routes)

**Files (Modify):**
- `src/app/api/clients/route.ts`
- `src/app/api/clients/[id]/route.ts`
- `src/app/api/clients/[id]/resumen/route.ts`
- `src/app/api/clients/[id]/roles/route.ts`
- `src/app/api/owners/route.ts`
- `src/app/api/owners/[id]/route.ts`
- `src/app/api/owners/[id]/co-owner-properties/route.ts`
- `src/app/api/owners/[id]/cuenta-corriente/route.ts`
- `src/app/api/owners/[id]/movimientos/route.ts`
- `src/app/api/owners/[id]/movimientos/[movimientoId]/route.ts`
- `src/app/api/tenants/route.ts`
- `src/app/api/tenants/[id]/route.ts`
- `src/app/api/tenants/[id]/cuenta-corriente/route.ts`
- `src/app/api/tenants/[id]/ledger/route.ts`
- `src/app/api/tenants/[id]/ledger/[entryId]/route.ts`
- `src/app/api/tenants/[id]/ledger/[entryId]/conciliar/route.ts`
- `src/app/api/tenants/[id]/ledger/[entryId]/punitorio/route.ts`
- `src/app/api/tenants/[id]/movimientos/route.ts`
- `src/app/api/tenants/[id]/movimientos/[movimientoId]/route.ts`
- `src/app/api/guarantors/[id]/route.ts`
- `src/app/api/guarantees/route.ts`
- `src/app/api/guarantees/[id]/route.ts`
- `src/app/api/guarantees/[id]/salary-info/route.ts`

- [ ] **Step 1: Aplicar el patrón uniforme**

Tablas relevantes: `client` (todas las routes de clients/owners/tenants/guarantors), `guarantee` (guarantees/*), `tenantLedger` (ledger/*), `cajaMovimiento` (movimientos/*).

**Para owners/tenants/guarantors**: estas routes consultan `client` con un filtro por `type` (`type = "owner"`, etc.). El scoping por `agencyId` se agrega al where. Ejemplo `tenants/[id]/route.ts` GET:
```ts
const tenant = await requireAgencyResource(client, id, agencyId, [
  eq(client.type, "tenant"),
]);
```

**Para ledger entries (`tenantLedger`)**: cada entry tiene `agencyId` directo. Validar también que el `[id]` del path (que es un client/tenant) sea de la misma agency:
```ts
const tenant = await requireAgencyResource(client, tenantId, agencyId, [
  eq(client.type, "tenant"),
]);
const entry = await requireAgencyResource(tenantLedger, entryId, agencyId);
```

- [ ] **Step 2: Smoke test manual**

- Abrir `/inquilinos` — listado debe cargar
- Abrir un inquilino → ver cuenta corriente → marcar un cargo como conciliado
- Abrir `/propietarios` → listado debe cargar
- Abrir un propietario → ver cuenta corriente → emitir un comprobante (si tenés data)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clients/ src/app/api/owners/ src/app/api/tenants/ src/app/api/guarantors/ src/app/api/guarantees/
git commit -m "feat(sec-3): scope clients/owners/tenants/guarantors/guarantees routes by agencyId"
```

---

### Task 4.3: Cutover — `properties/*` (9 routes)

**Files (Modify):**
- `src/app/api/properties/route.ts`
- `src/app/api/properties/[id]/route.ts`
- `src/app/api/properties/[id]/co-owners/route.ts`
- `src/app/api/properties/[id]/co-owners/[coOwnerId]/route.ts`
- `src/app/api/properties/[id]/features/route.ts`
- `src/app/api/properties/[id]/features/[featureId]/route.ts`
- `src/app/api/properties/[id]/rooms/route.ts`
- `src/app/api/properties/[id]/rooms/[roomId]/route.ts`
- `src/app/api/properties/[id]/services/route.ts`

- [ ] **Step 1: Aplicar el patrón uniforme**

Tablas relevantes: `property`, `propertyCoOwner`, `propertyRoom`, `propertyToFeature`, `servicio`. La tabla `propertyToFeature` (join table) **no** está en las 14, pero filtrarla por `propertyId` ya valida porque el property fue validado primero.

**Patrón para sub-routes de `[id]` (co-owners, features, rooms, services)**: validar primero el property, luego la sub-resource si tiene `[xId]`:
```ts
const session = await auth.api.getSession({ headers: await headers() });
const agencyId = requireAgencyId(session);
const { id, coOwnerId } = await params;
await requireAgencyResource(property, id, agencyId);
const coOwner = await requireAgencyResource(propertyCoOwner, coOwnerId, agencyId, [
  eq(propertyCoOwner.propertyId, id),
]);
```

- [ ] **Step 2: Smoke test manual**

- `/propiedades` listado, abrir una propiedad
- Agregar un co-owner, agregar una feature, agregar una room
- Vista de servicios de la propiedad

- [ ] **Step 3: Commit**

```bash
git add src/app/api/properties/
git commit -m "feat(sec-3): scope properties/* routes by agencyId"
```

---

### Task 4.4: Cutover — `contracts/*` (18 routes)

**Files (Modify):**
- `src/app/api/contracts/route.ts`
- `src/app/api/contracts/[id]/route.ts`
- `src/app/api/contracts/[id]/amendments/route.ts`
- `src/app/api/contracts/[id]/amendments/[aid]/route.ts`
- `src/app/api/contracts/[id]/amendments/[aid]/document/route.ts`
- `src/app/api/contracts/[id]/documents/route.ts`
- `src/app/api/contracts/[id]/documents/files/[fileId]/route.ts`
- `src/app/api/contracts/[id]/documents/[documentType]/apply/route.ts`
- `src/app/api/contracts/[id]/documents/[documentType]/clauses/route.ts`
- `src/app/api/contracts/[id]/documents/[documentType]/clauses/[clauseId]/route.ts`
- `src/app/api/contracts/[id]/documents/[documentType]/clauses/reorder/route.ts`
- `src/app/api/contracts/[id]/generate-ledger/route.ts`
- `src/app/api/contracts/[id]/generate-ledger/count/route.ts`
- `src/app/api/contracts/[id]/guarantees/route.ts`
- `src/app/api/contracts/[id]/guarantees/[guaranteeId]/route.ts`
- `src/app/api/contracts/[id]/participants/route.ts`
- `src/app/api/contracts/[id]/participants/[participantId]/route.ts`
- `src/app/api/contracts/[id]/variable-writeback/route.ts`

- [ ] **Step 1: Aplicar el patrón uniforme**

Tablas relevantes: `contract`, `contractAmendment`, `contractDocument`, `contractParticipant`, `guarantee`, `tenantLedger` (vía generate-ledger).

**Patrón para todas las sub-routes**: validar primero el contract, luego la sub-resource:
```ts
await requireAgencyResource(contract, contractId, agencyId);
const amendment = await requireAgencyResource(contractAmendment, aid, agencyId, [
  eq(contractAmendment.contractId, contractId),
]);
```

**Atención especial — `contracts/[id]/amendments/[aid]/document/route.ts`**: este es el endpoint que genera HTML. SEC-3 lo scopea pero **no** arregla la vulnerabilidad XSS (eso es SEC-5). Solo agregar el `requireAgencyResource` correspondiente.

**Atención especial — `contracts/[id]/documents/[documentType]/clauses/[clauseId]/route.ts`**: el `clauseId` apunta a una clause dentro de un `contract_document`. Como `contract_clause` es hija de hija (no tiene `agencyId` propio), validar el path completo: contract → document → clause.

```ts
await requireAgencyResource(contract, contractId, agencyId);
const document = await db.select().from(contractDocument).where(and(
  eq(contractDocument.contractId, contractId),
  eq(contractDocument.documentType, documentType),
  eq(contractDocument.agencyId, agencyId),
)).limit(1);
if (!document[0]) throw new AgencyAccessError(404, "Recurso no encontrado");
const clause = await db.select().from(contractClause).where(and(
  eq(contractClause.id, clauseId),
  eq(contractClause.documentId, document[0].id),
)).limit(1);
if (!clause[0]) throw new AgencyAccessError(404, "Recurso no encontrado");
```

- [ ] **Step 2: Smoke test manual**

- `/contratos` listado
- Abrir un contrato, ver detalle
- Crear un amendment
- Editar las clauses del documento
- Generar el ledger (si el contrato no lo tiene)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/contracts/
git commit -m "feat(sec-3): scope contracts/* routes by agencyId"
```

---

### Task 4.5: Cutover — `tasks/*` (3 routes)

**Files (Modify):**
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/tasks/[id]/archivos/route.ts`

- [ ] **Step 1: Aplicar el patrón uniforme**

Tabla raíz: `tarea` (DB: `task`). Las hijas (`task_history`, `task_comment`, `task_file`) son hijas-de-hijas y no tienen `agencyId`. Para `archivos/route.ts`, validar primero el task:

```ts
await requireAgencyResource(tarea, id, agencyId);
// ahora podés operar sobre tareaArchivo filtrando solo por taskId
```

- [ ] **Step 2: Smoke test manual**

- `/tareas` listado, crear una tarea, agregar un archivo

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/
git commit -m "feat(sec-3): scope tasks/* routes by agencyId"
```

---

### Task 4.6: Cutover — `services/*` (6 routes)

**Files (Modify):**
- `src/app/api/services/route.ts`
- `src/app/api/services/[id]/route.ts`
- `src/app/api/services/[id]/comprobante/route.ts`
- `src/app/api/services/[id]/omitir-bloqueo/route.ts`
- `src/app/api/services/companies/route.ts`
- `src/app/api/services/summary/route.ts`

- [ ] **Step 1: Aplicar el patrón uniforme**

Tabla raíz: `servicio` (DB: `service`). Las hijas `service_receipt` y `service_skip` no tienen agencyId — pero las routes `[id]/comprobante` y `[id]/omitir-bloqueo` operan sobre el service primero, entonces validar ahí.

**`services/companies/route.ts`** y **`services/summary/route.ts`**: son agregaciones globales del módulo de servicios. Filtrar por `agencyId` en el where.

- [ ] **Step 2: Smoke test manual**

- `/servicios` listado, sumario de servicios, marcar un servicio como omitido

- [ ] **Step 3: Commit**

```bash
git add src/app/api/services/
git commit -m "feat(sec-3): scope services/* routes by agencyId"
```

---

### Task 4.7: Cutover — `clauses/*`, `zones/*`, `property-features/*`, `document-templates/*` (10 routes)

**Files (Modify):**
- `src/app/api/clauses/route.ts`
- `src/app/api/zones/route.ts` (ya tiene agencyId, verificar que filtra por sesión)
- `src/app/api/property-features/route.ts` (ya tiene agencyId, verificar)
- `src/app/api/document-templates/route.ts` (ya tiene agencyId, verificar)
- `src/app/api/document-templates/[id]/route.ts` (ya tiene agencyId, verificar)
- `src/app/api/document-templates/[id]/clauses/route.ts` (verificar)
- `src/app/api/document-templates/[id]/clauses/[clauseId]/route.ts` (verificar)
- `src/app/api/document-templates/[id]/clauses/reorder/route.ts` (verificar)
- `src/app/api/document-templates/resolve/route.ts` (verificar)

- [ ] **Step 1: Para `clauses/route.ts` — aplicar el patrón uniforme**

`clauseTemplate` ahora tiene `agencyId` (Fase 1). Adaptar el handler con el patrón.

- [ ] **Step 2: Para las 8 routes que YA tenían `agencyId` (zones, property-features, document-templates)**

Auditarlas: ¿cómo obtienen el `agencyId` hoy? Si lo obtienen vía `db.select().from(agency).where(eq(agency.ownerId, session.user.id))` (lookup por request), reemplazar por `requireAgencyId(session)`. El comportamiento es equivalente pero usa la sesión en vez de una query.

Si una route ya falla 404 al cruzar agencias correctamente, igual aplicar el patrón uniforme — uniformidad facilita auditorías futuras.

- [ ] **Step 3: Smoke test manual**

- `/generador-documentos` listado, abrir un template, editar clauses
- Crear una zone nueva en el form de propiedad
- Crear una feature nueva en el form de propiedad

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clauses/ src/app/api/zones/ src/app/api/property-features/ src/app/api/document-templates/
git commit -m "feat(sec-3): scope clauses/zones/property-features/document-templates by agencyId"
```

---

### Task 4.8: Cutover — `dashboard/*`, `arrears/*`, `comprobantes/*`, `receipts/*`, `agency`, `adjustment-indexes`, `field-notes/*` (12 routes)

**Files (Modify):**
- `src/app/api/adjustment-indexes/route.ts`
- `src/app/api/agency/route.ts`
- `src/app/api/arrears/active/route.ts`
- `src/app/api/comprobantes/[id]/route.ts`
- `src/app/api/comprobantes/[id]/send/route.ts`
- `src/app/api/dashboard/portfolio/route.ts`
- `src/app/api/dashboard/summary/route.ts`
- `src/app/api/receipts/[id]/route.ts`
- `src/app/api/receipts/[id]/annul/route.ts`
- `src/app/api/receipts/[id]/send/route.ts`
- `src/app/api/receipts/[id]/void/route.ts`
- `src/app/api/receipts/emit/route.ts`
- `src/app/api/field-notes/route.ts` (ya tiene agencyId, verificar)
- `src/app/api/field-notes/[id]/route.ts` (ya tiene agencyId, verificar)

- [ ] **Step 1: Aplicar el patrón uniforme**

**`agency/route.ts`** es especial: GET y PATCH operan sobre la propia agency del user. Cambiar de `eq(agency.ownerId, session.user.id)` a `eq(agency.id, agencyId)` — equivalente en lógica, pero usa el campo de sesión.

**`adjustment-indexes/route.ts`**: la tabla `customAdjustmentIndex` tiene `createdBy` pero no `agencyId`. Decisión: **no** la incluimos en SEC-3 (no es parte de las 14). Si la auditoría detecta que es leak-able, agregarla en una fase posterior. Por ahora, este file solo necesita `requireAgencyId(session)` para validar que el user tiene agency, pero no cambia las queries.

**`arrears/active/route.ts`** y **dashboard/***: son agregaciones que joinan varias tablas. Filtrar por `eq(<root_table>.agencyId, agencyId)` en cada subquery o JOIN.

**`comprobantes/[id]/route.ts`**, **receipts/*** : el id es un `cash_movement` o entry de ledger. Usar `requireAgencyResource` con la tabla raíz correcta (`cajaMovimiento` para receipts emitidos, `tenantLedger` para ledger entries).

**`field-notes/*`** ya tiene agencyId — verificar que el filtro lee de sesión, no de query.

- [ ] **Step 2: Smoke test manual**

- `/tablero` (dashboard) — gráficos cargan
- `/inquilinos` con filtro "en mora" — lista de morosos
- Abrir un recibo emitido, anularlo, reenviarlo
- Editar la agency en `/configuracion` o donde esté el form

- [ ] **Step 3: Build final**

```bash
bun run build && bun run lint
```

Expected: ambos pasan. Si build falla porque algún `db.insert(...).values({...})` no incluye `agencyId` y la columna es `NOT NULL`, agregar el campo. **Este es el momento donde TS empieza a obligarte** a poner el campo gracias a la fase 1.3.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/adjustment-indexes/ src/app/api/agency/ src/app/api/arrears/ src/app/api/comprobantes/ src/app/api/dashboard/ src/app/api/receipts/ src/app/api/field-notes/
git commit -m "feat(sec-3): scope dashboard/arrears/comprobantes/receipts/agency/field-notes by agencyId"
```

---

## Phase 5 — Validación cross-agencia

### Task 5.1: Script de validación cross-agency (setup manual + assertions automatizadas)

**Files:**
- Create: `scripts/test-cross-agency.ts`

> **Estrategia simplificada**: dividimos la validación en dos partes — el **setup** (crear agencyA y agencyB con datos) lo hacés a mano una vez vía SQL + UI, y el **script** solo hace las llamadas HTTP y valida outputs. Esto elimina la complejidad de programar el flow de signup completo en el script. Si más adelante el proyecto suma test infra real (vitest + fixtures), se reescribe.

- [ ] **Step 1: Crear ephemeral branch en Neon para la validación**

Vía `mcp__neon__create_branch`. Anotar la connection string. Esa branch va a contener tu data real más la agencyB que vas a crear.

- [ ] **Step 2: Setup manual de los dos tenants en la branch**

a) Apuntar `DATABASE_URL` (en `.env.local` o vía export en la shell que va a correr `bun dev`) a la connection string de la branch.

b) Levantar `bun dev` apuntado a la branch.

c) `agencyA = la tuya existente`. Anotar:
   - `agencyA.agencyId` → `mcp__neon__run_sql`: `SELECT id FROM agency LIMIT 1;`
   - `agencyA.userId` → `SELECT id FROM "user" LIMIT 1;`
   - `agencyA.propertyId` → cualquier `SELECT id FROM property LIMIT 1;`
   - `agencyA.clientId` → cualquier `SELECT id FROM client LIMIT 1;`
   - `agencyA.contractId` → cualquier `SELECT id FROM contract LIMIT 1;`
   - `agencyA.sessionCookie` → loguearte con tu user real, copiar el header `Cookie` del DevTools / Network tab

d) Crear `agencyB`:
   - Logout en el browser
   - Registrar un nuevo email (`test-b@example.com`), verificar manualmente el email seteando `UPDATE "user" SET "emailVerified" = true WHERE email = 'test-b@example.com';`
   - Login y completar el flow `/register-oauth` con un `agencyName` distinto ("Test Agency B")
   - Crear via la UI: 1 client (owner), 1 property, 1 contract
   - Anotar todos los IDs y el `sessionCookie` igual que para agencyA

- [ ] **Step 3: Escribir el script con los IDs anotados**

```ts
// scripts/test-cross-agency.ts
//
// Cross-agency security validation.
// PRE: setup manual descrito en docs/superpowers/plans/2026-05-06-sec-3-multi-tenancy.md Task 5.1 Step 2
// RUN: APP_BASE=http://localhost:3000 bun run scripts/test-cross-agency.ts

const APP_BASE = process.env.APP_BASE ?? "http://localhost:3000";

// ⚠️ Reemplazar con los IDs y cookies del setup manual
const agencyA = {
  cookie: "better-auth.session_token=...",
  agencyId: "...",
  userId: "...",
  clientId: "...",
  propertyId: "...",
  contractId: "...",
};
const agencyB = {
  cookie: "better-auth.session_token=...",
  agencyId: "...",
  userId: "...",
  clientId: "...",
  propertyId: "...",
  contractId: "...",
};

interface RouteCheck {
  path: string;
  method: "GET" | "PATCH" | "DELETE" | "POST";
  bResource: keyof typeof agencyB;
}

const CROSS_ROUTES: RouteCheck[] = [
  { path: "/api/properties/:id", method: "GET", bResource: "propertyId" },
  { path: "/api/properties/:id", method: "PATCH", bResource: "propertyId" },
  { path: "/api/properties/:id", method: "DELETE", bResource: "propertyId" },
  { path: "/api/clients/:id", method: "GET", bResource: "clientId" },
  { path: "/api/clients/:id", method: "PATCH", bResource: "clientId" },
  { path: "/api/clients/:id", method: "DELETE", bResource: "clientId" },
  { path: "/api/contracts/:id", method: "GET", bResource: "contractId" },
  { path: "/api/contracts/:id", method: "PATCH", bResource: "contractId" },
  { path: "/api/contracts/:id/amendments", method: "GET", bResource: "contractId" },
  { path: "/api/contracts/:id/documents", method: "GET", bResource: "contractId" },
  { path: "/api/contracts/:id/participants", method: "GET", bResource: "contractId" },
  { path: "/api/owners/:id", method: "GET", bResource: "clientId" },
  { path: "/api/tenants/:id", method: "GET", bResource: "clientId" },
  { path: "/api/properties/:id/co-owners", method: "GET", bResource: "propertyId" },
  { path: "/api/properties/:id/features", method: "GET", bResource: "propertyId" },
  { path: "/api/properties/:id/rooms", method: "GET", bResource: "propertyId" },
];

interface ListCheck {
  path: string;
  expectAbsent: keyof typeof agencyB;
}

const LIST_ROUTES: ListCheck[] = [
  { path: "/api/properties", expectAbsent: "propertyId" },
  { path: "/api/clients", expectAbsent: "clientId" },
  { path: "/api/contracts", expectAbsent: "contractId" },
  { path: "/api/owners", expectAbsent: "clientId" },
  { path: "/api/tenants", expectAbsent: "clientId" },
];

async function main() {
  let failures = 0;

  // 1) Cross-tenant detail access — agencyA targeting agencyB resources → 404
  for (const route of CROSS_ROUTES) {
    const url = APP_BASE + route.path.replace(":id", agencyB[route.bResource]);
    const res = await fetch(url, {
      method: route.method,
      headers: {
        Cookie: agencyA.cookie,
        "Content-Type": "application/json",
      },
      body: route.method !== "GET" ? "{}" : undefined,
    });
    const ok = res.status === 404;
    console.log(`${ok ? "OK  " : "FAIL"} ${route.method.padEnd(6)} ${route.path.padEnd(50)} → ${res.status} (expected 404)`);
    if (!ok) failures++;
  }

  // 2) Listings — agencyA's listing should NOT contain agencyB's IDs
  for (const list of LIST_ROUTES) {
    const res = await fetch(APP_BASE + list.path, {
      headers: { Cookie: agencyA.cookie },
    });
    const body = await res.text();
    const leakedId = agencyB[list.expectAbsent];
    const leaked = body.includes(leakedId);
    console.log(`${leaked ? "FAIL" : "OK  "} GET    ${list.path.padEnd(50)} → no leak of ${list.expectAbsent}`);
    if (leaked) failures++;
  }

  console.log(`\n${failures === 0 ? "✅ All assertions passed" : `❌ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Correr el script**

```bash
APP_BASE=http://localhost:3000 bun run scripts/test-cross-agency.ts
```

Expected: `✅ All assertions passed`.

Si alguna route falla con status ≠ 404, anotar cuál, identificar la route en `src/app/api/`, fixear el scoping faltante, commit con `fix(sec-3): scope <route> by agencyId`. Re-correr el script hasta que todo pase.

- [ ] **Step 5: Cleanup — borrar la ephemeral branch**

Vía `mcp__neon__delete_branch`. Restaurar `DATABASE_URL` en `.env.local` apuntando a la DB principal.

- [ ] **Step 6: Commit el script (sin las cookies/IDs reales)**

Antes de commitear, **borrar los valores de `agencyA.cookie`, `agencyA.userId`, etc.** y dejarlos como `"..."` placeholder en el commit. El script versionado es el template; los valores reales son del setup local de quien lo corre.

```bash
git add scripts/test-cross-agency.ts
git commit -m "test(sec-3): manual cross-agency validation script"
```

---

## Phase 6 — Cierre

### Task 6.1: Validación final + actualizar PENDIENTES + LOG

**Files (Modify):**
- `PENDIENTES.md`
- `LOG.md`

- [ ] **Step 1: Smoke test final del usuario real**

```bash
bun dev
```

Como el user real:
- Login con tu cuenta normal
- Recorrer cada módulo: Tablero / Propietarios / Inquilinos / Propiedades / Contratos / Caja / Tareas / Servicios / Generador
- Verificar que listas cargan, detalles se ven, mutations funcionan
- Si algo se rompe → buscar la route problema, fixear, commit

- [ ] **Step 2: Build + lint final**

```bash
bun run build && bun run lint
```

Expected: ambos pasan.

- [ ] **Step 3: Marcar SEC-3 como completado en `PENDIENTES.md`**

Cambiar la línea de SEC-3 de `- [ ]` a `- [x]` y agregar un breve resumen del fix:

```markdown
- [x] **SEC-3 · Multi-tenancy real: agregar `agencyId` y scopear todas las queries (HIGH)** — 14 tablas migradas con `agencyId NOT NULL` + FK. `agencyId` propagado vía Better Auth `additionalFields`. Helpers `requireAgencyId` + `requireAgencyResource` aplicados a las 86 routes de negocio. Validación cross-agency pasa (script `scripts/test-cross-agency.ts`). · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)
```

- [ ] **Step 4: Agregar entrada en `LOG.md`**

Agregar al tope (debajo del `# LOG` o de la entrada más nueva):

```markdown
## 2026-MM-DD — SEC-3 (multi-tenancy real con agencyId)

### Qué hice

[descripción de lo que se hizo, en términos simples]

### Por qué lo hice así y no de otra forma

[razones; las que están en el spec son la base]

### Conceptos que aparecieron

- **defense-in-depth**: ...
- **session vs lookup-per-request**: ...
- **Postgres RLS y por qué no usarlo acá**: ...
- ...

### Preguntas para reflexionar

1.
2.

### Qué debería anotar en Obsidian

- [ ] item
```

- [ ] **Step 5: Actualizar `docs/decisions/usuarios-y-acceso.md`**

Agregar una entrada nueva con tag `confirmada`:

```markdown
## SEC-3 · Multi-tenancy con `agencyId` — 2026-MM-DD — confirmada

**La decisión:** las 14 tablas de negocio reciben columna `agencyId NOT NULL` con FK a `agency.id ON DELETE CASCADE`. El `agencyId` se propaga vía Better Auth `additionalFields` (sin queries extra). Toda route handler usa los helpers `requireAgencyId` y `requireAgencyResource` para validar pertenencia. Errores 404 indistinguibles entre "no existe" y "es de otra agency".

**Por qué:** la auditoría pre-deploy reveló que cualquier user logueado podía leer/editar/borrar datos de cualquier inmobiliaria. Defense-in-depth con 4 capas (sesión + DB constraint + helpers + validación) cierra el agujero sin requerir Postgres RLS (incompatible con Neon serverless connection pooling).

**Tablas excluidas y por qué:** las hijas de hijas (`task_history`, `task_comment`, `task_file`, `receipt_*`, `contract_clause`, `contract_document_config`, `guarantee_salary_info`) NO reciben `agencyId`. Su padre directo ya tiene la columna; agregarla acá sería 1 nivel de redundancia que no compra seguridad.

**Cuándo revisarla:** cuando V2 abra signup público de nuevas inmobiliarias o cuando se sume invitación de colaboradores con rol distinto al owner. En ese momento revisar (a) Postgres RLS como capa 5 si el código se vuelve más complejo, (b) cross-tabla consistency (CHECK constraint para que `contract.propertyId` apunte a una `property` de la misma agency).
```

- [ ] **Step 6: Commit final**

```bash
git add PENDIENTES.md LOG.md docs/decisions/usuarios-y-acceso.md
git commit -m "docs(sec-3): mark SEC-3 done, update LOG and decisions"
```

---

## Resumen de fases — checklist visual

- [ ] **Fase 1** (3 tasks): SQL de migración + aplicar + actualizar 14 schema files
- [ ] **Fase 2** (4 tasks): user.agencyId column + Better Auth config + register-oauth update + layout simplification
- [ ] **Fase 3** (2 tasks): helpers + tests
- [ ] **Fase 4** (8 tasks): cutover de 86 routes agrupadas por dominio
- [ ] **Fase 5** (1 task, 6 steps): script de validación cross-agency
- [ ] **Fase 6** (1 task): smoke test final + actualizar PENDIENTES/LOG/decisions

**Total: 19 tasks. Tiempo estimado realista: 1-2 días de trabajo concentrado.**

---

## Riesgos durante la ejecución

1. **Drizzle types y `requireAgencyResource` genérico**: si el genérico `<T extends AgencyScopedTable>` choca con tipos de Drizzle, ablandar la firma a `any` con TODO. La seguridad real la dan los helpers + queries explícitas, no el sistema de tipos.

2. **Better Auth no expone `agencyId` en el tipo `Session`**: si después de Fase 2 el campo no es accesible vía `session.user.agencyId`, regenerar tipos forzando rebuild (`bun run build`) o agregar manualmente el campo a `Session`.

3. **Inserts que no pasan `agencyId` después de Fase 1**: `bun run build` debería reportarlos. Si no lo hace (porque relajamos el tipo), revisar con `grep -r "db.insert(<table>)" src/` para asegurarse de que todos los call sites pasan el campo.

4. **El user real pierde acceso después del cutover**: si el smoke test final falla con redirect a `/register-oauth` o 403, verificar:
   - `SELECT id, "agencyId" FROM "user" WHERE id = '<your-user-id>';` — debe estar populado
   - Si está null, ejecutar el backfill de Task 2.1 step 2 manualmente
   - Logout + login para refrescar la sesión

5. **Ephemeral branch del test cross-agency tiene datos del user real**: si la branch hereda de prod y vos tenés data sensible ahí, el script lo verá. No es problema porque el branch se borra, pero asegurate de no commitear logs del script al repo.
