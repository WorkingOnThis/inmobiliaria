import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { propertyRoom } from "@/db/schema/property-room";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateRoomSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  position: z.number().int().min(0).optional(),
  floor: z.number().int().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, roomId } = await params;

    const body = await request.json();
    const result = updateRoomSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (result.data.name !== undefined) updateData.name = result.data.name;
    if (result.data.description !== undefined) updateData.description = result.data.description;
    if (result.data.position !== undefined) updateData.position = result.data.position;
    if (result.data.floor !== undefined) updateData.floor = result.data.floor;

    const [updated] = await db
      .update(propertyRoom)
      .set(updateData)
      .where(and(eq(propertyRoom.id, roomId), eq(propertyRoom.propertyId, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Ambiente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ room: updated });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json({ error: "Error al actualizar ambiente" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id, roomId } = await params;

    const [deleted] = await db
      .delete(propertyRoom)
      .where(and(eq(propertyRoom.id, roomId), eq(propertyRoom.propertyId, id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Ambiente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json({ error: "Error al eliminar ambiente" }, { status: 500 });
  }
}
