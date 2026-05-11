import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { property } from "@/db/schema/property";
import { cajaMovimiento } from "@/db/schema/caja";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { calculateStatus } from "@/lib/tenants/status";
import { formatAddress } from "@/lib/properties/format-address";
import { groupTenants, type TenantGroup, type EstadoInquilino } from "@/lib/tenants/grouping";

function calcularCompletitud(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

// Lower number = higher priority (most relevant contract to show)
const CONTRACT_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  expiring_soon: 1,
  pending_signature: 2,
  draft: 3,
  expired: 4,
  terminated: 5,
};

function groupMatchesSearch(g: TenantGroup, term: string): boolean {
  const t = term.toLowerCase();
  return [g.primary, ...g.coTenants].some(
    (m) =>
      m.firstName.toLowerCase().includes(t) ||
      (m.lastName?.toLowerCase().includes(t) ?? false) ||
      (m.dni?.toLowerCase().includes(t) ?? false) ||
      (m.phone?.toLowerCase().includes(t) ?? false)
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const estadoFilter = searchParams.get("estado") || "todos";

    // Clients that appear as tenants: those with type="tenant" OR linked in contract_participant as tenant
    const tenantLinks = await db
      .selectDistinct({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        eq(contractParticipant.role, "tenant"),
      ));

    const linkedIds = tenantLinks.map((r) => r.clientId);

    // Combine: type="tenant" OR in contract_participant (role="tenant") to catch legacy client.type rows
    const tenantCondition = linkedIds.length > 0
      ? or(eq(client.type, "tenant"), inArray(client.id, linkedIds))!
      : eq(client.type, "tenant");

    const agencyCondition = eq(client.agencyId, agencyId);

    const allTenants = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        phone: client.phone,
        email: client.email,
        createdAt: client.createdAt,
      })
      .from(client)
      .where(and(agencyCondition, tenantCondition))
      .orderBy(desc(client.createdAt));

    if (allTenants.length === 0) {
      return NextResponse.json({
        groups: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
        stats: { total: 0, conContratoActivo: 0, enMora: 0, pendiente: 0, porVencer: 0, sinContrato: 0, pendienteFirma: 0, historico: 0 },
      });
    }

    const ids = allTenants.map((t) => t.id);

    // Fetch contract_participant createdAt to determine group primary order
    const participantDates = await db
      .select({ clientId: contractParticipant.clientId, createdAt: contractParticipant.createdAt })
      .from(contractParticipant)
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        eq(contractParticipant.role, "tenant"),
        inArray(contractParticipant.clientId, ids),
      ));

    const participantOrder = new Map<string, Date | null>(
      participantDates.map((p) => [p.clientId, p.createdAt])
    );

    // All contracts for these tenants (any status)
    const contracts = await db
      .select({
        clientId: contractParticipant.clientId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractStatus: contract.status,
        startDate: contract.startDate,
        endDate: contract.endDate,
        paymentDay: contract.paymentDay,
        graceDays: contract.graceDays,
        propertyAddress: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
        propertyFloorUnit: property.floorUnit,
      })
      .from(contractParticipant)
      .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        inArray(contractParticipant.clientId, ids),
        eq(contractParticipant.role, "tenant"),
      ));

    // Last income payment per tenant
    const payments = await db
      .select({
        inquilinoId: cajaMovimiento.inquilinoId,
        fecha: cajaMovimiento.date,
      })
      .from(cajaMovimiento)
      .where(
        and(
          eq(cajaMovimiento.agencyId, agencyId),
          inArray(cajaMovimiento.inquilinoId, ids),
          eq(cajaMovimiento.tipo, "income")
        )
      )
      .orderBy(desc(cajaMovimiento.date));

    // Pending ledger entries for status override (punitorios → en_mora; extras → pendiente)
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const pendingLedger = await db
      .select({ inquilinoId: tenantLedger.inquilinoId, tipo: tenantLedger.tipo, period: tenantLedger.period })
      .from(tenantLedger)
      .where(and(
        eq(tenantLedger.agencyId, agencyId),
        inArray(tenantLedger.inquilinoId, ids),
        eq(tenantLedger.estado, "pendiente"),
        inArray(tenantLedger.tipo, ["punitorio", "servicio", "gasto", "deposito"])
      ));

    const ledgerByTenant = new Map<string, { hasPunitorio: boolean; hasPending: boolean }>();
    for (const entry of pendingLedger) {
      const flags = ledgerByTenant.get(entry.inquilinoId) ?? { hasPunitorio: false, hasPending: false };
      if (entry.tipo === "punitorio") {
        flags.hasPunitorio = true;
      } else if (entry.period === currentPeriod || entry.period === prevPeriod || entry.period === null) {
        flags.hasPending = true;
      }
      ledgerByTenant.set(entry.inquilinoId, flags);
    }

    // Best contract per client (by status priority)
    const bestContractByClient = new Map<string, (typeof contracts)[0]>();
    for (const c of contracts) {
      const current = bestContractByClient.get(c.clientId);
      const currentPriority = current ? (CONTRACT_STATUS_PRIORITY[current.contractStatus] ?? 99) : 99;
      const newPriority = CONTRACT_STATUS_PRIORITY[c.contractStatus] ?? 99;
      if (newPriority < currentPriority) {
        bestContractByClient.set(c.clientId, c);
      }
    }

    const lastPaymentByClient = new Map<string, string>();
    for (const p of payments) {
      if (p.inquilinoId && !lastPaymentByClient.has(p.inquilinoId)) {
        lastPaymentByClient.set(p.inquilinoId, p.fecha);
      }
    }

    const enriched = allTenants.map((tenant) => {
      const bestContract = bestContractByClient.get(tenant.id) ?? null;
      const lastPayment = lastPaymentByClient.get(tenant.id) ?? null;
      const { estado: estadoBase, diasMora } = calculateStatus(
        bestContract
          ? {
              endDate: bestContract.endDate,
              paymentDay: bestContract.paymentDay,
              contractStatus: bestContract.contractStatus,
              graceDays: bestContract.graceDays,
            }
          : null,
        lastPayment
      );
      const flags = ledgerByTenant.get(tenant.id);
      let estado = estadoBase as EstadoInquilino;
      if (!["historico", "sin_contrato", "pendiente_firma"].includes(estadoBase)) {
        if (flags?.hasPunitorio) estado = "en_mora";
        else if (estadoBase === "activo" && flags?.hasPending) estado = "pendiente";
      }
      const completitud =
        bestContract && ["active", "expiring_soon"].includes(bestContract.contractStatus)
          ? calcularCompletitud(bestContract.startDate, bestContract.endDate)
          : null;

      let propertyDisplay: string | null = null;
      if (bestContract?.propertyAddress) {
        propertyDisplay = bestContract.propertyAddress;
        if (bestContract.propertyFloorUnit)
          propertyDisplay += `, ${bestContract.propertyFloorUnit}`;
      }

      return {
        ...tenant,
        contrato: bestContract
          ? {
              id: bestContract.contractId,
              numero: bestContract.contractNumber,
              status: bestContract.contractStatus,
              endDate: bestContract.endDate,
              completitud,
            }
          : null,
        property: propertyDisplay,
        ultimoPago: lastPayment,
        estado,
        diasMora,
      };
    });

    const groups = groupTenants(enriched, participantOrder);

    const searched = search
      ? groups.filter((g) => groupMatchesSearch(g, search))
      : groups;

    const filtered =
      estadoFilter === "todos"
        ? searched
        : searched.filter((g) => g.groupEstado === estadoFilter);

    const stats = {
      total: groups.length,
      conContratoActivo: groups.filter((g) =>
        ["activo", "pendiente", "por_vencer", "en_mora"].includes(g.groupEstado)
      ).length,
      enMora:        groups.filter((g) => g.groupEstado === "en_mora").length,
      pendiente:     groups.filter((g) => g.groupEstado === "pendiente").length,
      porVencer:     groups.filter((g) => g.groupEstado === "por_vencer").length,
      sinContrato:   groups.filter((g) => g.groupEstado === "sin_contrato").length,
      pendienteFirma: groups.filter((g) => g.groupEstado === "pendiente_firma").length,
      historico:     groups.filter((g) => g.groupEstado === "historico").length,
    };

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      groups: paginated,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats,
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching tenants:", error);
    return NextResponse.json({ error: "Error al obtener los inquilinos" }, { status: 500 });
  }
}
