import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq, inArray, sql, sum } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: propietarioId } = await params;

    const currentYear = new Date().getFullYear().toString();

    const [entries, ytdResult, pendienteResult] = await Promise.all([
      db
        .select()
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.propietarioId, propietarioId),
            eq(tenantLedger.impactaPropietario, true)
          )
        )
        .orderBy(tenantLedger.period, tenantLedger.tipo),

      db
        .select({ total: sum(tenantLedger.monto) })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.propietarioId, propietarioId),
            eq(tenantLedger.estado, "conciliado"),
            eq(tenantLedger.impactaPropietario, true),
            sql`extract(year from ${tenantLedger.dueDate}::date) = ${currentYear}`
          )
        )
        .then((rows) => rows[0]),

      db
        .select({ total: sum(tenantLedger.monto) })
        .from(tenantLedger)
        .where(
          and(
            eq(tenantLedger.propietarioId, propietarioId),
            eq(tenantLedger.impactaPropietario, true),
            inArray(tenantLedger.estado, ["pendiente", "registrado"])
          )
        )
        .then((rows) => rows[0]),
    ]);

    return NextResponse.json({
      kpis: {
        totalLiquidadoYTD: Number(ytdResult?.total ?? 0),
        totalPendiente: Number(pendienteResult?.total ?? 0),
      },
      ledgerEntries: entries,
    });
  } catch (error) {
    console.error("Error GET /api/owners/:id/cuenta-corriente:", error);
    return NextResponse.json({ error: "Error al obtener la cuenta corriente" }, { status: 500 });
  }
}
