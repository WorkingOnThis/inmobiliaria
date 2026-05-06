import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioComprobante, servicioOmision } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { calculateServiceStatus } from "@/lib/services/constants";

const actualizarServicioSchema = z.object({
  company: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  metadata: z.record(z.string()).optional().nullable(),
  holder: z.string().optional().nullable(),
  holderType: z.enum(["propietario", "inquilino", "otro"]).optional(),
  paymentResponsible: z.enum(["propietario", "inquilino"]).optional(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  activatesBlock: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hoy = new Date();
    const periodoParam = searchParams.get("periodo") ?? searchParams.get("period");
    const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

    const s = (await requireAgencyResource(servicio, id, agencyId)) as typeof servicio.$inferSelect;

    const historial = await db
      .select()
      .from(servicioComprobante)
      .where(eq(servicioComprobante.servicioId, id))
      .orderBy(desc(servicioComprobante.period))
      .limit(12);

    const [comprobantePeriodo] = await db
      .select()
      .from(servicioComprobante)
      .where(and(eq(servicioComprobante.servicioId, id), eq(servicioComprobante.period, periodo)))
      .limit(1);

    const [omisionPeriodo] = await db
      .select()
      .from(servicioOmision)
      .where(and(eq(servicioOmision.servicioId, id), eq(servicioOmision.period, periodo)))
      .limit(1);

    const [year, month] = periodo.split("-").map(Number);
    const inicioPeriodo = new Date(year, month - 1, 1);
    const diasTranscurridos = Math.floor((new Date().getTime() - inicioPeriodo.getTime()) / (1000 * 60 * 60 * 24));

    const estado = calculateServiceStatus({
      hasReceipt: !!comprobantePeriodo,
      daysWithoutReceipt: comprobantePeriodo ? 0 : diasTranscurridos,
      activatesBlock: s.triggersBlock,
      hasOmission: !!omisionPeriodo,
    });

    return NextResponse.json({
      item: s,
      periodo,
      estado,
      daysWithoutReceipt: comprobantePeriodo ? 0 : diasTranscurridos,
      comprobantePeriodo: comprobantePeriodo ?? null,
      omisionPeriodo: omisionPeriodo ?? null,
      historial,
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching servicio:", error);
    return NextResponse.json({ error: "Error al obtener el servicio" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageServices(session!.user.role)) {
      return NextResponse.json({ error: "No tenés permisos para gestionar servicios" }, { status: 403 });
    }

    const { id } = await params;
    await requireAgencyResource(servicio, id, agencyId);

    const body = await request.json();
    const result = actualizarServicioSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const [actualizado] = await db
      .update(servicio)
      .set({
        ...(data.company !== undefined && { company: data.company }),
        ...(data.accountNumber !== undefined && { accountNumber: data.accountNumber }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        ...(data.holder !== undefined && { holder: data.holder }),
        ...(data.holderType !== undefined && { holderType: data.holderType }),
        ...(data.paymentResponsible !== undefined && { paymentResponsible: data.paymentResponsible }),
        ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
        ...(data.activatesBlock !== undefined && { triggersBlock: data.activatesBlock }),
        updatedAt: new Date(),
      })
      .where(and(eq(servicio.id, id), eq(servicio.agencyId, agencyId)))
      .returning();

    return NextResponse.json({ message: "Servicio actualizado", item: actualizado });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error updating servicio:", error);
    return NextResponse.json({ error: "Error al actualizar el servicio" }, { status: 500 });
  }
}
