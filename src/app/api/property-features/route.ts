import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyFeature } from "@/db/schema/property-feature";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { canManageProperties } from "@/lib/permissions";
import { eq, ilike, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

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
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching property features:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageProperties(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

    const [created] = await db
      .insert(propertyFeature)
      .values({ name, agencyId })
      .returning({ id: propertyFeature.id, name: propertyFeature.name });

    return NextResponse.json({ feature: created }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating property feature:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
