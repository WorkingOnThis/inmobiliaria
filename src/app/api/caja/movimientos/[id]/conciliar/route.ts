import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const [actualizado] = await db
    .update(cajaMovimiento)
    .set({
      conciliado: sql`NOT ${cajaMovimiento.conciliado}`,
      conciliadoEn: sql`CASE WHEN NOT ${cajaMovimiento.conciliado} THEN NOW() ELSE NULL END`,
      actualizadoEn: new Date(),
    })
    .where(eq(cajaMovimiento.id, id))
    .returning({
      id: cajaMovimiento.id,
      conciliado: cajaMovimiento.conciliado,
      conciliadoEn: cajaMovimiento.conciliadoEn,
    });

  if (!actualizado) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ movimiento: actualizado });
}
