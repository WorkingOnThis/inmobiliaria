import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

const movimientoSchema = z.object({
  descripcion: z.string().min(1, "La descripción es requerida"),
  tipo: z.enum(["income", "expense"]),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  categoria: z.string().optional().nullable(),
  propiedadId: z.string().optional().nullable(),
  contratoId: z.string().optional().nullable(),
  comprobante: z.string().optional().nullable(),
  nota: z.string().optional().nullable(),
  origen: z.enum(["manual", "settlement"]).default("manual"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    await requireAgencyResource(client, id, agencyId, [eq(client.type, "owner")]);

    const body = await request.json();
    const result = movimientoSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const now = new Date();

    const [movimiento] = await db
      .insert(cajaMovimiento)
      .values({
        date: data.fecha,
        description: data.descripcion,
        tipo: data.tipo,
        categoria: data.categoria ?? null,
        amount: String(data.monto),
        source: data.origen,
        propietarioId: id,
        propiedadId: data.propiedadId ?? null,
        contratoId: data.contratoId ?? null,
        comprobante: data.comprobante ?? null,
        note: data.nota ?? null,
        agencyId,
        createdBy: session!.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(
      { message: "Movimiento registrado", movimiento },
      { status: 201 }
    );
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST /api/owners/:id/movimientos:", error);
    return NextResponse.json({ error: "Error al registrar el movimiento" }, { status: 500 });
  }
}
