import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageTasks } from "@/lib/permissions";
import { tarea, tareaArchivo } from "@/db/schema/tarea";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads", "tareas", id);
    await fs.mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${timestamp}-${safeFilename}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/tareas/${id}/${filename}`;

    const [archivo] = await db
      .insert(tareaArchivo)
      .values({
        id: crypto.randomUUID(),
        taskId: id,
        name: file.name,
        url,
        type: file.type || null,
        size: file.size,
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

    const filePath = path.join(process.cwd(), "public", archivo.url);
    await fs.unlink(filePath).catch(() => {});
    await db.delete(tareaArchivo).where(eq(tareaArchivo.id, archivoId));

    return NextResponse.json({ message: "Archivo eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting archivo:", error);
    return NextResponse.json({ error: "Error al eliminar el archivo" }, { status: 500 });
  }
}
