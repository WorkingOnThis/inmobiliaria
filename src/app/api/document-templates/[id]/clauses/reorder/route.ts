import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

async function getUserAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function PUT(
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
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const [template] = await db
      .select({ id: documentTemplate.id })
      .from(documentTemplate)
      .where(and(eq(documentTemplate.id, templateId), eq(documentTemplate.agencyId, agencyId)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Update each clause's order within a transaction
    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(documentTemplateClause)
          .set({ order: i, updatedAt: new Date() })
          .where(
            and(
              eq(documentTemplateClause.id, parsed.data.orderedIds[i]),
              eq(documentTemplateClause.templateId, templateId)
            )
          );
      }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
