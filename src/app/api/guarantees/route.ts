import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { guarantee } from "@/db/schema/guarantee";
import { guaranteeSalaryInfo } from "@/db/schema/guarantee-salary-info";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

const baseGuaranteeSchema = z.object({
  tenantClientId: z.string().min(1),
  contractId: z.string().min(1),
});

const propertyOwnerSchema = baseGuaranteeSchema.extend({
  kind: z.literal("propertyOwner"),
  propertyId: z.string().min(1),
});

const depositSchema = baseGuaranteeSchema.extend({
  kind: z.literal("deposit"),
  depositAmount: z.string().optional().nullable(),
  depositCurrency: z.enum(["ARS", "USD"]).optional().nullable(),
  depositHeldBy: z.string().optional().nullable(),
  depositNotes: z.string().optional().nullable(),
});

const salaryReceiptSchema = baseGuaranteeSchema.extend({
  kind: z.literal("salaryReceipt"),
  personClientId: z.string().min(1),
});

const createGuaranteeSchema = z.discriminatedUnion("kind", [
  propertyOwnerSchema,
  depositSchema,
  salaryReceiptSchema,
]);

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const searchParams = request.nextUrl.searchParams;
    const tenantClientId = searchParams.get("tenantId");
    const contractId = searchParams.get("contractId");

    if (!tenantClientId && !contractId) {
      return NextResponse.json(
        { error: "Se requiere tenantId o contractId" },
        { status: 400 }
      );
    }

    const conditions = [eq(guarantee.agencyId, agencyId)];
    if (tenantClientId) conditions.push(eq(guarantee.tenantClientId, tenantClientId));
    if (contractId) conditions.push(eq(guarantee.contractId, contractId));

    const rows = await db
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
        personClient: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          phone: client.phone,
          email: client.email,
        },
      })
      .from(guarantee)
      .leftJoin(guaranteeSalaryInfo, eq(guaranteeSalaryInfo.guaranteeId, guarantee.id))
      .leftJoin(property, eq(property.id, guarantee.propertyId))
      .leftJoin(client, eq(client.id, guarantee.personClientId))
      .where(and(...conditions));

    return NextResponse.json({ guarantees: rows });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching guarantees:", error);
    return NextResponse.json({ error: "Error al obtener garantías" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createGuaranteeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;

    const newGuarantee = await db
      .insert(guarantee)
      .values({
        agencyId,
        tenantClientId: data.tenantClientId,
        contractId: data.contractId,
        kind: data.kind,
        status: "active",
        ...(data.kind === "propertyOwner" && { propertyId: data.propertyId }),
        ...(data.kind === "salaryReceipt" && { personClientId: data.personClientId }),
        ...(data.kind === "deposit" && {
          depositAmount: data.depositAmount ?? undefined,
          depositCurrency: data.depositCurrency ?? undefined,
          depositHeldBy: data.depositHeldBy ?? undefined,
          depositNotes: data.depositNotes ?? undefined,
        }),
      })
      .returning();

    return NextResponse.json(
      { message: "Garantía creada", guarantee: newGuarantee[0] },
      { status: 201 }
    );
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating guarantee:", error);
    return NextResponse.json({ error: "Error al crear la garantía" }, { status: 500 });
  }
}

