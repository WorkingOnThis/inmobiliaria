import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { applyIndexToContracts } from "@/lib/ledger/apply-index";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const putSchema = z.object({
  value: z.coerce.number().min(0).max(200),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = putSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: adjustmentIndexValue.id, auditedAt: adjustmentIndexValue.auditedAt, indexType: adjustmentIndexValue.indexType })
      .from(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Valor no encontrado" }, { status: 404 });
    }

    if (existing.auditedAt !== null) {
      return NextResponse.json(
        { error: "Este valor está auditado. Quitá el sello antes de modificarlo." },
        { status: 409 }
      );
    }

    await db
      .update(adjustmentIndexValue)
      .set({ value: result.data.value.toString(), source: "manual" })
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)));

    const { contractsAffected, provisionalCount } = await applyIndexToContracts(
      existing.indexType,
      agencyId,
      session!.user.id,
    );

    return NextResponse.json({ message: "Valor actualizado", contractsAffected, provisionalCount });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al actualizar el valor" }, { status: 500 });
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: adjustmentIndexValue.id, auditedAt: adjustmentIndexValue.auditedAt })
      .from(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Valor no encontrado" }, { status: 404 });
    }

    const isAudited = existing.auditedAt !== null;

    await db
      .update(adjustmentIndexValue)
      .set(
        isAudited
          ? { auditedAt: null, auditedBy: null }
          : { auditedAt: new Date(), auditedBy: session!.user.id }
      )
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)));

    return NextResponse.json({ audited: !isAudited });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al actualizar el valor" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: adjustmentIndexValue.id, auditedAt: adjustmentIndexValue.auditedAt })
      .from(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Valor no encontrado" }, { status: 404 });
    }

    if (existing.auditedAt !== null) {
      return NextResponse.json(
        { error: "Este valor está auditado. Quitá el sello antes de eliminarlo." },
        { status: 409 }
      );
    }

    await db
      .delete(adjustmentIndexValue)
      .where(and(eq(adjustmentIndexValue.id, id), eq(adjustmentIndexValue.agencyId, agencyId)));

    return NextResponse.json({ message: "Valor eliminado" });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al eliminar el valor" }, { status: 500 });
  }
}
