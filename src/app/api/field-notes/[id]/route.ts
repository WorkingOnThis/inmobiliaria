import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { fieldNote } from "@/db/schema/field-note";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const role = session.user.role as string;
  if (role !== "agent" && role !== "account_admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const comment = body.comment?.trim();

  if (!comment) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
  }

  const [existing] = await db
    .select({ authorId: fieldNote.authorId })
    .from(fieldNote)
    .where(eq(fieldNote.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Solo podés editar tus propias notas" }, { status: 403 });
  }

  const [updated] = await db
    .update(fieldNote)
    .set({ comment, updatedAt: new Date() })
    .where(eq(fieldNote.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const role = session.user.role as string;
  if (role !== "agent" && role !== "account_admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select({ authorId: fieldNote.authorId })
    .from(fieldNote)
    .where(eq(fieldNote.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Solo podés eliminar tus propias notas" }, { status: 403 });
  }

  await db.delete(fieldNote).where(eq(fieldNote.id, id));
  return new NextResponse(null, { status: 204 });
}
