import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { tarea, tareaHistorial } from "@/db/schema/tarea";
import { property } from "@/db/schema/property";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { user } from "@/db/schema/better-auth";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const tenantAlias = alias(client, "tenantClient");
const assignedUserAlias = alias(user, "assignedUser");

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const scope = params.get("scope") ?? "mine";
    const categoria = params.get("categoria");
    const tipo = params.get("tipo");
    const estado = params.get("estado");

    const conditions = [];
    if (scope === "mine") {
      conditions.push(eq(tarea.assignedTo, session.user.id));
    }
    if (categoria) conditions.push(eq(tarea.categoria, categoria));
    if (tipo) conditions.push(eq(tarea.tipo, tipo));
    if (estado) conditions.push(eq(tarea.estado, estado));

    const items = await db
      .select({
        id: tarea.id,
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        prioridad: tarea.prioridad,
        estado: tarea.estado,
        tipo: tarea.tipo,
        categoria: tarea.categoria,
        fechaVencimiento: tarea.fechaVencimiento,
        propertyId: tarea.propertyId,
        propertyAddress: property.address,
        contractId: tarea.contractId,
        contractNumber: contract.contractNumber,
        tenantId: tarea.tenantId,
        tenantNombre: sql<string | null>`NULLIF(TRIM(COALESCE(${tenantAlias.firstName}, '') || ' ' || COALESCE(${tenantAlias.lastName}, '')), '')`,
        assignedToId: tarea.assignedTo,
        assignedToNombre: assignedUserAlias.name,
        createdAt: tarea.createdAt,
        updatedAt: tarea.updatedAt,
      })
      .from(tarea)
      .leftJoin(property, eq(tarea.propertyId, property.id))
      .leftJoin(contract, eq(tarea.contractId, contract.id))
      .leftJoin(tenantAlias, eq(tarea.tenantId, tenantAlias.id))
      .leftJoin(assignedUserAlias, eq(tarea.assignedTo, assignedUserAlias.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sql`CASE ${tarea.prioridad} WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 WHEN 'baja' THEN 4 ELSE 5 END`,
        desc(tarea.createdAt)
      );

    // Salud del portfolio: % de propiedades sin tareas urgente/alta abiertas
    const [{ totalProps }] = await db
      .select({ totalProps: count() })
      .from(property);

    let saludPortfolio = 100;
    if (totalProps > 0) {
      const alertProps = await db
        .selectDistinct({ pid: tarea.propertyId })
        .from(tarea)
        .where(
          and(
            inArray(tarea.prioridad, ["urgente", "alta"]),
            inArray(tarea.estado, ["pendiente", "en_curso"]),
            isNotNull(tarea.propertyId)
          )
        );
      saludPortfolio = Math.round(
        ((totalProps - alertProps.length) / totalProps) * 100
      );
    }

    return NextResponse.json({
      total: items.length,
      saludPortfolio,
      items,
    });
  } catch (error) {
    console.error("Error fetching tareas:", error);
    return NextResponse.json(
      { error: "Error al obtener tareas" },
      { status: 500 }
    );
  }
}

const crearTareaSchema = z.object({
  titulo: z.string().min(1, "El título es obligatorio"),
  descripcion: z.string().nullable().optional(),
  prioridad: z.enum(["urgente", "alta", "media", "baja"]).default("media"),
  tipo: z.enum(["auto", "manual"]).default("manual"),
  categoria: z.string().nullable().optional(),
  fechaVencimiento: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  propertyId: z.string().nullable().optional(),
  contractId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const result = crearTareaSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = result.data;
    const id = crypto.randomUUID();
    const historialId = crypto.randomUUID();
    const now = new Date();

    const nuevaTarea = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(tarea)
        .values({
          id,
          titulo: data.titulo,
          descripcion: data.descripcion ?? null,
          prioridad: data.prioridad,
          estado: "pendiente",
          tipo: data.tipo,
          categoria: data.categoria ?? null,
          fechaVencimiento: data.fechaVencimiento ?? null,
          propertyId: data.propertyId ?? null,
          contractId: data.contractId ?? null,
          tenantId: data.tenantId ?? null,
          ownerId: data.ownerId ?? null,
          assignedTo: data.assignedTo ?? session.user.id,
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(tareaHistorial).values({
        id: historialId,
        tareaId: id,
        texto: "Tarea creada",
        tipo: "manual",
        creadoPor: session.user.id,
        createdAt: now,
      });

      return t;
    });

    return NextResponse.json(
      { message: "Tarea creada exitosamente", tarea: nuevaTarea },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tarea:", error);
    return NextResponse.json(
      { error: "Error al crear la tarea" },
      { status: 500 }
    );
  }
}
