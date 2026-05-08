import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { agency } from "@/db/schema/agency";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { defaultFlagsForTipo } from "@/lib/ledger/flags";
import { calcDaysMora } from "@/lib/ledger/mora";
import { and, eq, or, sum, sql, getTableColumns, isNotNull, inArray } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentYear = now.getFullYear().toString();

    // Fetch active contract split metadata
    const [activeContractSplit] = await db
      .select({
        id: contract.id,
        paymentModality: contract.paymentModality,
        managementCommissionPct: contract.managementCommissionPct,
        ownerId: contract.ownerId,
      })
      .from(contract)
      .innerJoin(contractParticipant, eq(contractParticipant.contractId, contract.id))
      .where(
        and(
          eq(contract.agencyId, agencyId),
          eq(contractParticipant.agencyId, agencyId),
          eq(contractParticipant.clientId, id),
          eq(contractParticipant.role, "tenant"),
          inArray(contract.status, ["active", "expiring_soon"])
        )
      )
      .orderBy(contract.createdAt)
      .limit(1);

    // When the tenant is on a shared contract, include all entries for that contract
    // (not just entries with this tenant's inquilinoId) so co-tenants see the same ledger.
    const ledgerContractId = activeContractSplit?.id ?? null;
    const ledgerFilter = ledgerContractId
      ? or(eq(tenantLedger.inquilinoId, id), eq(tenantLedger.contratoId, ledgerContractId))
      : eq(tenantLedger.inquilinoId, id);

    let splitMeta: {
      managementCommissionPct: number;
      ownerName: string;
      ownerCbu: string | null;
      agencyNombre: string | null;
      agenciaCbu: string | null;
      agenciaAlias: string | null;
    } | null = null;

    if (activeContractSplit?.paymentModality === "split") {
      const [ownerRow, agencyRow] = await Promise.all([
        db
          .select({ firstName: client.firstName, lastName: client.lastName, cbu: client.cbu })
          .from(client)
          .where(and(eq(client.id, activeContractSplit.ownerId), eq(client.agencyId, agencyId)))
          .limit(1)
          .then((r) => r[0] ?? null),
        db
          .select({ name: agency.name, bancoCBU: agency.bancoCBU, bancoAlias: agency.bancoAlias })
          .from(agency)
          .where(eq(agency.id, agencyId))
          .limit(1)
          .then((r) => r[0] ?? null),
      ]);

      splitMeta = {
        managementCommissionPct: Number(activeContractSplit.managementCommissionPct ?? 10),
        ownerName: ownerRow
          ? `${ownerRow.firstName} ${ownerRow.lastName ?? ""}`.trim()
          : "Propietario",
        ownerCbu: ownerRow?.cbu ?? null,
        agencyNombre: agencyRow?.name ?? null,
        agenciaCbu: agencyRow?.bancoCBU ?? null,
        agenciaAlias: agencyRow?.bancoAlias ?? null,
      };
    }

    const overdueWithRate = await db
      .select({
        id: tenantLedger.id,
        contratoId: tenantLedger.contratoId,
        inquilinoId: tenantLedger.inquilinoId,
        propietarioId: tenantLedger.propietarioId,
        propiedadId: tenantLedger.propiedadId,
        period: tenantLedger.period,
        dueDate: tenantLedger.dueDate,
        monto: tenantLedger.monto,
        montoPagado: tenantLedger.montoPagado,
        estado: tenantLedger.estado,
        ultimoPagoAt: tenantLedger.ultimoPagoAt,
        lateInterestPct: contract.lateInterestPct,
        graceDays: contract.graceDays,
      })
      .from(tenantLedger)
      .leftJoin(contract, eq(tenantLedger.contratoId, contract.id))
      .where(
        and(
          eq(tenantLedger.agencyId, agencyId),
          ledgerFilter,
          eq(tenantLedger.tipo, "alquiler"),
          inArray(tenantLedger.estado, ["pendiente", "pago_parcial"]),
          sql`${tenantLedger.dueDate}::date + coalesce(${contract.graceDays}, 0) < ${today}::date`,
          isNotNull(contract.lateInterestPct),
        )
      );

    // Cancel any stale auto-generated punitorios for alquileres still within grace period.
    // This self-heals entries created before grace days were considered.
    const pendingAlquilerIds = await db
      .select({ id: tenantLedger.id })
      .from(tenantLedger)
      .where(
        and(
          eq(tenantLedger.agencyId, agencyId),
          ledgerFilter,
          eq(tenantLedger.tipo, "alquiler"),
          inArray(tenantLedger.estado, ["pendiente", "pago_parcial"]),
        )
      )
      .then((rows) => rows.map((r) => r.id));

    const overdueIdSet = new Set(overdueWithRate.map((a) => a.id));
    const inGracePeriodIds = pendingAlquilerIds.filter((id) => !overdueIdSet.has(id));

    if (inGracePeriodIds.length > 0) {
      await db
        .update(tenantLedger)
        .set({ estado: "cancelado", updatedAt: new Date() })
        .where(
          and(
            eq(tenantLedger.agencyId, agencyId),
            eq(tenantLedger.tipo, "punitorio"),
            eq(tenantLedger.isAutoGenerated, true),
            eq(tenantLedger.estado, "pendiente"),
            inArray(tenantLedger.installmentOf, inGracePeriodIds),
          )
        );
    }

    if (overdueWithRate.length > 0) {
      const parentIds = overdueWithRate.map((a) => a.id);

      const existingAuto = await db
        .select({ id: tenantLedger.id, installmentOf: tenantLedger.installmentOf, monto: tenantLedger.monto })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.agencyId, agencyId),
            eq(tenantLedger.tipo, "punitorio"),
            eq(tenantLedger.isAutoGenerated, true),
            eq(tenantLedger.estado, "pendiente"),
            inArray(tenantLedger.installmentOf, parentIds),
          )
        );

      const autoByParent = new Map(existingAuto.map((p) => [p.installmentOf, p]));

      for (const alquiler of overdueWithRate) {
        const dailyRate = Number(alquiler.lateInterestPct) / 100;
        if (dailyRate <= 0 || !alquiler.monto) continue;

        const baseAmount = alquiler.montoPagado !== null
          ? Math.max(0, Number(alquiler.monto) - Number(alquiler.montoPagado))
          : alquiler.estado === "pago_parcial"
            ? 0  // data inconsistency — skip rather than use full amount
            : Number(alquiler.monto);
        if (baseAmount <= 0) continue;

        const fechaBase = alquiler.ultimoPagoAt ?? alquiler.dueDate;
        const graceDays = alquiler.ultimoPagoAt ? 0 : Number(alquiler.graceDays ?? 0);
        const daysMora = calcDaysMora(fechaBase, graceDays);
        if (daysMora <= 0) continue;

        const monto = (baseAmount * dailyRate * daysMora).toFixed(2);
        const descripcion = `Punitorio (${(dailyRate * 100).toFixed(2)}%/día, ${daysMora} días mora)`;

        const existing = autoByParent.get(alquiler.id);
        if (existing) {
          if (Number(existing.monto).toFixed(2) !== monto) {
            await db
              .update(tenantLedger)
              .set({
                monto,
                descripcion,
                updatedAt: new Date(),
                ...(activeContractSplit?.paymentModality === "split" && { beneficiario: "propietario" }),
              })
              .where(and(eq(tenantLedger.id, existing.id), eq(tenantLedger.agencyId, agencyId)));
          }
        } else {
          await db.insert(tenantLedger).values({
            agencyId,
            contratoId: alquiler.contratoId,
            inquilinoId: alquiler.inquilinoId,
            propietarioId: alquiler.propietarioId,
            propiedadId: alquiler.propiedadId,
            period: alquiler.period ?? undefined,
            dueDate: alquiler.dueDate ?? undefined,
            tipo: "punitorio",
            descripcion,
            monto,
            estado: "pendiente",
            installmentOf: alquiler.id,
            isAutoGenerated: true,
            createdBy: session!.user.id,
            ...defaultFlagsForTipo("punitorio"),
            ...(activeContractSplit?.paymentModality === "split" && { beneficiario: "propietario" }),
          });
        }
      }
    }

    const entries = await db
      .select({
        ...getTableColumns(tenantLedger),
        lateInterestPct: contract.lateInterestPct,
        graceDays: contract.graceDays,
      })
      .from(tenantLedger)
      .leftJoin(contract, eq(tenantLedger.contratoId, contract.id))
      .where(and(eq(tenantLedger.agencyId, agencyId), ledgerFilter))
      .orderBy(tenantLedger.period, tenantLedger.tipo);

    const [ytdResult] = await db
      .select({ total: sum(tenantLedger.monto) })
      .from(tenantLedger)
      .where(
        and(
          eq(tenantLedger.agencyId, agencyId),
          ledgerFilter,
          eq(tenantLedger.estado, "conciliado"),
          eq(tenantLedger.tipo, "alquiler"),
          sql`substring(${tenantLedger.period}, 1, 4) = ${currentYear}`
        )
      );

    const nextMonthDate = new Date(now);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthPeriod = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

    const nextMonthAll = entries.filter((e) => e.period === nextMonthPeriod);
    const nextMonthPending = nextMonthAll.filter((e) => e.estado === "pendiente");
    const nextMonthRevision = nextMonthAll.filter((e) => e.estado === "pendiente_revision");
    const nextMonthTotal = nextMonthPending.length > 0
      ? nextMonthPending.reduce((s, e) => s + Number(e.monto ?? 0), 0)
      : null;
    const nextMonthDueDate = nextMonthAll.find((e) => e.tipo === "alquiler")?.dueDate ?? null;
    const nextMonthHasAdjuste = nextMonthRevision.length > 0;

    const lastKnownAlquiler = [...entries]
      .filter((e) => e.tipo === "alquiler" && (e.period ?? "") < nextMonthPeriod && e.monto !== null)
      .pop();
    const montoMinimo = nextMonthTotal === null && lastKnownAlquiler
      ? Number(lastKnownAlquiler.monto)
      : null;

    const firstPendingRevision = entries.find((e) => e.estado === "pendiente_revision");

    const overdueAlquileres = entries.filter((e) => {
      if (e.tipo !== "alquiler") return false;
      if (e.estado !== "pendiente" && e.estado !== "pago_parcial") return false;
      if (!e.dueDate) return false;
      const effectiveDue = new Date(e.dueDate + "T00:00:00");
      effectiveDue.setDate(effectiveDue.getDate() + Number(e.graceDays ?? 0));
      return effectiveDue.toISOString().slice(0, 10) < today;
    });
    const hayMora = overdueAlquileres.length > 0;

    const capitalEnMora = overdueAlquileres.reduce((s, e) => {
      let saldo: number;
      if (e.estado === "pago_parcial") {
        saldo = e.montoPagado !== null
          ? Math.max(0, Number(e.monto ?? 0) - Number(e.montoPagado))
          : 0;  // data inconsistency — exclude rather than overcount
      } else {
        saldo = Number(e.monto ?? 0);
      }
      return s + saldo;
    }, 0);
    const interesesEnMora = entries
      .filter((e) => e.tipo === "punitorio" && e.estado === "pendiente")
      .reduce((s, e) => s + Number(e.monto ?? 0), 0);

    const pagosConFecha = entries.filter(
      (e) => e.tipo === "alquiler" && e.estado === "conciliado" && e.conciliadoAt !== null && e.dueDate !== null
    );
    const diasPromedioPago = pagosConFecha.length > 0
      ? Math.round(
          pagosConFecha.reduce((s, e) => {
            const due = new Date(e.dueDate!).getTime();
            const paid = new Date(e.conciliadoAt!).getTime();
            return s + (paid - due) / (1000 * 60 * 60 * 24);
          }, 0) / pagosConFecha.length
        )
      : null;

    const kpis = {
      estadoCuenta: hayMora ? "en_mora" : "al_dia",
      moraDetalle: hayMora
        ? { capital: capitalEnMora, intereses: interesesEnMora, total: capitalEnMora + interesesEnMora }
        : null,
      totalCobradoYTD: Number(ytdResult?.total ?? 0),
      diasPromedioPago,
      proximoPago: nextMonthAll.length > 0
        ? { total: nextMonthTotal, montoMinimo, fecha: nextMonthDueDate, tieneAjuste: nextMonthHasAdjuste }
        : null,
    };

    const proximoAjuste = firstPendingRevision
      ? {
          period: firstPendingRevision.period,
          mesesRestantes: firstPendingRevision.period
            ? Math.max(
                0,
                (parseInt(firstPendingRevision.period.slice(0, 4)) - now.getFullYear()) * 12 +
                  (parseInt(firstPendingRevision.period.slice(5, 7)) - (now.getMonth() + 1))
              )
            : null,
        }
      : null;

    return NextResponse.json({
      kpis,
      ledgerEntries: entries,
      proximoAjuste,
      splitMeta,
      contractId: activeContractSplit?.id ?? null,
      paymentModality: activeContractSplit?.paymentModality ?? null,
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/tenants/:id/cuenta-corriente:", error);
    return NextResponse.json({ error: "Error al obtener la cuenta corriente" }, { status: 500 });
  }
}
