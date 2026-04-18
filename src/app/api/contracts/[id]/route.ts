import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ADJUSTMENT_INDEXES } from "@/lib/clients/constants";

const patchContractSchema = z.object({
  // Condiciones
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  monthlyAmount: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).optional().nullable(),
  agencyCommission: z.coerce.number().min(0).max(100).optional().nullable(),
  paymentDay: z.coerce.number().int().min(1).max(28).optional(),
  paymentModality: z.enum(["A", "B"]).optional(),
  adjustmentIndex: z.string().min(1).optional(),
  adjustmentFrequency: z.coerce.number().int().min(1).max(12).optional(),
  status: z
    .enum(["draft", "pending_signature", "active", "expiring_soon", "expired", "terminated"])
    .optional(),
  // Partes
  ownerId: z.string().min(1).optional(),
  tenantIds: z.array(z.string().min(1)).min(1).optional(),
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
        paymentDay: contract.paymentDay,
        paymentModality: contract.paymentModality,
        adjustmentIndex: contract.adjustmentIndex,
        adjustmentFrequency: contract.adjustmentFrequency,
        createdAt: contract.createdAt,
        ownerId: contract.ownerId,
        propertyId: contract.propertyId,
        propertyAddress: property.address,
        propertyType: property.type,
        // Servicios de la propiedad
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

    const [ownerData, tenantsData] = await Promise.all([
      db
        .select({
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          whatsapp: client.whatsapp,
          dni: client.dni,
        })
        .from(client)
        .where(eq(client.id, row.ownerId))
        .limit(1),
      db
        .select({
          clientId: contractTenant.clientId,
          role: contractTenant.role,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          whatsapp: client.whatsapp,
          dni: client.dni,
        })
        .from(contractTenant)
        .innerJoin(client, eq(contractTenant.clientId, client.id))
        .where(eq(contractTenant.contractId, id)),
    ]);

    const owner = ownerData[0]
      ? {
          id: ownerData[0].id,
          name: `${ownerData[0].firstName} ${ownerData[0].lastName || ""}`.trim(),
          email: ownerData[0].email,
          phone: ownerData[0].phone || ownerData[0].whatsapp,
          dni: ownerData[0].dni,
        }
      : null;

    const tenants = tenantsData.map((t) => ({
      id: t.clientId,
      name: `${t.firstName} ${t.lastName || ""}`.trim(),
      role: t.role,
      email: t.email,
      phone: t.phone || t.whatsapp,
      dni: t.dni,
    }));

    return NextResponse.json({
      ...row,
      owner,
      tenants,
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

    // Verificar que existe
    const [existing] = await db
      .select({ id: contract.id })
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

    // Construir solo los campos que vienen en el body
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.startDate !== undefined) updates.startDate = data.startDate;
    if (data.endDate !== undefined) updates.endDate = data.endDate;
    if (data.monthlyAmount !== undefined)
      updates.monthlyAmount = data.monthlyAmount.toString();
    if (data.depositAmount !== undefined)
      updates.depositAmount = data.depositAmount?.toString() ?? null;
    if (data.agencyCommission !== undefined)
      updates.agencyCommission = data.agencyCommission?.toString() ?? null;
    if (data.paymentDay !== undefined) updates.paymentDay = data.paymentDay;
    if (data.paymentModality !== undefined)
      updates.paymentModality = data.paymentModality;
    if (data.adjustmentIndex !== undefined) {
      // Verificar que el índice es válido (estándar o custom)
      const isStandard = (ADJUSTMENT_INDEXES as readonly string[]).includes(
        data.adjustmentIndex
      );
      if (!isStandard) {
        // Lo aceptamos igual — los custom índices son strings libres validados al crearlos
        // El formulario solo muestra opciones válidas
      }
      updates.adjustmentIndex = data.adjustmentIndex;
    }
    if (data.adjustmentFrequency !== undefined)
      updates.adjustmentFrequency = data.adjustmentFrequency;
    if (data.status !== undefined) updates.status = data.status;
    if (data.ownerId !== undefined) {
      // Verificar que el propietario existe
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

    if (data.tenantIds !== undefined) {
      // Verificar que todos los inquilinos existen
      const existingTenants = await db
        .select({ id: client.id })
        .from(client)
        .where(inArray(client.id, data.tenantIds));
      if (existingTenants.length !== data.tenantIds.length) {
        return NextResponse.json(
          { error: "Uno o más inquilinos no existen" },
          { status: 400 }
        );
      }

      // Actualizar contrato e inquilinos en una transacción
      await db.transaction(async (tx) => {
        if (Object.keys(updates).length > 1) {
          // > 1 porque siempre tiene updatedAt
          await tx.update(contract).set(updates).where(eq(contract.id, id));
        }
        // Borrar inquilinos anteriores y reinsertar los nuevos
        await tx
          .delete(contractTenant)
          .where(eq(contractTenant.contractId, id));
        await tx.insert(contractTenant).values(
          data.tenantIds!.map((clientId, index) => ({
            contractId: id,
            clientId,
            role: index === 0 ? "primary" : "co-tenant",
          }))
        );
      });

      return NextResponse.json({ message: "Contrato actualizado" });
    }

    await db.update(contract).set(updates).where(eq(contract.id, id));

    return NextResponse.json({ message: "Contrato actualizado" });
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Error al actualizar el contrato" },
      { status: 500 }
    );
  }
}
