import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { contract } from "@/db/schema/contract";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

const updatePropietarioSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  dni: z.string().nullable().optional(),
  cuit: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  cbu: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
  banco: z.string().nullable().optional(),
  tipoCuenta: z.string().nullable().optional(),
  status: z.enum(["activo", "suspendido", "baja"]).optional(),
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
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [propietario] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.type, "propietario")))
      .limit(1);

    if (!propietario) {
      return NextResponse.json({ error: "Propietario no encontrado" }, { status: 404 });
    }

    // Sus propiedades
    const propiedades = await db
      .select()
      .from(property)
      .where(eq(property.ownerId, id));

    // Sus contratos activos
    const contratosActivos = await db
      .select()
      .from(contract)
      .where(and(eq(contract.ownerId, id), eq(contract.status, "active")));

    return NextResponse.json({
      propietario,
      propiedades,
      contratosActivos,
    });
  } catch (error) {
    console.error("Error GET /api/propietarios/:id:", error);
    return NextResponse.json({ error: "Error al obtener el propietario" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: client.id })
      .from(client)
      .where(and(eq(client.id, id), eq(client.type, "propietario")))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Propietario no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = updatePropietarioSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [updated] = await db
      .update(client)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(client.id, id))
      .returning();

    return NextResponse.json({ propietario: updated });
  } catch (error) {
    console.error("Error PATCH /api/propietarios/:id:", error);
    return NextResponse.json({ error: "Error al actualizar el propietario" }, { status: 500 });
  }
}
