import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioOmision } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const omitirBloqueoSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM"),
  motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
});

/**
 * POST /api/servicios/[id]/omitir-bloqueo
 *
 * Permite al staff omitir el bloqueo de alquiler para un período dado.
 * La omisión es registrada con usuario, timestamp y motivo.
 * Es por período (no permanente).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageServices(session.user.role)) {
    return NextResponse.json({ error: "No tenés permisos para omitir bloqueos" }, { status: 403 });
  }

  const { id } = await params;

  const [s] = await db.select().from(servicio).where(eq(servicio.id, id)).limit(1);
  if (!s) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const result = omitirBloqueoSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
  }

  const { periodo, motivo } = result.data;

  // Verificar si ya existe una omisión para este período
  const [existente] = await db
    .select()
    .from(servicioOmision)
    .where(and(eq(servicioOmision.servicioId, id), eq(servicioOmision.periodo, periodo)))
    .limit(1);

  if (existente) {
    return NextResponse.json({ error: "Ya existe una omisión registrada para este período" }, { status: 409 });
  }

  const [nuevaOmision] = await db
    .insert(servicioOmision)
    .values({
      id: crypto.randomUUID(),
      servicioId: id,
      periodo,
      motivo,
      omitidoPor: session.user.id,
    })
    .returning();

  return NextResponse.json(
    { message: "Omisión de bloqueo registrada", item: nuevaOmision },
    { status: 201 }
  );
}
