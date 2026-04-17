import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { tareaArchivo } from "@/db/schema/tarea";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const archivos = await db
      .select()
      .from(tareaArchivo)
      .where(eq(tareaArchivo.tareaId, id));

    return NextResponse.json({ archivos });
  } catch (error) {
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
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
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
        tareaId: id,
        nombre: file.name,
        url,
        tipo: file.type || null,
        tamaño: file.size,
        creadoPor: session.user.id,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ message: "Archivo subido", archivo }, { status: 201 });
  } catch (error) {
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
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const { archivoId } = await request.json();

    if (!archivoId) {
      return NextResponse.json({ error: "archivoId requerido" }, { status: 400 });
    }

    const [archivo] = await db
      .select()
      .from(tareaArchivo)
      .where(eq(tareaArchivo.id, archivoId));

    if (!archivo || archivo.tareaId !== id) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), "public", archivo.url);
    await fs.unlink(filePath).catch(() => {});
    await db.delete(tareaArchivo).where(eq(tareaArchivo.id, archivoId));

    return NextResponse.json({ message: "Archivo eliminado" });
  } catch (error) {
    console.error("Error deleting archivo:", error);
    return NextResponse.json({ error: "Error al eliminar el archivo" }, { status: 500 });
  }
}
