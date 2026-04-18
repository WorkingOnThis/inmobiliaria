import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { contract } from "@/db/schema/contract";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

const createPropietarioSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  dni: z.string().optional().nullable(),
  cuit: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  cbu: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const statusParam = searchParams.get("status") || "activo";
    const q = searchParams.get("q")?.trim() || "";

    const STATUS_MAP: Record<string, string> = {
      activo: "active",
      inactivo: "inactive",
      suspendido: "suspended",
    };
    const resolvedStatus = STATUS_MAP[statusParam] ?? statusParam;

    // Condición base: solo propietarios
    const baseCondition = eq(client.type, "owner");
    const statusCondition =
      statusParam !== "todos" ? eq(client.status, resolvedStatus) : undefined;

    // --- Búsqueda directa por nombre/DNI/teléfono ---
    let directMatchIds: string[] = [];
    let propMatchMap: Record<string, string> = {}; // propietarioId → dirección que coincidió

    if (q.length >= 2) {
      const likeQ = `%${q}%`;

      // Matches directos en client
      const directMatches = await db
        .select({ id: client.id })
        .from(client)
        .where(
          and(
            baseCondition,
            statusCondition,
            or(
              ilike(client.firstName, likeQ),
              ilike(sql`COALESCE(${client.lastName}, '')`, likeQ),
              ilike(
                sql`COALESCE(${client.firstName}, '') || ' ' || COALESCE(${client.lastName}, '')`,
                likeQ
              ),
              ilike(sql`COALESCE(${client.dni}, '')`, likeQ),
              ilike(sql`COALESCE(${client.phone}, '')`, likeQ)
            )
          )
        );
      directMatchIds = directMatches.map((r) => r.id);

      // Matches por dirección de propiedad asociada
      const propMatches = await db
        .select({ ownerId: property.ownerId, address: property.address })
        .from(property)
        .innerJoin(client, eq(property.ownerId, client.id))
        .where(
          and(
            eq(client.type, "owner"),
            statusCondition,
            ilike(property.address, likeQ)
          )
        );

      for (const pm of propMatches) {
        if (!directMatchIds.includes(pm.ownerId)) {
          propMatchMap[pm.ownerId] = pm.address;
        }
      }
    }

    // --- Construir where final ---
    let whereClause;
    if (q.length >= 2) {
      const allMatchIds = [...new Set([...directMatchIds, ...Object.keys(propMatchMap)])];
      if (allMatchIds.length === 0) {
        return NextResponse.json({
          owners: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        });
      }
      whereClause = and(baseCondition, statusCondition, inArray(client.id, allMatchIds));
    } else {
      whereClause = and(baseCondition, statusCondition);
    }

    // --- Total ---
    const [totalResult] = await db
      .select({ value: count() })
      .from(client)
      .where(whereClause);
    const total = Number(totalResult.value);

    // --- Propietarios con conteo de propiedades y contratos activos ---
    const propietariosData = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        dni: client.dni,
        cuit: client.cuit,
        cbu: client.cbu,
        status: client.status,
        createdAt: client.createdAt,
      })
      .from(client)
      .where(whereClause)
      .orderBy(desc(client.createdAt))
      .limit(limit)
      .offset(offset);

    // Contar propiedades y contratos activos por propietario
    const ids = propietariosData.map((p) => p.id);

    let propCountMap: Record<string, number> = {};
    let contractCountMap: Record<string, number> = {};

    if (ids.length > 0) {
      const propCounts = await db
        .select({ ownerId: property.ownerId, value: count() })
        .from(property)
        .where(inArray(property.ownerId, ids))
        .groupBy(property.ownerId);

      for (const r of propCounts) propCountMap[r.ownerId] = Number(r.value);

      const contractCounts = await db
        .select({ ownerId: contract.ownerId, value: count() })
        .from(contract)
        .where(and(inArray(contract.ownerId, ids), eq(contract.status, "active")))
        .groupBy(contract.ownerId);

      for (const r of contractCounts) contractCountMap[r.ownerId] = Number(r.value);
    }

    const owners = propietariosData.map((p) => ({
      ...p,
      propiedadesCount: propCountMap[p.id] ?? 0,
      contratosActivosCount: contractCountMap[p.id] ?? 0,
      matchedProperty: propMatchMap[p.id] ?? null,
    }));

    return NextResponse.json({
      owners,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error GET /api/owners:", error);
    return NextResponse.json({ error: "Error al obtener propietarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createPropietarioSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;
    const now = new Date();
    const id = crypto.randomUUID();

    const [newPropietario] = await db
      .insert(client)
      .values({
        id,
        type: "owner",
        status: "active",
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        email: data.email || null,
        dni: data.dni ?? null,
        cuit: data.cuit ?? null,
        address: data.address ?? null,
        birthDate: data.birthDate ?? null,
        cbu: data.cbu ?? null,
        alias: data.alias ?? null,
        bank: data.bank ?? null,
        accountType: data.accountType ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(
      { message: "Propietario creado exitosamente", owner: newPropietario },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/owners:", error);
    return NextResponse.json({ error: "Error al crear el propietario" }, { status: 500 });
  }
}
