import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { servicio } from "@/db/schema";
import { isNotNull, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rows = await db
    .selectDistinct({ empresa: servicio.empresa })
    .from(servicio)
    .where(isNotNull(servicio.empresa))
    .orderBy(asc(servicio.empresa));

  const empresas = rows.map((r) => r.empresa).filter(Boolean) as string[];

  return NextResponse.json({ empresas });
}
