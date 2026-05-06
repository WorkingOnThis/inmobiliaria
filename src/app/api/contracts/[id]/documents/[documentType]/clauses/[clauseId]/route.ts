import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  isActive: z.boolean().optional(),
  fieldOverrides: z.record(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, clauseId } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)))
      .limit(1);

    if (!contractRow || !EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const [updated] = await db
      .update(contractClause)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(contractClause.id, clauseId), eq(contractClause.contractId, contractId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, clauseId } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)))
      .limit(1);

    if (!contractRow || !EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const [clause] = await db
      .select({ sourceClauseId: contractClause.sourceClauseId })
      .from(contractClause)
      .where(and(eq(contractClause.id, clauseId), eq(contractClause.contractId, contractId)))
      .limit(1);

    if (!clause) return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });

    if (clause.sourceClauseId !== null) {
      return NextResponse.json(
        { error: "Las cláusulas de plantilla no se pueden eliminar, solo desactivar" },
        { status: 400 }
      );
    }

    await db.delete(contractClause).where(and(eq(contractClause.id, clauseId), eq(contractClause.contractId, contractId)));
    return NextResponse.json({ success: true });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
