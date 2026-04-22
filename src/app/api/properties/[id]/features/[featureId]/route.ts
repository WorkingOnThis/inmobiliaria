import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyToFeature } from "@/db/schema/property-to-feature";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManageProperties(session.user.role)) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const { id: propertyId, featureId } = await params;

  await db
    .delete(propertyToFeature)
    .where(
      and(
        eq(propertyToFeature.propertyId, propertyId),
        eq(propertyToFeature.featureId, featureId)
      )
    );

  return NextResponse.json({ ok: true });
}
