import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { servicio } from "@/db/schema";
import { isNotNull, asc, and, eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const rows = await db
      .selectDistinct({ company: servicio.company })
      .from(servicio)
      .where(and(eq(servicio.agencyId, agencyId), isNotNull(servicio.company)))
      .orderBy(asc(servicio.company));

    const empresas = rows.map((r) => r.company).filter(Boolean) as string[];

    return NextResponse.json({ empresas });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching companies:", error);
    return NextResponse.json({ error: "Error al obtener empresas" }, { status: 500 });
  }
}
