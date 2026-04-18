import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updatePropertySchema = z.object({
  title: z.string().optional().nullable(),
  address: z.string().min(1).optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  zone: z.string().optional().nullable(),
  floorUnit: z.string().optional().nullable(),
  rooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  surface: z.coerce.number().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
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
        price: property.price,
        type: property.type,
        status: property.status,
        zone: property.zone,
        floorUnit: property.floorUnit,
        rooms: property.rooms,
        bathrooms: property.bathrooms,
        surface: property.surface,
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

    return NextResponse.json({ property: row });
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
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.zone !== undefined) updateData.zone = data.zone;
    if (data.floorUnit !== undefined) updateData.floorUnit = data.floorUnit;
    if (data.rooms !== undefined) updateData.rooms = data.rooms;
    if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
    if (data.surface !== undefined) updateData.surface = data.surface != null ? String(data.surface) : null;
    if (data.price !== undefined) updateData.price = data.price != null ? String(data.price) : null;
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
