import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)))
      .limit(1);

    if (!contractRow || !EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(contractClause)
          .set({ order: i, updatedAt: new Date() })
          .where(
            and(
              eq(contractClause.id, parsed.data.orderedIds[i]),
              eq(contractClause.contractId, contractId),
              eq(contractClause.documentType, documentType)
            )
          );
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
