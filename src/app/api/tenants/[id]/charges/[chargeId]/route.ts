import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { tenantCharge } from "@/db/schema/tenant-charge";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

const patchChargeSchema = z.object({
  categoria: z.enum(["alquiler", "dias_ocupados", "expensas", "punitorios", "otros"]).optional(),
  descripcion: z.string().min(1).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  monto: z.number().positive().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id, chargeId } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: tenantCharge.id, estado: tenantCharge.estado })
      .from(tenantCharge)
      .where(and(eq(tenantCharge.id, chargeId), eq(tenantCharge.inquilinoId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    }

    if (existing.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Solo se pueden editar cargos pendientes" },
        { status: 422 }
      );
    }

    const body = await request.json();
    const result = patchChargeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.categoria !== undefined) updates.categoria = data.categoria;
    if (data.descripcion !== undefined) updates.descripcion = data.descripcion;
    if (data.period !== undefined) updates.period = data.period;
    if (data.monto !== undefined) updates.monto = String(data.monto);

    const [updated] = await db
      .update(tenantCharge)
      .set(updates)
      .where(eq(tenantCharge.id, chargeId))
      .returning();

    return NextResponse.json({ charge: updated });
  } catch (error) {
    console.error("Error PATCH /api/tenants/:id/charges/:chargeId:", error);
    return NextResponse.json({ error: "Error al actualizar el cargo" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id, chargeId } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: tenantCharge.id, estado: tenantCharge.estado })
      .from(tenantCharge)
      .where(and(eq(tenantCharge.id, chargeId), eq(tenantCharge.inquilinoId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    }

    if (existing.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar cargos pendientes" },
        { status: 422 }
      );
    }

    await db.delete(tenantCharge).where(eq(tenantCharge.id, chargeId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error DELETE /api/tenants/:id/charges/:chargeId:", error);
    return NextResponse.json({ error: "Error al eliminar el cargo" }, { status: 500 });
  }
}
