import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const conciliarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  splitBreakdown: z.object({
    propietario: z.number(),
    administracion: z.number(),
  }).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = conciliarSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    await requireAgencyResource(client, inquilinoId, agencyId);
    await requireAgencyResource(tenantLedger, entryId, agencyId, [eq(tenantLedger.inquilinoId, inquilinoId)]);

    const [entry] = await db
      .select()
      .from(tenantLedger)
      .where(and(
        eq(tenantLedger.id, entryId),
        eq(tenantLedger.agencyId, agencyId),
        eq(tenantLedger.inquilinoId, inquilinoId),
      ))
      .limit(1);

    if (!entry) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (!["pendiente", "registrado"].includes(entry.estado)) {
      return NextResponse.json(
        { error: "Solo se pueden conciliar ítems en estado pendiente o registrado" },
        { status: 422 }
      );
    }
    if (entry.monto === null) {
      return NextResponse.json({ error: "No se puede conciliar un ítem sin monto definido" }, { status: 422 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      let cajaId: string | undefined;

      if (entry.impactaCaja) {
        const [mov] = await tx
          .insert(cajaMovimiento)
          .values({
            agencyId,
            tipo: "income",
            description: entry.descripcion,
            amount: entry.monto!,
            date: result.data.fecha,
            categoria: entry.tipo,
            contratoId: entry.contratoId,
            propietarioId: entry.propietarioId,
            inquilinoId: entry.inquilinoId,
            propiedadId: entry.propiedadId,
            period: entry.period ?? undefined,
            tipoFondo: "propietario",
            ledgerEntryId: entry.id,
            source: "contract",
            createdBy: session!.user.id,
          })
          .returning();
        cajaId = mov.id;
      }

      await tx
        .update(tenantLedger)
        .set({
          estado: "conciliado",
          conciliadoAt: now,
          conciliadoPor: session!.user.id,
          ...(cajaId && { cajaMovimientoId: cajaId }),
          ...(result.data.splitBreakdown && {
            splitBreakdown: JSON.stringify(result.data.splitBreakdown),
          }),
          updatedAt: now,
        })
        .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.agencyId, agencyId)));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST conciliar:", error);
    return NextResponse.json({ error: "Error al conciliar el ítem" }, { status: 500 });
  }
}
