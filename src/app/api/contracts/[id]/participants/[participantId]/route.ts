import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contractParticipant } from "@/db/schema/contract-participant";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, participantId } = await params;

    const [existing] = await db
      .select({ id: contractParticipant.id })
      .from(contractParticipant)
      .where(
        and(
          eq(contractParticipant.id, participantId),
          eq(contractParticipant.contractId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Participante no encontrado" },
        { status: 404 }
      );
    }

    await db
      .delete(contractParticipant)
      .where(eq(contractParticipant.id, participantId));

    return NextResponse.json({ message: "Participante eliminado" });
  } catch (error) {
    console.error("Error deleting participant:", error);
    return NextResponse.json(
      { error: "Error al eliminar participante" },
      { status: 500 }
    );
  }
}
