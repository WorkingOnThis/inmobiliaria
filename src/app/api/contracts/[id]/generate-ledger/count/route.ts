import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { eq, count } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;

    const [result] = await db
      .select({ count: count() })
      .from(tenantLedger)
      .where(eq(tenantLedger.contratoId, contractId));

    return NextResponse.json({ count: result?.count ?? 0 });
  } catch (error) {
    console.error("Error GET generate-ledger/count:", error);
    return NextResponse.json({ error: "Error al contar entradas" }, { status: 500 });
  }
}
