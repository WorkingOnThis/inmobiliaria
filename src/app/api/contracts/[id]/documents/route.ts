import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractDocument } from "@/db/schema/contract-document";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { validateUpload } from "@/lib/uploads/validate";
import { saveUpload, buildFileUrl } from "@/lib/uploads/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(contract, id, agencyId);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const result = await validateUpload(file, {
      allowedExts: ["pdf", "jpg", "jpeg", "png", "webp"],
      maxBytes: 10 * 1024 * 1024, // 10 MB
    });
    if (!result.ok || !result.data) {
      return NextResponse.json({ error: result.error ?? "Archivo inválido" }, { status: result.status ?? 400 });
    }

    const validated = result.data;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeFilename = `${crypto.randomUUID()}.${validated.ext}`;
    await saveUpload("contracts", id, safeFilename, validated.buffer);
    const publicUrl = buildFileUrl("contracts", id, safeFilename);

    const [inserted] = await db
      .insert(contractDocument)
      .values({
        agencyId,
        contractId: id,
        name: safeName,
        url: publicUrl,
        uploadedBy: session!.user.id,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Error al subir el documento" },
      { status: 500 }
    );
  }
}
