import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { PROPERTY_TYPES, RENTAL_STATUSES, SALE_STATUSES } from "@/lib/properties/constants";
import { z } from "zod";
import { count, desc, eq, ilike, or, and, inArray, isNotNull } from "drizzle-orm";

const createPropertySchema = z.object({
  title: z.string().optional().nullable(),
  address: z.string().min(1, "La dirección es requerida"),
  type: z.enum(PROPERTY_TYPES, {
    errorMap: () => ({ message: "El tipo de propiedad no es válido" }),
  }),
  rentalStatus: z.enum(RENTAL_STATUSES).default("available"),
  saleStatus: z.enum(SALE_STATUSES).optional().nullable(),
  rentalPrice: z.coerce.number().optional().nullable(),
  rentalPriceCurrency: z.enum(["ARS", "USD"]).default("ARS"),
  salePrice: z.coerce.number().optional().nullable(),
  salePriceCurrency: z.enum(["ARS", "USD"]).default("USD"),
  zone: z.string().optional().nullable(),
  floorUnit: z.string().optional().nullable(),
  rooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  surface: z.coerce.number().optional().nullable(),
  ownerId: z.string().min(1, "El dueño es requerido"),
});

const ACTIVE_CONTRACT_STATUSES = ["active", "expiring_soon", "pending_signature", "draft"] as const;

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "8")));
    const offset = (page - 1) * limit;
    const rentalStatusFilter = searchParams.get("rentalStatus") || "";
    const saleStatusFilter = searchParams.get("saleStatus") || "";
    const search = searchParams.get("search") || "";
    const zone = searchParams.get("zone") || "";

    const conditions = [eq(property.agencyId, agencyId)];
    const isManagedParam = searchParams.get("isManaged");
    if (isManagedParam === "true") conditions.push(eq(property.isManaged, true));
    else if (isManagedParam === "false") conditions.push(eq(property.isManaged, false));

    if (rentalStatusFilter && RENTAL_STATUSES.includes(rentalStatusFilter as any)) {
      conditions.push(eq(property.rentalStatus, rentalStatusFilter));
    }
    if (saleStatusFilter === "for_sale" || saleStatusFilter === "sold") {
      conditions.push(eq(property.saleStatus, saleStatusFilter));
    } else if (saleStatusFilter === "en_venta_cualquier") {
      conditions.push(isNotNull(property.saleStatus));
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

    const [propertiesWithOwner, [totalResult], rentalCountsRaw, saleCountsRaw] = await Promise.all([
      db
        .select({
          id: property.id,
          title: property.title,
          address: property.address,
          rentalPrice: property.rentalPrice,
          rentalPriceCurrency: property.rentalPriceCurrency,
          salePrice: property.salePrice,
          salePriceCurrency: property.salePriceCurrency,
          type: property.type,
          rentalStatus: property.rentalStatus,
          saleStatus: property.saleStatus,
          zone: property.zone,
          floorUnit: property.floorUnit,
          rooms: property.rooms,
          bathrooms: property.bathrooms,
          surface: property.surface,
          isManaged: property.isManaged,
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
      db.select({ status: property.rentalStatus, cnt: count() }).from(property).where(eq(property.agencyId, agencyId)).groupBy(property.rentalStatus),
      db.select({ status: property.saleStatus, cnt: count() }).from(property).where(and(eq(property.agencyId, agencyId), isNotNull(property.saleStatus))).groupBy(property.saleStatus),
    ]);

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

    const propertiesWithContract = propertiesWithOwner.map((p) => {
      const contractInfo = contractsByPropertyId.get(p.id) ?? null;
      return {
        ...p,
        contractNumber: contractInfo?.contractNumber ?? null,
        contractEndDate: contractInfo?.contractEndDate ?? null,
        contractStatus: contractInfo?.contractStatus ?? null,
      };
    });

    const rentalCountsMap: Record<string, number> = {};
    let grandTotal = 0;
    for (const row of rentalCountsRaw) {
      rentalCountsMap[row.status] = Number(row.cnt);
      grandTotal += Number(row.cnt);
    }
    const saleCountsMap: Record<string, number> = {};
    for (const row of saleCountsRaw) {
      if (row.status) saleCountsMap[row.status] = Number(row.cnt);
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
        available: rentalCountsMap["available"] ?? 0,
        rented: rentalCountsMap["rented"] ?? 0,
        reserved: rentalCountsMap["reserved"] ?? 0,
        maintenance: rentalCountsMap["maintenance"] ?? 0,
        for_sale: saleCountsMap["for_sale"] ?? 0,
        sold: saleCountsMap["sold"] ?? 0,
      },
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Error al obtener propiedades" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageProperties(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createPropertySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;

    const [existingClient] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, data.ownerId), eq(client.agencyId, agencyId)))
      .limit(1);
    if (!existingClient) {
      return NextResponse.json({ error: "El dueño especificado no existe" }, { status: 400 });
    }

    const propertyId = generateId();
    const now = new Date();

    const [newProperty] = await db
      .insert(property)
      .values({
        id: propertyId,
        agencyId,
        title: data.title || data.address.split(",")[0],
        address: data.address,
        type: data.type,
        rentalStatus: data.rentalStatus,
        saleStatus: data.saleStatus ?? null,
        rentalPrice: data.rentalPrice?.toString() || null,
        rentalPriceCurrency: data.rentalPriceCurrency,
        salePrice: data.salePrice?.toString() || null,
        salePriceCurrency: data.salePriceCurrency,
        zone: data.zone,
        floorUnit: data.floorUnit,
        rooms: data.rooms,
        bathrooms: data.bathrooms,
        surface: data.surface?.toString() || null,
        ownerId: data.ownerId,
        createdBy: session!.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ message: "Propiedad creada exitosamente", property: newProperty }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al crear la propiedad" }, { status: 500 });
  }
}
