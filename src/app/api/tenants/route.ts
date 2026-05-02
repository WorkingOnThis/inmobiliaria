import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { property } from "@/db/schema/property";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { calculateStatus } from "@/lib/tenants/status";

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

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const estadoFilter = searchParams.get("estado") || "todos";

    // Clients that appear as tenants: those with type="tenant" OR linked in contract_participant as tenant
    const tenantLinks = await db
      .selectDistinct({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(eq(contractParticipant.role, "tenant"));

    const linkedIds = tenantLinks.map((r) => r.clientId);

    // Combine: type="tenant" OR in contract_tenant (avoid duplicates via OR in SQL)
    const tenantCondition = linkedIds.length > 0
      ? or(eq(client.type, "tenant"), inArray(client.id, linkedIds))!
      : eq(client.type, "tenant");

    const searchCondition = search
      ? and(
          tenantCondition,
          or(
            ilike(client.firstName, `%${search}%`),
            ilike(client.lastName, `%${search}%`),
            ilike(client.dni, `%${search}%`),
            ilike(client.phone, `%${search}%`)
          )
        )
      : tenantCondition;

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
      .where(searchCondition)
      .orderBy(desc(client.createdAt));

    if (allTenants.length === 0) {
      return NextResponse.json({
        tenants: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
        stats: { total: 0, conContratoActivo: 0, enMora: 0, porVencer: 0, sinContrato: 0, pendienteFirma: 0, historico: 0 },
      });
    }

    const ids = allTenants.map((t) => t.id);

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
        propertyAddress: property.address,
        propertyFloorUnit: property.floorUnit,
      })
      .from(contractParticipant)
      .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(and(inArray(contractParticipant.clientId, ids), eq(contractParticipant.role, "tenant")));

    // Last income payment per tenant
    const payments = await db
      .select({
        inquilinoId: cajaMovimiento.inquilinoId,
        fecha: cajaMovimiento.date,
      })
      .from(cajaMovimiento)
      .where(
        and(
          inArray(cajaMovimiento.inquilinoId, ids),
          eq(cajaMovimiento.tipo, "income")
        )
      )
      .orderBy(desc(cajaMovimiento.date));

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
      const { estado, diasMora } = calculateStatus(
        bestContract
          ? {
              endDate: bestContract.endDate,
              paymentDay: bestContract.paymentDay,
              contractStatus: bestContract.contractStatus,
            }
          : null,
        lastPayment
      );
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

    const stats = {
      total: enriched.length,
      conContratoActivo: enriched.filter((t) => ["activo", "por_vencer", "en_mora"].includes(t.estado)).length,
      enMora: enriched.filter((t) => t.estado === "en_mora").length,
      porVencer: enriched.filter((t) => t.estado === "por_vencer").length,
      sinContrato: enriched.filter((t) => t.estado === "sin_contrato").length,
      pendienteFirma: enriched.filter((t) => t.estado === "pendiente_firma").length,
      historico: enriched.filter((t) => t.estado === "historico").length,
    };

    const filtered =
      estadoFilter === "todos"
        ? enriched
        : enriched.filter((t) => t.estado === estadoFilter);

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      tenants: paginated,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats,
    });
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json({ error: "Error al obtener los inquilinos" }, { status: 500 });
  }
}
