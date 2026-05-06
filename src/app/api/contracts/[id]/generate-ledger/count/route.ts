import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq, count } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [result] = await db
      .select({ count: count() })
      .from(tenantLedger)
      .where(and(eq(tenantLedger.contratoId, contractId), eq(tenantLedger.agencyId, agencyId)));

    return NextResponse.json({ count: result?.count ?? 0 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET generate-ledger/count:", error);
    return NextResponse.json({ error: "Error al contar entradas" }, { status: 500 });
  }
}
