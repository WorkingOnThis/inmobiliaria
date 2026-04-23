import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { guarantee } from "@/db/schema/guarantee";
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
      .select({ id: guarantee.id })
      .from(guarantee)
      .where(
        and(
          eq(guarantee.id, guaranteeId),
          eq(guarantee.contractId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Garantía no encontrada" }, { status: 404 });
    }

    await db
      .delete(guarantee)
      .where(eq(guarantee.id, guaranteeId));

    return NextResponse.json({ message: "Garantía eliminada" });
  } catch (error) {
    console.error("Error deleting guarantee:", error);
    return NextResponse.json(
      { error: "Error al eliminar garantía" },
      { status: 500 }
    );
  }
}
