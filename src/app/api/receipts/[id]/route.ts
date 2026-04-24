import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { receiptServiceItem } from "@/db/schema/receipt-service-item";
import { tenantCharge } from "@/db/schema/tenant-charge";
import { and, eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
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

    const [movimiento] = await db
      .select()
      .from(cajaMovimiento)
      .where(eq(cajaMovimiento.id, id))
      .limit(1);

    if (!movimiento || !movimiento.reciboNumero) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
    }

    let inquilino = null;
    if (movimiento.inquilinoId) {
      const [inq] = await db
        .select({
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          email: client.email,
        })
        .from(client)
        .where(eq(client.id, movimiento.inquilinoId))
        .limit(1);
      inquilino = inq ?? null;
    }

    let propiedad = null;
    if (movimiento.propiedadId) {
      const [prop] = await db
        .select({ address: property.address, floorUnit: property.floorUnit })
        .from(property)
        .where(eq(property.id, movimiento.propiedadId))
        .limit(1);
      propiedad = prop ?? null;
    }

    let contrato = null;
    if (movimiento.contratoId) {
      const [con] = await db
        .select({ contractNumber: contract.contractNumber })
        .from(contract)
        .where(eq(contract.id, movimiento.contratoId))
        .limit(1);
      contrato = con ?? null;
    } else if (movimiento.inquilinoId) {
      // Intentar obtener el contrato activo del inquilino
      const [con] = await db
        .select({ contractNumber: contract.contractNumber })
        .from(contractTenant)
        .innerJoin(contract, eq(contract.id, contractTenant.contractId))
        .where(
          and(
            eq(contractTenant.clientId, movimiento.inquilinoId),
            eq(contract.status, "active")
          )
        )
        .limit(1);
      contrato = con ?? null;
    }

    const serviceItems = await db
      .select({
        id: receiptServiceItem.id,
        etiqueta: receiptServiceItem.etiqueta,
        period: receiptServiceItem.period,
        monto: receiptServiceItem.monto,
        servicioId: receiptServiceItem.servicioId,
      })
      .from(receiptServiceItem)
      .where(eq(receiptServiceItem.movimientoId, id));

    // Load tenant charges associated to this receipt number
    const charges = movimiento.reciboNumero
      ? await db
          .select({
            id: tenantCharge.id,
            periodo: tenantCharge.period,
            categoria: tenantCharge.categoria,
            descripcion: tenantCharge.descripcion,
            monto: tenantCharge.monto,
          })
          .from(tenantCharge)
          .where(eq(tenantCharge.reciboNumero, movimiento.reciboNumero))
      : [];

    return NextResponse.json({ movimiento, inquilino, propiedad, contrato, serviceItems, charges });
  } catch (error) {
    console.error("Error GET /api/receipts/:id:", error);
    return NextResponse.json({ error: "Error al obtener el recibo" }, { status: 500 });
  }
}
