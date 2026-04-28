import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { contractDocumentConfig } from "@/db/schema/contract-document-config";
import { documentTemplate } from "@/db/schema/document-template";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });

    const [config] = await db
      .select({ appliedTemplateId: contractDocumentConfig.appliedTemplateId, appliedAt: contractDocumentConfig.appliedAt })
      .from(contractDocumentConfig)
      .where(and(eq(contractDocumentConfig.contractId, contractId), eq(contractDocumentConfig.documentType, documentType)))
      .limit(1);

    const clauses = await db
      .select()
      .from(contractClause)
      .where(and(eq(contractClause.contractId, contractId), eq(contractClause.documentType, documentType)))
      .orderBy(asc(contractClause.order));

    let templateName: string | null = null;
    if (config?.appliedTemplateId) {
      const [tmpl] = await db
        .select({ name: documentTemplate.name })
        .from(documentTemplate)
        .where(eq(documentTemplate.id, config.appliedTemplateId))
        .limit(1);
      templateName = tmpl?.name ?? null;
    }

    return NextResponse.json({
      clauses,
      config: config ? { ...config, templateName } : null,
      isEditable: EDITABLE_STATUSES.includes(contractRow.status),
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const createClauseSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  body: z.string().default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createClauseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const existing = await db
      .select({ order: contractClause.order })
      .from(contractClause)
      .where(and(eq(contractClause.contractId, contractId), eq(contractClause.documentType, documentType)))
      .orderBy(asc(contractClause.order));

    const maxOrder = existing.length > 0 ? existing[existing.length - 1].order : -1;

    const [created] = await db
      .insert(contractClause)
      .values({
        contractId,
        documentType,
        sourceClauseId: null,
        title: parsed.data.title,
        body: parsed.data.body,
        isActive: true,
        order: maxOrder + 1,
        fieldOverrides: {},
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
