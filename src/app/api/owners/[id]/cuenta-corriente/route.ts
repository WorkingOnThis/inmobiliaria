import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { cajaMovimiento } from "@/db/schema/caja";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, desc, eq, sql, sum } from "drizzle-orm";

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

    // Verificar que existe
    const [propietario] = await db
      .select({ id: client.id, firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(and(eq(client.id, id), eq(client.type, "propietario")))
      .limit(1);

    if (!propietario) {
      return NextResponse.json({ error: "Propietario no encontrado" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propiedadFilter = searchParams.get("propiedadId");
    const periodoFilter = searchParams.get("periodo"); // "YYYY-MM"

    // --- Movimientos de este propietario ---
    const baseWhere = eq(cajaMovimiento.propietarioId, id);

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
        comprobante: cajaMovimiento.comprobante,
        nota: cajaMovimiento.note,
        creadoEn: cajaMovimiento.createdAt,
        conciliado: cajaMovimiento.reconciled,
        conciliadoEn: cajaMovimiento.reconciledAt,
        comprobanteUrl: cajaMovimiento.comprobanteUrl,
        comprobanteMime: cajaMovimiento.comprobanteMime,
      })
      .from(cajaMovimiento)
      .where(
        and(
          baseWhere,
          propiedadFilter ? eq(cajaMovimiento.propiedadId, propiedadFilter) : undefined,
          periodoFilter
            ? sql`to_char(${cajaMovimiento.date}::date, 'YYYY-MM') = ${periodoFilter}`
            : undefined
        )
      )
      .orderBy(desc(cajaMovimiento.date));

    // Enriquecer con dirección de propiedad
    const propIds = [...new Set(movimientos.map((m) => m.propiedadId).filter(Boolean))] as string[];
    let propAddressMap: Record<string, string> = {};
    if (propIds.length > 0) {
      const props = await db
        .select({ id: property.id, address: property.address })
        .from(property)
        .where(sql`${property.id} = ANY(${propIds})`);
      for (const p of props) propAddressMap[p.id] = p.address;
    }

    const movimientosEnriquecidos = movimientos.map((m) => ({
      ...m,
      propiedadAddress: m.propiedadId ? (propAddressMap[m.propiedadId] ?? null) : null,
      periodo: m.fecha ? m.fecha.substring(0, 7) : null, // "YYYY-MM"
    }));

    // --- KPIs ---
    const currentYear = new Date().getFullYear().toString();

    // Liquidado acumulado: egresos con origen "settlement" en el año actual
    const [liquidadoResult] = await db
      .select({ total: sum(cajaMovimiento.amount) })
      .from(cajaMovimiento)
      .where(
        and(
          eq(cajaMovimiento.propietarioId, id),
          eq(cajaMovimiento.tipo, "expense"),
          eq(cajaMovimiento.source, "settlement"),
          sql`extract(year from ${cajaMovimiento.date}::date) = ${currentYear}`
        )
      );

    // Ingresos aún no liquidados (source != settlement): son los que deberían liquidarse
    const [pendienteLiquidarResult] = await db
      .select({ total: sum(cajaMovimiento.amount) })
      .from(cajaMovimiento)
      .where(
        and(
          eq(cajaMovimiento.propietarioId, id),
          eq(cajaMovimiento.tipo, "income"),
          sql`${cajaMovimiento.source} != 'settlement'`
        )
      );

    // Pendiente de confirmar: categoría "pendiente_confirmacion"
    const [pendienteConfirmarResult] = await db
      .select({ total: sum(cajaMovimiento.amount) })
      .from(cajaMovimiento)
      .where(
        and(
          eq(cajaMovimiento.propietarioId, id),
          eq(cajaMovimiento.categoria, "pendiente_confirmacion")
        )
      );

    const kpis = {
      liquidadoAcumulado: Number(liquidadoResult?.total ?? 0),
      proximaLiquidacionEstimada: Number(pendienteLiquidarResult?.total ?? 0),
      pendienteConfirmar: Number(pendienteConfirmarResult?.total ?? 0),
    };

    return NextResponse.json({ kpis, movimientos: movimientosEnriquecidos });
  } catch (error) {
    console.error("Error GET /api/owners/:id/cuenta-corriente:", error);
    return NextResponse.json(
      { error: "Error al obtener la cuenta corriente" },
      { status: 500 }
    );
  }
}
