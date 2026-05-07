import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { zone } from "@/db/schema/zone";
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
      .select({ id: zone.id, name: zone.name })
      .from(zone)
      .where(
        search
          ? and(eq(zone.agencyId, agencyId), ilike(zone.name, `%${search}%`))
          : eq(zone.agencyId, agencyId)
      )
      .limit(5);

    return NextResponse.json({ zones: rows });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching zones:", error);
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
      .insert(zone)
      .values({ id: crypto.randomUUID(), name, agencyId })
      .returning({ id: zone.id, name: zone.name });

    return NextResponse.json({ zone: created }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating zone:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
