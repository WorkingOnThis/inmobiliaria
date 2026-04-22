import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { propertyRoom } from "@/db/schema/property-room";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { eq, asc, count } from "drizzle-orm";
import { z } from "zod";

const createRoomSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  position: z.number().int().min(0).optional(),
});

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

    const rooms = await db
      .select()
      .from(propertyRoom)
      .where(eq(propertyRoom.propertyId, id))
      .orderBy(asc(propertyRoom.position));

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "Error al obtener ambientes" }, { status: 500 });
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
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existingProperty] = await db
      .select({ id: property.id })
      .from(property)
      .where(eq(property.id, id))
      .limit(1);
    if (!existingProperty) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const result = createRoomSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [{ currentCount }] = await db
      .select({ currentCount: count() })
      .from(propertyRoom)
      .where(eq(propertyRoom.propertyId, id));

    const position = result.data.position ?? currentCount;

    const [inserted] = await db
      .insert(propertyRoom)
      .values({
        propertyId: id,
        name: result.data.name,
        description: result.data.description,
        position,
      })
      .returning();

    return NextResponse.json({ room: inserted }, { status: 201 });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json({ error: "Error al crear ambiente" }, { status: 500 });
  }
}
