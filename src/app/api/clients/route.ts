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
/**
 * Zod schema for client creation
 */
const createClientSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  createAsUser: z.boolean().default(false), // Si se debe crear un usuario asociado
});

/**
 * Generate a unique ID for database records
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Clients API Route
 */
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
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const [totalCountResult] = await db.select({ value: count() }).from(client);
    const totalCount = Number(totalCountResult.value);

    // Obtener lista de clientes con datos de usuario (si existe)
    const clientsData = await db
      .select({
        id: client.id,
        userId: client.userId,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email, // Preferimos el email del cliente
        userEmail: user.email, // Email del usuario si existe
        phone: client.phone,
        whatsapp: client.whatsapp,
        dni: client.dni,
        role: user.role,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      })
      .from(client)
      .leftJoin(user, eq(client.userId, user.id))
      .orderBy(desc(client.createdAt))
      .limit(limit)
      .offset(offset);

    // Normalizar email (usar userEmail como fallback si client.email está vacío)
    const normalizedClients = clientsData.map(c => ({
      ...c,
      email: c.email || c.userEmail || "",
    }));

    return NextResponse.json({
      clients: normalizedClients,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

/**
 * POST handler for client creation
 */
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
    const result = createClientSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;

    // Si pide crear usuario, verificar que no exista el email
    if (data.createAsUser && data.email) {
      const existingUser = await db.select().from(user).where(eq(user.email, data.email)).limit(1);
      if (existingUser.length > 0) {
        return NextResponse.json({ error: "El email ya está registrado como usuario." }, { status: 409 });
      }
    }

    // Iniciar transacción
    const newClientData = await db.transaction(async (tx) => {
      let userId: string | null = null;
      const now = new Date();

      if (data.createAsUser && data.email) {
        userId = generateId();
        await tx.insert(user).values({
          id: userId,
          name: `${data.firstName} ${data.lastName || ""}`.trim(),
          email: data.email,
          role: "visitor",
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      const clientId = generateId();
      const [newClient] = await tx
        .insert(client)
        .values({
          id: clientId,
          userId: userId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          whatsapp: data.whatsapp,
          email: data.email,
          dni: data.dni,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      
      return newClient;
    });

    return NextResponse.json({ message: "Cliente creado exitosamente", client: newClientData }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Error al crear el cliente" }, { status: 500 });
  }
}
