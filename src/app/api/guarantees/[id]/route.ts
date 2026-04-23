import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { guarantee } from "@/db/schema/guarantee";
import { guaranteeSalaryInfo } from "@/db/schema/guarantee-salary-info";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { eq } from "drizzle-orm";

const patchGuaranteeSchema = z.object({
  depositAmount: z.string().optional().nullable(),
  depositCurrency: z.enum(["ARS", "USD"]).optional().nullable(),
  depositHeldBy: z.string().optional().nullable(),
  depositNotes: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  personClientId: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const [row] = await db
      .select({
        guarantee: guarantee,
        salaryInfo: guaranteeSalaryInfo,
        property: {
          id: property.id,
          address: property.address,
          type: property.type,
          ownerId: property.ownerId,
        },
        personClient: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          phone: client.phone,
          email: client.email,
          address: client.address,
          cuit: client.cuit,
        },
      })
      .from(guarantee)
      .leftJoin(guaranteeSalaryInfo, eq(guaranteeSalaryInfo.guaranteeId, guarantee.id))
      .leftJoin(property, eq(property.id, guarantee.propertyId))
      .leftJoin(client, eq(client.id, guarantee.personClientId))
      .where(eq(guarantee.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Garantía no encontrada" }, { status: 404 });
    }

    // For propertyOwner guarantees, resolve the legal owner of the property
    let legalOwner = null;
    if (row.guarantee.kind === "propertyOwner" && row.property) {
      const prop = row.property;

      // Check co-owners for legal/ambos role first
      const coOwners = await db
        .select({ clientId: propertyCoOwner.clientId, role: propertyCoOwner.role })
        .from(propertyCoOwner)
        .where(eq(propertyCoOwner.propertyId, prop.id));

      const legalCoOwner = coOwners.find(
        (co) => co.role === "legal" || co.role === "ambos"
      );

      const legalOwnerId = legalCoOwner
        ? legalCoOwner.clientId
        : prop.ownerId;

      const [ownerRow] = await db
        .select({
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          phone: client.phone,
          email: client.email,
        })
        .from(client)
        .where(eq(client.id, legalOwnerId))
        .limit(1);

      legalOwner = ownerRow ?? null;
    }

    return NextResponse.json({ guarantee: row, legalOwner });
  } catch (error) {
    console.error("Error fetching guarantee:", error);
    return NextResponse.json({ error: "Error al obtener la garantía" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = patchGuaranteeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: guarantee.id })
      .from(guarantee)
      .where(eq(guarantee.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Garantía no encontrada" }, { status: 404 });
    }

    const [updated] = await db
      .update(guarantee)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(guarantee.id, id))
      .returning();

    return NextResponse.json({ guarantee: updated });
  } catch (error) {
    console.error("Error updating guarantee:", error);
    return NextResponse.json({ error: "Error al actualizar la garantía" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
      .select({ id: guarantee.id })
      .from(guarantee)
      .where(eq(guarantee.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Garantía no encontrada" }, { status: 404 });
    }

    await db.delete(guarantee).where(eq(guarantee.id, id));

    return NextResponse.json({ message: "Garantía eliminada" });
  } catch (error) {
    console.error("Error deleting guarantee:", error);
    return NextResponse.json({ error: "Error al eliminar la garantía" }, { status: 500 });
  }
}

