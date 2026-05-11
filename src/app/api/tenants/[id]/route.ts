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
import { formatAddress } from "@/lib/properties/format-address";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
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
  emailDefault: z.boolean().optional(),
  trustedEmails: z.array(z.object({
    email: z.string().email(),
    label: z.string().optional(),
    sendDefault: z.boolean(),
  })).optional(),
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
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = patchTenantSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    await requireAgencyResource(client, id, agencyId);

    const statusMap: Record<string, string> = { activo: "active", suspendido: "suspended", baja: "inactive" };
    const { trustedEmails, ...rest } = result.data;
    const data = {
      ...rest,
      ...(rest.status ? { status: statusMap[rest.status] ?? rest.status } : {}),
      ...(trustedEmails !== undefined ? { trustedEmails: JSON.stringify(trustedEmails) } : {}),
    };

    const [updated] = await db
      .update(client)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(client.id, id), eq(client.agencyId, agencyId)))
      .returning();

    return NextResponse.json({ tenant: updated });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
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
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId);

    // Look up the client by ID (role is derived from contract_tenant, not client.type)
    const [tenant] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.agencyId, agencyId)))
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
      managementCommissionPct: contract.managementCommissionPct,
      paymentDay: contract.paymentDay,
      graceDays: contract.graceDays,
      paymentModality: contract.paymentModality,
      adjustmentIndex: contract.adjustmentIndex,
      adjustmentFrequency: contract.adjustmentFrequency,
    };

    const tenantContractsRaw = await db
      .select(contractFields)
      .from(contractParticipant)
      .innerJoin(contract, eq(contract.id, contractParticipant.contractId))
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        eq(contractParticipant.clientId, id),
        eq(contractParticipant.role, "tenant"),
      ));

    // Enrich with property address for each contract
    const contractPropIds = [...new Set(tenantContractsRaw.map((c) => c.propertyId))];
    const contractProps = contractPropIds.length > 0
      ? await db
          .select({ id: property.id, addressStreet: property.addressStreet, addressNumber: property.addressNumber, floorUnit: property.floorUnit })
          .from(property)
          .where(and(eq(property.agencyId, agencyId), inArray(property.id, contractPropIds)))
      : [];
    const contractPropMap: Record<string, string> = {};
    for (const p of contractProps) contractPropMap[p.id] = formatAddress({ addressStreet: p.addressStreet ?? "", addressNumber: p.addressNumber, floorUnit: p.floorUnit });

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

    const [propiedad, propietario] = bestContract
      ? await Promise.all([
          db.select().from(property).where(and(eq(property.id, bestContract.propertyId), eq(property.agencyId, agencyId))).limit(1).then((r) => r[0] ?? null),
          db.select().from(client).where(and(eq(client.id, bestContract.ownerId), eq(client.agencyId, agencyId))).limit(1).then((r) => r[0] ?? null),
        ])
      : [null, null];

    // Movements for this tenant (last 24)
    const movimientos = await db
      .select()
      .from(cajaMovimiento)
      .where(and(eq(cajaMovimiento.agencyId, agencyId), eq(cajaMovimiento.inquilinoId, id)))
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
          addressStreet: property.addressStreet,
          addressNumber: property.addressNumber,
          floorUnit: property.floorUnit,
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
      .where(and(eq(guarantee.agencyId, agencyId), eq(guarantee.tenantClientId, id)));

    const { estado: estadoBase, diasMora } = calculateStatus(
      bestContract
        ? {
            endDate: bestContract.endDate,
            paymentDay: bestContract.paymentDay,
            contractStatus: bestContract.status,
            graceDays: bestContract.graceDays,
          }
        : null,
      lastPayment?.date ?? null
    );

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const pendingLedgerEntries = await db
      .select({ tipo: tenantLedger.tipo, period: tenantLedger.period })
      .from(tenantLedger)
      .where(and(
        eq(tenantLedger.agencyId, agencyId),
        eq(tenantLedger.inquilinoId, id),
        eq(tenantLedger.estado, "pendiente"),
        inArray(tenantLedger.tipo, ["punitorio", "servicio", "gasto", "deposito"])
      ));

    let estado = estadoBase;
    if (!["historico", "sin_contrato", "pendiente_firma"].includes(estadoBase)) {
      const hasPunitorio = pendingLedgerEntries.some(e => e.tipo === "punitorio");
      const hasPending = pendingLedgerEntries.some(
        e => e.tipo !== "punitorio" && (e.period === currentPeriod || e.period === prevPeriod || e.period === null)
      );
      if (hasPunitorio) estado = "en_mora";
      else if (estadoBase === "activo" && hasPending) estado = "pendiente";
    }

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
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/tenants/:id:", error);
    return NextResponse.json({ error: "Error al obtener el inquilino" }, { status: 500 });
  }
}
