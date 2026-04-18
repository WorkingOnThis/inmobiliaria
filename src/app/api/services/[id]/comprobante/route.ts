import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const [s] = await db.select().from(servicio).where(eq(servicio.id, id)).limit(1);
  if (!s) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

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
      uploadedBy: session.user.id,
      uploadedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ message: "Comprobante registrado", item: nuevoComprobante }, { status: 201 });
}
