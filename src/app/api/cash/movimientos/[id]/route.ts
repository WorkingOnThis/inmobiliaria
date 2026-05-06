import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";

/**
 * PATCH /api/cash/movimientos/:id
 *
 * Actualiza un movimiento existente.
 * Acepta los mismos campos que el POST de creación.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    const { id } = await params;

    await requireAgencyResource(cajaMovimiento, id, agencyId);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const {
      fecha, descripcion, tipo, monto, categoria,
      contratoId, propietarioId, inquilinoId, propiedadId,
      comprobante, nota,
    } = body as Record<string, string>;

    if (!fecha || typeof fecha !== "string") {
      return NextResponse.json({ error: "La fecha es requerida" }, { status: 400 });
    }
    if (!descripcion || typeof descripcion !== "string" || descripcion.trim() === "") {
      return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
    }
    if (tipo !== "income" && tipo !== "expense") {
      return NextResponse.json({ error: "El tipo debe ser 'income' o 'expense'" }, { status: 400 });
    }
    const montoNum = parseFloat(String(monto));
    if (isNaN(montoNum) || montoNum <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    const [actualizado] = await db
      .update(cajaMovimiento)
      .set({
        date: fecha,
        description: descripcion.trim(),
        tipo,
        amount: String(montoNum),
        categoria: categoria?.trim() || null,
        contratoId: contratoId || null,
        propietarioId: propietarioId || null,
        inquilinoId: inquilinoId || null,
        propiedadId: propiedadId || null,
        comprobante: comprobante?.trim() || null,
        note: nota?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)))
      .returning();

    if (!actualizado) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ movimiento: actualizado });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/cash/movimientos/:id
 *
 * Elimina un movimiento de caja de forma permanente.
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

    const [mov] = await db
      .select({ source: cajaMovimiento.source })
      .from(cajaMovimiento)
      .where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)))
      .limit(1);

    if (!mov) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }
    if (mov.source !== "manual") {
      return NextResponse.json({ error: "Solo se pueden eliminar movimientos manuales" }, { status: 422 });
    }

    await db.delete(cajaMovimiento).where(and(eq(cajaMovimiento.id, id), eq(cajaMovimiento.agencyId, agencyId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
