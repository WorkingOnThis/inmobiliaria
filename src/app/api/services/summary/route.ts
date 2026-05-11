import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { servicio, servicioComprobante, servicioOmision, property } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateServiceStatus, getPeriodDays } from "@/lib/services/constants";
import { formatAddress } from "@/lib/properties/format-address";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { searchParams } = new URL(request.url);
    const hoy = new Date();
    const periodoParam = searchParams.get("periodo") ?? searchParams.get("period");
    const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

    const { daysElapsed: diasTranscurridos } = getPeriodDays(periodo);

    const servicios = await db
      .select({
        id: servicio.id,
        propertyId: servicio.propertyId,
        activatesBlock: servicio.triggersBlock,
        propertyAddressStreet: property.addressStreet,
        propertyAddressNumber: property.addressNumber,
        propertyFloorUnit: property.floorUnit,
        comprobanteId: servicioComprobante.id,
        omisionId: servicioOmision.id,
      })
      .from(servicio)
      .leftJoin(property, eq(servicio.propertyId, property.id))
      .leftJoin(
        servicioComprobante,
        and(eq(servicioComprobante.servicioId, servicio.id), eq(servicioComprobante.period, periodo))
      )
      .leftJoin(
        servicioOmision,
        and(eq(servicioOmision.servicioId, servicio.id), eq(servicioOmision.period, periodo))
      )
      .where(eq(servicio.agencyId, agencyId))
      .limit(200);

    const serviciosConEstado = servicios.map((s) => {
      const hasReceipt = s.comprobanteId !== null;
      const hasOmission = s.omisionId !== null;
      const estado = calculateServiceStatus({
        hasReceipt,
        daysWithoutReceipt: hasReceipt ? 0 : diasTranscurridos,
        activatesBlock: s.activatesBlock,
        hasOmission,
      });
      const propertyAddress = s.propertyAddressStreet
        ? formatAddress({ addressStreet: s.propertyAddressStreet, addressNumber: s.propertyAddressNumber, floorUnit: s.propertyFloorUnit })
        : null;
      return { propertyId: s.propertyId, propertyAddress, estado };
    });

    const propiedadesMap = new Map<string, { propertyId: string; address: string | null; estados: string[] }>();

    for (const s of serviciosConEstado) {
      if (!propiedadesMap.has(s.propertyId)) {
        propiedadesMap.set(s.propertyId, { propertyId: s.propertyId, address: s.propertyAddress ?? null, estados: [] });
      }
      propiedadesMap.get(s.propertyId)!.estados.push(s.estado);
    }

    const prioridad = { blocked: 4, alert: 3, pending: 2, current: 1 };

    let totalProperties = 0;
    let current = 0;
    let alert = 0;
    let blocked = 0;
    let pending = 0;

    for (const [, prop] of propiedadesMap) {
      totalProperties++;
      const peorEstado = prop.estados.reduce((peor, est) => {
        return (prioridad[est as keyof typeof prioridad] ?? 0) > (prioridad[peor as keyof typeof prioridad] ?? 0)
          ? est
          : peor;
      }, "current");

      if (peorEstado === "current") current++;
      else if (peorEstado === "alert") alert++;
      else if (peorEstado === "blocked") blocked++;
      else pending++;
    }

    return NextResponse.json({
      periodo,
      kpis: {
        totalProperties,
        current,
        alert,
        blocked,
        pending,
      },
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching services summary:", error);
    return NextResponse.json({ error: "Error al obtener resumen de servicios" }, { status: 500 });
  }
}
