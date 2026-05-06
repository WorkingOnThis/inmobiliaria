import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { servicio } from "@/db/schema/servicio";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";

const SERVICIO_LABELS: Record<string, string> = {
  electricity: "Luz",
  gas: "Gas",
  water: "Agua",
  hoa: "Expensas",
  abl: "ABL",
  property_tax: "Rentas / Inmobiliario",
  insurance: "Seguro",
  other: "Otro",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageProperties(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(property, id, agencyId);

    const servicios = await db
      .select({
        id: servicio.id,
        tipo: servicio.tipo,
        company: servicio.company,
        paymentResponsible: servicio.paymentResponsible,
      })
      .from(servicio)
      .where(and(eq(servicio.propertyId, id), eq(servicio.agencyId, agencyId)));

    const result = servicios.map((s) => ({
      id: s.id,
      etiqueta: [SERVICIO_LABELS[s.tipo] ?? s.tipo, s.company].filter(Boolean).join(" · "),
      tipo: s.tipo,
      company: s.company,
      paymentResponsible: s.paymentResponsible,
    }));

    return NextResponse.json({ servicios: result });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/properties/:id/services:", error);
    return NextResponse.json({ error: "Error al obtener servicios" }, { status: 500 });
  }
}
