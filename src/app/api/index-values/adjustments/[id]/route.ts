import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { revertAdjustmentApplication } from "@/lib/ledger/apply-index";

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
    await revertAdjustmentApplication(id, agencyId);

    return NextResponse.json({ message: "Ajuste revertido" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Ajuste no encontrado") {
      return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 });
    }
    console.error("DELETE /api/index-values/adjustments/:id:", error);
    return NextResponse.json({ error: "Error al revertir el ajuste" }, { status: 500 });
  }
}
