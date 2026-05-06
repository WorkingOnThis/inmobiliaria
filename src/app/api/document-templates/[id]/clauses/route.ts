import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, max } from "drizzle-orm";
import { z } from "zod";

const createClauseSchema = z.object({
  title: z.string().max(300).default(""),
  body: z.string().max(100000).default(""),
  category: z.string().max(100).default("general"),
  isOptional: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: templateId } = await params;
    // Verify template belongs to this agency
    await requireAgencyResource(documentTemplate, templateId, agencyId);

    // Get current max order to append at end
    const [maxRow] = await db
      .select({ maxOrder: max(documentTemplateClause.order) })
      .from(documentTemplateClause)
      .where(eq(documentTemplateClause.templateId, templateId));

    const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

    const body = await request.json();
    const parsed = createClauseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const [clause] = await db
      .insert(documentTemplateClause)
      .values({
        id: crypto.randomUUID(),
        templateId,
        title: parsed.data.title.trim(),
        body: parsed.data.body,
        order: nextOrder,
        isActive: true,
        category: parsed.data.category,
        isOptional: parsed.data.isOptional,
        notes: parsed.data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ clause }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
