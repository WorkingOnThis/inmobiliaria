import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchClauseSchema = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(100000).optional(),
  isActive: z.boolean().optional(),
  category: z.string().max(100).optional(),
  isOptional: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: templateId, clauseId } = await params;
    await requireAgencyResource(documentTemplate, templateId, agencyId);

    const body = await request.json();
    const parsed = patchClauseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
    if (parsed.data.body !== undefined) updates.body = parsed.data.body;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.category !== undefined) updates.category = parsed.data.category;
    if (parsed.data.isOptional !== undefined) updates.isOptional = parsed.data.isOptional;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    const [clause] = await db
      .update(documentTemplateClause)
      .set(updates)
      .where(
        and(
          eq(documentTemplateClause.id, clauseId),
          eq(documentTemplateClause.templateId, templateId)
        )
      )
      .returning();

    if (!clause) {
      return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ clause });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: templateId, clauseId } = await params;
    await requireAgencyResource(documentTemplate, templateId, agencyId);

    const [deleted] = await db
      .delete(documentTemplateClause)
      .where(
        and(
          eq(documentTemplateClause.id, clauseId),
          eq(documentTemplateClause.templateId, templateId)
        )
      )
      .returning({ id: documentTemplateClause.id });

    if (!deleted) {
      return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
