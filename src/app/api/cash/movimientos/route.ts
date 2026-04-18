import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

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
      creadoEn: cajaMovimiento.createdAt,
      // Contrato vinculado
      contratoId: cajaMovimiento.contratoId,
      contratoNumero: contract.contractNumber,
      // Propiedad vinculada
      propiedadId: cajaMovimiento.propiedadId,
      propiedadDireccion: property.address,
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
        gte(cajaMovimiento.date, fechaInicio),
        lte(cajaMovimiento.date, fechaFin)
      )
    )
    .orderBy(sql`${cajaMovimiento.date} DESC, ${cajaMovimiento.createdAt} DESC`);

  // Calcular totales del período
  const totalIngresos = movimientos
    .filter((m) => m.tipo === "income")
    .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

  const totalEgresos = movimientos
    .filter((m) => m.tipo === "expense")
    .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

  return NextResponse.json({
    movimientos,
    totales: {
      ingresos: totalIngresos,
      egresos: totalEgresos,
      saldo: totalIngresos - totalEgresos,
    },
    periodo: { anio, mes, fechaInicio, fechaFin },
  });
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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
      createdBy: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ movimiento: nuevo }, { status: 201 });
}
