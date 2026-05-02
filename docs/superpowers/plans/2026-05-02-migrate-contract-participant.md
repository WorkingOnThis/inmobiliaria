# Migrar contract_tenant → contract_participant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la tabla `contract_tenant` (roles "primary"/"co-tenant") migrando todos sus usos a `contract_participant` (role "tenant"), y borrar la tabla vieja de la DB.

**Architecture:** La nueva tabla `contractParticipant` ya existe en el schema y en la DB. El cambio es: (1) mover los datos existentes con una SQL, (2) actualizar 12 archivos de código que todavía importan la tabla vieja, (3) borrar el archivo de schema y su export, (4) hacer DROP TABLE.

**Tech Stack:** Next.js Route Handlers · Drizzle ORM · PostgreSQL (Neon) · TypeScript

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `src/app/api/tenants/route.ts` | `contractTenant` → `contractParticipant` (role "tenant") |
| `src/app/api/tenants/[id]/route.ts` | dual lookup → solo `contractParticipant` (role "tenant") |
| `src/app/api/tenants/[id]/ledger/route.ts` | join con `contractTenant` → `contractParticipant` |
| `src/app/api/tenants/[id]/movimientos/route.ts` | dual lookup → solo `contractParticipant` |
| `src/app/api/tenants/[id]/charges/route.ts` | dual lookup → solo `contractParticipant` |
| `src/lib/receipts/load.ts` | fallback join → `contractParticipant` |
| `src/app/api/clients/[id]/resumen/route.ts` | 2 queries → `contractParticipant` |
| `src/app/api/services/route.ts` | join con role "primary" → role "tenant" |
| `src/app/api/clients/[id]/roles/route.ts` | count de contratos → `contractParticipant` |
| `src/app/api/properties/[id]/route.ts` | join en guarantees → `contractParticipant` |
| `src/app/api/contracts/[id]/amendments/[aid]/document/route.ts` | tenant lookup → `contractParticipant` |
| `src/app/api/contracts/[id]/guarantees/route.ts` | tenant lookup → `contractParticipant` |
| `src/db/schema/index.ts` | eliminar export de `contract-tenant` |
| `src/db/schema/contract-tenant.ts` | borrar archivo |

---

## Task 1: Migrar datos de contract_tenant a contract_participant en la DB

**Archivos:** ninguno — solo SQL en Neon MCP

- [ ] **Step 1: Verificar datos actuales en ambas tablas**

Usando Neon MCP (`mcp__neon__run_sql`), ejecutar en el proyecto/branch correcto:

```sql
SELECT COUNT(*) AS total_tenant FROM contract_tenant;
SELECT COUNT(*) AS total_participant FROM contract_participant WHERE role = 'tenant';
```

Anotar los números. Si `total_participant` ya es >= `total_tenant`, probablemente ya se migró antes.

- [ ] **Step 2: Copiar filas faltantes**

```sql
INSERT INTO contract_participant (id, "contractId", "clientId", role, "createdAt")
SELECT
  gen_random_uuid(),
  ct."contractId",
  ct."clientId",
  'tenant',
  NOW()
FROM contract_tenant ct
WHERE NOT EXISTS (
  SELECT 1
  FROM contract_participant cp
  WHERE cp."contractId" = ct."contractId"
    AND cp."clientId" = ct."clientId"
    AND cp.role = 'tenant'
);
```

Resultado esperado: `INSERT 0 N` donde N es la cantidad de filas copiadas (puede ser 0 si ya estaban).

- [ ] **Step 3: Verificar que no quedó nada sin migrar**

```sql
SELECT ct."contractId", ct."clientId"
FROM contract_tenant ct
WHERE NOT EXISTS (
  SELECT 1
  FROM contract_participant cp
  WHERE cp."contractId" = ct."contractId"
    AND cp."clientId" = ct."clientId"
    AND cp.role = 'tenant'
);
```

Resultado esperado: 0 filas.

- [ ] **Step 4: Commit (solo documentación del paso)**

No hay archivos de código que cambiar en este task. El commit vendrá en el task siguiente.

---

## Task 2: Migrar src/app/api/tenants/route.ts

**Archivos:**
- Modify: `src/app/api/tenants/route.ts`

- [ ] **Step 1: Reemplazar import**

Cambiar:
```ts
import { contractTenant } from "@/db/schema/contract-tenant";
```
Por:
```ts
import { contractParticipant } from "@/db/schema/contract-participant";
import { eq as _eq } from "drizzle-orm"; // ya existe, solo verificar que `eq` esté importado
```
(El `eq` ya está importado en el archivo, no agregar duplicado.)

- [ ] **Step 2: Actualizar query de "clientes que son inquilinos"**

Cambiar (líneas 48-50):
```ts
    const tenantLinks = await db
      .selectDistinct({ clientId: contractTenant.clientId })
      .from(contractTenant);
```
Por:
```ts
    const tenantLinks = await db
      .selectDistinct({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(eq(contractParticipant.role, "tenant"));
```

- [ ] **Step 3: Actualizar join de contratos por inquilino**

Cambiar (líneas 96-111):
```ts
    const contracts = await db
      .select({
        clientId: contractTenant.clientId,
        ...
      })
      .from(contractTenant)
      .innerJoin(contract, eq(contract.id, contractTenant.contractId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(inArray(contractTenant.clientId, ids));
```
Por:
```ts
    const contracts = await db
      .select({
        clientId: contractParticipant.clientId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractStatus: contract.status,
        startDate: contract.startDate,
        endDate: contract.endDate,
        paymentDay: contract.paymentDay,
        propertyAddress: property.address,
        propertyFloorUnit: property.floorUnit,
      })
      .from(contractParticipant)
      .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(and(inArray(contractParticipant.clientId, ids), eq(contractParticipant.role, "tenant")));
```

- [ ] **Step 4: Verificar build**

```bash
bun run build
```
Esperado: sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tenants/route.ts
git commit -m "refactor: migrate tenants list route from contractTenant to contractParticipant"
```

---

## Task 3: Migrar src/app/api/tenants/[id]/route.ts

**Archivos:**
- Modify: `src/app/api/tenants/[id]/route.ts`

- [ ] **Step 1: Eliminar import de contractTenant**

Eliminar la línea:
```ts
import { contractTenant } from "@/db/schema/contract-tenant";
```
El archivo ya importa `contractParticipant`.

- [ ] **Step 2: Reemplazar el dual lookup por uno solo**

Encontrar el bloque (líneas 146-163):
```ts
    const [fromTenant, fromParticipant] = await Promise.all([
      db.select(contractFields)
        .from(contractTenant)
        .innerJoin(contract, eq(contract.id, contractTenant.contractId))
        .where(eq(contractTenant.clientId, id)),
      db.select(contractFields)
        .from(contractParticipant)
        .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
        .where(eq(contractParticipant.clientId, id)),
    ]);

    // Merge and deduplicate by contract ID
    const seen = new Set<string>();
    const tenantContractsRaw = [...fromTenant, ...fromParticipant].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
```

Reemplazar por:
```ts
    const tenantContractsRaw = await db
      .select(contractFields)
      .from(contractParticipant)
      .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
      .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")));
```

- [ ] **Step 3: Verificar build**

```bash
bun run build
```
Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tenants/[id]/route.ts
git commit -m "refactor: simplify tenant detail route to use only contractParticipant"
```

---

## Task 4: Migrar tenants/[id]/ledger, movimientos y charges

**Archivos:**
- Modify: `src/app/api/tenants/[id]/ledger/route.ts`
- Modify: `src/app/api/tenants/[id]/movimientos/route.ts`
- Modify: `src/app/api/tenants/[id]/charges/route.ts`

### ledger/route.ts

- [ ] **Step 1: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 2: Actualizar verificación de contrato**

Cambiar (líneas 52-60):
```ts
    const [contractRow] = await db
      .select({ id: contract.id })
      .from(contract)
      .innerJoin(contractTenant, eq(contractTenant.contractId, contract.id))
      .where(
        and(
          eq(contract.id, data.contratoId),
          eq(contractTenant.clientId, inquilinoId)
        )
      )
      .limit(1);
```
Por:
```ts
    const [contractRow] = await db
      .select({ id: contract.id })
      .from(contract)
      .innerJoin(contractParticipant, eq(contractParticipant.contractId, contract.id))
      .where(
        and(
          eq(contract.id, data.contratoId),
          eq(contractParticipant.clientId, inquilinoId),
          eq(contractParticipant.role, "tenant")
        )
      )
      .limit(1);
```

### movimientos/route.ts

- [ ] **Step 3: Eliminar import de contractTenant**

Eliminar:
```ts
import { contractTenant } from "@/db/schema/contract-tenant";
```

- [ ] **Step 4: Reemplazar dual lookup en validación de contratoId**

Cambiar (líneas 70-83):
```ts
      const [fromTenant, fromParticipant] = await Promise.all([
        db.select({ contractId: contractTenant.contractId })
          .from(contractTenant)
          .where(eq(contractTenant.clientId, id))
          .then((rows) => rows.map((r) => r.contractId)),
        db.select({ contractId: contractParticipant.contractId })
          .from(contractParticipant)
          .where(eq(contractParticipant.clientId, id))
          .then((rows) => rows.map((r) => r.contractId)),
      ]);
      const allowed = new Set([...fromTenant, ...fromParticipant]);
```
Por:
```ts
      const contractIds = await db
        .select({ contractId: contractParticipant.contractId })
        .from(contractParticipant)
        .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")))
        .then((rows) => rows.map((r) => r.contractId));
      const allowed = new Set(contractIds);
```

### charges/route.ts

- [ ] **Step 5: Eliminar import de contractTenant**

Eliminar:
```ts
import { contractTenant } from "@/db/schema/contract-tenant";
```

- [ ] **Step 6: Reemplazar dual lookup en validación de contratoId**

Cambiar (líneas 118-128):
```ts
    const [fromTenant, fromParticipant] = await Promise.all([
      db.select({ contractId: contractTenant.contractId })
        .from(contractTenant)
        .where(eq(contractTenant.clientId, id))
        .then((rows) => rows.map((r) => r.contractId)),
      db.select({ contractId: contractParticipant.contractId })
        .from(contractParticipant)
        .where(eq(contractParticipant.clientId, id))
        .then((rows) => rows.map((r) => r.contractId)),
    ]);
    const allowed = new Set([...fromTenant, ...fromParticipant]);
```
Por:
```ts
    const contractIds = await db
      .select({ contractId: contractParticipant.contractId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")))
      .then((rows) => rows.map((r) => r.contractId));
    const allowed = new Set(contractIds);
```

- [ ] **Step 7: Verificar build**

```bash
bun run build
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/tenants/[id]/ledger/route.ts src/app/api/tenants/[id]/movimientos/route.ts src/app/api/tenants/[id]/charges/route.ts
git commit -m "refactor: migrate tenant sub-routes to contractParticipant"
```

---

## Task 5: Migrar lib/receipts/load.ts y clients/[id]/resumen/route.ts

**Archivos:**
- Modify: `src/lib/receipts/load.ts`
- Modify: `src/app/api/clients/[id]/resumen/route.ts`

### receipts/load.ts

- [ ] **Step 1: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 2: Actualizar fallback de contrato**

Cambiar (líneas 101-106):
```ts
        : movimiento.inquilinoId
          ? db.select({ contractNumber: contract.contractNumber, paymentModality: contract.paymentModality })
              .from(contractTenant)
              .innerJoin(contract, eq(contract.id, contractTenant.contractId))
              .where(and(eq(contractTenant.clientId, movimiento.inquilinoId), eq(contract.status, "active")))
              .limit(1)
```
Por:
```ts
        : movimiento.inquilinoId
          ? db.select({ contractNumber: contract.contractNumber, paymentModality: contract.paymentModality })
              .from(contractParticipant)
              .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
              .where(and(
                eq(contractParticipant.clientId, movimiento.inquilinoId),
                eq(contractParticipant.role, "tenant"),
                eq(contract.status, "active")
              ))
              .limit(1)
```

### clients/[id]/resumen/route.ts

- [ ] **Step 3: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 4: Actualizar query "asTenant" (tenant contracts)**

Cambiar (líneas 60-65):
```ts
    const tenantContractLinks = await db
      .select({ contractId: contractTenant.contractId })
      .from(contractTenant)
      .where(eq(contractTenant.clientId, id));
```
Por:
```ts
    const tenantContractLinks = await db
      .select({ contractId: contractParticipant.contractId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")));
```

- [ ] **Step 5: Actualizar query "asOwner" (nombre del inquilino)**

Cambiar (líneas 191-199):
```ts
        db
          .select({
            contractId: contractTenant.contractId,
            firstName: client.firstName,
            lastName: client.lastName,
          })
          .from(contractTenant)
          .leftJoin(client, eq(contractTenant.clientId, client.id))
          .where(inArray(contractTenant.contractId, ownerContractIds)),
```
Por:
```ts
        db
          .select({
            contractId: contractParticipant.contractId,
            firstName: client.firstName,
            lastName: client.lastName,
          })
          .from(contractParticipant)
          .leftJoin(client, eq(contractParticipant.clientId, client.id))
          .where(and(
            inArray(contractParticipant.contractId, ownerContractIds),
            eq(contractParticipant.role, "tenant")
          )),
```

- [ ] **Step 6: Verificar build**

```bash
bun run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/receipts/load.ts src/app/api/clients/[id]/resumen/route.ts
git commit -m "refactor: migrate receipts and client resumen to contractParticipant"
```

---

## Task 6: Migrar services, roles, properties y contracts

**Archivos:**
- Modify: `src/app/api/services/route.ts`
- Modify: `src/app/api/clients/[id]/roles/route.ts`
- Modify: `src/app/api/properties/[id]/route.ts`
- Modify: `src/app/api/contracts/[id]/amendments/[aid]/document/route.ts`
- Modify: `src/app/api/contracts/[id]/guarantees/route.ts`

### services/route.ts

- [ ] **Step 1: Actualizar import del barrel export**

La línea 6 es:
```ts
import { servicio, servicioComprobante, servicioOmision, property, contract, contractTenant, client } from "@/db/schema";
```
Cambiar a:
```ts
import { servicio, servicioComprobante, servicioOmision, property, contract, contractParticipant, client } from "@/db/schema";
```

- [ ] **Step 2: Actualizar join con role "primary" → "tenant"**

Encontrar (alrededor de líneas 96-100):
```ts
        contractTenant,
        and(eq(contractTenant.contractId, contract.id), eq(contractTenant.role, "primary"))
      )
      .innerJoin(client, eq(client.id, contractTenant.clientId))
```
Reemplazar por:
```ts
        contractParticipant,
        and(eq(contractParticipant.contractId, contract.id), eq(contractParticipant.role, "tenant"))
      )
      .innerJoin(client, eq(client.id, contractParticipant.clientId))
```

### clients/[id]/roles/route.ts

- [ ] **Step 3: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 4: Actualizar count de contratos del inquilino**

Cambiar (líneas 36-39):
```ts
    const [tenantCount] = await db
      .select({ count: countDistinct(contractTenant.contractId) })
      .from(contractTenant)
      .where(eq(contractTenant.clientId, id));
```
Por:
```ts
    const [tenantCount] = await db
      .select({ count: countDistinct(contractParticipant.contractId) })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")));
```

### properties/[id]/route.ts

- [ ] **Step 5: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 6: Actualizar join en query de guarantees**

Cambiar (líneas 138-139):
```ts
        .innerJoin(contractTenant, eq(contractTenant.contractId, guarantee.contractId))
        .innerJoin(client, eq(client.id, contractTenant.clientId))
```
Por:
```ts
        .innerJoin(contractParticipant, and(eq(contractParticipant.contractId, guarantee.contractId), eq(contractParticipant.role, "tenant")))
        .innerJoin(client, eq(client.id, contractParticipant.clientId))
```

Nota: el import de `and` ya debería existir en el archivo — verificar.

### contracts/[id]/amendments/[aid]/document/route.ts

- [ ] **Step 7: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 8: Actualizar lookup del inquilino**

Cambiar (líneas 118-122):
```ts
    const [tenantLink] = await db
      .select({ clientId: contractTenant.clientId })
      .from(contractTenant)
      .where(eq(contractTenant.contractId, contractId))
      .limit(1);
```
Por:
```ts
    const [tenantLink] = await db
      .select({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.contractId, contractId), eq(contractParticipant.role, "tenant")))
      .limit(1);
```

Verificar que `and` esté importado en ese archivo.

### contracts/[id]/guarantees/route.ts

- [ ] **Step 9: Cambiar import**

```ts
// Eliminar:
import { contractTenant } from "@/db/schema/contract-tenant";
// Agregar:
import { contractParticipant } from "@/db/schema/contract-participant";
```

- [ ] **Step 10: Actualizar lookup del primer inquilino**

Cambiar (líneas 60-64):
```ts
    const [firstTenant] = await db
      .select({ clientId: contractTenant.clientId })
      .from(contractTenant)
      .where(eq(contractTenant.contractId, id))
      .limit(1);
```
Por:
```ts
    const [firstTenant] = await db
      .select({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.contractId, id), eq(contractParticipant.role, "tenant")))
      .limit(1);
```

Verificar que `and` esté importado en ese archivo.

- [ ] **Step 11: Verificar build**

```bash
bun run build
```
Esperado: 0 errores.

- [ ] **Step 12: Commit**

```bash
git add src/app/api/services/route.ts src/app/api/clients/[id]/roles/route.ts src/app/api/properties/[id]/route.ts src/app/api/contracts/[id]/amendments/[aid]/document/route.ts src/app/api/contracts/[id]/guarantees/route.ts
git commit -m "refactor: migrate remaining routes from contractTenant to contractParticipant"
```

---

## Task 7: Eliminar archivo de schema y export

**Archivos:**
- Modify: `src/db/schema/index.ts`
- Delete: `src/db/schema/contract-tenant.ts`

- [ ] **Step 1: Quitar export de index.ts**

En `src/db/schema/index.ts`, eliminar la línea:
```ts
export * from "./contract-tenant";
```

- [ ] **Step 2: Verificar build (sin el export)**

```bash
bun run build
```
Si hay error de "contractTenant is not defined" en algún archivo, significa que quedó algún import sin migrar — revisar y corregir.

- [ ] **Step 3: Borrar el archivo de schema**

```bash
Remove-Item src/db/schema/contract-tenant.ts
```

- [ ] **Step 4: Verificar build final**

```bash
bun run build
```
Esperado: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/index.ts
git rm src/db/schema/contract-tenant.ts
git commit -m "chore: remove contract-tenant schema file and its barrel export"
```

---

## Task 8: Drop tabla en la DB

**Archivos:** ninguno — solo SQL en Neon MCP

- [ ] **Step 1: Verificar una última vez que el código no usa la tabla**

```bash
bun run build
```
Debe pasar sin errores antes de proceder.

- [ ] **Step 2: Drop table**

Usando Neon MCP (`mcp__neon__run_sql`):

```sql
DROP TABLE IF EXISTS contract_tenant;
```

Resultado esperado: `DROP TABLE`

- [ ] **Step 3: Confirmar que la tabla no existe**

```sql
SELECT to_regclass('public.contract_tenant');
```

Resultado esperado: `null`

- [ ] **Step 4: Smoke test manual**

Levantar el servidor con `bun dev` y verificar que:
- La lista de inquilinos carga sin error
- La ficha de un inquilino con contrato carga sin error
- Los servicios cargan sin error

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: drop contract_tenant table — migration to contract_participant complete"
```
