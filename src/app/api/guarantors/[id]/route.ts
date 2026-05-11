import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { guarantee } from "@/db/schema/guarantee";
import { guaranteeSalaryInfo } from "@/db/schema/guarantee-salary-info";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const patchGuarantorSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  cuit: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId);

    const [guarantor] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.agencyId, agencyId)))
      .limit(1);
    if (!guarantor) return NextResponse.json({ error: "Garante no encontrado" }, { status: 404 });

    const guaranteeRows = await db
      .select({
        guarantee: guarantee,
        salaryInfo: guaranteeSalaryInfo,
        property: {
          id: property.id,
          addressStreet: property.addressStreet,
          addressNumber: property.addressNumber,
          floorUnit: property.floorUnit,
          type: property.type,
        },
        contract: {
          id: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
        },
      })
      .from(guarantee)
      .leftJoin(guaranteeSalaryInfo, eq(guaranteeSalaryInfo.guaranteeId, guarantee.id))
      .leftJoin(property, eq(property.id, guarantee.propertyId))
      .innerJoin(contract, eq(contract.id, guarantee.contractId))
      .where(and(eq(guarantee.agencyId, agencyId), eq(guarantee.personClientId, id)));

    const tenantIds = [...new Set(guaranteeRows.map((r) => r.guarantee.tenantClientId))];
    const tenants =
      tenantIds.length > 0
        ? await db
            .select({ id: client.id, firstName: client.firstName, lastName: client.lastName })
            .from(client)
            .where(and(eq(client.agencyId, agencyId), inArray(client.id, tenantIds)))
        : [];

    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    const guarantees = guaranteeRows.map((r) => ({
      ...r,
      tenant: tenantById.get(r.guarantee.tenantClientId) ?? null,
    }));

    return NextResponse.json({ guarantor, guarantees });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/guarantors/:id:", error);
    return NextResponse.json({ error: "Error al obtener el garante" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId);

    const body = await request.json();
    const result = patchGuarantorSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [updated] = await db
      .update(client)
      .set({ ...result.data, updatedAt: new Date() })
      .where(and(eq(client.id, id), eq(client.agencyId, agencyId)))
      .returning();

    return NextResponse.json({ guarantor: updated });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error PATCH /api/guarantors/:id:", error);
    return NextResponse.json({ error: "Error al actualizar el garante" }, { status: 500 });
  }
}
