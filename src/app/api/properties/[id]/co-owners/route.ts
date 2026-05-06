import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const addCoOwnerSchema = z.object({
  clientId: z.string().min(1, "El cliente es requerido"),
  role: z.enum(["ambos", "real", "legal"]).default("ambos"),
  vinculo: z.string().optional().nullable(),
  sharePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
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

    const rows = await db
      .select({
        id: propertyCoOwner.id,
        propertyId: propertyCoOwner.propertyId,
        clientId: propertyCoOwner.clientId,
        role: propertyCoOwner.role,
        vinculo: propertyCoOwner.vinculo,
        sharePercent: propertyCoOwner.sharePercent,
        notes: propertyCoOwner.notes,
        createdAt: propertyCoOwner.createdAt,
        clientFirstName: client.firstName,
        clientLastName: client.lastName,
        clientPhone: client.phone,
        clientEmail: client.email,
        clientDni: client.dni,
      })
      .from(propertyCoOwner)
      .leftJoin(client, eq(propertyCoOwner.clientId, client.id))
      .where(and(eq(propertyCoOwner.propertyId, id), eq(propertyCoOwner.agencyId, agencyId)));

    return NextResponse.json({ coOwners: rows });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching co-owners:", error);
    return NextResponse.json({ error: "Error al obtener co-propietarios" }, { status: 500 });
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
    const result = addCoOwnerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { clientId, role, vinculo, sharePercent, notes } = result.data;

    const [existingClient] = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.agencyId, agencyId)))
      .limit(1);
    if (!existingClient) {
      return NextResponse.json({ error: "El cliente no existe" }, { status: 400 });
    }

    const [inserted] = await db
      .insert(propertyCoOwner)
      .values({
        agencyId,
        propertyId: id,
        clientId,
        role,
        vinculo: vinculo ?? null,
        sharePercent: sharePercent != null ? String(sharePercent) : null,
        notes: notes ?? null,
      })
      .returning();

    return NextResponse.json({ coOwner: inserted }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique")) {
      return NextResponse.json({ error: "Este cliente ya es co-propietario de esta propiedad" }, { status: 409 });
    }
    console.error("Error adding co-owner:", error);
    return NextResponse.json({ error: "Error al agregar co-propietario" }, { status: 500 });
  }
}
