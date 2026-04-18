import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { servicio, servicioComprobante, servicioOmision, property } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateServiceStatus, getPeriodDays } from "@/lib/services/constants";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hoy = new Date();
  const periodoParam = searchParams.get("periodo") ?? searchParams.get("period");
  const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const { daysElapsed: diasTranscurridos } = getPeriodDays(periodo);

  const servicios = await db
    .select({
      id: servicio.id,
      propertyId: servicio.propertyId,
      tipo: servicio.tipo,
      activatesBlock: servicio.triggersBlock,
      propertyAddress: property.address,
    })
    .from(servicio)
    .leftJoin(property, eq(servicio.propertyId, property.id));

  const serviciosConEstado = await Promise.all(
    servicios.map(async (s) => {
      const [comprobante] = await db
        .select({ id: servicioComprobante.id })
        .from(servicioComprobante)
        .where(and(eq(servicioComprobante.servicioId, s.id), eq(servicioComprobante.period, periodo)))
        .limit(1);

      const [omision] = await db
        .select({ id: servicioOmision.id })
        .from(servicioOmision)
        .where(and(eq(servicioOmision.servicioId, s.id), eq(servicioOmision.period, periodo)))
        .limit(1);

      const estado = calculateServiceStatus({
        hasReceipt: !!comprobante,
        daysWithoutReceipt: comprobante ? 0 : diasTranscurridos,
        activatesBlock: s.activatesBlock,
        hasOmission: !!omision,
      });

      return { ...s, estado };
    })
  );

  const propiedadesMap = new Map<string, { propertyId: string; address: string | null; estados: string[] }>();

  for (const s of serviciosConEstado) {
    if (!propiedadesMap.has(s.propertyId)) {
      propiedadesMap.set(s.propertyId, { propertyId: s.propertyId, address: s.propertyAddress ?? null, estados: [] });
    }
    propiedadesMap.get(s.propertyId)!.estados.push(s.estado);
  }

  const prioridad = { blocked: 4, alert: 3, pending: 2, current: 1 };

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
    }, "current");

    if (peorEstado === "current") alDia++;
    else if (peorEstado === "alert") enAlerta++;
    else if (peorEstado === "blocked") bloqueadas++;
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
