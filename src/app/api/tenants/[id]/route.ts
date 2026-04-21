import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { property } from "@/db/schema/property";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { desc, eq } from "drizzle-orm";
import { calculateStatus } from "@/lib/tenants/status";

const CONTRACT_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  expiring_soon: 1,
  pending_signature: 2,
  draft: 3,
  expired: 4,
  terminated: 5,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    // Look up the client by ID (role is derived from contract_tenant, not client.type)
    const [tenant] = await db
      .select()
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    // All contracts where this client is a tenant (any status)
    const tenantContracts = await db
      .select({
        id: contract.id,
        contractNumber: contract.contractNumber,
        propertyId: contract.propertyId,
        ownerId: contract.ownerId,
        status: contract.status,
        contractType: contract.contractType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyAmount: contract.monthlyAmount,
        depositAmount: contract.depositAmount,
        agencyCommission: contract.agencyCommission,
        paymentDay: contract.paymentDay,
        paymentModality: contract.paymentModality,
        adjustmentIndex: contract.adjustmentIndex,
        adjustmentFrequency: contract.adjustmentFrequency,
      })
      .from(contractTenant)
      .innerJoin(contract, eq(contract.id, contractTenant.contractId))
      .where(eq(contractTenant.clientId, id));

    // Pick the most relevant contract
    const bestContract = tenantContracts.sort(
      (a, b) =>
        (CONTRACT_STATUS_PRIORITY[a.status] ?? 99) -
        (CONTRACT_STATUS_PRIORITY[b.status] ?? 99)
    )[0] ?? null;

    // Property (from best contract)
    let propiedad = null;
    if (bestContract) {
      const [prop] = await db
        .select()
        .from(property)
        .where(eq(property.id, bestContract.propertyId))
        .limit(1);
      propiedad = prop ?? null;
    }

    // Owner (from best contract)
    let propietario = null;
    if (bestContract) {
      const [owner] = await db
        .select()
        .from(client)
        .where(eq(client.id, bestContract.ownerId))
        .limit(1);
      propietario = owner ?? null;
    }

    // Movements for this tenant (last 24)
    const movimientos = await db
      .select()
      .from(cajaMovimiento)
      .where(eq(cajaMovimiento.inquilinoId, id))
      .orderBy(desc(cajaMovimiento.date))
      .limit(24);

    const lastPayment = movimientos.find((m) => m.tipo === "income");

    const { estado, diasMora } = calculateStatus(
      bestContract
        ? {
            endDate: bestContract.endDate,
            paymentDay: bestContract.paymentDay,
            contractStatus: bestContract.status,
          }
        : null,
      lastPayment?.date ?? null
    );

    return NextResponse.json({
      tenant: { ...tenant, estado, diasMora },
      contrato: bestContract ?? null,
      property: propiedad,
      owner: propietario,
      movimientos,
    });
  } catch (error) {
    console.error("Error GET /api/tenants/:id:", error);
    return NextResponse.json({ error: "Error al obtener el inquilino" }, { status: 500 });
  }
}
