import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { agency } from "@/db/schema/agency";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { applyIndexToContracts } from "@/lib/ledger/apply-index";
import { fetchIPCCordobaValues } from "@/lib/cron/fetch-ipc-cordoba";
import { eq, and } from "drizzle-orm";

const INDEX_TYPE = "IPC (Córdoba)";

/** "YYYY-MM" del mes anterior a hoy */
function previousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "Cron disabled" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Agencias con contratos activos de IPC (Córdoba)
  const agencyRows = await db
    .selectDistinct({ agencyId: contract.agencyId })
    .from(contract)
    .where(and(eq(contract.adjustmentIndex, INDEX_TYPE), eq(contract.status, "active")));

  if (agencyRows.length === 0) {
    return NextResponse.json({ ok: true, message: "No hay contratos con IPC (Córdoba)" });
  }

  const agencyIds = agencyRows.map((r) => r.agencyId);
  const expected_period = previousMonth();

  // Si todas las agencias ya tienen el mes anterior cargado, no llamamos a la API
  const alreadyLoaded = await Promise.all(
    agencyIds.map((agencyId) =>
      db
        .select({ id: adjustmentIndexValue.id })
        .from(adjustmentIndexValue)
        .where(
          and(
            eq(adjustmentIndexValue.agencyId, agencyId),
            eq(adjustmentIndexValue.indexType, INDEX_TYPE),
            eq(adjustmentIndexValue.period, expected_period),
          )
        )
        .limit(1)
        .then((rows) => rows.length > 0),
    )
  );

  if (alreadyLoaded.every(Boolean)) {
    return NextResponse.json({ ok: true, message: `${expected_period} ya cargado en todas las agencias` });
  }

  // Llamar a la API una sola vez
  let apiValues;
  try {
    apiValues = await fetchIPCCordobaValues();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: `Error al contactar la API de IPC: ${msg}` }, { status: 200 });
  }
  if (apiValues.length === 0) {
    return NextResponse.json({ ok: true, message: "La API no devolvió valores" });
  }

  const summary: Record<string, { inserted: number; contractsUpdated: number }> = {};

  for (const agencyId of agencyIds) {
    // Períodos ya cargados para esta agencia
    const existing = await db
      .select({ period: adjustmentIndexValue.period })
      .from(adjustmentIndexValue)
      .where(
        and(
          eq(adjustmentIndexValue.agencyId, agencyId),
          eq(adjustmentIndexValue.indexType, INDEX_TYPE),
        )
      );
    const loadedPeriods = new Set(existing.map((r) => r.period));

    const toInsert = apiValues.filter((v) => !loadedPeriods.has(v.period));
    if (toInsert.length === 0) {
      summary[agencyId] = { inserted: 0, contractsUpdated: 0 };
      continue;
    }

    // Usar el ownerId de la agencia como loadedBy (contexto sin sesión)
    const [agencyData] = await db
      .select({ ownerId: agency.ownerId })
      .from(agency)
      .where(eq(agency.id, agencyId))
      .limit(1);

    const userId = agencyData.ownerId;
    let contractsUpdated = 0;

    for (const { period, value } of toInsert) {
      await db.insert(adjustmentIndexValue).values({
        agencyId,
        indexType: INDEX_TYPE,
        period,
        value: value.toFixed(4),
        loadedBy: userId,
      });
      const result = await applyIndexToContracts(INDEX_TYPE, agencyId, userId);
      contractsUpdated += result.contractsAffected;
    }

    summary[agencyId] = { inserted: toInsert.length, contractsUpdated };
  }

  return NextResponse.json({ ok: true, summary });
}
