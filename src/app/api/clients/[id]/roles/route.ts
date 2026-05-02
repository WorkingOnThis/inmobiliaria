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
import { and, countDistinct, eq, isNotNull } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;

    const [existing] = await db
      .select({ id: client.id, type: client.type })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const [tenantCount] = await db
      .select({ count: countDistinct(contractParticipant.contractId) })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")));

    const [ownerContractCount] = await db
      .select({ count: countDistinct(contract.id) })
      .from(contract)
      .where(eq(contract.ownerId, id));

    const [ownerPropertyCount] = await db
      .select({ count: countDistinct(property.id) })
      .from(property)
      .where(eq(property.ownerId, id));

    const [guarantorCount] = await db
      .select({ count: countDistinct(guarantee.id) })
      .from(guarantee)
      .where(and(eq(guarantee.personClientId, id), isNotNull(guarantee.personClientId)));

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
    console.error("Error GET /api/clients/:id/roles:", error);
    return NextResponse.json({ error: "Error al obtener los roles" }, { status: 500 });
  }
}
