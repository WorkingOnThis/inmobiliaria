import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { zone } from "@/db/schema/zone";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
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
  if (!agencyId) return NextResponse.json({ zones: [] });

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
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const agencyId = await getAgencyId(session.user.id);
  if (!agencyId) return NextResponse.json({ error: "Agencia no encontrada" }, { status: 400 });

  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const [created] = await db
    .insert(zone)
    .values({ id: crypto.randomUUID(), name, agencyId })
    .returning({ id: zone.id, name: zone.name });

  return NextResponse.json({ zone: created }, { status: 201 });
}
