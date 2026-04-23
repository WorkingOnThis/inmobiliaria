import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const updateCoOwnerSchema = z.object({
  role: z.enum(["ambos", "real", "legal"]).optional(),
  vinculo: z.string().optional().nullable(),
  sharePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; coOwnerId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, coOwnerId } = await params;

    const body = await request.json();
    const result = updateCoOwnerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.role !== undefined) updateData.role = data.role;
    if (data.vinculo !== undefined) updateData.vinculo = data.vinculo;
    if (data.sharePercent !== undefined) {
      updateData.sharePercent = data.sharePercent != null ? String(data.sharePercent) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await db
      .update(propertyCoOwner)
      .set(updateData)
      .where(and(eq(propertyCoOwner.id, coOwnerId), eq(propertyCoOwner.propertyId, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Co-propietario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ coOwner: updated });
  } catch (error) {
    console.error("Error updating co-owner:", error);
    return NextResponse.json({ error: "Error al actualizar co-propietario" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; coOwnerId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, coOwnerId } = await params;

    const [deleted] = await db
      .delete(propertyCoOwner)
      .where(and(eq(propertyCoOwner.id, coOwnerId), eq(propertyCoOwner.propertyId, id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Co-propietario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting co-owner:", error);
    return NextResponse.json({ error: "Error al eliminar co-propietario" }, { status: 500 });
  }
}
