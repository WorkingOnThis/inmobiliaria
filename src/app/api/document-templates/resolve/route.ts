import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and, inArray } from "drizzle-orm";
import {
  VARIABLES_CATALOG,
  type TemplateContext,
} from "@/lib/document-templates/variables-catalog";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const contractId = request.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return NextResponse.json(
        { error: "contractId es requerido" },
        { status: 400 }
      );
    }

    const [contractRow] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    const [propertyRow, ownerRow, agencyRow, tenantParticipants, guarantorParticipants] =
      await Promise.all([
        db
          .select()
          .from(property)
          .where(eq(property.id, contractRow.propertyId))
          .limit(1)
          .then((r) => r[0] ?? null),
        db
          .select()
          .from(client)
          .where(eq(client.id, contractRow.ownerId))
          .limit(1)
          .then((r) => r[0] ?? null),
        db
          .select()
          .from(agency)
          .where(eq(agency.ownerId, session.user.id))
          .limit(1)
          .then((r) => r[0] ?? null),
        db
          .select({ clientId: contractParticipant.clientId })
          .from(contractParticipant)
          .where(
            and(
              eq(contractParticipant.contractId, contractId),
              eq(contractParticipant.role, "tenant")
            )
          ),
        db
          .select({ clientId: contractParticipant.clientId })
          .from(contractParticipant)
          .where(
            and(
              eq(contractParticipant.contractId, contractId),
              eq(contractParticipant.role, "guarantor")
            )
          ),
      ]);

    const [tenantRows, guarantorRows] = await Promise.all([
      tenantParticipants.length > 0
        ? db
            .select()
            .from(client)
            .where(inArray(client.id, tenantParticipants.map((p) => p.clientId)))
        : Promise.resolve([]),
      guarantorParticipants.length > 0
        ? db
            .select()
            .from(client)
            .where(inArray(client.id, guarantorParticipants.map((p) => p.clientId)))
        : Promise.resolve([]),
    ]);

    const ctx: TemplateContext = {
      property: propertyRow,
      owner: ownerRow,
      tenants: tenantRows,
      guarantors: guarantorRows,
      contract: contractRow,
      agency: agencyRow,
    };

    const resolved: Record<string, string | null> = {};
    for (const variable of VARIABLES_CATALOG) {
      resolved[variable.path] = variable.resolver(ctx);
    }

    return NextResponse.json({ resolved });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
