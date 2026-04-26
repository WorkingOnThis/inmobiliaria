import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq, sum, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
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

    const { id } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    // All ledger entries for this tenant, ordered by period then tipo
    const entries = await db
      .select()
      .from(tenantLedger)
      .where(eq(tenantLedger.inquilinoId, id))
      .orderBy(tenantLedger.period, tenantLedger.tipo);

    // KPI: total collected YTD (conciliado, alquiler tipo)
    const currentYear = new Date().getFullYear().toString();
    const [ytdResult] = await db
      .select({ total: sum(tenantLedger.monto) })
      .from(tenantLedger)
      .where(
        and(
          eq(tenantLedger.inquilinoId, id),
          eq(tenantLedger.estado, "conciliado"),
          eq(tenantLedger.tipo, "alquiler"),
          sql`substring(${tenantLedger.period}, 1, 4) = ${currentYear}`
        )
      );

    // Next pending alquiler entry (first pending from current period onward)
    const todayPeriod = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const nextPendingAlquiler = entries.find(
      (e) => e.tipo === "alquiler" && e.estado === "pendiente" && (e.period ?? "") >= todayPeriod
    );

    // proximoAjuste — first entry with estado="pendiente_revision"
    const firstPendingRevision = entries.find((e) => e.estado === "pendiente_revision");

    // Estado de cuenta: in mora if any alquiler is pendiente and past its dueDate
    const today = new Date().toISOString().slice(0, 10);
    const hayMora = entries.some(
      (e) =>
        e.tipo === "alquiler" &&
        e.estado === "pendiente" &&
        e.dueDate !== null &&
        e.dueDate < today
    );

    const kpis = {
      estadoCuenta: hayMora ? "en_mora" : "al_dia",
      totalCobradoYTD: Number(ytdResult?.total ?? 0),
      proximoPago: nextPendingAlquiler
        ? { fecha: nextPendingAlquiler.dueDate, monto: nextPendingAlquiler.monto }
        : null,
    };

    const proximoAjuste = firstPendingRevision
      ? {
          period: firstPendingRevision.period,
          mesesRestantes: firstPendingRevision.period
            ? Math.max(
                0,
                (parseInt(firstPendingRevision.period.slice(0, 4)) - new Date().getFullYear()) * 12 +
                  (parseInt(firstPendingRevision.period.slice(5, 7)) - (new Date().getMonth() + 1))
              )
            : null,
        }
      : null;

    return NextResponse.json({ kpis, ledgerEntries: entries, proximoAjuste });
  } catch (error) {
    console.error("Error GET /api/tenants/:id/cuenta-corriente:", error);
    return NextResponse.json({ error: "Error al obtener la cuenta corriente" }, { status: 500 });
  }
}
