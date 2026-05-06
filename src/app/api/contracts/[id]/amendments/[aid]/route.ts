import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { VALID_TRANSITIONS } from "@/lib/contracts/amendments";

const patchSchema = z.object({
  status: z.enum(["document_generated", "signed"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id: contractId, aid } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [row] = await db
      .select()
      .from(contractAmendment)
      .where(and(
        eq(contractAmendment.id, aid),
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.agencyId, agencyId),
      ))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    return NextResponse.json({ amendment: row });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId, aid } = await params;
    await requireAgencyResource(contract, contractId, agencyId);
    const body = patchSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const { status: newStatus } = body.data;

    const [row] = await db
      .select()
      .from(contractAmendment)
      .where(and(
        eq(contractAmendment.id, aid),
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.agencyId, agencyId),
      ))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    const validNext = VALID_TRANSITIONS[row.status] ?? [];
    if (!validNext.includes(newStatus)) {
      return NextResponse.json({
        error: `Transición inválida: ${row.status} → ${newStatus}`,
      }, { status: 400 });
    }

    const update: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    if (newStatus === "signed") update.signedAt = new Date();

    const [updated] = await db
      .update(contractAmendment)
      .set(update as never)
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.agencyId, agencyId)))
      .returning();

    return NextResponse.json({ amendment: updated });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId, aid } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [row] = await db
      .select()
      .from(contractAmendment)
      .where(and(
        eq(contractAmendment.id, aid),
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.agencyId, agencyId),
      ))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    if (row.status !== "registered") {
      return NextResponse.json({
        error: "Solo se pueden eliminar instrumentos en estado 'registrado'",
      }, { status: 409 });
    }

    if (row.documentContent) {
      return NextResponse.json({
        error: "El instrumento ya tiene un documento generado. No se puede eliminar.",
      }, { status: 409 });
    }

    // Revert contract to snapshot and delete amendment in a single transaction
    const snapshot = row.contractSnapshot as Record<string, unknown>;
    await db.transaction(async (tx) => {
      await tx
        .update(contract)
        .set({ ...snapshot, updatedAt: new Date() } as never)
        .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)));

      await tx
        .delete(contractAmendment)
        .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.agencyId, agencyId)));
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
