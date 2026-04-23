import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and, max } from "drizzle-orm";
import { z } from "zod";

const createClauseSchema = z.object({
  title: z.string().max(300).default(""),
  body: z.string().max(100000).default(""),
  category: z.string().max(100).default("general"),
  isOptional: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
});

async function getUserAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: templateId } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    // Verify template belongs to this agency
    const [template] = await db
      .select({ id: documentTemplate.id })
      .from(documentTemplate)
      .where(and(eq(documentTemplate.id, templateId), eq(documentTemplate.agencyId, agencyId)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
