import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { nextTramoStart } from "@/lib/ledger/apply-index";
import { adjustmentApplication } from "@/db/schema/adjustment-application";
import { eq, and, gte } from "drizzle-orm";

export type ProyeccionMonth = {
  period: string;   // "YYYY-MM"
  pct: number;      // e.g. 3.24
  amount: number;   // accumulated
  isProjected: boolean;
};

export type ProyeccionTramo = {
  tramoStart: string;   // "YYYY-MM" — primer mes que rige con este monto
  tramoEnd: string;     // "YYYY-MM" — último mes antes del próximo ajuste
  tramoNumber: number;  // posición 1-based desde el inicio del contrato
  baseAmount: number;
  newAmount: number;
  totalPct: number;
  months: ProyeccionMonth[];
  hasProjected: boolean;
  isPast: boolean;      // true = tramo ya terminado (histórico)
};

export type ProyeccionResponse = {
  adjustmentIndex: string;
  adjustmentFrequency: number;
  endDate: string;
  tramos: ProyeccionTramo[];
};

/** Suma `n` meses a un período "YYYY-MM". */
function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Resta 1 mes a un período "YYYY-MM". */
function subOneMonth(period: string): string {
  return addMonths(period, -1);
}

/** Número de tramo 1-based desde el inicio del contrato. */
function tramoNumberOf(tramoStart: string, contractStart: string, frequency: number): number {
  const [sy, sm] = contractStart.split("-").map(Number);
  const [ty, tm] = tramoStart.split("-").map(Number);
  const monthsFromStart = (ty - sy) * 12 + (tm - sm);
  return Math.floor(monthsFromStart / frequency) + 1;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tenantId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    // Active contract for this tenant
    const [participation] = await db
      .select({ contractId: contractParticipant.contractId })
      .from(contractParticipant)
      .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
      .where(
        and(
          eq(contractParticipant.clientId, tenantId),
          eq(contractParticipant.role, "tenant"),
          eq(contract.agencyId, agencyId),
          eq(contract.status, "active"),
        )
      )
      .limit(1);

    if (!participation) {
      return NextResponse.json({ error: "Sin contrato activo" }, { status: 404 });
    }

    const [c] = await db
      .select({
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyAmount: contract.monthlyAmount,
        adjustmentIndex: contract.adjustmentIndex,
        adjustmentFrequency: contract.adjustmentFrequency,
      })
      .from(contract)
      .where(and(eq(contract.id, participation.contractId), eq(contract.agencyId, agencyId)))
      .limit(1);

    if (!c || c.adjustmentIndex === "none" || c.adjustmentIndex === "manual") {
      return NextResponse.json({ error: "Contrato sin ajuste por índice" }, { status: 422 });
    }

    // All loaded index values for this index type, from contract start
    const indexValues = await db
      .select({ period: adjustmentIndexValue.period, value: adjustmentIndexValue.value })
      .from(adjustmentIndexValue)
      .where(
        and(
          eq(adjustmentIndexValue.agencyId, agencyId),
          eq(adjustmentIndexValue.indexType, c.adjustmentIndex),
          gte(adjustmentIndexValue.period, c.startDate.slice(0, 7)),
        )
      );

    const valueMap = new Map(indexValues.map((v) => [v.period, parseFloat(v.value)]));

    // Last known value (for projection of missing future months)
    const sortedPeriods = [...valueMap.keys()].sort();
    const lastKnownPct = sortedPeriods.length > 0
      ? valueMap.get(sortedPeriods[sortedPeriods.length - 1])!
      : 0;

    // Determine current tramo start (first upcoming adjustment, then work backwards)
    const today = new Date();
    const nextAdjPeriod = nextTramoStart(c.startDate, c.adjustmentFrequency, today);
    const contractEndPeriod = c.endDate.slice(0, 7);
    const contractStartPeriod = c.startDate.slice(0, 7);

    // Current tramo started `adjustmentFrequency` months before the next one
    const currentTramoStart = addMonths(nextAdjPeriod, -c.adjustmentFrequency);
    const currentBaseAmount = parseFloat(c.monthlyAmount);

    const tramos: ProyeccionTramo[] = [];

    // Include the previous tramo if it falls within the contract
    // (e.g. contract started Feb, current tramo is May → show Feb-Apr as past tramo)
    const prevTramoStart = addMonths(currentTramoStart, -c.adjustmentFrequency);
    let currentTramoBase = currentBaseAmount;

    if (prevTramoStart >= contractStartPeriod) {
      // Use previousAmount from the adjustment that triggered the current tramo, if it exists.
      // If no adjustment was applied yet, currentBaseAmount IS the original amount.
      const [lastApp] = await db
        .select({ previousAmount: adjustmentApplication.previousAmount })
        .from(adjustmentApplication)
        .where(and(
          eq(adjustmentApplication.contratoId, participation.contractId),
          eq(adjustmentApplication.adjustmentPeriod, currentTramoStart),
          eq(adjustmentApplication.agencyId, agencyId),
        ))
        .limit(1);

      const prevBase = lastApp ? parseFloat(lastApp.previousAmount) : currentBaseAmount;
      const prevTramoEnd = subOneMonth(currentTramoStart);
      const months: ProyeccionMonth[] = [];
      let accumulated = prevBase;
      let hasProjected = false;

      for (let i = 0; i < c.adjustmentFrequency; i++) {
        const mPeriod = addMonths(prevTramoStart, i);
        if (mPeriod >= currentTramoStart) break;
        const hasPct = valueMap.has(mPeriod);
        const pct = hasPct ? valueMap.get(mPeriod)! : lastKnownPct;
        const isProjected = !hasPct;
        if (isProjected) hasProjected = true;
        accumulated = Math.round(accumulated * (1 + pct / 100) * 100) / 100;
        months.push({ period: mPeriod, pct, amount: accumulated, isProjected });
      }

      const prevNewAmount = months.length > 0 ? months[months.length - 1].amount : prevBase;
      tramos.push({
        tramoStart: prevTramoStart,
        tramoEnd: prevTramoEnd,
        tramoNumber: tramoNumberOf(prevTramoStart, contractStartPeriod, c.adjustmentFrequency),
        baseAmount: prevBase,
        newAmount: prevNewAmount,
        totalPct: prevBase > 0 ? ((prevNewAmount / prevBase - 1) * 100) : 0,
        months,
        hasProjected,
        isPast: true,
      });

      // If the adjustment wasn't applied yet, cascade the projected amount as current tramo base
      if (!lastApp) currentTramoBase = prevNewAmount;
    }

    // Build current tramo + next 2
    let tramoStart = currentTramoStart;
    let baseAmount = currentTramoBase;
    let futureCount = 0;

    while (tramoStart <= contractEndPeriod && futureCount < 3) {
      const tramoEndExcl = addMonths(tramoStart, c.adjustmentFrequency);
      const tramoEnd = subOneMonth(tramoEndExcl);

      const months: ProyeccionMonth[] = [];
      let accumulated = baseAmount;
      let hasProjected = false;

      for (let i = 0; i < c.adjustmentFrequency; i++) {
        const mPeriod = addMonths(tramoStart, i);
        if (mPeriod > contractEndPeriod) break;

        const hasPct = valueMap.has(mPeriod);
        const pct = hasPct ? valueMap.get(mPeriod)! : lastKnownPct;
        const isProjected = !hasPct;
        if (isProjected) hasProjected = true;

        accumulated = Math.round(accumulated * (1 + pct / 100) * 100) / 100;
        months.push({ period: mPeriod, pct, amount: accumulated, isProjected });
      }

      const newAmount = months.length > 0 ? months[months.length - 1].amount : baseAmount;
      const totalPct = baseAmount > 0 ? ((newAmount / baseAmount - 1) * 100) : 0;

      tramos.push({
        tramoStart,
        tramoEnd,
        tramoNumber: tramoNumberOf(tramoStart, contractStartPeriod, c.adjustmentFrequency),
        baseAmount,
        newAmount,
        totalPct,
        months,
        hasProjected,
        isPast: false,
      });

      tramoStart = tramoEndExcl;
      baseAmount = newAmount;
      futureCount++;
    }

    const response: ProyeccionResponse = {
      adjustmentIndex: c.adjustmentIndex,
      adjustmentFrequency: c.adjustmentFrequency,
      endDate: c.endDate,
      tramos,
    };

    return NextResponse.json(response);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("GET /api/tenants/[id]/proyeccion:", error);
    return NextResponse.json({ error: "Error al calcular proyección" }, { status: 500 });
  }
}
