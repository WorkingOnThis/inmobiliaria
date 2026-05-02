import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { property } from "@/db/schema/property";
import { tenantCharge } from "@/db/schema/tenant-charge";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

const createChargeSchema = z.object({
  contratoId: z.string().min(1),
  categoria: z.enum(["alquiler", "dias_ocupados", "expensas", "punitorios", "otros"]),
  descripcion: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  monto: z.number().positive(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const estadoFilter = request.nextUrl.searchParams.get("estado") ?? "pendiente";

    const whereConditions = [eq(tenantCharge.inquilinoId, id)];
    if (estadoFilter !== "todos") {
      whereConditions.push(eq(tenantCharge.estado, estadoFilter));
    }

    const charges = await db
      .select()
      .from(tenantCharge)
      .where(and(...whereConditions))
      .orderBy(tenantCharge.createdAt);

    // Enrich with property address
    const propIds = [...new Set(charges.map((c) => c.propiedadId))];
    let propAddressMap: Record<string, string> = {};
    if (propIds.length > 0) {
      const props = await db
        .select({ id: property.id, address: property.address })
        .from(property)
        .where(inArray(property.id, propIds));
      for (const p of props) propAddressMap[p.id] = p.address;
    }

    const enriched = charges.map((c) => ({
      ...c,
      propiedadAddress: propAddressMap[c.propiedadId] ?? null,
    }));

    return NextResponse.json({ charges: enriched });
  } catch (error) {
    console.error("Error GET /api/tenants/:id/charges:", error);
    return NextResponse.json({ error: "Error al obtener los cargos" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [inquilino] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = createChargeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { contratoId, categoria, descripcion, period, monto } = result.data;

    // Validate contratoId belongs to this tenant
    const contractIds = await db
      .select({ contractId: contractParticipant.contractId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.clientId, id), eq(contractParticipant.role, "tenant")))
      .then((rows) => rows.map((r) => r.contractId));
    const allowed = new Set(contractIds);
    if (!allowed.has(contratoId)) {
      return NextResponse.json(
        { error: "El contrato no pertenece a este inquilino" },
        { status: 422 }
      );
    }

    // Load contract to denormalize propietarioId and propiedadId
    const [contractRow] = await db
      .select({ ownerId: contract.ownerId, propertyId: contract.propertyId })
      .from(contract)
      .where(eq(contract.id, contratoId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const [charge] = await db
      .insert(tenantCharge)
      .values({
        contratoId,
        inquilinoId: id,
        propietarioId: contractRow.ownerId,
        propiedadId: contractRow.propertyId,
        period: period ?? null,
        categoria,
        descripcion,
        monto: String(monto),
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ charge }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/tenants/:id/charges:", error);
    return NextResponse.json({ error: "Error al crear el cargo" }, { status: 500 });
  }
}
