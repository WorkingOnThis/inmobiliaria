import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { canManageServices } from "@/lib/permissions";
import { servicio, servicioComprobante, servicioOmision, property, contract, contractParticipant, client } from "@/db/schema";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { calculateServiceStatus, getPeriodDays } from "@/lib/services/constants";

const crearServicioSchema = z.object({
  propertyId: z.string().min(1, "La propiedad es requerida"),
  tipo: z.enum(["electricity", "gas", "water", "hoa", "abl", "property_tax", "insurance", "other"]),
  company: z.string().optional(),
  accountNumber: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  holder: z.string().optional(),
  holderType: z.enum(["propietario", "inquilino", "otro"]).default("propietario"),
  paymentResponsible: z.enum(["propietario", "inquilino"]).default("propietario"),
  dueDay: z.number().int().min(1).max(31).optional(),
  triggersBlock: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const addressSearch = searchParams.get("address") ?? "";
  const estado = searchParams.get("estado");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const offset = (page - 1) * limit;

  const hoy = new Date();
  const periodoParam = searchParams.get("periodo") ?? searchParams.get("period");
  const periodo = periodoParam ?? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const { daysElapsed: diasTranscurridos } = getPeriodDays(periodo);

  const conditions = [
    propertyId ? eq(servicio.propertyId, propertyId) : null,
    addressSearch ? ilike(property.address, `%${addressSearch}%`) : null,
  ].filter(Boolean) as ReturnType<typeof eq>[];

  const servicios = await db
    .select({
      id: servicio.id,
      propertyId: servicio.propertyId,
      tipo: servicio.tipo,
      company: servicio.company,
      accountNumber: servicio.accountNumber,
      holder: servicio.holder,
      holderType: servicio.holderType,
      paymentResponsible: servicio.paymentResponsible,
      dueDay: servicio.dueDay,
      triggersBlock: servicio.triggersBlock,
      createdAt: servicio.createdAt,
      propertyAddress: property.address,
      propertyType: property.type,
      comprobanteId: servicioComprobante.id,
      comprobanteMonto: servicioComprobante.monto,
      comprobanteArchivoUrl: servicioComprobante.archivoUrl,
      comprobanteUploadedAt: servicioComprobante.uploadedAt,
      omisionId: servicioOmision.id,
    })
    .from(servicio)
    .leftJoin(property, eq(servicio.propertyId, property.id))
    .leftJoin(
      servicioComprobante,
      and(eq(servicioComprobante.servicioId, servicio.id), eq(servicioComprobante.period, periodo))
    )
    .leftJoin(
      servicioOmision,
      and(eq(servicioOmision.servicioId, servicio.id), eq(servicioOmision.period, periodo))
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(servicio.createdAt))
    .limit(limit)
    .offset(offset);

  const propertyIds = [...new Set(servicios.map((s) => s.propertyId))];
  const inquilinoMap = new Map<string, { nombre: string; clientId: string }>();
  if (propertyIds.length > 0) {
    const activeContracts = await db
      .select({
        propertyId: contract.propertyId,
        clientId: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
      })
      .from(contract)
      .innerJoin(
        contractParticipant,
        and(eq(contractParticipant.contractId, contract.id), eq(contractParticipant.role, "tenant"))
      )
      .innerJoin(client, eq(client.id, contractParticipant.clientId))
      .where(
        and(
          inArray(contract.propertyId, propertyIds),
          or(eq(contract.status, "active"), eq(contract.status, "expiring_soon"))
        )
      );
    for (const c of activeContracts) {
      if (!inquilinoMap.has(c.propertyId)) {
        inquilinoMap.set(c.propertyId, {
          nombre: `${c.firstName} ${c.lastName ?? ""}`.trim(),
          clientId: c.clientId,
        });
      }
    }
  }

  const serviciosConEstado = servicios.map((s) => {
    const hasReceipt = s.comprobanteId !== null;
    const hasOmission = s.omisionId !== null;

    const estadoCalculado = calculateServiceStatus({
      hasReceipt,
      daysWithoutReceipt: hasReceipt ? 0 : diasTranscurridos,
      activatesBlock: s.triggersBlock,
      hasOmission,
    });

    const ultimoComprobante = hasReceipt
      ? {
          id: s.comprobanteId!,
          monto: s.comprobanteMonto,
          archivoUrl: s.comprobanteArchivoUrl,
          uploadedAt: s.comprobanteUploadedAt,
        }
      : null;

    return {
      id: s.id,
      propertyId: s.propertyId,
      tipo: s.tipo,
      company: s.company,
      accountNumber: s.accountNumber,
      holder: s.holder,
      holderType: s.holderType,
      paymentResponsible: s.paymentResponsible,
      dueDay: s.dueDay,
      triggersBlock: s.triggersBlock,
      createdAt: s.createdAt,
      propertyAddress: s.propertyAddress,
      propertyType: s.propertyType,
      periodo,
      estado: estadoCalculado,
      diasSinComprobante: hasReceipt ? 0 : diasTranscurridos,
      ultimoComprobante,
      tieneOmision: hasOmission,
      inquilinoNombre: inquilinoMap.get(s.propertyId)?.nombre ?? null,
      inquilinoId: inquilinoMap.get(s.propertyId)?.clientId ?? null,
    };
  });

  const resultado = estado
    ? serviciosConEstado.filter((s) => s.estado === estado)
    : serviciosConEstado;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(servicio)
    .leftJoin(property, eq(servicio.propertyId, property.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return NextResponse.json({
    items: resultado,
    pagination: {
      total: Number(count),
      page,
      limit,
      totalPages: Math.ceil(Number(count) / limit),
    },
    periodo,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageServices(session.user.role)) {
    return NextResponse.json({ error: "No tenés permisos para gestionar servicios" }, { status: 403 });
  }

  const body = await request.json();
  const result = crearServicioSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
  }

  const data = result.data;

  const [nuevoServicio] = await db
    .insert(servicio)
    .values({
      id: crypto.randomUUID(),
      propertyId: data.propertyId,
      tipo: data.tipo,
      company: data.company ?? null,
      accountNumber: data.accountNumber ?? null,
      metadata: data.metadata ?? null,
      holder: data.holder ?? null,
      holderType: data.holderType,
      paymentResponsible: data.paymentResponsible,
      dueDay: data.dueDay ?? null,
      triggersBlock: data.triggersBlock,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json({ message: "Servicio creado", item: nuevoServicio }, { status: 201 });
}
