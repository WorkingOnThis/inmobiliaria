import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioComprobante, servicioOmision } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { calcularEstadoServicio } from "@/lib/servicios/constants";

const actualizarServicioSchema = z.object({
  empresa: z.string().optional().nullable(),
  numeroCuenta: z.string().optional().nullable(),
  metadatos: z.record(z.string()).optional().nullable(),
  titular: z.string().optional().nullable(),
  titularTipo: z.enum(["propietario", "inquilino", "otro"]).optional(),
  responsablePago: z.enum(["propietario", "inquilino"]).optional(),
  vencimientoDia: z.number().int().min(1).max(31).optional().nullable(),
  activaBloqueo: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const hoy = new Date();
  const periodoParam = searchParams.get("periodo");
  const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const [s] = await db.select().from(servicio).where(eq(servicio.id, id)).limit(1);
  if (!s) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  // Historial de comprobantes (últimos 12)
  const historial = await db
    .select()
    .from(servicioComprobante)
    .where(eq(servicioComprobante.servicioId, id))
    .orderBy(desc(servicioComprobante.periodo))
    .limit(12);

  // Comprobante y omisión del período actual
  const [comprobantePeriodo] = await db
    .select()
    .from(servicioComprobante)
    .where(and(eq(servicioComprobante.servicioId, id), eq(servicioComprobante.periodo, periodo)))
    .limit(1);

  const [omisionPeriodo] = await db
    .select()
    .from(servicioOmision)
    .where(and(eq(servicioOmision.servicioId, id), eq(servicioOmision.periodo, periodo)))
    .limit(1);

  const [year, month] = periodo.split("-").map(Number);
  const inicioPeriodo = new Date(year, month - 1, 1);
  const diasTranscurridos = Math.floor((new Date().getTime() - inicioPeriodo.getTime()) / (1000 * 60 * 60 * 24));

  const estado = calcularEstadoServicio({
    tieneComprobante: !!comprobantePeriodo,
    diasSinComprobante: comprobantePeriodo ? 0 : diasTranscurridos,
    activaBloqueo: s.activaBloqueo,
    tieneOmision: !!omisionPeriodo,
  });

  return NextResponse.json({
    item: s,
    periodo,
    estado,
    diasSinComprobante: comprobantePeriodo ? 0 : diasTranscurridos,
    comprobantePeriodo: comprobantePeriodo ?? null,
    omisionPeriodo: omisionPeriodo ?? null,
    historial,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageServices(session.user.role)) {
    return NextResponse.json({ error: "No tenés permisos para gestionar servicios" }, { status: 403 });
  }

  const { id } = await params;
  const [s] = await db.select().from(servicio).where(eq(servicio.id, id)).limit(1);
  if (!s) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const result = actualizarServicioSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
  }

  const data = result.data;
  const [actualizado] = await db
    .update(servicio)
    .set({
      ...(data.empresa !== undefined && { empresa: data.empresa }),
      ...(data.numeroCuenta !== undefined && { numeroCuenta: data.numeroCuenta }),
      ...(data.metadatos !== undefined && { metadatos: data.metadatos }),
      ...(data.titular !== undefined && { titular: data.titular }),
      ...(data.titularTipo !== undefined && { titularTipo: data.titularTipo }),
      ...(data.responsablePago !== undefined && { responsablePago: data.responsablePago }),
      ...(data.vencimientoDia !== undefined && { vencimientoDia: data.vencimientoDia }),
      ...(data.activaBloqueo !== undefined && { activaBloqueo: data.activaBloqueo }),
      updatedAt: new Date(),
    })
    .where(eq(servicio.id, id))
    .returning();

  return NextResponse.json({ message: "Servicio actualizado", item: actualizado });
}
