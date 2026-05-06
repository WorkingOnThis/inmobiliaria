import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { contractClause } from "@/db/schema/contract-clause";
import { contractDocumentConfig } from "@/db/schema/contract-document-config";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

const applySchema = z.object({
  templateId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)))
      .limit(1);

    if (!contractRow) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const [template] = await db
      .select({ id: documentTemplate.id })
      .from(documentTemplate)
      .where(and(eq(documentTemplate.id, parsed.data.templateId), eq(documentTemplate.agencyId, agencyId)))
      .limit(1);

    if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

    const templateClauses = await db
      .select()
      .from(documentTemplateClause)
      .where(eq(documentTemplateClause.templateId, template.id))
      .orderBy(documentTemplateClause.order);

    await db.transaction(async (tx) => {
      await tx
        .delete(contractClause)
        .where(and(eq(contractClause.contractId, contractId), eq(contractClause.documentType, documentType)));

      if (templateClauses.length > 0) {
        await tx.insert(contractClause).values(
          templateClauses.map((tc, i) => ({
            contractId,
            documentType,
            sourceClauseId: tc.id,
            title: tc.title,
            body: tc.body,
            isActive: tc.isActive,
            order: i,
            fieldOverrides: {},
          }))
        );
      }

      await tx
        .insert(contractDocumentConfig)
        .values({ contractId, documentType, appliedTemplateId: template.id })
        .onConflictDoUpdate({
          target: [contractDocumentConfig.contractId, contractDocumentConfig.documentType],
          set: { appliedTemplateId: template.id, appliedAt: new Date() },
        });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
