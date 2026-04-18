import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { property } from "@/db/schema/property";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { and, desc, eq } from "drizzle-orm";

function calcularEstado(
  activeContract: { endDate: string; paymentDay: number } | null,
  lastPaymentDate: string | null
): { estado: string; diasMora: number } {
  if (!activeContract) return { estado: "sin_contrato", diasMora: 0 };

  const today = new Date();
  const endDate = new Date(activeContract.endDate);
  const daysUntilEnd = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilEnd < 0) return { estado: "sin_contrato", diasMora: 0 };
  if (daysUntilEnd <= 90) return { estado: "por_vencer", diasMora: 0 };

  const todayDay = today.getDate();
  if (todayDay > activeContract.paymentDay) {
    const dueDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      activeContract.paymentDay
    );
    if (!lastPaymentDate || new Date(lastPaymentDate) < dueDate) {
      const diasMora = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { estado: "en_mora", diasMora };
    }
  }

  return { estado: "activo", diasMora: 0 };
}

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

    // Inquilino
    const [inquilino] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.type, "inquilino")))
      .limit(1);

    if (!inquilino) {
      return NextResponse.json({ error: "Inquilino no encontrado" }, { status: 404 });
    }

    // Contrato activo (vía tabla intermedia contract_tenant)
    const [contratoRow] = await db
      .select({
        id: contract.id,
        contractNumber: contract.contractNumber,
        propertyId: contract.propertyId,
        ownerId: contract.ownerId,
        status: contract.status,
        contractType: contract.contractType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyAmount: contract.monthlyAmount,
        depositAmount: contract.depositAmount,
        agencyCommission: contract.agencyCommission,
        paymentDay: contract.paymentDay,
        paymentModality: contract.paymentModality,
        adjustmentIndex: contract.adjustmentIndex,
        adjustmentFrequency: contract.adjustmentFrequency,
      })
      .from(contractTenant)
      .innerJoin(contract, eq(contract.id, contractTenant.contractId))
      .where(
        and(
          eq(contractTenant.clientId, id),
          eq(contract.status, "active")
        )
      )
      .limit(1);

    // Propiedad (si hay contrato)
    let propiedad = null;
    if (contratoRow) {
      const [prop] = await db
        .select()
        .from(property)
        .where(eq(property.id, contratoRow.propertyId))
        .limit(1);
      propiedad = prop ?? null;
    }

    // Propietario (si hay contrato)
    let propietario = null;
    if (contratoRow) {
      const [owner] = await db
        .select()
        .from(client)
        .where(eq(client.id, contratoRow.ownerId))
        .limit(1);
      propietario = owner ?? null;
    }

    // Movimientos de caja vinculados al inquilino (últimos 24)
    const movimientos = await db
      .select()
      .from(cajaMovimiento)
      .where(eq(cajaMovimiento.inquilinoId, id))
      .orderBy(desc(cajaMovimiento.date))
      .limit(24);

    // Último pago registrado
    const lastPayment = movimientos.find((m) => m.tipo === "income");

    // Estado calculado
    const { estado, diasMora } = calcularEstado(
      contratoRow
        ? { endDate: contratoRow.endDate, paymentDay: contratoRow.paymentDay }
        : null,
      lastPayment?.date ?? null
    );

    return NextResponse.json({
      inquilino: { ...inquilino, estado, diasMora },
      contrato: contratoRow ?? null,
      propiedad,
      propietario,
      movimientos,
    });
  } catch (error) {
    console.error("Error GET /api/inquilinos/:id:", error);
    return NextResponse.json({ error: "Error al obtener el inquilino" }, { status: 500 });
  }
}
