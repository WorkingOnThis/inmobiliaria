import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { guarantee } from "@/db/schema/guarantee";
import { contractDocument } from "@/db/schema/contract-document";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { user } from "@/db/schema/better-auth";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, inArray, and, ne, or } from "drizzle-orm";
import { z } from "zod";
import { ADJUSTMENT_INDEXES } from "@/lib/clients/constants";

const patchContractSchema = z.object({
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  monthlyAmount: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).optional().nullable(),
  agencyCommission: z.coerce.number().min(0).max(100).optional().nullable(),
  managementCommissionPct: z.coerce.number().min(0).max(100).optional().nullable(),
  paymentDay: z.coerce.number().int().min(1).max(28).optional(),
  paymentModality: z.enum(["A", "B", "split"]).optional(),
  adjustmentIndex: z.string().min(1).optional(),
  adjustmentFrequency: z.coerce.number().int().min(1).max(12).optional(),
  status: z
    .enum(["draft", "pending_signature", "active", "expiring_soon", "expired", "terminated"])
    .optional(),
  ownerId: z.string().min(1).optional(),
  graceDays: z.coerce.number().int().min(0).max(31).optional(),
  electronicPaymentFeePct: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  lateInterestPct: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  isRenewal: z.boolean().optional(),
  ledgerStartDate: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [row] = await db
      .select({
        id: contract.id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        contractType: contract.contractType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyAmount: contract.monthlyAmount,
        depositAmount: contract.depositAmount,
        agencyCommission: contract.agencyCommission,
        managementCommissionPct: contract.managementCommissionPct,
        paymentDay: contract.paymentDay,
        paymentModality: contract.paymentModality,
        adjustmentIndex: contract.adjustmentIndex,
        adjustmentFrequency: contract.adjustmentFrequency,
        graceDays: contract.graceDays,
        electronicPaymentFeePct: contract.electronicPaymentFeePct,
        lateInterestPct: contract.lateInterestPct,
        isRenewal: contract.isRenewal,
        ledgerStartDate: contract.ledgerStartDate,
        createdAt: contract.createdAt,
        ownerId: contract.ownerId,
        propertyId: contract.propertyId,
        propertyAddress: property.address,
        propertyType: property.type,
        propertyFloorUnit: property.floorUnit,
        propertyZone: property.zone,
        serviceElectricity: property.serviceElectricity,
        serviceGas: property.serviceGas,
        serviceWater: property.serviceWater,
        serviceCouncil: property.serviceCouncil,
        serviceStateTax: property.serviceStateTax,
        serviceHoa: property.serviceHoa,
      })
      .from(contract)
      .leftJoin(property, eq(contract.propertyId, property.id))
      .where(eq(contract.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const [ownerData, participantsData, guaranteesData, documentsData] =
      await Promise.all([
        db
          .select({
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            whatsapp: client.whatsapp,
            dni: client.dni,
            cuit: client.cuit,
            address: client.address,
            type: client.type,
          })
          .from(client)
          .where(eq(client.id, row.ownerId))
          .limit(1),
        db
          .select({
            id: contractParticipant.id,
            role: contractParticipant.role,
            clientId: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            whatsapp: client.whatsapp,
            dni: client.dni,
            cuit: client.cuit,
            address: client.address,
            type: client.type,
          })
          .from(contractParticipant)
          .innerJoin(client, eq(contractParticipant.clientId, client.id))
          .where(eq(contractParticipant.contractId, id)),
        db
          .select({
            id: guarantee.id,
            kind: guarantee.kind,
            personClientId: guarantee.personClientId,
            propertyId: guarantee.propertyId,
            depositAmount: guarantee.depositAmount,
            depositCurrency: guarantee.depositCurrency,
            depositHeldBy: guarantee.depositHeldBy,
            createdAt: guarantee.createdAt,
            guarantorFirstName: client.firstName,
            guarantorLastName: client.lastName,
            guarantorDni: client.dni,
            guarantorCuit: client.cuit,
            guarantorAddress: client.address,
            guarantorPhone: client.phone,
            guarantorEmail: client.email,
          })
          .from(guarantee)
          .leftJoin(client, eq(guarantee.personClientId, client.id))
          .where(eq(guarantee.contractId, id)),
        db
          .select({
            id: contractDocument.id,
            name: contractDocument.name,
            url: contractDocument.url,
            uploadedBy: contractDocument.uploadedBy,
            createdAt: contractDocument.createdAt,
            uploaderName: user.name,
          })
          .from(contractDocument)
          .leftJoin(user, eq(contractDocument.uploadedBy, user.id))
          .where(eq(contractDocument.contractId, id))
          .orderBy(contractDocument.createdAt),
      ]);

    const ownerRow = ownerData[0];
    const owner = ownerRow
      ? {
          id: ownerRow.id,
          name: `${ownerRow.firstName} ${ownerRow.lastName || ""}`.trim(),
          email: ownerRow.email,
          phone: ownerRow.phone || ownerRow.whatsapp,
          dni: ownerRow.dni,
          cuit: ownerRow.cuit,
          address: ownerRow.address,
          type: ownerRow.type,
        }
      : null;

    // Legacy compat: expose tenants array from participants
    const tenants = participantsData
      .filter((p) => p.role === "tenant")
      .map((p) => ({
        id: p.clientId,
        name: `${p.firstName} ${p.lastName || ""}`.trim(),
        role: p.role,
        email: p.email,
        phone: p.phone || p.whatsapp,
        dni: p.dni,
      }));

    const participants = participantsData.map((p) => ({
      id: p.id,
      role: p.role,
      client: {
        id: p.clientId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone || p.whatsapp,
        dni: p.dni,
        cuit: p.cuit,
        address: p.address,
        type: p.type,
      },
    }));

    type GuarantorInfo = {
      id: string;
      firstName: string | null;
      lastName: string | null;
      dni: string | null;
      cuit: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
    };

    // For propertyOwner guarantees: resolve the legal owner of the guarantee property
    const propertyGuaranteeIds = guaranteesData
      .filter((g) => g.kind === "propertyOwner" && g.propertyId)
      .map((g) => g.propertyId!);

    const legalOwnerByPropertyId = new Map<string, GuarantorInfo>();

    if (propertyGuaranteeIds.length > 0) {
      const coOwnerRows = await db
        .select({
          propertyId: propertyCoOwner.propertyId,
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          cuit: client.cuit,
          address: client.address,
          phone: client.phone,
          email: client.email,
        })
        .from(propertyCoOwner)
        .innerJoin(client, eq(client.id, propertyCoOwner.clientId))
        .where(
          and(
            inArray(propertyCoOwner.propertyId, propertyGuaranteeIds),
            or(eq(propertyCoOwner.role, "legal"), eq(propertyCoOwner.role, "ambos"))
          )
        );

      for (const row of coOwnerRows) {
        if (!legalOwnerByPropertyId.has(row.propertyId)) {
          legalOwnerByPropertyId.set(row.propertyId, row);
        }
      }

      const missingPropertyIds = propertyGuaranteeIds.filter(
        (pid) => !legalOwnerByPropertyId.has(pid)
      );

      if (missingPropertyIds.length > 0) {
        const fallbackRows = await db
          .select({
            propertyId: property.id,
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            dni: client.dni,
            cuit: client.cuit,
            address: client.address,
            phone: client.phone,
            email: client.email,
          })
          .from(property)
          .innerJoin(client, eq(client.id, property.ownerId))
          .where(inArray(property.id, missingPropertyIds));

        for (const row of fallbackRows) {
          legalOwnerByPropertyId.set(row.propertyId, row);
        }
      }
    }

    const guarantees = guaranteesData.map((g) => {
      let guarantorInfo: GuarantorInfo | null = null;
      if (g.kind === "salaryReceipt" && g.personClientId) {
        guarantorInfo = {
          id: g.personClientId,
          firstName: g.guarantorFirstName,
          lastName: g.guarantorLastName,
          dni: g.guarantorDni,
          cuit: g.guarantorCuit,
          address: g.guarantorAddress,
          phone: g.guarantorPhone,
          email: g.guarantorEmail,
        };
      } else if (g.kind === "propertyOwner" && g.propertyId) {
        guarantorInfo = legalOwnerByPropertyId.get(g.propertyId) ?? null;
      }

      return {
        id: g.id,
        type: g.kind === "salaryReceipt" ? "personal" : "real",
        clientId: guarantorInfo?.id ?? null,
        propertyId: g.propertyId ?? null,
        externalAddress: null,
        externalCadastralRef: null,
        externalOwnerName: null,
        externalOwnerDni: null,
        createdAt: g.createdAt,
        guarantor: guarantorInfo
          ? {
              firstName: guarantorInfo.firstName,
              lastName: guarantorInfo.lastName,
              dni: guarantorInfo.dni,
              cuit: guarantorInfo.cuit,
              address: guarantorInfo.address,
              phone: guarantorInfo.phone,
              email: guarantorInfo.email,
            }
          : null,
      };
    });

    const documents = documentsData.map((d) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      uploadedBy: d.uploadedBy,
      uploaderName: d.uploaderName,
      createdAt: d.createdAt,
    }));

    return NextResponse.json({
      ...row,
      owner,
      tenants,
      participants,
      guarantees,
      documents,
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Error al obtener el contrato" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: contract.id, status: contract.status })
      .from(contract)
      .where(eq(contract.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = patchContractSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = result.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.startDate !== undefined) updates.startDate = data.startDate;
    if (data.endDate !== undefined) updates.endDate = data.endDate;
    if (data.monthlyAmount !== undefined)
      updates.monthlyAmount = data.monthlyAmount.toString();
    if (data.depositAmount !== undefined)
      updates.depositAmount = data.depositAmount?.toString() ?? null;
    if (data.agencyCommission !== undefined)
      updates.agencyCommission = data.agencyCommission?.toString() ?? null;
    if (data.managementCommissionPct !== undefined)
      updates.managementCommissionPct = data.managementCommissionPct?.toString() ?? "10";
    if (data.paymentDay !== undefined) updates.paymentDay = data.paymentDay;
    if (data.paymentModality !== undefined)
      updates.paymentModality = data.paymentModality;
    if (data.adjustmentIndex !== undefined) {
      const isStandard = (ADJUSTMENT_INDEXES as readonly string[]).includes(
        data.adjustmentIndex
      );
      if (!isStandard) {
        // custom indexes accepted as-is
      }
      updates.adjustmentIndex = data.adjustmentIndex;
    }
    if (data.adjustmentFrequency !== undefined)
      updates.adjustmentFrequency = data.adjustmentFrequency;
    if (data.status !== undefined) updates.status = data.status;
    if (data.ownerId !== undefined) {
      const [existingOwner] = await db
        .select({ id: client.id })
        .from(client)
        .where(eq(client.id, data.ownerId))
        .limit(1);
      if (!existingOwner) {
        return NextResponse.json(
          { error: "El propietario no existe" },
          { status: 400 }
        );
      }
      updates.ownerId = data.ownerId;
    }
    if (data.graceDays !== undefined) updates.graceDays = data.graceDays;
    if (data.electronicPaymentFeePct !== undefined) updates.electronicPaymentFeePct = data.electronicPaymentFeePct;
    if (data.lateInterestPct !== undefined) updates.lateInterestPct = data.lateInterestPct;
    if (data.isRenewal !== undefined) updates.isRenewal = data.isRenewal;
    if (data.ledgerStartDate !== undefined) updates.ledgerStartDate = data.ledgerStartDate;

    const activating =
      data.status === "active" && existing.status !== "active";

    await db.transaction(async (tx) => {
      await tx.update(contract).set(updates).where(eq(contract.id, id));

      if (activating) {
        const tenantParticipants = await tx
          .select({ clientId: contractParticipant.clientId })
          .from(contractParticipant)
          .where(
            and(
              eq(contractParticipant.contractId, id),
              eq(contractParticipant.role, "tenant")
            )
          );

        for (const p of tenantParticipants) {
          await tx
            .update(client)
            .set({ type: "tenant" })
            .where(
              and(eq(client.id, p.clientId), ne(client.type, "tenant"))
            );
        }
      }
    });

    return NextResponse.json({ message: "Contrato actualizado" });
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Error al actualizar el contrato" },
      { status: 500 }
    );
  }
}
