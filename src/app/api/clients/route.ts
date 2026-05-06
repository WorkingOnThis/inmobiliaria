import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { user } from "@/db/schema/better-auth";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, count, desc, eq, inArray, ilike, or } from "drizzle-orm";

const createClientSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  createAsUser: z.boolean().default(false),
  // Nuevos campos
  type: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  profession: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  cbu: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
});

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    const typeFilter = searchParams.get("type");
    const searchFilter = searchParams.get("search");

    // type accepts comma-separated values: type=owner,propietario
    const typeValues = typeFilter ? typeFilter.split(",").map((t) => t.trim()).filter(Boolean) : null;
    const typeCondition = typeValues?.length
      ? typeValues.length === 1
        ? eq(client.type, typeValues[0])
        : inArray(client.type, typeValues)
      : undefined;

    const searchCondition = searchFilter
      ? or(
          ilike(client.firstName, `%${searchFilter}%`),
          ilike(client.lastName, `%${searchFilter}%`)
        )
      : undefined;

    const agencyCondition = eq(client.agencyId, agencyId);
    const whereCondition = and(
      agencyCondition,
      ...(typeCondition ? [typeCondition] : []),
      ...(searchCondition ? [searchCondition] : []),
    );

    const [totalCountResult] = await db
      .select({ value: count() })
      .from(client)
      .where(whereCondition);
    const totalCount = Number(totalCountResult.value);

    const clientsData = await db
      .select({
        id: client.id,
        userId: client.userId,
        type: client.type,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        userEmail: user.email,
        phone: client.phone,
        whatsapp: client.whatsapp,
        dni: client.dni,
        address: client.address,
        profession: client.profession,
        birthDate: client.birthDate,
        cbu: client.cbu,
        alias: client.alias,
        bank: client.bank,
        accountType: client.accountType,
        role: user.role,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      })
      .from(client)
      .leftJoin(user, eq(client.userId, user.id))
      .where(whereCondition)
      .orderBy(desc(client.createdAt))
      .limit(limit)
      .offset(offset);

    const normalizedClients = clientsData.map((c) => ({
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
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createClientSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const data = result.data;

    if (data.createAsUser && data.email) {
      const existingUser = await db
        .select()
        .from(user)
        .where(eq(user.email, data.email))
        .limit(1);
      if (existingUser.length > 0) {
        return NextResponse.json(
          { error: "El email ya está registrado como usuario." },
          { status: 409 }
        );
      }
    }

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
          agencyId,
          userId: userId,
          type: data.type || "contacto",
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          whatsapp: data.whatsapp,
          email: data.email,
          dni: data.dni,
          address: data.address,
          profession: data.profession,
          birthDate: data.birthDate,
          cbu: data.cbu,
          alias: data.alias,
          bank: data.bank,
          accountType: data.accountType,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return newClient;
    });

    return NextResponse.json(
      { message: "Cliente creado exitosamente", client: newClientData },
      { status: 201 }
    );
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Error al crear el cliente" }, { status: 500 });
  }
}
