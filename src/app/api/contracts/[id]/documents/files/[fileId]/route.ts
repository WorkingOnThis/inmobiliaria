import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contractDocument } from "@/db/schema/contract-document";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, fileId } = await params;

    const [existing] = await db
      .select({ id: contractDocument.id, url: contractDocument.url })
      .from(contractDocument)
      .where(
        and(
          eq(contractDocument.id, fileId),
          eq(contractDocument.contractId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db
      .delete(contractDocument)
      .where(eq(contractDocument.id, fileId));

    // Best-effort file deletion — don't fail the request if the file is missing
    try {
      const filePath = path.join(process.cwd(), "public", existing.url);
      await unlink(filePath);
    } catch {
      // file may already be gone
    }

    return NextResponse.json({ message: "Documento eliminado" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Error al eliminar el documento" },
      { status: 500 }
    );
  }
}
