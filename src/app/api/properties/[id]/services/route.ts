import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { servicio } from "@/db/schema/servicio";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
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
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [prop] = await db
      .select({ id: property.id })
      .from(property)
      .where(eq(property.id, id))
      .limit(1);

    if (!prop) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    const servicios = await db
      .select({
        id: servicio.id,
        tipo: servicio.tipo,
        company: servicio.company,
        paymentResponsible: servicio.paymentResponsible,
      })
      .from(servicio)
      .where(eq(servicio.propertyId, id));

    const result = servicios.map((s) => ({
      id: s.id,
      etiqueta: [SERVICIO_LABELS[s.tipo] ?? s.tipo, s.company].filter(Boolean).join(" · "),
      tipo: s.tipo,
      company: s.company,
      paymentResponsible: s.paymentResponsible,
    }));

    return NextResponse.json({ servicios: result });
  } catch (error) {
    console.error("Error GET /api/properties/:id/services:", error);
    return NextResponse.json({ error: "Error al obtener servicios" }, { status: 500 });
  }
}
