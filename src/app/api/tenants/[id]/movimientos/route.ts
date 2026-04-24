import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { cajaMovimiento } from "@/db/schema/caja";
import { receiptServiceItem } from "@/db/schema/receipt-service-item";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { contractTenant } from "@/db/schema/contract-tenant";
import { contractParticipant } from "@/db/schema/contract-participant";
import { nextReciboNumero } from "@/lib/receipts/numbering";

interface ServiceItemInput {
  servicioId: string | null;
  period: string;
  monto: number | null;
  etiqueta: string;
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
    const {
      tipo,
      descripcion,
      monto,
      fecha,
      categoria,
      nota,
      periodo,
      contratoId,
      propiedadId,
      generarRecibo = false,
      serviceItems = [] as ServiceItemInput[],
    } = body;

    if (!tipo || !descripcion || !monto || !fecha) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    if (tipo !== "income" && tipo !== "expense") {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    // Validate contratoId belongs to this tenant
    if (contratoId) {
      const [fromTenant, fromParticipant] = await Promise.all([
        db.select({ contractId: contractTenant.contractId })
          .from(contractTenant)
          .where(eq(contractTenant.clientId, id))
          .then((rows) => rows.map((r) => r.contractId)),
        db.select({ contractId: contractParticipant.contractId })
          .from(contractParticipant)
          .where(eq(contractParticipant.clientId, id))
          .then((rows) => rows.map((r) => r.contractId)),
      ]);
      const allowed = new Set([...fromTenant, ...fromParticipant]);
      if (!allowed.has(contratoId)) {
        return NextResponse.json({ error: "El contrato no pertenece a este inquilino" }, { status: 422 });
      }
    }

    // Sum service items with charged amounts to the total
    const extraFromServices = (serviceItems as ServiceItemInput[])
      .filter((s) => s.monto != null && s.monto > 0)
      .reduce((acc, s) => acc + (s.monto ?? 0), 0);
    const montoFinal = Number(monto) + extraFromServices;

    // Generate receipt number: for alquiler (legacy path) or when generarRecibo flag is set
    let reciboNumero: string | null = null;
    if (tipo === "income" && (categoria === "alquiler" || generarRecibo)) {
      reciboNumero = await nextReciboNumero();
    }

    const nuevo = await db.transaction(async (tx) => {
      const [mov] = await tx
        .insert(cajaMovimiento)
        .values({
          tipo,
          description: descripcion,
          amount: String(montoFinal),
          date: fecha,
          categoria: categoria || null,
          note: nota || null,
          period: periodo || null,
          reciboNumero,
          inquilinoId: id,
          contratoId: contratoId || null,
          propiedadId: propiedadId || null,
          source: "manual",
          createdBy: session.user.id,
        })
        .returning();

      if (serviceItems.length > 0) {
        await tx.insert(receiptServiceItem).values(
          (serviceItems as ServiceItemInput[]).map((s) => ({
            movimientoId: mov.id,
            servicioId: s.servicioId ?? null,
            period: s.period,
            monto: s.monto != null ? String(s.monto) : null,
            etiqueta: s.etiqueta,
          }))
        );
      }

      return mov;
    });

    return NextResponse.json(nuevo, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/tenants/:id/movimientos:", error);
    return NextResponse.json({ error: "Error al registrar movimiento" }, { status: 500 });
  }
}
