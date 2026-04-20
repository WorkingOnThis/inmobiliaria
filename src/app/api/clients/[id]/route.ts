import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

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
    .where(eq(client.id, id))
    .limit(1);

  if (!found) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ client: found });
}
