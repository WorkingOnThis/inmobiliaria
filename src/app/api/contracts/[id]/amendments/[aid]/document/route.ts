import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import {
  requireAgencyId,
  requireAgencyResource,
  handleAgencyError,
} from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";

// POST: transition the amendment to "document_generated".
// Documents are now rendered on-demand via the page route
// /contratos/[id]/modificaciones/[aid] — we no longer store HTML.
export async function POST(
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

    const [amendment] = await db
      .select({ id: contractAmendment.id })
      .from(contractAmendment)
      .where(
        and(
          eq(contractAmendment.id, aid),
          eq(contractAmendment.contractId, contractId),
          eq(contractAmendment.agencyId, agencyId)
        )
      )
      .limit(1);

    if (!amendment) {
      return NextResponse.json(
        { error: "Instrumento no encontrado" },
        { status: 404 }
      );
    }

    await db
      .update(contractAmendment)
      .set({ status: "document_generated", updatedAt: new Date() })
      .where(
        and(
          eq(contractAmendment.id, aid),
          eq(contractAmendment.agencyId, agencyId)
        )
      );

    return NextResponse.json({ ok: true, status: "document_generated" });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET: redirect to the new page route. Kept for backwards compatibility
// with any callers (bookmarks, old UI builds) still hitting the API URL.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const { id, aid } = await params;
  return NextResponse.redirect(
    new URL(`/contratos/${id}/modificaciones/${aid}`, _req.url),
    { status: 307 }
  );
}
