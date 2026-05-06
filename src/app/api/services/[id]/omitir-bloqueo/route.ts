import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioOmision } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const omitirBloqueoSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres").optional(),
  reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres").optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageServices(session!.user.role)) {
      return NextResponse.json({ error: "No tenés permisos para omitir bloqueos" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(servicio, id, agencyId);

    const body = await request.json();
    const result = omitirBloqueoSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const period = result.data.period ?? result.data.periodo;
    const reason = result.data.reason ?? result.data.motivo;
    if (!period) return NextResponse.json({ error: "El período es requerido" }, { status: 400 });
    if (!reason || reason.length < 10) return NextResponse.json({ error: "El motivo debe tener al menos 10 caracteres" }, { status: 400 });

    const [existente] = await db
      .select()
      .from(servicioOmision)
      .where(and(eq(servicioOmision.servicioId, id), eq(servicioOmision.period, period)))
      .limit(1);

    if (existente) {
      return NextResponse.json({ error: "Ya existe una omisión registrada para este período" }, { status: 409 });
    }

    const [nuevaOmision] = await db
      .insert(servicioOmision)
      .values({
        id: crypto.randomUUID(),
        servicioId: id,
        period,
        reason,
        skippedBy: session!.user.id,
      })
      .returning();

    return NextResponse.json(
      { message: "Omisión de bloqueo registrada", item: nuevaOmision },
      { status: 201 }
    );
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating omision:", error);
    return NextResponse.json({ error: "Error al registrar la omisión" }, { status: 500 });
  }
}
