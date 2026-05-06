import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { propertyFeature } from "@/db/schema/property-feature";
import { propertyToFeature } from "@/db/schema/property-to-feature";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and, ilike } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id } = await params;
    await requireAgencyResource(property, id, agencyId);

    const rows = await db
      .select({ id: propertyFeature.id, name: propertyFeature.name })
      .from(propertyToFeature)
      .innerJoin(propertyFeature, eq(propertyToFeature.featureId, propertyFeature.id))
      .where(eq(propertyToFeature.propertyId, id));

    return NextResponse.json({ features: rows });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching features:", error);
    return NextResponse.json({ error: "Error al obtener características" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageProperties(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id: propertyId } = await params;
    await requireAgencyResource(property, propertyId, agencyId);

    const body = await request.json();
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

    // Find or create the feature for this agency (case-insensitive match)
    let [feature] = await db
      .select({ id: propertyFeature.id, name: propertyFeature.name })
      .from(propertyFeature)
      .where(and(eq(propertyFeature.agencyId, agencyId), ilike(propertyFeature.name, name)))
      .limit(1);

    if (!feature) {
      [feature] = await db
        .insert(propertyFeature)
        .values({ name, agencyId })
        .returning({ id: propertyFeature.id, name: propertyFeature.name });
    }

    // Add to property (idempotent — ignore if already linked)
    await db
      .insert(propertyToFeature)
      .values({ propertyId, featureId: feature.id })
      .onConflictDoNothing();

    return NextResponse.json({ feature }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error adding feature:", error);
    return NextResponse.json({ error: "Error al agregar característica" }, { status: 500 });
  }
}
