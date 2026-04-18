import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq, like, max } from "drizzle-orm";

async function nextReciboNumero(): Promise<string> {
  const [row] = await db
    .select({ last: max(cajaMovimiento.reciboNumero) })
    .from(cajaMovimiento)
    .where(like(cajaMovimiento.reciboNumero, "REC-%"));

  let next = 1;
  if (row?.last) {
    const num = parseInt(row.last.replace("REC-", ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `REC-${String(next).padStart(4, "0")}`;
}

export async function POST(
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
      .where(and(eq(client.id, id), eq(client.type, "tenant")))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { tipo, descripcion, monto, fecha, categoria, nota, periodo, contratoId, propiedadId } = body;

    if (!tipo || !descripcion || !monto || !fecha) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    if (tipo !== "income" && tipo !== "expense") {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    // Generar número de recibo solo para ingresos de alquiler
    let reciboNumero: string | null = null;
    if (tipo === "income" && categoria === "alquiler") {
      reciboNumero = await nextReciboNumero();
    }

    const [nuevo] = await db
      .insert(cajaMovimiento)
      .values({
        tipo,
        descripcion,
        monto: String(monto),
        fecha,
        categoria: categoria || null,
        nota: nota || null,
        periodo: periodo || null,
        reciboNumero,
        inquilinoId: id,
        contratoId: contratoId || null,
        propiedadId: propiedadId || null,
        origen: "manual" as const,
        creadoPor: session.user.id,
      })
      .returning();

    return NextResponse.json(nuevo, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/inquilinos/:id/movimientos:", error);
    return NextResponse.json({ error: "Error al registrar movimiento" }, { status: 500 });
  }
}
