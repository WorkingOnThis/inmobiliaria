import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

const patchSchema = z.object({
  descripcion: z.string().min(1).optional(),
  tipo: z.enum(["income", "expense"]).optional(),
  monto: z.number().positive().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nota: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movimientoId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, movimientoId } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: cajaMovimiento.id, source: cajaMovimiento.source })
      .from(cajaMovimiento)
      .where(and(eq(cajaMovimiento.id, movimientoId), eq(cajaMovimiento.inquilinoId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    if (existing.source !== "manual") {
      return NextResponse.json(
        { error: "Solo se pueden editar movimientos manuales" },
        { status: 422 }
      );
    }

    const body = await request.json();
    const result = patchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.descripcion !== undefined) updates.description = data.descripcion;
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.monto !== undefined) updates.amount = String(data.monto);
    if (data.fecha !== undefined) updates.date = data.fecha;
    if (data.nota !== undefined) updates.note = data.nota;
    if (data.categoria !== undefined) updates.categoria = data.categoria;

    const [updated] = await db
      .update(cajaMovimiento)
      .set(updates)
      .where(eq(cajaMovimiento.id, movimientoId))
      .returning();

    return NextResponse.json({ movimiento: updated });
  } catch (error) {
    console.error("Error PATCH /api/tenants/:id/movimientos/:movimientoId:", error);
    return NextResponse.json({ error: "Error al actualizar el movimiento" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movimientoId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, movimientoId } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: cajaMovimiento.id, source: cajaMovimiento.source })
      .from(cajaMovimiento)
      .where(and(eq(cajaMovimiento.id, movimientoId), eq(cajaMovimiento.inquilinoId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    if (existing.source !== "manual") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar movimientos manuales" },
        { status: 422 }
      );
    }

    await db.delete(cajaMovimiento).where(eq(cajaMovimiento.id, movimientoId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error DELETE /api/tenants/:id/movimientos/:movimientoId:", error);
    return NextResponse.json({ error: "Error al eliminar el movimiento" }, { status: 500 });
  }
}
