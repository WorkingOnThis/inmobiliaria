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
    .selectDistinct({ company: servicio.company })
    .from(servicio)
    .where(isNotNull(servicio.company))
    .orderBy(asc(servicio.company));

  const empresas = rows.map((r) => r.company).filter(Boolean) as string[];

  return NextResponse.json({ empresas });
}
