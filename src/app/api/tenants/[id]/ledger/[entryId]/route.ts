import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  monto: z.number().positive().optional(),
  descripcion: z.string().min(1).optional(),
  estado: z.enum(["pendiente", "registrado", "cancelado"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = patchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [existing] = await db
      .select({ estado: tenantLedger.estado })
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (existing.estado === "conciliado") {
      return NextResponse.json({ error: "No se puede modificar un ítem conciliado" }, { status: 422 });
    }

    const data = result.data;
    const [updated] = await db
      .update(tenantLedger)
      .set({
        ...(data.monto !== undefined && { monto: String(data.monto) }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.estado !== undefined && { estado: data.estado }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        updatedAt: new Date(),
      })
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error PATCH /api/tenants/:id/ledger/:entryId:", error);
    return NextResponse.json({ error: "Error al actualizar el ítem" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;

    const [existing] = await db
      .select({ estado: tenantLedger.estado })
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (existing.estado === "conciliado") {
      return NextResponse.json({ error: "No se puede eliminar un ítem conciliado" }, { status: 422 });
    }

    await db
      .delete(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error DELETE /api/tenants/:id/ledger/:entryId:", error);
    return NextResponse.json({ error: "Error al eliminar el ítem" }, { status: 500 });
  }
}
