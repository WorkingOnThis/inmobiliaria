import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contractGuarantee } from "@/db/schema/contract-guarantee";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; guaranteeId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, guaranteeId } = await params;

    const [existing] = await db
      .select({ id: contractGuarantee.id })
      .from(contractGuarantee)
      .where(
        and(
          eq(contractGuarantee.id, guaranteeId),
          eq(contractGuarantee.contractId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Garantía no encontrada" }, { status: 404 });
    }

    await db
      .delete(contractGuarantee)
      .where(eq(contractGuarantee.id, guaranteeId));

    return NextResponse.json({ message: "Garantía eliminada" });
  } catch (error) {
    console.error("Error deleting guarantee:", error);
    return NextResponse.json(
      { error: "Error al eliminar garantía" },
      { status: 500 }
    );
  }
}
