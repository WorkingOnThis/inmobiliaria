import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { CONTRACT_TYPES } from "@/lib/clients/constants";
import { z } from "zod";
import { count, desc, eq, and, inArray, or, ilike } from "drizzle-orm";

const createContractSchema = z.object({
  propertyId: z.string().min(1, "La propiedad es requerida"),
  tenantIds: z
    .array(z.string().min(1))
    .min(1, "Al menos un inquilino es requerido"),
  guarantorIds: z.array(z.string().min(1)).optional().default([]),
  ownerId: z.string().min(1, "El propietario es requerido"),
  contractType: z.enum(CONTRACT_TYPES, {
    errorMap: () => ({ message: "Tipo de contrato inválido" }),
  }),
  startDate: z.string().min(1, "La fecha de inicio es requerida"),
  endDate: z.string().min(1, "La fecha de fin es requerida"),
  monthlyAmount: z.coerce.number().positive("El monto mensual debe ser mayor a 0"),
  depositAmount: z.coerce.number().min(0).optional().nullable(),
  agencyCommission: z.coerce.number().min(0).max(100).optional().nullable(),
  managementCommissionPct: z.coerce.number().min(0).max(100).optional().nullable(),
  paymentDay: z.coerce.number().int().min(1).max(28),
  paymentModality: z.enum(["A", "B"]).default("A"),
  adjustmentIndex: z.string().min(1).default("none"),
  adjustmentFrequency: z.coerce.number().int().min(1).max(12).default(12),
  isImported: z.boolean().optional().default(false),
  ledgerStartDate: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const offset = (page - 1) * limit;
    const statusFilter = searchParams.get("status") || "";
    const q = searchParams.get("q") || "";
    const propertyIdFilter = searchParams.get("propertyId") || "";

    const conditions = [];
    if (statusFilter === "activos") {
      conditions.push(inArray(contract.status, ["active", "expiring_soon"]));
    } else if (statusFilter) {
      conditions.push(eq(contract.status, statusFilter));
    }
    if (propertyIdFilter) {
      conditions.push(eq(contract.propertyId, propertyIdFilter));
    }
    if (q) {
      conditions.push(
        or(
          ilike(contract.contractNumber, `%${q}%`),
          ilike(property.address, `%${q}%`)
        )
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [contractsData, [totalResult], statusCountsRaw] = await Promise.all([
      db
        .select({
          id: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
          contractType: contract.contractType,
          startDate: contract.startDate,
          endDate: contract.endDate,
          monthlyAmount: contract.monthlyAmount,
          adjustmentIndex: contract.adjustmentIndex,
          adjustmentFrequency: contract.adjustmentFrequency,
          paymentModality: contract.paymentModality,
          createdAt: contract.createdAt,
          propertyAddress: property.address,
          propertyType: property.type,
          ownerId: contract.ownerId,
          propertyId: contract.propertyId,
        })
        .from(contract)
        .leftJoin(property, eq(contract.propertyId, property.id))
        .where(where)
        .orderBy(desc(contract.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(contract).where(where),
      db
        .select({ status: contract.status, cnt: count() })
        .from(contract)
        .groupBy(contract.status),
    ]);

    const enriched = await Promise.all(
      contractsData.map(async (c) => {
        const [ownerData, tenantsData] = await Promise.all([
          db
            .select({ firstName: client.firstName, lastName: client.lastName })
            .from(client)
            .where(eq(client.id, c.ownerId))
            .limit(1),
          db
            .select({
              clientId: contractParticipant.clientId,
              role: contractParticipant.role,
              firstName: client.firstName,
              lastName: client.lastName,
            })
            .from(contractParticipant)
            .innerJoin(client, eq(contractParticipant.clientId, client.id))
            .where(
              and(
                eq(contractParticipant.contractId, c.id),
                eq(contractParticipant.role, "tenant")
              )
            ),
        ]);

        const tenantNames = tenantsData.map((t) =>
          `${t.firstName} ${t.lastName || ""}`.trim()
        );

        return {
          ...c,
          tenantNames,
          tenantIds: tenantsData.map((t) => t.clientId),
          ownerName: ownerData[0]
            ? `${ownerData[0].firstName} ${ownerData[0].lastName || ""}`.trim()
            : "-",
        };
      })
    );

    const countsMap: Record<string, number> = {};
    for (const row of statusCountsRaw) {
      countsMap[row.status] = Number(row.cnt);
    }

    return NextResponse.json({
      contracts: enriched,
      pagination: {
        total: Number(totalResult.value),
        page,
        limit,
        totalPages: Math.ceil(Number(totalResult.value) / limit),
      },
      counts: {
        active: countsMap["active"] ?? 0,
        draft: countsMap["draft"] ?? 0,
        expiring_soon: countsMap["expiring_soon"] ?? 0,
        terminated: countsMap["terminated"] ?? 0,
        expired: countsMap["expired"] ?? 0,
        pending_signature: countsMap["pending_signature"] ?? 0,
      },
    });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json({ error: "Error al obtener contratos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createContractSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    const [existingProperty] = await db
      .select()
      .from(property)
      .where(eq(property.id, data.propertyId))
      .limit(1);
    if (!existingProperty) {
      return NextResponse.json({ error: "La propiedad no existe" }, { status: 400 });
    }

    const allClientIds = [...data.tenantIds, ...data.guarantorIds];
    const existingClients = await db
      .select({ id: client.id })
      .from(client)
      .where(inArray(client.id, allClientIds));
    if (existingClients.length !== allClientIds.length) {
      return NextResponse.json(
        { error: "Uno o más participantes no existen" },
        { status: 400 }
      );
    }

    const [existingOwner] = await db
      .select()
      .from(client)
      .where(eq(client.id, data.ownerId))
      .limit(1);
    if (!existingOwner) {
      return NextResponse.json({ error: "El propietario no existe" }, { status: 400 });
    }

    const [last] = await db
      .select({ contractNumber: contract.contractNumber })
      .from(contract)
      .orderBy(desc(contract.contractNumber))
      .limit(1);

    const nextNum = last
      ? parseInt(last.contractNumber.replace("CON-", ""), 10) + 1
      : 1;
    const contractNumber = `CON-${String(nextNum).padStart(4, "0")}`;

    const contractId = crypto.randomUUID();
    const now = new Date();

    const [newContract] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(contract)
        .values({
          id: contractId,
          contractNumber,
          propertyId: data.propertyId,
          ownerId: data.ownerId,
          status: data.isImported ? "active" : "draft",
          contractType: data.contractType,
          startDate: data.startDate,
          endDate: data.endDate,
          monthlyAmount: data.monthlyAmount.toString(),
          depositAmount: data.depositAmount?.toString() ?? null,
          agencyCommission: data.agencyCommission?.toString() ?? null,
          managementCommissionPct: data.managementCommissionPct?.toString() ?? "10",
          paymentDay: data.paymentDay,
          paymentModality: data.paymentModality,
          adjustmentIndex: data.adjustmentIndex,
          adjustmentFrequency: data.adjustmentFrequency,
          ledgerStartDate: data.ledgerStartDate ?? null,
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const participantRows = [
        { contractId, clientId: data.ownerId, role: "owner" as const },
        ...data.tenantIds.map((clientId) => ({
          contractId,
          clientId,
          role: "tenant" as const,
        })),
        ...data.guarantorIds.map((clientId) => ({
          contractId,
          clientId,
          role: "guarantor" as const,
        })),
      ];

      await tx.insert(contractParticipant).values(participantRows);

      return inserted;
    });

    return NextResponse.json(
      { message: `Contrato ${contractNumber} creado`, contract: newContract },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json({ error: "Error al crear el contrato" }, { status: 500 });
  }
}
