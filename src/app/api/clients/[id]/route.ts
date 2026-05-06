import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId);

    const [found] = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        phone: client.phone,
        email: client.email,
        whatsapp: client.whatsapp,
      })
      .from(client)
      .where(and(eq(client.id, id), eq(client.agencyId, agencyId)))
      .limit(1);

    if (!found) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ client: found });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
