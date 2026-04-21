import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

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

    const rows = await db
      .select({
        id: propertyCoOwner.id,
        propertyId: propertyCoOwner.propertyId,
        vinculo: propertyCoOwner.vinculo,
        sharePercent: propertyCoOwner.sharePercent,
        property: {
          id: property.id,
          address: property.address,
          type: property.type,
          status: property.status,
          zone: property.zone,
          rooms: property.rooms,
          surface: property.surface,
        },
      })
      .from(propertyCoOwner)
      .leftJoin(property, eq(propertyCoOwner.propertyId, property.id))
      .where(eq(propertyCoOwner.clientId, id));

    return NextResponse.json({ coOwnerProperties: rows });
  } catch (error) {
    console.error("Error fetching co-owner properties:", error);
    return NextResponse.json({ error: "Error al obtener propiedades" }, { status: 500 });
  }
}
