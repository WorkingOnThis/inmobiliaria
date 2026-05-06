import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { tarea, tareaHistorial } from "@/db/schema/tarea";
import { property } from "@/db/schema/property";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { user } from "@/db/schema/better-auth";
import { and, count, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const tenantAlias = alias(client, "tenantClient");
const assignedUserAlias = alias(user, "assignedUser");

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const params = request.nextUrl.searchParams;
    const scope = params.get("scope") ?? "mine";
    const categoria = params.get("categoria");
    const tipo = params.get("tipo");
    const estado = params.get("estado");
    const excluirResuelta = params.get("excluirResuelta") === "true";

    const conditions = [eq(tarea.agencyId, agencyId)];
    if (scope === "mine") conditions.push(eq(tarea.assignedTo, session!.user.id));
    if (categoria) conditions.push(eq(tarea.category, categoria));
    if (tipo) conditions.push(eq(tarea.type, tipo));
    if (estado) conditions.push(eq(tarea.status, estado));
    if (excluirResuelta) conditions.push(ne(tarea.status, "resolved"));

    const items = await db
      .select({
        id: tarea.id,
        title: tarea.title,
        description: tarea.description,
        priority: tarea.priority,
        status: tarea.status,
        tipo: tarea.type,
        categoria: tarea.category,
        dueDate: tarea.dueDate,
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
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${tarea.priority} WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
        desc(tarea.createdAt)
      );

    const [{ totalProps }] = await db
      .select({ totalProps: count() })
      .from(property)
      .where(eq(property.agencyId, agencyId));

    let saludPortfolio = 100;
    if (totalProps > 0) {
      const alertProps = await db
        .selectDistinct({ pid: tarea.propertyId })
        .from(tarea)
        .where(
          and(
            eq(tarea.agencyId, agencyId),
            inArray(tarea.priority, ["urgent", "high"]),
            inArray(tarea.status, ["pending", "in_progress"]),
            isNotNull(tarea.propertyId)
          )
        );
      saludPortfolio = Math.round(((totalProps - alertProps.length) / totalProps) * 100);
    }

    return NextResponse.json({ total: items.length, saludPortfolio, items });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error fetching tareas:", error);
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }
}

const crearTareaSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().nullable().optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
  type: z.enum(["auto", "manual"]).default("manual"),
  category: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional().transform((v) => (v ? new Date(v) : null)),
  propertyId: z.string().nullable().optional(),
  contractId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const body = await request.json();
    const result = crearTareaSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
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
          agencyId,
          title: data.title,
          description: data.description ?? null,
          priority: data.priority,
          status: "pending",
          type: data.type,
          category: data.category ?? null,
          dueDate: data.dueDate ?? null,
          propertyId: data.propertyId ?? null,
          contractId: data.contractId ?? null,
          tenantId: data.tenantId ?? null,
          ownerId: data.ownerId ?? null,
          assignedTo: data.assignedTo ?? session!.user.id,
          createdBy: session!.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(tareaHistorial).values({
        id: historialId,
        taskId: id,
        text: "Tarea creada",
        type: "manual",
        createdBy: session!.user.id,
        createdAt: now,
      });

      return t;
    });

    return NextResponse.json({ message: "Tarea creada exitosamente", tarea: nuevaTarea }, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error creating tarea:", error);
    return NextResponse.json({ error: "Error al crear la tarea" }, { status: 500 });
  }
}
