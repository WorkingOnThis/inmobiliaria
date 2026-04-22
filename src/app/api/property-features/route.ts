import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyFeature } from "@/db/schema/property-feature";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { eq, ilike, and } from "drizzle-orm";

async function getAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const agencyId = await getAgencyId(session.user.id);
  if (!agencyId) return NextResponse.json({ features: [] });

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  const rows = await db
    .select({ id: propertyFeature.id, name: propertyFeature.name })
    .from(propertyFeature)
    .where(
      search
        ? and(eq(propertyFeature.agencyId, agencyId), ilike(propertyFeature.name, `%${search}%`))
        : eq(propertyFeature.agencyId, agencyId)
    )
    .limit(10);

  return NextResponse.json({ features: rows });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManageProperties(session.user.role)) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const agencyId = await getAgencyId(session.user.id);
  if (!agencyId) return NextResponse.json({ error: "Agencia no encontrada" }, { status: 400 });

  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const [created] = await db
    .insert(propertyFeature)
    .values({ name, agencyId })
    .returning({ id: propertyFeature.id, name: propertyFeature.name });

  return NextResponse.json({ feature: created }, { status: 201 });
}
