import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { property } from "@/db/schema/property";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId);

    const rows = await db
      .select({
        id: propertyCoOwner.id,
        propertyId: propertyCoOwner.propertyId,
        vinculo: propertyCoOwner.vinculo,
        sharePercent: propertyCoOwner.sharePercent,
        property: {
          id: property.id,
          addressStreet: property.addressStreet,
          addressNumber: property.addressNumber,
          floorUnit: property.floorUnit,
          type: property.type,
          rentalStatus: property.rentalStatus,
          saleStatus: property.saleStatus,
          zone: property.zone,
          rooms: property.rooms,
          surface: property.surface,
        },
      })
      .from(propertyCoOwner)
      .leftJoin(property, eq(propertyCoOwner.propertyId, property.id))
      .where(and(
        eq(propertyCoOwner.agencyId, agencyId),
        eq(propertyCoOwner.clientId, id),
      ));

    return NextResponse.json({ coOwnerProperties: rows });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching co-owner properties:", error);
    return NextResponse.json({ error: "Error al obtener propiedades" }, { status: 500 });
  }
}
