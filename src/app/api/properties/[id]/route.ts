import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { client } from "@/db/schema/client";
import { guarantee } from "@/db/schema/guarantee";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updatePropertySchema = z.object({
  title: z.string().optional().nullable(),
  address: z.string().min(1).optional(),
  type: z.string().optional(),
  rentalStatus: z.enum(["available", "rented", "reserved", "maintenance"]).optional(),
  saleStatus: z.enum(["for_sale", "sold"]).optional().nullable(),
  rentalPrice: z.coerce.number().optional().nullable(),
  rentalPriceCurrency: z.enum(["ARS", "USD"]).optional(),
  salePrice: z.coerce.number().optional().nullable(),
  salePriceCurrency: z.enum(["ARS", "USD"]).optional(),
  zone: z.string().optional().nullable(),
  floorUnit: z.string().optional().nullable(),
  rooms: z.coerce.number().int().min(0).optional().nullable(),
  bedrooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  surface: z.coerce.number().optional().nullable(),
  surfaceBuilt: z.coerce.number().optional().nullable(),
  surfaceLand: z.coerce.number().optional().nullable(),
  yearBuilt: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  condition: z.enum(["a_reciclar", "a_refaccionar", "bueno", "muy_bueno", "excelente", "a_estrenar"]).optional().nullable(),
  keys: z.enum(["no_se_sabe", "coordinar_dueno", "coordinar_inquilino", "tenemos"]).optional().nullable(),
  ownerRole: z.enum(["ambos", "real", "legal"]).optional(),
  serviceElectricity: z.enum(["inquilino", "propietario", "na"]).optional(),
  serviceGas: z.enum(["inquilino", "propietario", "na"]).optional(),
  serviceWater: z.enum(["inquilino", "propietario", "na"]).optional(),
  serviceCouncil: z.enum(["inquilino", "propietario", "na"]).optional(),
  serviceStateTax: z.enum(["inquilino", "propietario", "na"]).optional(),
  serviceHoa: z.enum(["inquilino", "propietario", "na"]).optional(),
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

    const { id } = await params;

    const [row] = await db
      .select({
        id: property.id,
        title: property.title,
        address: property.address,
        rentalPrice: property.rentalPrice,
        rentalPriceCurrency: property.rentalPriceCurrency,
        salePrice: property.salePrice,
        salePriceCurrency: property.salePriceCurrency,
        type: property.type,
        rentalStatus: property.rentalStatus,
        saleStatus: property.saleStatus,
        zone: property.zone,
        floorUnit: property.floorUnit,
        rooms: property.rooms,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        surface: property.surface,
        surfaceBuilt: property.surfaceBuilt,
        surfaceLand: property.surfaceLand,
        yearBuilt: property.yearBuilt,
        condition: property.condition,
        keys: property.keys,
        ownerRole: property.ownerRole,
        isManaged: property.isManaged,
        serviceElectricity: property.serviceElectricity,
        serviceGas: property.serviceGas,
        serviceWater: property.serviceWater,
        serviceCouncil: property.serviceCouncil,
        serviceStateTax: property.serviceStateTax,
        serviceHoa: property.serviceHoa,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
        ownerId: property.ownerId,
        ownerFirstName: client.firstName,
        ownerLastName: client.lastName,
        ownerPhone: client.phone,
        ownerEmail: client.email,
        ownerDni: client.dni,
        ownerCuit: client.cuit,
        ownerStatus: client.status,
      })
      .from(property)
      .leftJoin(client, eq(property.ownerId, client.id))
      .where(eq(property.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    // Contracts where this property is used as a guarantee
    const usedAsGuaranteeRows = await db
      .select({
        guaranteeId: guarantee.id,
        contractId: guarantee.contractId,
        tenantClientId: guarantee.tenantClientId,
        contractNumber: contract.contractNumber,
        tenantFirstName: client.firstName,
        tenantLastName: client.lastName,
      })
      .from(guarantee)
      .innerJoin(contract, eq(contract.id, guarantee.contractId))
      .innerJoin(contractTenant, eq(contractTenant.contractId, guarantee.contractId))
      .innerJoin(client, eq(client.id, contractTenant.clientId))
      .where(eq(guarantee.propertyId, id));

    // Deduplicate by contractId (multiple tenants per contract)
    const seenContracts = new Set<string>();
    const usedAsGuaranteeIn = usedAsGuaranteeRows
      .filter((r) => {
        if (seenContracts.has(r.contractId)) return false;
        seenContracts.add(r.contractId);
        return true;
      })
      .map((r) => ({
        guaranteeId: r.guaranteeId,
        contractId: r.contractId,
        contractNumber: r.contractNumber,
        tenantName: r.tenantLastName
          ? `${r.tenantFirstName} ${r.tenantLastName}`
          : r.tenantFirstName,
      }));

    return NextResponse.json({ property: row, usedAsGuaranteeIn });
  } catch (error) {
    console.error("Error fetching property:", error);
    return NextResponse.json({ error: "Error al obtener la propiedad" }, { status: 500 });
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

    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = updatePropertySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.rentalStatus !== undefined) updateData.rentalStatus = data.rentalStatus;
    if (data.saleStatus !== undefined) updateData.saleStatus = data.saleStatus;
    if (data.rentalPrice !== undefined) updateData.rentalPrice = data.rentalPrice != null ? String(data.rentalPrice) : null;
    if (data.rentalPriceCurrency !== undefined) updateData.rentalPriceCurrency = data.rentalPriceCurrency;
    if (data.salePrice !== undefined) updateData.salePrice = data.salePrice != null ? String(data.salePrice) : null;
    if (data.salePriceCurrency !== undefined) updateData.salePriceCurrency = data.salePriceCurrency;
    if (data.zone !== undefined) updateData.zone = data.zone;
    if (data.floorUnit !== undefined) updateData.floorUnit = data.floorUnit;
    if (data.rooms !== undefined) updateData.rooms = data.rooms;
    if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
    if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
    if (data.surface !== undefined) updateData.surface = data.surface != null ? String(data.surface) : null;
    if (data.surfaceBuilt !== undefined) updateData.surfaceBuilt = data.surfaceBuilt != null ? String(data.surfaceBuilt) : null;
    if (data.surfaceLand !== undefined) updateData.surfaceLand = data.surfaceLand != null ? String(data.surfaceLand) : null;
    if (data.yearBuilt !== undefined) updateData.yearBuilt = data.yearBuilt;
    if (data.condition !== undefined) updateData.condition = data.condition;
    if (data.keys !== undefined) updateData.keys = data.keys;
    if (data.ownerRole !== undefined) updateData.ownerRole = data.ownerRole;
    if (data.serviceElectricity !== undefined) updateData.serviceElectricity = data.serviceElectricity;
    if (data.serviceGas !== undefined) updateData.serviceGas = data.serviceGas;
    if (data.serviceWater !== undefined) updateData.serviceWater = data.serviceWater;
    if (data.serviceCouncil !== undefined) updateData.serviceCouncil = data.serviceCouncil;
    if (data.serviceStateTax !== undefined) updateData.serviceStateTax = data.serviceStateTax;
    if (data.serviceHoa !== undefined) updateData.serviceHoa = data.serviceHoa;

    const [updated] = await db
      .update(property)
      .set(updateData)
      .where(eq(property.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ property: updated });
  } catch (error) {
    console.error("Error updating property:", error);
    return NextResponse.json({ error: "Error al actualizar la propiedad" }, { status: 500 });
  }
}
