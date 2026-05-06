import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, participantId } = await params;
    await requireAgencyResource(contract, id, agencyId);
    await requireAgencyResource(contractParticipant, participantId, agencyId, [
      eq(contractParticipant.contractId, id),
    ]);

    await db
      .delete(contractParticipant)
      .where(and(eq(contractParticipant.id, participantId), eq(contractParticipant.agencyId, agencyId)));

    return NextResponse.json({ message: "Participante eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting participant:", error);
    return NextResponse.json(
      { error: "Error al eliminar participante" },
      { status: 500 }
    );
  }
}
