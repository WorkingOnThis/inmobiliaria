import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { canManageCash } from "@/lib/permissions";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { formatAddress } from "@/lib/properties/format-address";
import { alias } from "drizzle-orm/pg-core";

/**
 * GET /api/cash/movimientos?periodo=YYYY-MM
 *
 * Devuelve todos los movimientos del período indicado,
 * con los datos relacionados (contrato, propiedad, propietario, inquilino).
 *
 * Si no se pasa `periodo`, devuelve el mes actual.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { searchParams } = request.nextUrl;
    const periodo = searchParams.get("periodo"); // "YYYY-MM"

    // Calcular rango de fechas del período
    const hoy = new Date();
    const anio = periodo ? parseInt(periodo.split("-")[0]) : hoy.getFullYear();
    const mes = periodo ? parseInt(periodo.split("-")[1]) : hoy.getMonth() + 1;
    const fechaInicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fechaFin = `${anio}-${String(mes).padStart(2, "0")}-${ultimoDia}`;

    const propietarioAlias = alias(client, "propietario");
    const inquilinoAlias = alias(client, "inquilino");

    const movimientos = await db
      .select({
        id: cajaMovimiento.id,
        fecha: cajaMovimiento.date,
        descripcion: cajaMovimiento.description,
        tipo: cajaMovimiento.tipo,
        categoria: cajaMovimiento.categoria,
        monto: cajaMovimiento.amount,
        origen: cajaMovimiento.source,
        comprobante: cajaMovimiento.comprobante,
        nota: cajaMovimiento.note,
        tipoFondo: cajaMovimiento.tipoFondo,
        creadoEn: cajaMovimiento.createdAt,
        reciboNumero: cajaMovimiento.reciboNumero,
        liquidadoAt: cajaMovimiento.settledAt,
        anuladoAt: cajaMovimiento.anuladoAt,
        anulacionId: cajaMovimiento.annulmentId,
        // Contrato vinculado
        contratoId: cajaMovimiento.contratoId,
        contratoNumero: contract.contractNumber,
        // Propiedad vinculada
        propiedadId: cajaMovimiento.propiedadId,
        propiedadDireccion: formatAddress({ addressStreet: property.addressStreet ?? "", addressNumber: property.addressNumber, floorUnit: property.floorUnit }),
        // Propietario vinculado
        propietarioId: cajaMovimiento.propietarioId,
        propietarioNombre: sql<string | null>`
          CASE WHEN ${propietarioAlias.id} IS NOT NULL
            THEN TRIM(CONCAT(${propietarioAlias.firstName}, ' ', COALESCE(${propietarioAlias.lastName}, '')))
            ELSE NULL
          END
        `,
        // Inquilino vinculado
        inquilinoId: cajaMovimiento.inquilinoId,
        inquilinoNombre: sql<string | null>`
          CASE WHEN ${inquilinoAlias.id} IS NOT NULL
            THEN TRIM(CONCAT(${inquilinoAlias.firstName}, ' ', COALESCE(${inquilinoAlias.lastName}, '')))
            ELSE NULL
          END
        `,
      })
      .from(cajaMovimiento)
      .leftJoin(contract, eq(cajaMovimiento.contratoId, contract.id))
      .leftJoin(property, eq(cajaMovimiento.propiedadId, property.id))
      .leftJoin(propietarioAlias, eq(cajaMovimiento.propietarioId, propietarioAlias.id))
      .leftJoin(inquilinoAlias, eq(cajaMovimiento.inquilinoId, inquilinoAlias.id))
      .where(
        and(
          eq(cajaMovimiento.agencyId, agencyId),
          gte(cajaMovimiento.date, fechaInicio),
          lte(cajaMovimiento.date, fechaFin)
        )
      )
      .orderBy(sql`${cajaMovimiento.date} DESC, ${cajaMovimiento.createdAt} DESC`);

    // Calcular totales del período
    const movimientosActivos = movimientos.filter((m) => m.anuladoAt === null);

    // Bruto: cash the agency actually received (agencia fund income)
    const bruto = movimientosActivos
      .filter((m) => m.tipo === "income" && m.tipoFondo === "agencia")
      .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

    // Owner in-transit income (before commission deduction)
    const ingresosPropietario = movimientosActivos
      .filter((m) => m.tipo === "income" && m.tipoFondo === "propietario")
      .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

    // Commission retained by agency from Modality-A receipts (deducted from owner payout)
    const honorariosRetenidos = movimientosActivos
      .filter((m) => m.tipo === "expense" && m.categoria === "honorarios_administracion")
      .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

    // What will be forwarded to owners = in-transit minus retained commission
    const aLiquidar = ingresosPropietario - honorariosRetenidos;

    // Other agency expenses (manual, operational — not commission retention)
    const otrosEgresos = movimientosActivos
      .filter((m) => m.tipo === "expense" && m.categoria !== "honorarios_administracion")
      .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

    const neto = bruto - aLiquidar - otrosEgresos;

    return NextResponse.json({
      movimientos,
      totales: {
        bruto,
        aLiquidar,
        neto,
        otrosEgresos,
      },
      periodo: { anio, mes, fechaInicio, fechaFin },
    });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/cash/movimientos
 *
 * Crea un nuevo movimiento manual de caja.
 *
 * Body:
 *   fecha        string  "YYYY-MM-DD"  requerido
 *   descripcion  string               requerido
 *   tipo         string  "income" | "expense"  requerido
 *   monto        number               requerido, > 0
 *   categoria    string               opcional
 *   contratoId   string               opcional
 *   propietarioId string              opcional
 *   inquilinoId  string               opcional
 *   propiedadId  string               opcional
 *   comprobante  string               opcional
 *   nota         string               opcional
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageCash(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { fecha, descripcion, tipo, monto, categoria, contratoId, propietarioId, inquilinoId, propiedadId, comprobante, nota } = body as Record<string, string>;

    // Validaciones
    if (!fecha || typeof fecha !== "string") {
      return NextResponse.json({ error: "La fecha es requerida" }, { status: 400 });
    }
    if (!descripcion || typeof descripcion !== "string" || descripcion.trim() === "") {
      return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
    }
    if (tipo !== "income" && tipo !== "expense") {
      return NextResponse.json({ error: "El tipo debe ser 'income' o 'expense'" }, { status: 400 });
    }
    const montoNum = parseFloat(String(monto));
    if (isNaN(montoNum) || montoNum <= 0) {
      return NextResponse.json({ error: "El monto debe ser un número mayor a 0" }, { status: 400 });
    }

    const [nuevo] = await db
      .insert(cajaMovimiento)
      .values({
        agencyId,
        date: fecha,
        description: descripcion.trim(),
        tipo,
        amount: String(montoNum),
        categoria: categoria?.trim() || null,
        source: "manual",
        contratoId: contratoId || null,
        propietarioId: propietarioId || null,
        inquilinoId: inquilinoId || null,
        propiedadId: propiedadId || null,
        comprobante: comprobante?.trim() || null,
        note: nota?.trim() || null,
        createdBy: session!.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ movimiento: nuevo }, { status: 201 });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/cash/movimientos
 *
 * Elimina varios movimientos manuales en una sola operación.
 * Body: { ids: string[] }
 * Solo elimina los que tengan source="manual"; ignora el resto silenciosamente.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageCash(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    let body: { ids: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "ids debe ser un array de strings no vacío" }, { status: 400 });
    }

    const eliminados = await db
      .delete(cajaMovimiento)
      .where(and(
        inArray(cajaMovimiento.id, ids as string[]),
        eq(cajaMovimiento.source, "manual"),
        eq(cajaMovimiento.agencyId, agencyId),
      ))
      .returning({ id: cajaMovimiento.id });

    return NextResponse.json({ eliminados: eliminados.length });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
