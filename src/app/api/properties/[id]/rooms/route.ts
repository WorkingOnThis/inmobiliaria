import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { propertyRoom } from "@/db/schema/property-room";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq, asc, count } from "drizzle-orm";
import { z } from "zod";

const createRoomSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  position: z.number().int().min(0).optional(),
  floor: z.number().int().min(1).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id } = await params;
    await requireAgencyResource(property, id, agencyId);

    const rooms = await db
      .select()
      .from(propertyRoom)
      .where(and(eq(propertyRoom.propertyId, id), eq(propertyRoom.agencyId, agencyId)))
      .orderBy(asc(propertyRoom.position));

    return NextResponse.json({ rooms });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
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
    const agencyId = requireAgencyId(session);
    if (!canManageProperties(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(property, id, agencyId);

    const body = await request.json();
    const result = createRoomSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [{ currentCount }] = await db
      .select({ currentCount: count() })
      .from(propertyRoom)
      .where(and(eq(propertyRoom.propertyId, id), eq(propertyRoom.agencyId, agencyId)));

    const position = result.data.position ?? currentCount;

    const [inserted] = await db
      .insert(propertyRoom)
      .values({
        agencyId,
        propertyId: id,
        name: result.data.name,
        description: result.data.description,
        position,
        floor: result.data.floor ?? 1,
      })
      .returning();

    return NextResponse.json({ room: inserted }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating room:", error);
    return NextResponse.json({ error: "Error al crear ambiente" }, { status: 500 });
  }
}
