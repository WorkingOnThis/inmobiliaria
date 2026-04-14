import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { PROPERTY_TYPES, PROPERTY_STATUSES } from "@/lib/properties/constants";
import { z } from "zod";
import { count, desc, eq, ilike, or, and, inArray } from "drizzle-orm";

/**
 * Zod schema for property creation
 */
const createPropertySchema = z.object({
  title: z.string().optional().nullable(),
  address: z.string().min(1, "La dirección es requerida"),
  price: z.coerce.number().optional().nullable(),
  type: z.enum(PROPERTY_TYPES, {
    errorMap: () => ({ message: "El tipo de propiedad no es válido" }),
  }),
  status: z.enum(PROPERTY_STATUSES).default("available"),
  zone: z.string().optional().nullable(),
  floorUnit: z.string().optional().nullable(),
  rooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  surface: z.coerce.number().optional().nullable(),
  ownerId: z.string().min(1, "El dueño es requerido"),
});

/**
 * Statuses considered "active" for display in the property list contract column.
 * Excludes expired and terminated contracts.
 */
const ACTIVE_CONTRACT_STATUSES = ["active", "expiring_soon", "pending_signature", "draft"] as const;

/**
 * Generate a unique ID for database records
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Properties API Route
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "8")));
    const offset = (page - 1) * limit;
    const statusFilter = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const zone = searchParams.get("zone") || "";

    const conditions = [];
    if (statusFilter && PROPERTY_STATUSES.includes(statusFilter as any)) {
      conditions.push(eq(property.status, statusFilter));
    }
    if (zone.trim()) {
      conditions.push(ilike(property.zone, `%${zone.trim()}%`));
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(property.title, term),
          ilike(property.address, term),
          ilike(property.zone, term),
          ilike(client.firstName, term),
          ilike(client.lastName, term)
        )
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [propertiesWithOwner, [totalResult], statusCountsRaw] = await Promise.all([
      db
        .select({
          id: property.id,
          title: property.title,
          address: property.address,
          price: property.price,
          type: property.type,
          status: property.status,
          zone: property.zone,
          floorUnit: property.floorUnit,
          rooms: property.rooms,
          bathrooms: property.bathrooms,
          surface: property.surface,
          ownerId: property.ownerId,
          createdAt: property.createdAt,
          updatedAt: property.updatedAt,
          ownerFirstName: client.firstName,
          ownerLastName: client.lastName,
        })
        .from(property)
        .leftJoin(client, eq(property.ownerId, client.id))
        .where(where)
        .orderBy(desc(property.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(property)
        .leftJoin(client, eq(property.ownerId, client.id))
        .where(where),
      db.select({ status: property.status, cnt: count() }).from(property).groupBy(property.status),
    ]);

    // ── Fetch active contracts for this page of properties ──────────────────────
    // One additional query for up to `limit` properties — not N+1.
    const propertyIds = propertiesWithOwner.map((p) => p.id);
    let contractsByPropertyId: Map<string, {
      contractNumber: string;
      contractEndDate: string;
      contractStatus: string;
    }> = new Map();

    if (propertyIds.length > 0) {
      const activeContracts = await db
        .select({
          propertyId: contract.propertyId,
          contractNumber: contract.contractNumber,
          contractEndDate: contract.endDate,
          contractStatus: contract.status,
        })
        .from(contract)
        .where(
          and(
            inArray(contract.propertyId, propertyIds),
            inArray(contract.status, ACTIVE_CONTRACT_STATUSES as unknown as string[])
          )
        )
        .orderBy(desc(contract.endDate));

      // Keep only the most recent contract per property
      for (const c of activeContracts) {
        if (!contractsByPropertyId.has(c.propertyId)) {
          contractsByPropertyId.set(c.propertyId, {
            contractNumber: c.contractNumber,
            contractEndDate: c.contractEndDate,
            contractStatus: c.contractStatus,
          });
        }
      }
    }

    // Merge contract info into each property row
    const propertiesWithContract = propertiesWithOwner.map((p) => {
      const contractInfo = contractsByPropertyId.get(p.id) ?? null;
      return {
        ...p,
        contractNumber: contractInfo?.contractNumber ?? null,
        contractEndDate: contractInfo?.contractEndDate ?? null,
        contractStatus: contractInfo?.contractStatus ?? null,
      };
    });

    const countsMap: Record<string, number> = {};
    let grandTotal = 0;
    for (const row of statusCountsRaw) {
      countsMap[row.status] = Number(row.cnt);
      grandTotal += Number(row.cnt);
    }

    return NextResponse.json({
      properties: propertiesWithContract,
      pagination: {
        total: Number(totalResult.value),
        page,
        limit,
        totalPages: Math.ceil(Number(totalResult.value) / limit),
      },
      counts: {
        total: grandTotal,
        available: countsMap["available"] ?? 0,
        rented: countsMap["rented"] ?? 0,
        reserved: countsMap["reserved"] ?? 0,
        sold: countsMap["sold"] ?? 0,
        maintenance: countsMap["maintenance"] ?? 0,
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Error al obtener propiedades" }, { status: 500 });
  }
}

/**
 * POST /api/properties
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!canManageProperties(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createPropertySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;

    const [existingClient] = await db.select().from(client).where(eq(client.id, data.ownerId)).limit(1);
    if (!existingClient) {
      return NextResponse.json({ error: "El dueño especificado no existe" }, { status: 400 });
    }

    const propertyId = generateId();
    const now = new Date();

    const [newProperty] = await db
      .insert(property)
      .values({
        id: propertyId,
        title: data.title || data.address.split(",")[0], // Fallback a parte de la dirección
        address: data.address,
        price: data.price?.toString() || null,
        type: data.type,
        status: data.status,
        zone: data.zone,
        floorUnit: data.floorUnit,
        rooms: data.rooms,
        bathrooms: data.bathrooms,
        surface: data.surface?.toString() || null,
        ownerId: data.ownerId,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ message: "Propiedad creada exitosamente", property: newProperty }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error al crear la propiedad" }, { status: 500 });
  }
}
