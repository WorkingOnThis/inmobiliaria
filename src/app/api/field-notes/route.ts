import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { fieldNote } from "@/db/schema/field-note";
import { user } from "@/db/schema/better-auth";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const entityType = request.nextUrl.searchParams.get("entityType") ?? "";
    const entityId = request.nextUrl.searchParams.get("entityId") ?? "";

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "Parámetros entityType y entityId son requeridos" }, { status: 400 });
    }

    const rows = await db
      .select({
        id: fieldNote.id,
        fieldName: fieldNote.fieldName,
        comment: fieldNote.comment,
        authorId: fieldNote.authorId,
        authorName: user.name,
        createdAt: fieldNote.createdAt,
        updatedAt: fieldNote.updatedAt,
      })
      .from(fieldNote)
      .innerJoin(user, eq(user.id, fieldNote.authorId))
      .where(
        and(
          eq(fieldNote.agencyId, agencyId),
          eq(fieldNote.entityType, entityType),
          eq(fieldNote.entityId, entityId)
        )
      );

    return NextResponse.json(rows);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/field-notes:", error);
    return NextResponse.json({ error: "Error al obtener notas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const role = session!.user.role as string;
    if (role !== "agent" && role !== "account_admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const body = await request.json();
    const { entityType, entityId, fieldName, comment } = body;

    if (!entityType || !entityId || !fieldName || !comment?.trim()) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: fieldNote.id })
      .from(fieldNote)
      .where(
        and(
          eq(fieldNote.agencyId, agencyId),
          eq(fieldNote.entityType, entityType),
          eq(fieldNote.entityId, entityId),
          eq(fieldNote.fieldName, fieldName),
          eq(fieldNote.authorId, session!.user.id)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Ya existe una nota tuya para este campo" }, { status: 409 });
    }

    const [created] = await db
      .insert(fieldNote)
      .values({
        id: crypto.randomUUID(),
        agencyId,
        entityType,
        entityId,
        fieldName,
        comment: comment.trim(),
        authorId: session!.user.id,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating field note:", error);
    return NextResponse.json({ error: "Error al crear nota" }, { status: 500 });
  }
}
