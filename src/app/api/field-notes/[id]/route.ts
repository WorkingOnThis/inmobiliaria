import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { fieldNote } from "@/db/schema/field-note";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const role = session!.user.role as string;
    if (role !== "agent" && role !== "account_admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const comment = body.comment?.trim();

    if (!comment) {
      return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
    }

    // Validar que la nota pertenece a la agency
    const existing = await requireAgencyResource(fieldNote, id, agencyId);

    if (existing.authorId !== session!.user.id) {
      return NextResponse.json({ error: "Solo podés editar tus propias notas" }, { status: 403 });
    }

    const [updated] = await db
      .update(fieldNote)
      .set({ comment, updatedAt: new Date() })
      .where(and(eq(fieldNote.id, id), eq(fieldNote.agencyId, agencyId)))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error updating field note:", error);
    return NextResponse.json({ error: "Error al actualizar nota" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const role = session!.user.role as string;
    if (role !== "agent" && role !== "account_admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await requireAgencyResource(fieldNote, id, agencyId);

    if (existing.authorId !== session!.user.id) {
      return NextResponse.json({ error: "Solo podés eliminar tus propias notas" }, { status: 403 });
    }

    await db
      .delete(fieldNote)
      .where(and(eq(fieldNote.id, id), eq(fieldNote.agencyId, agencyId)));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error deleting field note:", error);
    return NextResponse.json({ error: "Error al eliminar nota" }, { status: 500 });
  }
}
