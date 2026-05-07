import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioComprobante } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const cargarComprobanteSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM").optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM").optional(),
  monto: z.number().positive().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageServices(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(servicio, id, agencyId);

    const body = await request.json();
    const result = cargarComprobanteSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const period = result.data.period ?? result.data.periodo;
    if (!period) {
      return NextResponse.json({ error: "El período es requerido" }, { status: 400 });
    }
    const { monto } = result.data;

    await db
      .delete(servicioComprobante)
      .where(and(eq(servicioComprobante.servicioId, id), eq(servicioComprobante.period, period)));

    const [nuevoComprobante] = await db
      .insert(servicioComprobante)
      .values({
        id: crypto.randomUUID(),
        servicioId: id,
        period,
        monto: monto ? String(monto) : null,
        uploadedBy: session!.user.id,
        uploadedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ message: "Comprobante registrado", item: nuevoComprobante }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating comprobante:", error);
    return NextResponse.json({ error: "Error al registrar el comprobante" }, { status: 500 });
  }
}
