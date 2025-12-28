import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { property } from "@/db/schema/property";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { PROPERTY_TYPES, PROPERTY_STATUSES } from "@/lib/properties/constants";
import { z } from "zod";
import { count, desc, eq } from "drizzle-orm";

/**
 * Zod schema for property creation
 */
const createPropertySchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  address: z.string().min(1, "La dirección es requerida"),
  price: z.coerce.number().positive("El precio debe ser un número positivo"),
  type: z.enum(PROPERTY_TYPES, {
    errorMap: () => ({ message: "El tipo de propiedad no es válido" }),
  }),
  status: z.enum(PROPERTY_STATUSES).default("available"),
  rooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  surface: z.coerce.number().positive().optional().nullable(),
  ownerId: z.string().min(1, "El dueño es requerido"),
});

/**
 * Generate a unique ID for database records
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Properties API Route
 *
 * Handles creation and listing of properties.
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener sesión del usuario
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Verificar autenticación
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener parámetros de paginación
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Obtener total de propiedades
    const [totalCountResult] = await db.select({ value: count() }).from(property);
    const totalCount = Number(totalCountResult.value);

    // Obtener lista de propiedades paginada
    const properties = await db
      .select()
      .from(property)
      .orderBy(desc(property.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      properties,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al obtener las propiedades. Por favor intenta de nuevo." },
      { status: 500 }
    );
  }
}

/**
 * POST handler for property creation
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener sesión del usuario
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Verificar autenticación
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!canManageProperties(session.user.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar propiedades" },
        { status: 403 }
      );
    }

    // Parsear y validar body
    const body = await request.json();
    const result = createPropertySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message, details: result.error.errors },
        { status: 400 }
      );
    }

    const data = result.data;

    // Verificar que el dueño exista
    const [existingClient] = await db
      .select()
      .from(client)
      .where(eq(client.id, data.ownerId))
      .limit(1);

    if (!existingClient) {
      return NextResponse.json(
        { error: "El cliente (dueño) especificado no existe" },
        { status: 400 }
      );
    }

    // Crear propiedad en la base de datos
    const propertyId = generateId();
    const now = new Date();

    const [newProperty] = await db
      .insert(property)
      .values({
        id: propertyId,
        title: data.title,
        address: data.address,
        price: data.price.toString(),
        type: data.type,
        status: data.status,
        rooms: data.rooms,
        bathrooms: data.bathrooms,
        surface: data.surface?.toString(),
        ownerId: data.ownerId,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(
      {
        message: "Propiedad creada exitosamente",
        property: newProperty,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating property:", error);
    return NextResponse.json(
      {
        error: "Ocurrió un error al crear la propiedad. Por favor intenta de nuevo.",
      },
      { status: 500 }
    );
  }
}

