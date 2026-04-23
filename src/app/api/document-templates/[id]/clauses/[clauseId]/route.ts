import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
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

async function getUserAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

async function verifyTemplateOwnership(
  templateId: string,
  agencyId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: documentTemplate.id })
    .from(documentTemplate)
    .where(and(eq(documentTemplate.id, templateId), eq(documentTemplate.agencyId, agencyId)))
    .limit(1);
  return !!row;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: templateId, clauseId } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId || !(await verifyTemplateOwnership(templateId, agencyId))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: templateId, clauseId } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId || !(await verifyTemplateOwnership(templateId, agencyId))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
