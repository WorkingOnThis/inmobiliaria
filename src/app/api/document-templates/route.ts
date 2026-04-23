import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { documentTemplate } from "@/db/schema/document-template";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  body: z.string().max(100000).default(""),
});

async function getUserAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) {
      return NextResponse.json({ templates: [] });
    }

    const templates = await db
      .select()
      .from(documentTemplate)
      .where(eq(documentTemplate.agencyId, agencyId))
      .orderBy(desc(documentTemplate.createdAt));

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) {
      return NextResponse.json(
        { error: "El usuario no tiene agencia asociada" },
        { status: 422 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const [template] = await db
      .insert(documentTemplate)
      .values({
        id: crypto.randomUUID(),
        agencyId,
        name: parsed.data.name.trim(),
        body: parsed.data.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
