import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageTasks } from "@/lib/permissions";
import { tarea, tareaArchivo } from "@/db/schema/tarea";
import { eq } from "drizzle-orm";
import { validateUpload } from "@/lib/uploads/validate";
import { saveUpload, deleteUpload, buildFileUrl, parseFileUrl } from "@/lib/uploads/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id } = await params;
    await requireAgencyResource(tarea, id, agencyId);

    const archivos = await db
      .select()
      .from(tareaArchivo)
      .where(eq(tareaArchivo.taskId, id));

    return NextResponse.json({ archivos });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching archivos:", error);
    return NextResponse.json({ error: "Error al obtener archivos" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageTasks(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(tarea, id, agencyId);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    const result = await validateUpload(file, {
      allowedExts: ["pdf", "jpg", "jpeg", "png", "webp"],
      maxBytes: 10 * 1024 * 1024, // 10 MB
    });
    if (!result.ok || !result.data) {
      return NextResponse.json({ error: result.error ?? "Archivo inválido" }, { status: result.status ?? 400 });
    }

    const validated = result.data;
    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await saveUpload("tasks", id, safeFilename, validated.buffer);
    const url = buildFileUrl("tasks", id, safeFilename);

    const [archivo] = await db
      .insert(tareaArchivo)
      .values({
        id: crypto.randomUUID(),
        taskId: id,
        name: file.name,
        url,
        type: validated.mime,
        size: validated.size,
        createdBy: session!.user.id,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ message: "Archivo subido", archivo }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error uploading archivo:", error);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageTasks(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(tarea, id, agencyId);

    const { archivoId } = await request.json();

    if (!archivoId) {
      return NextResponse.json({ error: "archivoId requerido" }, { status: 400 });
    }

    const [archivo] = await db
      .select()
      .from(tareaArchivo)
      .where(eq(tareaArchivo.id, archivoId));

    if (!archivo || archivo.taskId !== id) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const parsed = parseFileUrl(archivo.url);
    if (parsed) {
      await deleteUpload(parsed.scope, parsed.id, parsed.filename);
    }
    await db.delete(tareaArchivo).where(eq(tareaArchivo.id, archivoId));

    return NextResponse.json({ message: "Archivo eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting archivo:", error);
    return NextResponse.json({ error: "Error al eliminar el archivo" }, { status: 500 });
  }
}
