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
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

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
    const agencyId = requireAgencyId(session);

    const { id } = await params;

    await requireAgencyResource(guarantee, id, agencyId);

    const [row] = await db
      .select({
        guarantee: guarantee,
        salaryInfo: guaranteeSalaryInfo,
        property: {
          id: property.id,
          addressStreet: property.addressStreet,
          addressNumber: property.addressNumber,
          floorUnit: property.floorUnit,
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
      .where(and(eq(guarantee.id, id), eq(guarantee.agencyId, agencyId)))
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
        .where(and(
          eq(propertyCoOwner.agencyId, agencyId),
          eq(propertyCoOwner.propertyId, prop.id),
        ));

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
        .where(and(eq(client.id, legalOwnerId), eq(client.agencyId, agencyId)))
        .limit(1);

      legalOwner = ownerRow ?? null;
    }

    return NextResponse.json({ guarantee: row, legalOwner });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching guarantee:", error);
    return NextResponse.json({ error: "Error al obtener la garantía" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = patchGuaranteeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    await requireAgencyResource(guarantee, id, agencyId);

    const [updated] = await db
      .update(guarantee)
      .set({ ...result.data, updatedAt: new Date() })
      .where(and(eq(guarantee.id, id), eq(guarantee.agencyId, agencyId)))
      .returning();

    return NextResponse.json({ guarantee: updated });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error updating guarantee:", error);
    return NextResponse.json({ error: "Error al actualizar la garantía" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    await requireAgencyResource(guarantee, id, agencyId);

    await db.delete(guarantee).where(and(eq(guarantee.id, id), eq(guarantee.agencyId, agencyId)));

    return NextResponse.json({ message: "Garantía eliminada" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting guarantee:", error);
    return NextResponse.json({ error: "Error al eliminar la garantía" }, { status: 500 });
  }
}

