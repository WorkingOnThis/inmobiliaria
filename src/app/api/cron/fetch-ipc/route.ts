import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { agency } from "@/db/schema/agency";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { applyIndexToContracts } from "@/lib/ledger/apply-index";
import { fetchIPCCordobaValues } from "@/lib/cron/fetch-ipc-cordoba";
import { eq, and } from "drizzle-orm";

const INDEX_TYPE = "IPC (Córdoba)";

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

  // Llamar a la API externa
  let apiValues: { period: string; value: number }[];
  try {
    apiValues = await fetchIPCCordobaValues();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: `Error al contactar la API de IPC: ${msg}` }, { status: 200 });
  }
  if (apiValues.length === 0) {
    return NextResponse.json({ ok: true, message: "La API no devolvió valores" });
  }

  const summary: Record<string, { inserted: number; updated: number; skipped: number; contractsUpdated: number }> = {};

  for (const { agencyId } of agencyRows) {
    // Cargar todos los valores existentes para esta agencia + índice
    const existing = await db
      .select({
        id: adjustmentIndexValue.id,
        period: adjustmentIndexValue.period,
        auditedAt: adjustmentIndexValue.auditedAt,
      })
      .from(adjustmentIndexValue)
      .where(and(
        eq(adjustmentIndexValue.agencyId, agencyId),
        eq(adjustmentIndexValue.indexType, INDEX_TYPE),
      ));

    const existingMap = new Map(existing.map(r => [r.period, r]));

    const [agencyData] = await db
      .select({ ownerId: agency.ownerId })
      .from(agency)
      .where(eq(agency.id, agencyId))
      .limit(1);

    const userId = agencyData.ownerId;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let anyChange = false;

    for (const { period, value } of apiValues) {
      const row = existingMap.get(period);

      if (!row) {
        // No existe → insertar
        await db.insert(adjustmentIndexValue).values({
          agencyId,
          indexType: INDEX_TYPE,
          period,
          value: value.toFixed(4),
          loadedBy: userId,
          source: "cron",
        });
        inserted++;
        anyChange = true;
      } else if (row.auditedAt === null) {
        // Existe pero no está auditado → actualizar con el valor fresco de la API
        await db
          .update(adjustmentIndexValue)
          .set({ value: value.toFixed(4), source: "cron" })
          .where(eq(adjustmentIndexValue.id, row.id));
        updated++;
        anyChange = true;
      } else {
        // Auditado → respetar el valor manual confirmado
        skipped++;
      }
    }

    let contractsUpdated = 0;
    if (anyChange) {
      const result = await applyIndexToContracts(INDEX_TYPE, agencyId, userId);
      contractsUpdated = result.contractsAffected;
    }

    summary[agencyId] = { inserted, updated, skipped, contractsUpdated };
  }

  return NextResponse.json({ ok: true, summary });
}
