import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageCash } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { validateUpload } from "@/lib/uploads/validate";
import { saveUpload, deleteUpload, buildFileUrl, parseFileUrl } from "@/lib/uploads/storage";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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
    if (!canManageCash(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }
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

    const result = await validateUpload(file, {
      allowedExts: ["pdf", "jpg", "jpeg", "png", "webp"],
      maxBytes: MAX_SIZE_BYTES,
    });
    if (!result.ok || !result.data) {
      return NextResponse.json({ error: result.error ?? "Archivo inválido" }, { status: result.status ?? 400 });
    }

    const validated = result.data;

    // Si había un archivo previo, eliminarlo del disco (best-effort)
    if (movimiento.comprobanteUrl) {
      const parsed = parseFileUrl(movimiento.comprobanteUrl);
      if (parsed) {
        await deleteUpload(parsed.scope, parsed.id, parsed.filename);
      }
    }

    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await saveUpload("movimientos", id, safeFilename, validated.buffer);
    const comprobanteUrl = buildFileUrl("movimientos", id, safeFilename);

    const [actualizado] = await db
      .update(cajaMovimiento)
      .set({
        comprobanteUrl,
        comprobanteMime: validated.mime,
        comprobanteTamano: validated.size,
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
    if (!canManageCash(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }
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

    const parsed = parseFileUrl(movimiento.comprobanteUrl);
    if (parsed) {
      await deleteUpload(parsed.scope, parsed.id, parsed.filename);
    }

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
