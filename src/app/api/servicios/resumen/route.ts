import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { servicio, servicioComprobante, servicioOmision, property } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calcularEstadoServicio } from "@/lib/servicios/constants";

/**
 * GET /api/servicios/resumen?periodo=YYYY-MM
 *
 * Devuelve KPIs del módulo de servicios para el período indicado:
 * - Total de propiedades con al menos un servicio
 * - Propiedades al día (todos sus servicios con comprobante)
 * - Propiedades en alerta (al menos 1 en alerta)
 * - Propiedades bloqueadas (al menos 1 bloqueado)
 * - Resumen por propiedad (para la tabla de la vista global)
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hoy = new Date();
  const periodoParam = searchParams.get("periodo");
  const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  // Calcular días transcurridos desde el inicio del período
  const [year, month] = periodo.split("-").map(Number);
  const inicioPeriodo = new Date(year, month - 1, 1);
  const diasTranscurridos = Math.floor((hoy.getTime() - inicioPeriodo.getTime()) / (1000 * 60 * 60 * 24));

  // Obtener todos los servicios con su propiedad
  const servicios = await db
    .select({
      id: servicio.id,
      propertyId: servicio.propertyId,
      tipo: servicio.tipo,
      activaBloqueo: servicio.activaBloqueo,
      propertyAddress: property.address,
    })
    .from(servicio)
    .leftJoin(property, eq(servicio.propertyId, property.id));

  // Para cada servicio obtener comprobante y omisión del período
  const serviciosConEstado = await Promise.all(
    servicios.map(async (s) => {
      const [comprobante] = await db
        .select({ id: servicioComprobante.id })
        .from(servicioComprobante)
        .where(and(eq(servicioComprobante.servicioId, s.id), eq(servicioComprobante.periodo, periodo)))
        .limit(1);

      const [omision] = await db
        .select({ id: servicioOmision.id })
        .from(servicioOmision)
        .where(and(eq(servicioOmision.servicioId, s.id), eq(servicioOmision.periodo, periodo)))
        .limit(1);

      const estado = calcularEstadoServicio({
        tieneComprobante: !!comprobante,
        diasSinComprobante: comprobante ? 0 : diasTranscurridos,
        activaBloqueo: s.activaBloqueo,
        tieneOmision: !!omision,
      });

      return { ...s, estado };
    })
  );

  // Agrupar por propiedad y calcular el "peor estado" de cada una
  const propiedadesMap = new Map<string, { propertyId: string; address: string | null; estados: string[] }>();

  for (const s of serviciosConEstado) {
    if (!propiedadesMap.has(s.propertyId)) {
      propiedadesMap.set(s.propertyId, { propertyId: s.propertyId, address: s.propertyAddress ?? null, estados: [] });
    }
    propiedadesMap.get(s.propertyId)!.estados.push(s.estado);
  }

  const prioridad = { bloqueado: 4, en_alerta: 3, pendiente: 2, al_dia: 1 };

  let totalPropiedades = 0;
  let alDia = 0;
  let enAlerta = 0;
  let bloqueadas = 0;
  let pendientes = 0;

  for (const [, prop] of propiedadesMap) {
    totalPropiedades++;
    const peorEstado = prop.estados.reduce((peor, est) => {
      return (prioridad[est as keyof typeof prioridad] ?? 0) > (prioridad[peor as keyof typeof prioridad] ?? 0)
        ? est
        : peor;
    }, "al_dia");

    if (peorEstado === "al_dia") alDia++;
    else if (peorEstado === "en_alerta") enAlerta++;
    else if (peorEstado === "bloqueado") bloqueadas++;
    else pendientes++;
  }

  return NextResponse.json({
    periodo,
    kpis: {
      totalPropiedades,
      alDia,
      enAlerta,
      bloqueadas,
      pendientes,
    },
  });
}
