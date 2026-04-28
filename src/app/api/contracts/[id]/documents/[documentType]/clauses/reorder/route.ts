import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
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
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
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
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
