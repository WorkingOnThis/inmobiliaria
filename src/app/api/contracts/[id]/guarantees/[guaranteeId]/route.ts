import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { guarantee } from "@/db/schema/guarantee";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; guaranteeId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, guaranteeId } = await params;
    await requireAgencyResource(contract, id, agencyId);
    await requireAgencyResource(guarantee, guaranteeId, agencyId, [
      eq(guarantee.contractId, id),
    ]);

    await db
      .delete(guarantee)
      .where(and(eq(guarantee.id, guaranteeId), eq(guarantee.agencyId, agencyId)));

    return NextResponse.json({ message: "Garantía eliminada" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting guarantee:", error);
    return NextResponse.json(
      { error: "Error al eliminar garantía" },
      { status: 500 }
    );
  }
}
