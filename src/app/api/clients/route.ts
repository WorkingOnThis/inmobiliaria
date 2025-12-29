import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { user } from "@/db/schema/better-auth";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { z } from "zod";
import { count, desc, eq } from "drizzle-orm";

/**
 * Zod schema for client creation
 */
const createClientSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  phone: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  email: z.string().email("Email inválido"),
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

    // Obtener lista de clientes paginada con datos de usuario
    const clientsData = await db
      .select({
        id: client.id,
        userId: client.userId,
        firstName: client.firstName,
        lastName: client.lastName,
        email: user.email,
        phone: client.phone,
        dni: client.dni,
        role: user.role,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      })
      .from(client)
      .innerJoin(user, eq(client.userId, user.id))
      .orderBy(desc(client.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      clients: clientsData,
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

    // Verificar si el email ya existe en la tabla users
    const existingUser = await db.select().from(user).where(eq(user.email, data.email)).limit(1);
    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "El email ya está registrado en el sistema." },
        { status: 409 }
      );
    }

    // Iniciar transacción para crear usuario y cliente
    const newClientData = await db.transaction(async (tx) => {
      const userId = generateId();
      const now = new Date();

      // 1. Crear usuario
      await tx.insert(user).values({
        id: userId,
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        role: "visitor", // Rol por defecto
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Crear detalle de cliente
      const clientId = generateId();
      const [newClient] = await tx
        .insert(client)
        .values({
          id: clientId,
          userId: userId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          dni: data.dni,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      return newClient;
    });

    return NextResponse.json(
      {
        message: "Cliente creado exitosamente",
        client: newClientData,
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
