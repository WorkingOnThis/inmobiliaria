import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { propertyFeature } from "@/db/schema/property-feature";
import { propertyToFeature } from "@/db/schema/property-to-feature";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageProperties(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id: propertyId, featureId } = await params;
    await requireAgencyResource(property, propertyId, agencyId);
    await requireAgencyResource(propertyFeature, featureId, agencyId);

    await db
      .delete(propertyToFeature)
      .where(
        and(
          eq(propertyToFeature.propertyId, propertyId),
          eq(propertyToFeature.featureId, featureId)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error removing feature:", error);
    return NextResponse.json({ error: "Error al quitar característica" }, { status: 500 });
  }
}
