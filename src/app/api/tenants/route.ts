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
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { calculateStatus } from "@/lib/tenants/status";

// Qué porcentaje del contrato ya pasó (0–100)
function calcularCompletitud(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const estadoFilter = searchParams.get("estado") || "todos";

    // Condición de búsqueda (nombre, apellido, DNI o teléfono)
    const baseCondition = search
      ? and(
          eq(client.type, "inquilino"),
          or(
            ilike(client.firstName, `%${search}%`),
            ilike(client.lastName, `%${search}%`),
            ilike(client.dni, `%${search}%`),
            ilike(client.phone, `%${search}%`)
          )
        )
      : eq(client.type, "inquilino");

    // Todos los inquilinos que coinciden con la búsqueda (sin paginar aún)
    const allInquilinos = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        phone: client.phone,
        email: client.email,
        createdAt: client.createdAt,
      })
      .from(client)
      .where(baseCondition)
      .orderBy(desc(client.createdAt));

    if (allInquilinos.length === 0) {
      return NextResponse.json({
        inquilinos: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
        stats: {
          total: 0,
          conContratoActivo: 0,
          enMora: 0,
          porVencer: 0,
          sinContrato: 0,
        },
      });
    }

    const ids = allInquilinos.map((i) => i.id);

    // Contratos activos de esos inquilinos (con datos de propiedad)
    const contracts = await db
      .select({
        clientId: contractTenant.clientId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        startDate: contract.startDate,
        endDate: contract.endDate,
        paymentDay: contract.paymentDay,
        propertyAddress: property.address,
        propertyFloorUnit: property.floorUnit,
      })
      .from(contractTenant)
      .innerJoin(contract, eq(contract.id, contractTenant.contractId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(
        and(
          inArray(contractTenant.clientId, ids),
          eq(contract.status, "active")
        )
      );

    // Último ingreso registrado por inquilino (para detectar mora)
    const payments = await db
      .select({
        inquilinoId: cajaMovimiento.inquilinoId,
        fecha: cajaMovimiento.date,
      })
      .from(cajaMovimiento)
      .where(
        and(
          inArray(cajaMovimiento.inquilinoId, ids),
          eq(cajaMovimiento.tipo, "income")
        )
      )
      .orderBy(desc(cajaMovimiento.date));

    // Mapas de consulta rápida
    const contractByClient = new Map<string, (typeof contracts)[0]>();
    for (const c of contracts) {
      // Un inquilino puede tener más de un contrato activo (raro, pero posible)
      // Tomamos el primero que encontramos
      if (!contractByClient.has(c.clientId)) {
        contractByClient.set(c.clientId, c);
      }
    }

    const lastPaymentByClient = new Map<string, string>();
    for (const p of payments) {
      if (p.inquilinoId && !lastPaymentByClient.has(p.inquilinoId)) {
        lastPaymentByClient.set(p.inquilinoId, p.fecha);
      }
    }

    // Enriquecer cada inquilino con datos del contrato y estado calculado
    const enriched = allInquilinos.map((inq) => {
      const activeContract = contractByClient.get(inq.id) ?? null;
      const lastPayment = lastPaymentByClient.get(inq.id) ?? null;
      const { estado, diasMora } = calculateStatus(
        activeContract
          ? {
              endDate: activeContract.endDate,
              paymentDay: activeContract.paymentDay,
            }
          : null,
        lastPayment
      );
      const completitud = activeContract
        ? calcularCompletitud(activeContract.startDate, activeContract.endDate)
        : null;

      // Armar dirección de propiedad
      let propiedad: string | null = null;
      if (activeContract?.propertyAddress) {
        propiedad = activeContract.propertyAddress;
        if (activeContract.propertyFloorUnit)
          propiedad += `, ${activeContract.propertyFloorUnit}`;
      }

      return {
        ...inq,
        contrato: activeContract
          ? {
              id: activeContract.contractId,
              numero: activeContract.contractNumber,
              endDate: activeContract.endDate,
              completitud,
            }
          : null,
        propiedad,
        ultimoPago: lastPayment,
        estado,
        diasMora,
      };
    });

    // Estadísticas globales (sobre todos los inquilinos, sin filtro de estado)
    const stats = {
      total: enriched.length,
      conContratoActivo: enriched.filter((i) => i.estado !== "sin_contrato")
        .length,
      enMora: enriched.filter((i) => i.estado === "en_mora").length,
      porVencer: enriched.filter((i) => i.estado === "por_vencer").length,
      sinContrato: enriched.filter((i) => i.estado === "sin_contrato").length,
    };

    // Filtrar por estado si se pide
    const filtered =
      estadoFilter === "todos"
        ? enriched
        : enriched.filter((i) => i.estado === estadoFilter);

    // Paginar en memoria (dataset pequeño en MVP)
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      inquilinos: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("Error fetching inquilinos:", error);
    return NextResponse.json(
      { error: "Error al obtener los inquilinos" },
      { status: 500 }
    );
  }
}
