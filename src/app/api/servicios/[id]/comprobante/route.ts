import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { servicio, servicioComprobante } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const cargarComprobanteSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM"),
  monto: z.number().positive().optional(),
  // archivoUrl se agregaría cuando se implemente el upload real de archivos
});

/**
 * POST /api/servicios/[id]/comprobante
 *
 * Registra un comprobante para un período dado.
 * Si ya existe un comprobante para ese período, lo reemplaza.
 */
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

  const { periodo, monto } = result.data;

  // Si ya existe comprobante para ese período, eliminarlo primero
  await db
    .delete(servicioComprobante)
    .where(and(eq(servicioComprobante.servicioId, id), eq(servicioComprobante.periodo, periodo)));

  const [nuevoComprobante] = await db
    .insert(servicioComprobante)
    .values({
      id: crypto.randomUUID(),
      servicioId: id,
      periodo,
      monto: monto ? String(monto) : null,
      cargadoPor: session.user.id,
      cargadoEl: new Date(),
    })
    .returning();

  return NextResponse.json({ message: "Comprobante registrado", item: nuevoComprobante }, { status: 201 });
}
