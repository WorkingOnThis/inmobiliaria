import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: adjustmentIndexValue.id })
      .from(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Valor no encontrado" }, { status: 404 });
    }

    await db
      .delete(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)));

    return NextResponse.json({ message: "Valor eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al eliminar el valor" }, { status: 500 });
  }
}
