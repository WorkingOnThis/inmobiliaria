import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { contractParticipant } from "@/db/schema/contract-participant";
import { property } from "@/db/schema/property";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { calculateStatus } from "@/lib/tenants/status";
import { guarantee } from "@/db/schema/guarantee";
import { guaranteeSalaryInfo } from "@/db/schema/guarantee-salary-info";

const patchTenantSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  cuit: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  condicionFiscal: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  status: z.enum(["activo", "suspendido", "baja"]).optional(),
  addressStreet: z.string().trim().max(200).optional().nullable(),
  addressNumber: z.string().trim().max(20).optional().nullable(),
  addressZone: z.string().trim().max(100).optional().nullable(),
  addressCity: z.string().trim().max(100).optional().nullable(),
  addressProvince: z.string().trim().max(100).optional().nullable(),
});

const CONTRACT_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  expiring_soon: 1,
  pending_signature: 2,
  draft: 3,
  expired: 4,
  terminated: 5,
};

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json();
    const result = patchTenantSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [existing] = await db.select({ id: client.id }).from(client).where(eq(client.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const statusMap: Record<string, string> = { activo: "active", suspendido: "suspended", baja: "inactive" };
    const data = {
      ...result.data,
      ...(result.data.status ? { status: statusMap[result.data.status] ?? result.data.status } : {}),
    };

    const [updated] = await db
      .update(client)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(client.id, id))
      .returning();

    return NextResponse.json({ tenant: updated });
  } catch (error) {
    console.error("Error PATCH /api/tenants/:id:", error);
    return NextResponse.json({ error: "Error al actualizar el inquilino" }, { status: 500 });
  }
}

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

    const contractFields = {
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
    };

    // All contracts where this client is a tenant — check both link tables
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

    // Enrich with property address for each contract
    const contractPropIds = [...new Set(tenantContractsRaw.map((c) => c.propertyId))];
    const contractProps = contractPropIds.length > 0
      ? await db
          .select({ id: property.id, address: property.address })
          .from(property)
          .where(inArray(property.id, contractPropIds))
      : [];
    const contractPropMap: Record<string, string> = {};
    for (const p of contractProps) contractPropMap[p.id] = p.address;

    const tenantContracts = tenantContractsRaw.map((c) => ({
      ...c,
      propertyAddress: contractPropMap[c.propertyId] ?? null,
    }));

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

    // Guarantees for all contracts of this tenant
    const guaranteeRows = await db
      .select({
        guarantee: guarantee,
        salaryInfo: guaranteeSalaryInfo,
        property: {
          id: property.id,
          address: property.address,
          type: property.type,
        },
        personClient: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          phone: client.phone,
          email: client.email,
        },
      })
      .from(guarantee)
      .leftJoin(guaranteeSalaryInfo, eq(guaranteeSalaryInfo.guaranteeId, guarantee.id))
      .leftJoin(property, eq(property.id, guarantee.propertyId))
      .leftJoin(client, eq(client.id, guarantee.personClientId))
      .where(eq(guarantee.tenantClientId, id));

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
      contratos: tenantContracts,
      property: propiedad,
      owner: propietario,
      movimientos,
      guarantees: guaranteeRows,
    });
  } catch (error) {
    console.error("Error GET /api/tenants/:id:", error);
    return NextResponse.json({ error: "Error al obtener el inquilino" }, { status: 500 });
  }
}
