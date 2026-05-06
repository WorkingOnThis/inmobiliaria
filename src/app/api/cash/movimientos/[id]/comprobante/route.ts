import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/cash/movimientos/:id/comprobante
 *
 * Adjunta un archivo (PDF o imagen, máx 5MB) como comprobante del movimiento.
 * Si ya existía un archivo previo, lo reemplaza.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    const { id } = await params;

    await requireAgencyResource(cajaMovimiento, id, agencyId);

    const [movimiento] = await db
      .select({ id: cajaMovimiento.id, comprobanteUrl: cajaMovimiento.comprobanteUrl })
      .from(cajaMovimiento)
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)))
      .limit(1);

    if (!movimiento) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "El archivo supera el límite de 5 MB" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Solo se permiten PDF e imágenes (JPEG, PNG, WebP)" }, { status: 400 });
    }

    // Si había un archivo previo, eliminarlo del disco
    if (movimiento.comprobanteUrl) {
      const oldPath = path.join(process.cwd(), "public", movimiento.comprobanteUrl);
      await fs.unlink(oldPath).catch(() => {});
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads", "movimientos", id);
    await fs.mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${timestamp}-${safeFilename}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);

    const comprobanteUrl = `/uploads/movimientos/${id}/${filename}`;

    const [actualizado] = await db
      .update(cajaMovimiento)
      .set({
        comprobanteUrl,
        comprobanteMime: file.type,
        comprobanteTamano: file.size,
        updatedAt: new Date(),
      })
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)))
      .returning({
        id: cajaMovimiento.id,
        comprobanteUrl: cajaMovimiento.comprobanteUrl,
        comprobanteMime: cajaMovimiento.comprobanteMime,
        comprobanteTamano: cajaMovimiento.comprobanteTamano,
      });

    return NextResponse.json({ movimiento: actualizado }, { status: 201 });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/cash/movimientos/:id/comprobante
 *
 * Elimina el comprobante adjunto del movimiento.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    const { id } = await params;

    await requireAgencyResource(cajaMovimiento, id, agencyId);

    const [movimiento] = await db
      .select({ id: cajaMovimiento.id, comprobanteUrl: cajaMovimiento.comprobanteUrl })
      .from(cajaMovimiento)
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)))
      .limit(1);

    if (!movimiento) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }
    if (!movimiento.comprobanteUrl) {
      return NextResponse.json({ error: "Este movimiento no tiene comprobante" }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), "public", movimiento.comprobanteUrl);
    await fs.unlink(filePath).catch(() => {});

    await db
      .update(cajaMovimiento)
      .set({
        comprobanteUrl: null,
        comprobanteMime: null,
        comprobanteTamano: null,
        updatedAt: new Date(),
      })
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
