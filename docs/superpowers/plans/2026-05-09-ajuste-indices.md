# Ajuste de Alquileres por Índice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar carga manual de valores de índices (ICL, IPC, CER, UVA) que actualice automáticamente el monto de los contratos afectados, con trazabilidad completa y mecanismo de valor provisorio.

**Architecture:** Dos tablas nuevas (`adjustment_index_value` para valores mensuales, `adjustment_application` para historial de ajustes aplicados). Una función core `applyIndexToContracts()` que se ejecuta al insertar cada valor. Panel UI en la página de Contratos.

**Tech Stack:** Next.js App Router · Drizzle ORM + PostgreSQL · Zod · TanStack Query · shadcn/ui · Bun test

**Spec:** `docs/superpowers/specs/2026-05-09-ajuste-indices-design.md`

---

## File Map

### Crear
| Archivo | Responsabilidad |
|---|---|
| `src/db/schema/adjustment-index-value.ts` | Tabla: un valor mensual por tipo de índice |
| `src/db/schema/adjustment-application.ts` | Tabla: historial de ajustes aplicados por contrato |
| `src/lib/ledger/apply-index.ts` | Lógica core: cálculo y aplicación del ajuste |
| `src/lib/ledger/apply-index.test.ts` | Tests unitarios del cálculo |
| `src/app/api/index-values/route.ts` | GET lista + POST carga nuevo valor |
| `src/app/api/index-values/[id]/route.ts` | DELETE elimina un valor |
| `src/app/api/index-values/adjustments/route.ts` | GET historial de ajustes |
| `src/app/api/index-values/adjustments/[id]/route.ts` | DELETE revierte un ajuste por contrato |
| `src/components/contracts/index-values-panel.tsx` | Panel UI "Índices" dentro de Contratos |

### Modificar
| Archivo | Cambio |
|---|---|
| `src/db/schema/index.ts` | Exportar los dos schemas nuevos |
| `src/lib/ledger/flags.ts` | Corregir flags de `ajuste_indice` a todos `false` |
| `src/components/contracts/contracts-list.tsx` | Insertar `<IndexValuesPanel />` arriba del listado |

---

## Task 1: DB schemas — las dos tablas nuevas

**Files:**
- Create: `src/db/schema/adjustment-index-value.ts`
- Create: `src/db/schema/adjustment-application.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Paso 1.1: Crear `src/db/schema/adjustment-index-value.ts`**

```ts
import { pgTable, text, decimal, timestamp, unique } from "drizzle-orm/pg-core";
import { agency } from "./agency";
import { user } from "./better-auth";

export const adjustmentIndexValue = pgTable(
  "adjustment_index_value",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agencyId: text("agencyId")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    indexType: text("indexType").notNull(), // "ICL" | "IPC" | "CER" | "UVA"
    period: text("period").notNull(),        // "YYYY-MM"
    value: decimal("value", { precision: 8, scale: 4 }).notNull(), // ej. 2.0000 = 2%
    loadedAt: timestamp("loadedAt").notNull().defaultNow(),
    loadedBy: text("loadedBy")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (t) => [unique().on(t.agencyId, t.indexType, t.period)]
);

export type AdjustmentIndexValue = typeof adjustmentIndexValue.$inferSelect;
export type NewAdjustmentIndexValue = typeof adjustmentIndexValue.$inferInsert;
```

- [ ] **Paso 1.2: Crear `src/db/schema/adjustment-application.ts`**

```ts
import { pgTable, text, decimal, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { agency } from "./agency";
import { contract } from "./contract";
import { user } from "./better-auth";

export const adjustmentApplication = pgTable("adjustment_application", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  contratoId: text("contratoId")
    .notNull()
    .references(() => contract.id, { onDelete: "restrict" }),
  // "YYYY-MM" — mes desde el que rige el nuevo valor
  adjustmentPeriod: text("adjustmentPeriod").notNull(),
  previousAmount: decimal("previousAmount", { precision: 15, scale: 2 }).notNull(),
  newAmount: decimal("newAmount", { precision: 15, scale: 2 }).notNull(),
  // Producto compuesto de los factores, ej. 1.07212000
  factor: decimal("factor", { precision: 12, scale: 8 }).notNull(),
  // JSON: ["2026-01","2026-02","2026-03"]
  periodsUsed: text("periodsUsed").notNull(),
  // JSON: [2.0, 3.0, 2.0] — valores correspondientes
  valuesUsed: text("valuesUsed").notNull(),
  // true si se usó el valor anterior por falta de datos del índice
  isProvisional: boolean("isProvisional").notNull().default(false),
  appliedAt: timestamp("appliedAt").notNull().defaultNow(),
  appliedBy: text("appliedBy")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
});

export type AdjustmentApplication = typeof adjustmentApplication.$inferSelect;
export type NewAdjustmentApplication = typeof adjustmentApplication.$inferInsert;
```

- [ ] **Paso 1.3: Exportar los schemas nuevos en `src/db/schema/index.ts`**

Agregar estas dos líneas al final del archivo (antes del cierre):

```ts
export * from "./adjustment-index-value";
export * from "./adjustment-application";
```

- [ ] **Paso 1.4: Sincronizar schema con la base de datos**

```bash
bun run db:push
```

Expected: sin errores. Las tablas `adjustment_index_value` y `adjustment_application` aparecen en Drizzle Studio (`bun run db:studio`).

- [ ] **Paso 1.5: Commit**

```bash
git add src/db/schema/adjustment-index-value.ts src/db/schema/adjustment-application.ts src/db/schema/index.ts
git commit -m "feat(schema): add adjustment_index_value and adjustment_application tables"
```

---

## Task 2: Core logic — cálculo y aplicación del ajuste

**Files:**
- Create: `src/lib/ledger/apply-index.ts`
- Create: `src/lib/ledger/apply-index.test.ts`
- Modify: `src/lib/ledger/flags.ts`

### Conceptos clave antes de leer el código

**Tramo de ajuste**: grupo de N meses donde el alquiler tiene el mismo valor. Para un contrato que arranca en Enero con frecuencia trimestral: Tramo 1 = Ene-Mar, Tramo 2 = Abr-Jun, Tramo 3 = Jul-Sep, etc.

**Regla**: el ajuste que rige a partir del mes X usa los IPC de los N meses ANTERIORES (X-N ... X-1). El Tramo 1 no tiene ajuste (es el valor base del contrato).

**`nextTramoStart`**: calcula el período `"YYYY-MM"` del primer mes del PRÓXIMO tramo de ajuste a partir de hoy. Todos los `tenantLedger` con `estado = "pendiente_revision"` corresponden a ese tramo y los siguientes.

**Factor compuesto**: multiplicación encadenada de (1 + v/100) para cada mes, nunca suma de porcentajes.

**Provisorio**: si alguno de los meses requeridos para el cálculo no tiene un valor cargado en `adjustment_index_value`, se usa el `monthlyAmount` actual del contrato como valor provisorio. Se marca `isProvisional = true` y el inquilino ve un aviso.

- [ ] **Paso 2.1: Corregir flags de `ajuste_indice` en `src/lib/ledger/flags.ts`**

La entrada `ajuste_indice` es puramente informativa (documenta el cambio de monto, no genera un cobro adicional). Todos sus flags deben ser `false`:

Cambiar la línea:
```ts
ajuste_indice: { impactaPropietario: true,  incluirEnBaseComision: true,  impactaCaja: false },
```
por:
```ts
ajuste_indice: { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: false },
```

- [ ] **Paso 2.2: Escribir los tests en `src/lib/ledger/apply-index.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import {
  calculateFactor,
  nextTramoStart,
  requiredMonthsForTramo,
} from "./apply-index";

describe("calculateFactor", () => {
  test("un solo mes", () => {
    expect(calculateFactor([2])).toBeCloseTo(1.02);
  });

  test("tres meses compuesto — ejemplo del spec", () => {
    // 1.02 × 1.03 × 1.02 = 1.07212...
    expect(calculateFactor([2, 3, 2])).toBeCloseTo(1.07212, 4);
  });

  test("tres meses segundo tramo — ejemplo del spec", () => {
    // 1.05 × 1.01 × 1.04 = 1.10571...
    expect(calculateFactor([5, 1, 4])).toBeCloseTo(1.10571, 4);
  });

  test("array vacío devuelve 1 (sin ajuste)", () => {
    expect(calculateFactor([])).toBe(1);
  });
});

describe("nextTramoStart", () => {
  test("contrato trimestral — calcula el primer tramo futuro desde hoy", () => {
    // startDate = 2024-01-01, freq = 3
    // Si today es 2024-05-15 → monthsFromStart=4, currentTramoIndex=1, next=2024-07-01
    const result = nextTramoStart("2024-01-01", 3, new Date("2024-05-15"));
    expect(result).toBe("2024-07");
  });

  test("contrato anual — calcula el primer tramo futuro", () => {
    // startDate = 2024-01-01, freq = 12
    // today = 2024-06-01 → monthsFromStart=5, currentTramoIndex=0, next=2025-01
    const result = nextTramoStart("2024-01-01", 12, new Date("2024-06-01"));
    expect(result).toBe("2025-01");
  });

  test("exactamente al inicio de un tramo nuevo", () => {
    // startDate = 2024-01-01, freq = 3
    // today = 2024-07-01 → monthsFromStart=6, currentTramoIndex=2, next=2024-10
    const result = nextTramoStart("2024-01-01", 3, new Date("2024-07-01"));
    expect(result).toBe("2024-10");
  });
});

describe("requiredMonthsForTramo", () => {
  test("trimestral — devuelve los 3 meses anteriores al tramo", () => {
    const result = requiredMonthsForTramo("2024-04", 3);
    expect(result).toEqual(["2024-01", "2024-02", "2024-03"]);
  });

  test("trimestral — cruza año", () => {
    const result = requiredMonthsForTramo("2025-01", 3);
    expect(result).toEqual(["2024-10", "2024-11", "2024-12"]);
  });

  test("semestral — devuelve 6 meses", () => {
    const result = requiredMonthsForTramo("2024-07", 6);
    expect(result).toEqual([
      "2024-01", "2024-02", "2024-03",
      "2024-04", "2024-05", "2024-06",
    ]);
  });
});
```

- [ ] **Paso 2.3: Ejecutar los tests para verificar que fallan**

```bash
bun test src/lib/ledger/apply-index.test.ts
```

Expected: error `Cannot find module './apply-index'` o similar. Los tests deben fallar porque el módulo no existe aún.

- [ ] **Paso 2.4: Crear `src/lib/ledger/apply-index.ts`**

```ts
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { adjustmentApplication } from "@/db/schema/adjustment-application";
import { contractParticipant } from "@/db/schema/contract-participant";
import { defaultFlagsForTipo } from "./flags";
import { eq, and, inArray, gte } from "drizzle-orm";

// ─── Pure helpers (sin DB) ────────────────────────────────

/** Multiplica factores (1 + v/100) para cada mes. Array vacío → 1. */
export function calculateFactor(values: number[]): number {
  return values.reduce((acc, v) => acc * (1 + v / 100), 1);
}

/**
 * Devuelve el período "YYYY-MM" del inicio del PRÓXIMO tramo de ajuste.
 * Acepta `today` como parámetro para facilitar tests.
 */
export function nextTramoStart(
  startDate: string,   // "YYYY-MM-DD"
  adjustmentFrequency: number,
  today: Date = new Date(),
): string {
  const start = new Date(startDate + "T00:00:00");
  const monthsFromStart =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  const currentTramoIndex = Math.floor(monthsFromStart / adjustmentFrequency);
  const nextTramoMonths = (currentTramoIndex + 1) * adjustmentFrequency;
  const next = new Date(start.getFullYear(), start.getMonth() + nextTramoMonths, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Devuelve los N períodos "YYYY-MM" inmediatamente anteriores a tramoStart.
 * Ejemplo: tramoStart="2024-04", count=3 → ["2024-01","2024-02","2024-03"]
 */
export function requiredMonthsForTramo(
  tramoStart: string, // "YYYY-MM"
  count: number,
): string[] {
  const [y, m] = tramoStart.split("-").map(Number);
  const result: string[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(y, m - 1 - i, 1);
    result.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return result;
}

// ─── Aplicación a contratos ───────────────────────────────

type ApplyResult = {
  contractsAffected: number;
  provisionalCount: number;
};

/**
 * Busca todos los contratos activos que usan `indexType` y tienen entradas
 * pendiente_revision. Para cada uno calcula y aplica el ajuste (o provisorio).
 * Se llama desde POST /api/index-values después de insertar el nuevo valor.
 */
export async function applyIndexToContracts(
  indexType: string,
  agencyId: string,
  userId: string,
): Promise<ApplyResult> {
  const today = new Date();
  const todayPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // 1. Contratos activos que usan este índice y tienen pendiente_revision
  const contractsWithPending = await db
    .selectDistinct({ id: tenantLedger.contratoId })
    .from(tenantLedger)
    .innerJoin(contract, eq(contract.id, tenantLedger.contratoId))
    .where(
      and(
        eq(tenantLedger.agencyId, agencyId),
        eq(tenantLedger.estado, "pendiente_revision"),
        eq(tenantLedger.tipo, "alquiler"),
        eq(contract.adjustmentIndex, indexType),
        eq(contract.status, "active"),
      )
    );

  if (contractsWithPending.length === 0) return { contractsAffected: 0, provisionalCount: 0 };

  const contractIds = contractsWithPending.map((r) => r.id);

  // 2. Cargar datos de esos contratos
  const contracts = await db
    .select({
      id: contract.id,
      startDate: contract.startDate,
      monthlyAmount: contract.monthlyAmount,
      adjustmentFrequency: contract.adjustmentFrequency,
      ownerId: contract.ownerId,
      propertyId: contract.propertyId,
    })
    .from(contract)
    .where(and(inArray(contract.id, contractIds), eq(contract.agencyId, agencyId)));

  let contractsAffected = 0;
  let provisionalCount = 0;

  for (const c of contracts) {
    const tramo = nextTramoStart(c.startDate, c.adjustmentFrequency, today);
    const requiredPeriods = requiredMonthsForTramo(tramo, c.adjustmentFrequency);

    // 3. Buscar valores de índice para los períodos requeridos
    const indexValues = await db
      .select({ period: adjustmentIndexValue.period, value: adjustmentIndexValue.value })
      .from(adjustmentIndexValue)
      .where(
        and(
          eq(adjustmentIndexValue.agencyId, agencyId),
          eq(adjustmentIndexValue.indexType, indexType),
          inArray(adjustmentIndexValue.period, requiredPeriods),
        )
      );

    const valueMap = new Map(indexValues.map((v) => [v.period, parseFloat(v.value)]));
    const allAvailable = requiredPeriods.every((p) => valueMap.has(p));

    const baseAmount = parseFloat(c.monthlyAmount);
    let newAmount: number;
    let factor: number;
    let isProvisional: boolean;
    let periodsUsed: string[];
    let valuesUsed: number[];

    if (allAvailable) {
      valuesUsed = requiredPeriods.map((p) => valueMap.get(p)!);
      factor = calculateFactor(valuesUsed);
      newAmount = Math.round(baseAmount * factor * 100) / 100;
      periodsUsed = requiredPeriods;
      isProvisional = false;
    } else {
      // Provisorio: usar el monto actual
      valuesUsed = requiredPeriods.map((p) => valueMap.get(p) ?? 0);
      factor = 1;
      newAmount = baseAmount;
      periodsUsed = requiredPeriods;
      isProvisional = true;
      provisionalCount++;
    }

    // 4. Obtener inquilino principal
    const [tenant] = await db
      .select({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(
        and(
          eq(contractParticipant.contractId, c.id),
          eq(contractParticipant.role, "tenant"),
        )
      )
      .limit(1);

    await db.transaction(async (tx) => {
      // 4a. Actualizar contract.monthlyAmount
      await tx
        .update(contract)
        .set({ monthlyAmount: newAmount.toString(), updatedAt: new Date() })
        .where(and(eq(contract.id, c.id), eq(contract.agencyId, agencyId)));

      // 4b. Actualizar entradas pendiente_revision → pendiente o proyectado
      const pendingEntries = await tx
        .select({ id: tenantLedger.id, period: tenantLedger.period })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.contratoId, c.id),
            eq(tenantLedger.agencyId, agencyId),
            eq(tenantLedger.estado, "pendiente_revision"),
            eq(tenantLedger.tipo, "alquiler"),
          )
        );

      for (const entry of pendingEntries) {
        const isPast = (entry.period ?? "") <= todayPeriod;
        await tx
          .update(tenantLedger)
          .set({
            monto: newAmount.toString(),
            montoOriginal: newAmount.toString(),
            estado: isPast ? "pendiente" : "proyectado",
            updatedAt: new Date(),
          })
          .where(eq(tenantLedger.id, entry.id));
      }

      // 4c. Crear entrada ajuste_indice en el ledger (informativa)
      const descLines = isProvisional
        ? [
            `Ajuste ${indexType} (Provisorio) — rige desde ${tramo.slice(5, 7)}/${tramo.slice(0, 4)}`,
            `Índice incompleto. Se usa valor del período anterior: $${baseAmount.toLocaleString("es-AR")}`,
          ]
        : [
            `Ajuste ${indexType} — rige desde ${tramo.slice(5, 7)}/${tramo.slice(0, 4)}`,
            `Valores: ${periodsUsed.map((p, i) => `${p.slice(5, 7)}/${p.slice(0, 4)} ${valuesUsed[i]}%`).join(" · ")}`,
            `Factor: × ${factor.toFixed(5)} | De $${baseAmount.toLocaleString("es-AR")} → $${newAmount.toLocaleString("es-AR")}`,
          ];

      await tx.insert(tenantLedger).values({
        agencyId,
        contratoId: c.id,
        inquilinoId: tenant?.clientId ?? c.ownerId,
        propietarioId: c.ownerId,
        propiedadId: c.propertyId,
        period: tramo,
        tipo: "ajuste_indice",
        descripcion: descLines.join("\n"),
        monto: undefined,
        estado: "registrado",
        isAutoGenerated: true,
        createdBy: userId,
        ...defaultFlagsForTipo("ajuste_indice"),
      });

      // 4d. Registrar en adjustment_application
      await tx.insert(adjustmentApplication).values({
        agencyId,
        contratoId: c.id,
        adjustmentPeriod: tramo,
        previousAmount: baseAmount.toString(),
        newAmount: newAmount.toString(),
        factor: factor.toFixed(8),
        periodsUsed: JSON.stringify(periodsUsed),
        valuesUsed: JSON.stringify(valuesUsed),
        isProvisional,
        appliedBy: userId,
      });
    });

    contractsAffected++;
  }

  return { contractsAffected, provisionalCount };
}

// ─── Revertir un ajuste ───────────────────────────────────

/**
 * Revierte un adjustment_application:
 * - Restaura contract.monthlyAmount al valor anterior
 * - Vuelve a poner las entradas del tramo en pendiente_revision con monto = null
 * - Cancela la entrada ajuste_indice del ledger
 * - Elimina el adjustment_application
 */
export async function revertAdjustmentApplication(
  applicationId: string,
  agencyId: string,
): Promise<void> {
  const [app] = await db
    .select()
    .from(adjustmentApplication)
    .where(
      and(
        eq(adjustmentApplication.id, applicationId),
        eq(adjustmentApplication.agencyId, agencyId),
      )
    )
    .limit(1);

  if (!app) throw new Error("Ajuste no encontrado");

  await db.transaction(async (tx) => {
    // Restaurar monthlyAmount
    await tx
      .update(contract)
      .set({ monthlyAmount: app.previousAmount, updatedAt: new Date() })
      .where(and(eq(contract.id, app.contratoId), eq(contract.agencyId, agencyId)));

    // Volver entries del tramo a pendiente_revision
    await tx
      .update(tenantLedger)
      .set({ monto: null, montoOriginal: null, estado: "pendiente_revision", updatedAt: new Date() })
      .where(
        and(
          eq(tenantLedger.contratoId, app.contratoId),
          eq(tenantLedger.agencyId, agencyId),
          eq(tenantLedger.tipo, "alquiler"),
          inArray(tenantLedger.estado, ["pendiente", "proyectado"]),
          // Solo revertir entries del tramo ajustado en adelante (no afectar tramos anteriores)
          gte(tenantLedger.period, app.adjustmentPeriod),
        )
      );

    // Cancelar entrada ajuste_indice para este tramo
    await tx
      .update(tenantLedger)
      .set({ estado: "cancelado", updatedAt: new Date() })
      .where(
        and(
          eq(tenantLedger.contratoId, app.contratoId),
          eq(tenantLedger.agencyId, agencyId),
          eq(tenantLedger.tipo, "ajuste_indice"),
          eq(tenantLedger.period, app.adjustmentPeriod),
        )
      );

    // Eliminar el registro
    await tx
      .delete(adjustmentApplication)
      .where(eq(adjustmentApplication.id, applicationId));
  });
}
```

- [ ] **Paso 2.5: Correr los tests para verificar que pasan**

```bash
bun test src/lib/ledger/apply-index.test.ts
```

Expected output:
```
✓ calculateFactor > un solo mes
✓ calculateFactor > tres meses compuesto — ejemplo del spec
✓ calculateFactor > tres meses segundo tramo — ejemplo del spec
✓ calculateFactor > array vacío devuelve 1 (sin ajuste)
✓ nextTramoStart > contrato trimestral — calcula el primer tramo futuro desde hoy
✓ nextTramoStart > contrato anual — calcula el primer tramo futuro
✓ nextTramoStart > exactamente al inicio de un tramo nuevo
✓ requiredMonthsForTramo > trimestral — devuelve los 3 meses anteriores al tramo
✓ requiredMonthsForTramo > trimestral — cruza año
✓ requiredMonthsForTramo > semestral — devuelve 6 meses
10 tests pass
```

- [ ] **Paso 2.6: Commit**

```bash
git add src/lib/ledger/apply-index.ts src/lib/ledger/apply-index.test.ts src/lib/ledger/flags.ts
git commit -m "feat(ledger): add apply-index core logic with tests, fix ajuste_indice flags"
```

---

## Task 3: API routes

**Files:**
- Create: `src/app/api/index-values/route.ts`
- Create: `src/app/api/index-values/[id]/route.ts`
- Create: `src/app/api/index-values/adjustments/route.ts`
- Create: `src/app/api/index-values/adjustments/[id]/route.ts`

**Patrón a seguir**: igual que todas las rutas del proyecto. Siempre: `getSession → requireAgencyId → canManageContracts → lógica de negocio`. Errores: 401 sin sesión, 403 sin permiso, 400 validación, 404 no encontrado, 409 conflicto (unique), 500 inesperado.

- [ ] **Paso 3.1: Crear `src/app/api/index-values/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { adjustmentApplication } from "@/db/schema/adjustment-application";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { applyIndexToContracts } from "@/lib/ledger/apply-index";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const VALID_INDEX_TYPES = ["ICL", "IPC", "CER", "UVA"] as const;

const postSchema = z.object({
  indexType: z.enum(VALID_INDEX_TYPES),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Formato debe ser YYYY-MM"),
  value: z.coerce.number().min(0).max(200),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const values = await db
      .select()
      .from(adjustmentIndexValue)
      .where(eq(adjustmentIndexValue.agencyId, agencyId))
      .orderBy(desc(adjustmentIndexValue.period), adjustmentIndexValue.indexType);

    return NextResponse.json(values);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al listar índices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = postSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { indexType, period, value } = result.data;

    // Verificar que no exista ya para ese período
    const [existing] = await db
      .select({ id: adjustmentIndexValue.id })
      .from(adjustmentIndexValue)
      .where(
        and(
          eq(adjustmentIndexValue.agencyId, agencyId),
          eq(adjustmentIndexValue.indexType, indexType),
          eq(adjustmentIndexValue.period, period),
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un valor de ${indexType} para ${period}` },
        { status: 409 }
      );
    }

    // Insertar
    await db.insert(adjustmentIndexValue).values({
      agencyId,
      indexType,
      period,
      value: value.toString(),
      loadedBy: session!.user.id,
    });

    // Aplicar a contratos automáticamente
    const { contractsAffected, provisionalCount } = await applyIndexToContracts(
      indexType,
      agencyId,
      session!.user.id,
    );

    return NextResponse.json(
      { message: "Índice cargado", contractsAffected, provisionalCount },
      { status: 201 }
    );
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("POST /api/index-values:", error);
    return NextResponse.json({ error: "Error al cargar el índice" }, { status: 500 });
  }
}
```

- [ ] **Paso 3.2: Crear `src/app/api/index-values/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: adjustmentIndexValue.id })
      .from(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Valor no encontrado" }, { status: 404 });
    }

    await db
      .delete(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)));

    return NextResponse.json({ message: "Valor eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al eliminar el valor" }, { status: 500 });
  }
}
```

- [ ] **Paso 3.3: Crear `src/app/api/index-values/adjustments/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentApplication } from "@/db/schema/adjustment-application";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const contractId = request.nextUrl.searchParams.get("contractId");

    const conditions = [eq(adjustmentApplication.agencyId, agencyId)];
    if (contractId) {
      conditions.push(eq(adjustmentApplication.contratoId, contractId));
    }

    const rows = await db
      .select({
        id: adjustmentApplication.id,
        contratoId: adjustmentApplication.contratoId,
        contractNumber: contract.contractNumber,
        propertyAddress: property.address,
        adjustmentPeriod: adjustmentApplication.adjustmentPeriod,
        previousAmount: adjustmentApplication.previousAmount,
        newAmount: adjustmentApplication.newAmount,
        factor: adjustmentApplication.factor,
        periodsUsed: adjustmentApplication.periodsUsed,
        valuesUsed: adjustmentApplication.valuesUsed,
        isProvisional: adjustmentApplication.isProvisional,
        appliedAt: adjustmentApplication.appliedAt,
      })
      .from(adjustmentApplication)
      .innerJoin(contract, eq(contract.id, adjustmentApplication.contratoId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(and(...conditions))
      .orderBy(desc(adjustmentApplication.appliedAt));

    return NextResponse.json(rows);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al listar ajustes" }, { status: 500 });
  }
}
```

- [ ] **Paso 3.4: Crear `src/app/api/index-values/adjustments/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { revertAdjustmentApplication } from "@/lib/ledger/apply-index";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    await revertAdjustmentApplication(id, agencyId);

    return NextResponse.json({ message: "Ajuste revertido" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Ajuste no encontrado") {
      return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 });
    }
    console.error("DELETE /api/index-values/adjustments/:id:", error);
    return NextResponse.json({ error: "Error al revertir el ajuste" }, { status: 500 });
  }
}
```

- [ ] **Paso 3.5: Verificar que el servidor compila sin errores**

```bash
bun run build 2>&1 | head -40
```

Expected: sin errores de TypeScript. Si hay errores de tipos, corregirlos antes de continuar.

- [ ] **Paso 3.6: Commit**

```bash
git add src/app/api/index-values/
git commit -m "feat(api): add index-values CRUD and adjustments history routes"
```

---

## Task 4: UI — Panel "Índices" en Contratos

**Files:**
- Create: `src/components/contracts/index-values-panel.tsx`
- Modify: `src/components/contracts/contracts-list.tsx`

**Componentes shadcn disponibles**: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Input`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`. Si alguno no está instalado: `npx shadcn@latest add <nombre>`.

**Formato de fechas en Argentina**: períodos se muestran como `MM/YYYY`, no como `YYYY-MM`.

- [ ] **Paso 4.1: Crear `src/components/contracts/index-values-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ── Tipos ────────────────────────────────────────────────

type IndexValue = {
  id: string;
  indexType: string;
  period: string;  // "YYYY-MM"
  value: string;
  loadedAt: string;
};

type AdjustmentRow = {
  id: string;
  contratoId: string;
  contractNumber: string;
  propertyAddress: string | null;
  adjustmentPeriod: string;  // "YYYY-MM"
  previousAmount: string;
  newAmount: string;
  factor: string;
  periodsUsed: string;  // JSON
  valuesUsed: string;   // JSON
  isProvisional: boolean;
  appliedAt: string;
};

// ── Helpers ──────────────────────────────────────────────

const INDEX_TYPES = ["ICL", "IPC", "CER", "UVA"] as const;

/** Convierte "YYYY-MM" → "MM/YYYY" */
function formatPeriod(p: string): string {
  return `${p.slice(5, 7)}/${p.slice(0, 4)}`;
}

/** Convierte timestamp → "DD/MM/YYYY" */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatARS(amount: string | number): string {
  return Number(amount).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

// ── Componente ───────────────────────────────────────────

export function IndexValuesPanel() {
  const [open, setOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [revertDialogId, setRevertDialogId] = useState<string | null>(null);

  // Form state
  const [indexType, setIndexType] = useState<string>("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [value, setValue] = useState("");

  const qc = useQueryClient();

  const { data: indexValues = [] } = useQuery<IndexValue[]>({
    queryKey: ["index-values"],
    queryFn: () => fetch("/api/index-values").then((r) => r.json()),
    enabled: open,
  });

  const { data: adjustments = [] } = useQuery<AdjustmentRow[]>({
    queryKey: ["index-adjustments"],
    queryFn: () => fetch("/api/index-values/adjustments").then((r) => r.json()),
    enabled: open,
  });

  const loadMutation = useMutation({
    mutationFn: (data: { indexType: string; period: string; value: number }) =>
      fetch("/api/index-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["index-values"] });
      qc.invalidateQueries({ queryKey: ["index-adjustments"] });
      setLoadDialogOpen(false);
      setIndexType("");
      setPeriodMonth("");
      setPeriodYear("");
      setValue("");
      if (data.contractsAffected > 0) {
        alert(`Índice cargado. ${data.contractsAffected} contrato(s) actualizado(s)${data.provisionalCount > 0 ? `, ${data.provisionalCount} de forma provisoria` : ""}.`);
      }
    },
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/index-values/adjustments/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["index-adjustments"] });
      setRevertDialogId(null);
    },
  });

  function handleLoad() {
    if (!indexType || !periodMonth || !periodYear || !value) return;
    const month = periodMonth.padStart(2, "0");
    const period = `${periodYear}-${month}`;
    loadMutation.mutate({ indexType, period, value: parseFloat(value) });
  }

  const revertTarget = adjustments.find((a) => a.id === revertDialogId);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-low px-4 py-3 text-sm font-medium hover:bg-surface-mid transition-colors">
            <span>Índices de ajuste</span>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 space-y-4">
          {/* Tabla de valores cargados */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-low">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valores cargados
              </span>
              <Button size="sm" variant="outline" onClick={() => setLoadDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Cargar índice
              </Button>
            </div>

            {indexValues.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay valores cargados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">Período</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 text-left font-medium">Cargado</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {indexValues.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{v.indexType}</td>
                      <td className="px-4 py-2">{formatPeriod(v.period)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{parseFloat(v.value).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(v.loadedAt)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            if (!confirm(`¿Eliminar ${v.indexType} ${formatPeriod(v.period)}?`)) return;
                            await fetch(`/api/index-values/${v.id}`, { method: "DELETE" });
                            qc.invalidateQueries({ queryKey: ["index-values"] });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial de ajustes aplicados */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-surface-low">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historial de ajustes aplicados
              </span>
            </div>

            {adjustments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay ajustes aplicados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Contrato</th>
                    <th className="px-4 py-2 text-left font-medium">Rige desde</th>
                    <th className="px-4 py-2 text-right font-medium">Anterior</th>
                    <th className="px-4 py-2 text-right font-medium">Nuevo</th>
                    <th className="px-4 py-2 text-right font-medium">Factor</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{a.contractNumber}</div>
                        <div className="text-xs text-muted-foreground">{a.propertyAddress}</div>
                      </td>
                      <td className="px-4 py-2">
                        {formatPeriod(a.adjustmentPeriod)}
                        {a.isProvisional && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500/30 text-amber-500">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Provisorio
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {formatARS(a.previousAmount)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-income">
                        {formatARS(a.newAmount)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">
                        × {parseFloat(a.factor).toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setRevertDialogId(a.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Dialog: cargar índice */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cargar valor de índice</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de índice</label>
              <Select value={indexType} onValueChange={setIndexType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná el índice" />
                </SelectTrigger>
                <SelectContent>
                  {INDEX_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Período</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="MM"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={2020}
                  max={2099}
                  placeholder="YYYY"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">Mes y año al que corresponde este valor</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={200}
                placeholder="ej. 11.20"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Variación mensual del índice en porcentaje
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleLoad}
              disabled={!indexType || !periodMonth || !periodYear || !value || loadMutation.isPending}
            >
              {loadMutation.isPending ? "Cargando..." : "Cargar y aplicar"}
            </Button>
          </DialogFooter>

          {loadMutation.isError && (
            <p className="text-sm text-destructive">{(loadMutation.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar revertir */}
      <Dialog open={!!revertDialogId} onOpenChange={() => setRevertDialogId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revertir ajuste</DialogTitle>
          </DialogHeader>
          {revertTarget && (
            <div className="space-y-2 py-2 text-sm">
              <p>
                ¿Revertir el ajuste del contrato{" "}
                <span className="font-medium">{revertTarget.contractNumber}</span>{" "}
                que rige desde <span className="font-medium">{formatPeriod(revertTarget.adjustmentPeriod)}</span>?
              </p>
              <p className="text-muted-foreground">
                El monto volverá a {formatARS(revertTarget.previousAmount)} y los períodos afectados
                quedarán como pendientes de revisión.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialogId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => revertDialogId && revertMutation.mutate(revertDialogId)}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? "Revirtiendo..." : "Revertir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Paso 4.2: Instalar Collapsible si no está disponible**

```bash
npx shadcn@latest add collapsible
```

Si ya existe en `src/components/ui/collapsible.tsx`, el comando no hace nada dañino.

- [ ] **Paso 4.3: Integrar `IndexValuesPanel` en `contracts-list.tsx`**

En `src/components/contracts/contracts-list.tsx`, buscar el return del componente principal. Agregar el panel justo antes del bloque de los filtros o del listado de contratos.

Agregar el import al inicio:
```ts
import { IndexValuesPanel } from "@/components/contracts/index-values-panel";
```

Agregar el panel en el JSX, inmediatamente antes del bloque de filtros (buscar el `<div>` que contiene los STATUS_FILTERS):

```tsx
{/* Panel de índices */}
<div className="mb-4">
  <IndexValuesPanel />
</div>
```

- [ ] **Paso 4.4: Verificar en el browser**

```bash
bun dev
```

Navegar a `http://localhost:3000/contratos`. Verificar:
- [ ] El panel "Índices de ajuste" aparece colapsado arriba del listado
- [ ] Hacer click expande el panel mostrando las dos tablas (vacías)
- [ ] Hacer click en "Cargar índice" abre el dialog
- [ ] Completar tipo IPC, período (ej. 03/2026), valor (ej. 5.5) y confirmar
- [ ] La tabla de valores muestra el registro recién cargado
- [ ] Si hay contratos activos con `adjustmentIndex = "IPC"` y entradas `pendiente_revision`, el alert confirma cuántos fueron afectados
- [ ] El historial muestra el ajuste aplicado con los datos correctos

- [ ] **Paso 4.5: Commit**

```bash
git add src/components/contracts/index-values-panel.tsx src/components/contracts/contracts-list.tsx
git commit -m "feat(ui): add IndexValuesPanel with load, history and revert to contracts page"
```

---

## Task 5: Verificación final

- [ ] **Paso 5.1: Build de producción limpio**

```bash
bun run build
```

Expected: sin errores de TypeScript ni de compilación.

- [ ] **Paso 5.2: Tests completos**

```bash
bun test
```

Expected: todos los tests pasan, incluyendo los de `apply-index.test.ts`.

- [ ] **Paso 5.3: Prueba manual del flujo completo**

Con al menos un contrato activo que tenga `adjustmentIndex = "IPC"`, `adjustmentFrequency = 3` y entradas `pendiente_revision`:

1. Ir a `/contratos`, expandir panel "Índices"
2. Cargar IPC de los 3 meses del tramo anterior (ej. Ene, Feb, Mar 2026)
   - Cargar uno por vez; los dos primeros no deberían afectar contratos
   - El tercero debería mostrar el alert con contratos afectados
3. Verificar en la CC del inquilino que:
   - Las entradas antes `pendiente_revision` ahora son `pendiente`/`proyectado` con monto correcto
   - Aparece una entrada `ajuste_indice` con la descripción del cálculo
4. En el panel, usar el botón de revertir en el historial
5. Verificar que el monto vuelve al valor anterior y las entradas vuelven a `pendiente_revision`

- [ ] **Paso 5.4: Commit final**

```bash
git add -A
git commit -m "feat: rent index adjustment — manual load, auto-apply, history and revert"
git push
```

---

## Notas para el implementador

### Sobre el cálculo del próximo tramo

`nextTramoStart` recalcula cada vez desde cero basándose en `startDate`, `adjustmentFrequency` y la fecha actual. Esto significa que si hoy es el 1 de julio y el contrato tiene frecuencia trimestral desde enero, el "próximo tramo" es octubre (no julio, porque julio ya arrancó y está en el tramo actual).

### Sobre el caso provisorio

Si faltan valores para calcular el ajuste, el sistema asigna el monto actual del contrato como provisorio (`isProvisional = true`). El badge "Provisorio" aparece en el historial. Cuando se carguen los valores faltantes y se vuelva a ejecutar `applyIndexToContracts`, el sistema creará un nuevo `adjustment_application` no provisorio. Los contratos provisorios NO se revierten automáticamente — quedan con el monto actual hasta que se carguen todos los índices requeridos.

### Sobre el revert

El revert opera a nivel de `adjustment_application` (por contrato), no a nivel de valor de índice. Eliminar un valor de `adjustment_index_value` no revierte automáticamente los ajustes aplicados — es solo una operación de limpieza del registro. Para revertir el efecto en un contrato, usá el botón de revertir en la tabla del historial.

### Formato de fechas

Toda la lógica interna usa `YYYY-MM`. Solo en la capa de presentación (componente React) se convierte a `MM/YYYY` con la función `formatPeriod`.
