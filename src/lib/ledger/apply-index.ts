import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { adjustmentApplication } from "@/db/schema/adjustment-application";
import { contractParticipant } from "@/db/schema/contract-participant";
import { defaultFlagsForTipo } from "./flags";
import { eq, and, inArray, gte, lt } from "drizzle-orm";

// ─── Pure helpers (no DB) ────────────────────────────────

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

/**
 * Resuelve los valores de índice para los períodos requeridos aplicando la regla
 * de fallback: si exactamente 1 período falta (IPC publicado tarde), usa el valor
 * del mes anterior disponible. Si faltan 2+, devuelve null.
 */
function resolveIndexValues(
  requiredPeriods: string[],
  valueMap: Map<string, number>,
): { values: number[]; substitutedPeriod: string | null } | null {
  const missing = requiredPeriods.filter((p) => !valueMap.has(p));
  if (missing.length === 0) {
    return { values: requiredPeriods.map((p) => valueMap.get(p)!), substitutedPeriod: null };
  }
  if (missing.length > 1) return null;

  // Exactamente 1 faltante — usar el valor del período más reciente disponible
  const lastAvailablePeriod = requiredPeriods
    .filter((p) => valueMap.has(p))
    .at(-1)!;
  const fallbackValue = valueMap.get(lastAvailablePeriod)!;
  const resolvedMap = new Map(valueMap);
  resolvedMap.set(missing[0], fallbackValue);
  return {
    values: requiredPeriods.map((p) => resolvedMap.get(p)!),
    substitutedPeriod: missing[0],
  };
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
    const resolved = resolveIndexValues(requiredPeriods, valueMap);

    const baseAmount = parseFloat(c.monthlyAmount);
    let newAmount: number;
    let factor: number;
    let isProvisional: boolean;
    let periodsUsed: string[];
    let valuesUsed: number[];
    let substitutedPeriod: string | null = null;

    if (resolved !== null) {
      valuesUsed = resolved.values;
      substitutedPeriod = resolved.substitutedPeriod;
      factor = calculateFactor(valuesUsed);
      newAmount = Math.round(baseAmount * factor * 100) / 100;
      periodsUsed = requiredPeriods;
      isProvisional = false;
    } else {
      // 2+ meses faltantes — provisorio, sin cambio de monto
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
            `Faltan 2 o más períodos de índice. Se mantiene el monto actual: $${baseAmount.toLocaleString("es-AR")}`,
          ]
        : [
            `Ajuste ${indexType} — rige desde ${tramo.slice(5, 7)}/${tramo.slice(0, 4)}`,
            ...(substitutedPeriod
              ? [`Nota: índice ${substitutedPeriod.slice(5, 7)}/${substitutedPeriod.slice(0, 4)} no disponible, se usó el mes anterior`]
              : []),
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

// ─── Catch-up: aplicar tramos pasados al generar un ledger ──

type CatchUpContractData = {
  startDate: string;
  adjustmentFrequency: number;
  adjustmentIndex: string;
  monthlyAmount: string;
  ownerId: string;
  propertyId: string;
};

/**
 * Aplica todos los tramos de ajuste que ya deberían haberse ejecutado pero no fueron
 * registrados. Usado al generar el ledger de un contrato con fecha de inicio en el pasado.
 * Itera tramos en orden cronológico; si un tramo no tiene sus valores de IPC disponibles,
 * se detiene (no puede aplicar tramos posteriores sin ese base).
 */
export async function applyCatchUpForContract(
  contractId: string,
  c: CatchUpContractData,
  agencyId: string,
  userId: string,
): Promise<void> {
  const today = new Date();
  const todayPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const start = new Date(c.startDate + "T00:00:00");
  let baseAmount = parseFloat(c.monthlyAmount);
  let tramoIndex = 1;

  console.log(`[catch-up] contrato=${contractId} índice=${c.adjustmentIndex} freq=${c.adjustmentFrequency} startDate=${c.startDate} baseAmount=${baseAmount} todayPeriod=${todayPeriod}`);

  while (true) {
    // Período de inicio de este tramo
    const tramoDate = new Date(start.getFullYear(), start.getMonth() + tramoIndex * c.adjustmentFrequency, 1);
    const tramoPeriod = `${tramoDate.getFullYear()}-${String(tramoDate.getMonth() + 1).padStart(2, "0")}`;

    console.log(`[catch-up] tramoIndex=${tramoIndex} tramoPeriod=${tramoPeriod}`);

    // Solo procesamos tramos que ya empezaron (inclusive el mes actual)
    if (tramoPeriod > todayPeriod) { console.log(`[catch-up] tramo futuro, saliendo`); break; }

    // Si ya existe un ajuste para este tramo, tomamos su monto y continuamos
    const [existingApp] = await db
      .select({ newAmount: adjustmentApplication.newAmount })
      .from(adjustmentApplication)
      .where(
        and(
          eq(adjustmentApplication.contratoId, contractId),
          eq(adjustmentApplication.agencyId, agencyId),
          eq(adjustmentApplication.adjustmentPeriod, tramoPeriod),
        )
      )
      .limit(1);

    if (existingApp) {
      console.log(`[catch-up] tramo ${tramoPeriod} ya tiene ajuste registrado (newAmount=${existingApp.newAmount}), saltando`);
      baseAmount = parseFloat(existingApp.newAmount);
      tramoIndex++;
      continue;
    }

    // Verificar si están disponibles los valores de IPC para este tramo
    const requiredPeriods = requiredMonthsForTramo(tramoPeriod, c.adjustmentFrequency);
    const indexValues = await db
      .select({ period: adjustmentIndexValue.period, value: adjustmentIndexValue.value })
      .from(adjustmentIndexValue)
      .where(
        and(
          eq(adjustmentIndexValue.agencyId, agencyId),
          eq(adjustmentIndexValue.indexType, c.adjustmentIndex),
          inArray(adjustmentIndexValue.period, requiredPeriods),
        )
      );

    const valueMap = new Map(indexValues.map((v) => [v.period, parseFloat(v.value)]));
    const missingPeriods = requiredPeriods.filter((p) => !valueMap.has(p));
    console.log(`[catch-up] tramo ${tramoPeriod}: requiere ${JSON.stringify(requiredPeriods)}, encontrados ${indexValues.length}, faltantes ${JSON.stringify(missingPeriods)}`);

    const resolved = resolveIndexValues(requiredPeriods, valueMap);
    if (resolved === null) { console.log(`[catch-up] 2+ meses faltantes, saliendo`); break; }
    console.log(`[catch-up] aplicando tramo ${tramoPeriod}${resolved.substitutedPeriod ? ` (fallback: ${resolved.substitutedPeriod} usa mes anterior)` : ""}`);

    const valuesUsed = resolved.values;
    const substitutedPeriod = resolved.substitutedPeriod;
    const factor = calculateFactor(valuesUsed);
    const newAmount = Math.round(baseAmount * factor * 100) / 100;

    // Límite superior del rango de este tramo
    const nextTramoDate = new Date(start.getFullYear(), start.getMonth() + (tramoIndex + 1) * c.adjustmentFrequency, 1);
    const nextTramoPeriod = `${nextTramoDate.getFullYear()}-${String(nextTramoDate.getMonth() + 1).padStart(2, "0")}`;

    const [tenant] = await db
      .select({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.contractId, contractId), eq(contractParticipant.role, "tenant")))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx
        .update(contract)
        .set({ monthlyAmount: newAmount.toString(), updatedAt: new Date() })
        .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)));

      const tramoEntries = await tx
        .select({ id: tenantLedger.id, period: tenantLedger.period })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.contratoId, contractId),
            eq(tenantLedger.agencyId, agencyId),
            eq(tenantLedger.tipo, "alquiler"),
            inArray(tenantLedger.estado, ["pendiente", "proyectado", "pendiente_revision"]),
            gte(tenantLedger.period, tramoPeriod),
            lt(tenantLedger.period, nextTramoPeriod),
          )
        );

      for (const entry of tramoEntries) {
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

      const descLines = [
        `Ajuste ${c.adjustmentIndex} — rige desde ${tramoPeriod.slice(5, 7)}/${tramoPeriod.slice(0, 4)}`,
        ...(substitutedPeriod
          ? [`Nota: índice ${substitutedPeriod.slice(5, 7)}/${substitutedPeriod.slice(0, 4)} no disponible, se usó el mes anterior`]
          : []),
        `Valores: ${requiredPeriods.map((p, i) => `${p.slice(5, 7)}/${p.slice(0, 4)} ${valuesUsed[i]}%`).join(" · ")}`,
        `Factor: × ${factor.toFixed(5)} | De $${baseAmount.toLocaleString("es-AR")} → $${newAmount.toLocaleString("es-AR")}`,
      ];

      await tx.insert(tenantLedger).values({
        agencyId,
        contratoId: contractId,
        inquilinoId: tenant?.clientId ?? c.ownerId,
        propietarioId: c.ownerId,
        propiedadId: c.propertyId,
        period: tramoPeriod,
        tipo: "ajuste_indice",
        descripcion: descLines.join("\n"),
        monto: undefined,
        estado: "registrado",
        isAutoGenerated: true,
        createdBy: userId,
        ...defaultFlagsForTipo("ajuste_indice"),
      });

      await tx.insert(adjustmentApplication).values({
        agencyId,
        contratoId: contractId,
        adjustmentPeriod: tramoPeriod,
        previousAmount: baseAmount.toString(),
        newAmount: newAmount.toString(),
        factor: factor.toFixed(8),
        periodsUsed: JSON.stringify(requiredPeriods),
        valuesUsed: JSON.stringify(valuesUsed),
        isProvisional: false,
        appliedBy: userId,
      });
    });

    baseAmount = newAmount;
    tramoIndex++;
  }
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

    // Volver entries del tramo a pendiente_revision (solo desde adjustmentPeriod en adelante)
    await tx
      .update(tenantLedger)
      .set({ monto: null, montoOriginal: null, estado: "pendiente_revision", updatedAt: new Date() })
      .where(
        and(
          eq(tenantLedger.contratoId, app.contratoId),
          eq(tenantLedger.agencyId, agencyId),
          eq(tenantLedger.tipo, "alquiler"),
          inArray(tenantLedger.estado, ["pendiente", "proyectado"]),
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
