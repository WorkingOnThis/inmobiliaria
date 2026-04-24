import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { cajaMovimiento } from "@/db/schema/caja";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, desc, eq, inArray, sql, sum } from "drizzle-orm";

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
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [inquilino] = await db
      .select({ id: client.id, firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propiedadFilter = searchParams.get("propiedadId");
    const periodoFilter = searchParams.get("periodo"); // "YYYY-MM"

    const movimientos = await db
      .select({
        id: cajaMovimiento.id,
        fecha: cajaMovimiento.date,
        descripcion: cajaMovimiento.description,
        tipo: cajaMovimiento.tipo,
        categoria: cajaMovimiento.categoria,
        monto: cajaMovimiento.amount,
        origen: cajaMovimiento.source,
        contratoId: cajaMovimiento.contratoId,
        propiedadId: cajaMovimiento.propiedadId,
        nota: cajaMovimiento.note,
        period: cajaMovimiento.period,
        reciboNumero: cajaMovimiento.reciboNumero,
        creadoEn: cajaMovimiento.createdAt,
        reconciled: cajaMovimiento.reconciled,
      })
      .from(cajaMovimiento)
      .where(
        and(
          eq(cajaMovimiento.inquilinoId, id),
          propiedadFilter ? eq(cajaMovimiento.propiedadId, propiedadFilter) : undefined,
          periodoFilter
            ? sql`to_char(${cajaMovimiento.date}::date, 'YYYY-MM') = ${periodoFilter}`
            : undefined
        )
      )
      .orderBy(desc(cajaMovimiento.date));

    // Enrich with property address
    const propIds = [...new Set(movimientos.map((m) => m.propiedadId).filter(Boolean))] as string[];
    let propAddressMap: Record<string, string> = {};
    if (propIds.length > 0) {
      const props = await db
        .select({ id: property.id, address: property.address })
        .from(property)
        .where(inArray(property.id, propIds));
      for (const p of props) propAddressMap[p.id] = p.address;
    }

    const movimientosEnriquecidos = movimientos.map((m) => ({
      ...m,
      propiedadAddress: m.propiedadId ? (propAddressMap[m.propiedadId] ?? null) : null,
      periodo: m.fecha ? m.fecha.substring(0, 7) : null,
    }));

    // KPIs
    const currentYear = new Date().getFullYear().toString();

    // Active contract for next payment KPI
    const activeContract = await db
      .select({
        paymentDay: contract.paymentDay,
        monthlyAmount: contract.monthlyAmount,
        endDate: contract.endDate,
        status: contract.status,
      })
      .from(contract)
      .innerJoin(contractTenant, eq(contractTenant.contractId, contract.id))
      .where(
        and(
          eq(contractTenant.clientId, id),
          sql`${contract.status} IN ('active', 'expiring_soon')`
        )
      )
      .orderBy(desc(contract.startDate))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const [[totalCobradoResult], [punitriosResult]] = await Promise.all([
      db
        .select({ total: sum(cajaMovimiento.amount) })
        .from(cajaMovimiento)
        .where(
          and(
            eq(cajaMovimiento.inquilinoId, id),
            eq(cajaMovimiento.tipo, "income"),
            sql`extract(year from ${cajaMovimiento.date}::date) = ${currentYear}`
          )
        ),
      db
        .select({ total: sum(cajaMovimiento.amount) })
        .from(cajaMovimiento)
        .where(
          and(
            eq(cajaMovimiento.inquilinoId, id),
            eq(cajaMovimiento.tipo, "expense"),
            eq(cajaMovimiento.categoria, "punitorios")
          )
        ),
    ]);

    // Compute next payment date from active contract
    let proximoPago: { fecha: string; monto: string } | null = null;
    if (activeContract) {
      const today = new Date();
      const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), activeContract.paymentDay);
      const due = dueThisMonth >= today
        ? dueThisMonth
        : new Date(today.getFullYear(), today.getMonth() + 1, activeContract.paymentDay);
      proximoPago = {
        fecha: due.toISOString().slice(0, 10),
        monto: activeContract.monthlyAmount,
      };
    }

    const kpis = {
      totalCobradoYTD: Number(totalCobradoResult?.total ?? 0),
      punitorialAcumulado: Number(punitriosResult?.total ?? 0),
      proximoPago,
    };

    return NextResponse.json({ kpis, movimientos: movimientosEnriquecidos });
  } catch (error) {
    console.error("Error GET /api/tenants/:id/cuenta-corriente:", error);
    return NextResponse.json(
      { error: "Error al obtener la cuenta corriente" },
      { status: 500 }
    );
  }
}
