import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractDocument } from "@/db/schema/contract-document";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";
import { deleteUpload, parseFileUrl } from "@/lib/uploads/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, fileId } = await params;
    await requireAgencyResource(contract, id, agencyId);
    await requireAgencyResource(contractDocument, fileId, agencyId, [
      eq(contractDocument.contractId, id),
    ]);

    const [existing] = await db
      .select({ id: contractDocument.id, url: contractDocument.url })
      .from(contractDocument)
      .where(
        and(
          eq(contractDocument.id, fileId),
          eq(contractDocument.contractId, id),
          eq(contractDocument.agencyId, agencyId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db
      .delete(contractDocument)
      .where(and(eq(contractDocument.id, fileId), eq(contractDocument.agencyId, agencyId)));

    // Best-effort file deletion — don't fail the request if the file is missing
    const parsed = parseFileUrl(existing.url);
    if (parsed) {
      await deleteUpload(parsed.scope, parsed.id, parsed.filename);
    }

    return NextResponse.json({ message: "Documento eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Error al eliminar el documento" },
      { status: 500 }
    );
  }
}
