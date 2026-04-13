import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/caja/movimientos/:id
 *
 * Actualiza un movimiento existente.
 * Acepta los mismos campos que el POST de creación.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

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
  if (tipo !== "ingreso" && tipo !== "egreso") {
    return NextResponse.json({ error: "El tipo debe ser 'ingreso' o 'egreso'" }, { status: 400 });
  }
  const montoNum = parseFloat(String(monto));
  if (isNaN(montoNum) || montoNum <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  }

  const [actualizado] = await db
    .update(cajaMovimiento)
    .set({
      fecha,
      descripcion: descripcion.trim(),
      tipo,
      monto: String(montoNum),
      categoria: categoria?.trim() || null,
      contratoId: contratoId || null,
      propietarioId: propietarioId || null,
      inquilinoId: inquilinoId || null,
      propiedadId: propiedadId || null,
      comprobante: comprobante?.trim() || null,
      nota: nota?.trim() || null,
      actualizadoEn: new Date(),
    })
    .where(eq(cajaMovimiento.id, id))
    .returning();

  if (!actualizado) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ movimiento: actualizado });
}

/**
 * DELETE /api/caja/movimientos/:id
 *
 * Elimina un movimiento de caja de forma permanente.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const [eliminado] = await db
    .delete(cajaMovimiento)
    .where(eq(cajaMovimiento.id, id))
    .returning({ id: cajaMovimiento.id });

  if (!eliminado) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
