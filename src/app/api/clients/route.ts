import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { CLIENT_TYPES } from "@/lib/clients/constants";
import { z } from "zod";
import { count, desc } from "drizzle-orm";

/**
 * Zod schema for client creation
 */
const createClientSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  tipo: z.enum(CLIENT_TYPES, {
    errorMap: () => ({ message: "El tipo de cliente no es válido" }),
  }),
  telefono: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  dueño_de: z.string().optional().nullable(),
  alquila: z.string().optional().nullable(),
});

/**
 * Generate a unique ID for database records
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Clients API Route
 *
 * Handles creation and listing of clients.
 * Requires user to have client management permissions.
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

    // Verificar permisos
    if (!canManageClients(session.user.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar clientes" },
        { status: 403 }
      );
    }

    // Obtener parámetros de paginación
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Obtener total de clientes
    const [totalCountResult] = await db.select({ value: count() }).from(client);
    const totalCount = Number(totalCountResult.value);

    // Obtener lista de clientes paginada
    const clients = await db
      .select()
      .from(client)
      .orderBy(desc(client.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      clients,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al obtener los clientes. Por favor intenta de nuevo." },
      { status: 500 }
    );
  }
}

/**
 * POST handler for client creation
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
    if (!canManageClients(session.user.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar clientes" },
        { status: 403 }
      );
    }

    // Parsear y validar body
    const body = await request.json();
    const result = createClientSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message, details: result.error.errors },
        { status: 400 }
      );
    }

    const data = result.data;

    // Crear cliente en la base de datos
    const clientId = generateId();
    const now = new Date();

    const [newClient] = await db
      .insert(client)
      .values({
        id: clientId,
        nombre: data.nombre,
        apellido: data.apellido,
        tipo: data.tipo,
        telefono: data.telefono,
        dni: data.dni,
        email: data.email,
        dueño_de: data.dueño_de,
        alquila: data.alquila,
        creado_por: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(
      {
        message: "Cliente creado exitosamente",
        client: {
          id: newClient.id,
          nombre: newClient.nombre,
          apellido: newClient.apellido,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      {
        error: "Ocurrió un error al crear el cliente. Por favor intenta de nuevo.",
      },
      { status: 500 }
    );
  }
}

