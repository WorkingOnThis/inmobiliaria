import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { contractParticipant } from "@/db/schema/contract-participant";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { WRITEBACK_MAP } from "@/lib/document-templates/writeback-map";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  path: z.string().min(1),
  value: z.string(),
});

function coerceValue(value: string, inputType: "text" | "number" | "integer" | "date"): string | number | null {
  const trimmed = value.trim();
  if (inputType === "text") return trimmed || null;
  if (inputType === "number") {
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n.toString();
  }
  if (inputType === "integer") {
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? null : n;
  }
  if (inputType === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }
  return null;
}

const isLegalRole = (role: string) => role === "legal" || role === "ambos";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { path, value } = parsed.data;

    // Validate path is writable
    const entry = WRITEBACK_MAP[path];
    if (!entry || entry.entity === "agency") {
      return NextResponse.json({ error: "Variable no escribible" }, { status: 400 });
    }

    // Validate value type
    const coerced = coerceValue(value, entry.inputType);
    if (coerced === null) {
      return NextResponse.json({ error: "Valor inválido para este campo" }, { status: 400 });
    }

    // Fetch contract (needed for all entity types)
    const [contractRow] = await db
      .select({ id: contract.id, propertyId: contract.propertyId, ownerId: contract.ownerId })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    // Update the right entity
    if (entry.entity === "contract") {
      await db
        .update(contract)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(contract.id, contractId));
    } else if (entry.entity === "property") {
      await db
        .update(property)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(property.id, contractRow.propertyId));
    } else if (entry.entity === "owner") {
      // Resolve the legal owner (same logic as document-templates/resolve)
      const [[propertyRow], coOwners] = await Promise.all([
        db
          .select({ ownerRole: property.ownerRole })
          .from(property)
          .where(eq(property.id, contractRow.propertyId))
          .limit(1)
          .then((r) => r),
        db
          .select({ clientId: propertyCoOwner.clientId, role: propertyCoOwner.role })
          .from(propertyCoOwner)
          .where(eq(propertyCoOwner.propertyId, contractRow.propertyId)),
      ]);

      let legalOwnerId = contractRow.ownerId;
      if (propertyRow && !isLegalRole(propertyRow.ownerRole)) {
        const legal = coOwners.find((co) => isLegalRole(co.role));
        if (legal) legalOwnerId = legal.clientId;
      }

      await db
        .update(client)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(client.id, legalOwnerId));
    } else if (entry.entity === "tenant_0") {
      const [tenantRow] = await db
        .select({ clientId: contractParticipant.clientId })
        .from(contractParticipant)
        .where(
          and(
            eq(contractParticipant.contractId, contractId),
            eq(contractParticipant.role, "tenant")
          )
        )
        .orderBy(asc(contractParticipant.createdAt))
        .limit(1);

      if (!tenantRow) {
        return NextResponse.json({ error: "Inquilino principal no encontrado" }, { status: 404 });
      }

      await db
        .update(client)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(client.id, tenantRow.clientId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error PATCH /api/contracts/:id/variable-writeback:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
