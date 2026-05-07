import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageCash } from "@/lib/permissions";
import { and, eq, sql } from "drizzle-orm";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageCash(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }
    const { id } = await params;

    await requireAgencyResource(cajaMovimiento, id, agencyId);

    const [actualizado] = await db
      .update(cajaMovimiento)
      .set({
        reconciled: sql`NOT ${cajaMovimiento.reconciled}`,
        reconciledAt: sql`CASE WHEN NOT ${cajaMovimiento.reconciled} THEN NOW() ELSE NULL END`,
        updatedAt: new Date(),
      })
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)))
      .returning({
        id: cajaMovimiento.id,
        conciliado: cajaMovimiento.reconciled,
        conciliadoEn: cajaMovimiento.reconciledAt,
      });

    if (!actualizado) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ movimiento: actualizado });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
