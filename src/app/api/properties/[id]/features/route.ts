import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyFeature } from "@/db/schema/property-feature";
import { propertyToFeature } from "@/db/schema/property-to-feature";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { eq, and, ilike } from "drizzle-orm";

async function getAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;

  const rows = await db
    .select({ id: propertyFeature.id, name: propertyFeature.name })
    .from(propertyToFeature)
    .innerJoin(propertyFeature, eq(propertyToFeature.featureId, propertyFeature.id))
    .where(eq(propertyToFeature.propertyId, id));

  return NextResponse.json({ features: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManageProperties(session.user.role)) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const { id: propertyId } = await params;

  const agencyId = await getAgencyId(session.user.id);
  if (!agencyId) return NextResponse.json({ error: "Agencia no encontrada" }, { status: 400 });

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
}
