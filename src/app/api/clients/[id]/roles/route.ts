import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { guarantee } from "@/db/schema/guarantee";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, countDistinct, eq, isNotNull } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;

    const existing = (await requireAgencyResource(client, id, agencyId)) as {
      id: string;
      type: string;
    };

    const [tenantCount] = await db
      .select({ count: countDistinct(contractParticipant.contractId) })
      .from(contractParticipant)
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        eq(contractParticipant.clientId, id),
        eq(contractParticipant.role, "tenant"),
      ));

    const [ownerContractCount] = await db
      .select({ count: countDistinct(contract.id) })
      .from(contract)
      .where(and(eq(contract.agencyId, agencyId), eq(contract.ownerId, id)));

    const [ownerPropertyCount] = await db
      .select({ count: countDistinct(property.id) })
      .from(property)
      .where(and(eq(property.agencyId, agencyId), eq(property.ownerId, id)));

    const [guarantorCount] = await db
      .select({ count: countDistinct(guarantee.id) })
      .from(guarantee)
      .where(and(
        eq(guarantee.agencyId, agencyId),
        eq(guarantee.personClientId, id),
        isNotNull(guarantee.personClientId),
      ));

    const roles: string[] = [];
    if ((tenantCount?.count ?? 0) > 0 || existing.type === "tenant") roles.push("tenant");
    if ((ownerContractCount?.count ?? 0) > 0 || (ownerPropertyCount?.count ?? 0) > 0 || existing.type === "owner") roles.push("owner");
    if ((guarantorCount?.count ?? 0) > 0) roles.push("guarantor");

    return NextResponse.json({
      roles,
      counts: {
        tenantContracts: Number(tenantCount?.count ?? 0),
        ownerContracts: Number(ownerContractCount?.count ?? 0),
        ownerProperties: Number(ownerPropertyCount?.count ?? 0),
        guarantorContracts: Number(guarantorCount?.count ?? 0),
      },
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/clients/:id/roles:", error);
    return NextResponse.json({ error: "Error al obtener los roles" }, { status: 500 });
  }
}
