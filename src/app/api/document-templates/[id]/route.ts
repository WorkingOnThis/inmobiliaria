import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate } from "@/db/schema/document-template";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  body: z.string().max(100000).optional(),
});

async function getUserAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function GET(
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

    const { id } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const [template] = await db
      .select()
      .from(documentTemplate)
      .where(
        and(eq(documentTemplate.id, id), eq(documentTemplate.agencyId, agencyId))
      )
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
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

    const { id } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.body !== undefined) updates.body = parsed.data.body;

    const [template] = await db
      .update(documentTemplate)
      .set(updates)
      .where(
        and(eq(documentTemplate.id, id), eq(documentTemplate.agencyId, agencyId))
      )
      .returning();

    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
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

    const { id } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const [deleted] = await db
      .delete(documentTemplate)
      .where(
        and(eq(documentTemplate.id, id), eq(documentTemplate.agencyId, agencyId))
      )
      .returning({ id: documentTemplate.id });

    if (!deleted) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
