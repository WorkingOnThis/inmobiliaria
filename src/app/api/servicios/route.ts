import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioComprobante, servicioOmision, property } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { calcularEstadoServicio } from "@/lib/servicios/constants";

const crearServicioSchema = z.object({
  propertyId: z.string().min(1, "La propiedad es requerida"),
  tipo: z.enum(["luz", "gas", "agua", "expensas", "abl", "inmobiliario", "seguro", "otro"]),
  empresa: z.string().optional(),
  numeroCuenta: z.string().optional(),
  metadatos: z.record(z.string()).optional(),
  titular: z.string().optional(),
  titularTipo: z.enum(["propietario", "inquilino", "otro"]).default("propietario"),
  responsablePago: z.enum(["propietario", "inquilino"]).default("propietario"),
  vencimientoDia: z.number().int().min(1).max(31).optional(),
  activaBloqueo: z.boolean().default(true),
});

function getPeriodoDias(periodo: string): { inicio: Date; diasTranscurridos: number } {
  const [year, month] = periodo.split("-").map(Number);
  const inicio = new Date(year, month - 1, 1);
  const hoy = new Date();
  const diasTranscurridos = Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  return { inicio, diasTranscurridos };
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const estado = searchParams.get("estado"); // al_dia | pendiente | en_alerta | bloqueado
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const offset = (page - 1) * limit;

  // Período actual o el indicado en la query (formato YYYY-MM)
  const hoy = new Date();
  const periodoParam = searchParams.get("periodo");
  const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const { diasTranscurridos } = getPeriodoDias(periodo);

  // Obtener todos los servicios con join a property
  const conditions = propertyId ? [eq(servicio.propertyId, propertyId)] : [];

  const servicios = await db
    .select({
      id: servicio.id,
      propertyId: servicio.propertyId,
      tipo: servicio.tipo,
      empresa: servicio.empresa,
      numeroCuenta: servicio.numeroCuenta,
      titular: servicio.titular,
      titularTipo: servicio.titularTipo,
      responsablePago: servicio.responsablePago,
      vencimientoDia: servicio.vencimientoDia,
      activaBloqueo: servicio.activaBloqueo,
      createdAt: servicio.createdAt,
      propertyAddress: property.address,
      propertyType: property.type,
    })
    .from(servicio)
    .leftJoin(property, eq(servicio.propertyId, property.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(servicio.createdAt))
    .limit(limit)
    .offset(offset);

  // Para cada servicio, obtener el comprobante del período y la omisión si existe
  const serviciosConEstado = await Promise.all(
    servicios.map(async (s) => {
      const [comprobante] = await db
        .select()
        .from(servicioComprobante)
        .where(and(eq(servicioComprobante.servicioId, s.id), eq(servicioComprobante.periodo, periodo)))
        .limit(1);

      const [omision] = await db
        .select()
        .from(servicioOmision)
        .where(and(eq(servicioOmision.servicioId, s.id), eq(servicioOmision.periodo, periodo)))
        .limit(1);

      // Días sin comprobante: si hay comprobante es 0, sino los días transcurridos del período
      const diasSinComprobante = comprobante ? 0 : diasTranscurridos;

      const estadoCalculado = calcularEstadoServicio({
        tieneComprobante: !!comprobante,
        diasSinComprobante,
        activaBloqueo: s.activaBloqueo,
        tieneOmision: !!omision,
      });

      return {
        ...s,
        periodo,
        estado: estadoCalculado,
        diasSinComprobante: comprobante ? 0 : diasTranscurridos,
        ultimoComprobante: comprobante ?? null,
        tieneOmision: !!omision,
      };
    })
  );

  // Filtrar por estado si se especificó
  const resultado = estado
    ? serviciosConEstado.filter((s) => s.estado === estado)
    : serviciosConEstado;

  // Total para paginación
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(servicio)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return NextResponse.json({
    items: resultado,
    pagination: {
      total: Number(count),
      page,
      limit,
      totalPages: Math.ceil(Number(count) / limit),
    },
    periodo,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageServices(session.user.role)) {
    return NextResponse.json({ error: "No tenés permisos para gestionar servicios" }, { status: 403 });
  }

  const body = await request.json();
  const result = crearServicioSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
  }

  const data = result.data;

  const [nuevoServicio] = await db
    .insert(servicio)
    .values({
      id: crypto.randomUUID(),
      propertyId: data.propertyId,
      tipo: data.tipo,
      empresa: data.empresa ?? null,
      numeroCuenta: data.numeroCuenta ?? null,
      metadatos: data.metadatos ?? null,
      titular: data.titular ?? null,
      titularTipo: data.titularTipo,
      responsablePago: data.responsablePago,
      vencimientoDia: data.vencimientoDia ?? null,
      activaBloqueo: data.activaBloqueo,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json({ message: "Servicio creado", item: nuevoServicio }, { status: 201 });
}
