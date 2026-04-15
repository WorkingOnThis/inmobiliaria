import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { tarea, tareaHistorial, tareaComentario } from "@/db/schema/tarea";
import { property } from "@/db/schema/property";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { user } from "@/db/schema/better-auth";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const tenantAlias = alias(client, "tenantClient");
const ownerAlias = alias(client, "ownerClient");
const assignedUserAlias = alias(user, "assignedUser");
const historialUserAlias = alias(user, "historialUser");
const comentarioUserAlias = alias(user, "comentarioUser");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const [row] = await db
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
        ownerId: tarea.ownerId,
        ownerNombre: sql<string | null>`NULLIF(TRIM(COALESCE(${ownerAlias.firstName}, '') || ' ' || COALESCE(${ownerAlias.lastName}, '')), '')`,
        assignedToId: tarea.assignedTo,
        assignedToNombre: assignedUserAlias.name,
        createdAt: tarea.createdAt,
        updatedAt: tarea.updatedAt,
      })
      .from(tarea)
      .leftJoin(property, eq(tarea.propertyId, property.id))
      .leftJoin(contract, eq(tarea.contractId, contract.id))
      .leftJoin(tenantAlias, eq(tarea.tenantId, tenantAlias.id))
      .leftJoin(ownerAlias, eq(tarea.ownerId, ownerAlias.id))
      .leftJoin(assignedUserAlias, eq(tarea.assignedTo, assignedUserAlias.id))
      .where(eq(tarea.id, id));

    if (!row) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      );
    }

    const historial = await db
      .select({
        id: tareaHistorial.id,
        texto: tareaHistorial.texto,
        tipo: tareaHistorial.tipo,
        creadoPorNombre: historialUserAlias.name,
        createdAt: tareaHistorial.createdAt,
      })
      .from(tareaHistorial)
      .leftJoin(
        historialUserAlias,
        eq(tareaHistorial.creadoPor, historialUserAlias.id)
      )
      .where(eq(tareaHistorial.tareaId, id))
      .orderBy(desc(tareaHistorial.createdAt));

    const comentarios = await db
      .select({
        id: tareaComentario.id,
        texto: tareaComentario.texto,
        creadoPorNombre: comentarioUserAlias.name,
        createdAt: tareaComentario.createdAt,
      })
      .from(tareaComentario)
      .leftJoin(
        comentarioUserAlias,
        eq(tareaComentario.creadoPor, comentarioUserAlias.id)
      )
      .where(eq(tareaComentario.tareaId, id))
      .orderBy(desc(tareaComentario.createdAt));

    return NextResponse.json({ ...row, historial, comentarios });
  } catch (error) {
    console.error("Error fetching tarea:", error);
    return NextResponse.json(
      { error: "Error al obtener la tarea" },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  prioridad: z.enum(["urgente", "alta", "media", "baja"]).optional(),
  estado: z.enum(["pendiente", "en_curso", "resuelta"]).optional(),
  assignedTo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = patchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const patch = result.data;
    const now = new Date();

    const ESTADO_LABELS: Record<string, string> = {
      pendiente: "Pendiente",
      en_curso: "En curso",
      resuelta: "Resuelta",
    };

    const PRIORIDAD_LABELS: Record<string, string> = {
      urgente: "Urgente",
      alta: "Alta",
      media: "Media",
      baja: "Baja",
    };

    await db.transaction(async (tx) => {
      await tx
        .update(tarea)
        .set({ ...patch, updatedAt: now })
        .where(eq(tarea.id, id));

      // Registro de historial por cada campo cambiado
      const histEntries = [];

      if (patch.estado) {
        histEntries.push({
          id: crypto.randomUUID(),
          tareaId: id,
          texto: `Estado cambiado a "${ESTADO_LABELS[patch.estado] ?? patch.estado}"`,
          tipo: "manual" as const,
          creadoPor: session.user.id,
          createdAt: now,
        });
      }

      if (patch.prioridad) {
        histEntries.push({
          id: crypto.randomUUID(),
          tareaId: id,
          texto: `Prioridad cambiada a "${PRIORIDAD_LABELS[patch.prioridad] ?? patch.prioridad}"`,
          tipo: "manual" as const,
          creadoPor: session.user.id,
          createdAt: now,
        });
      }

      if (histEntries.length > 0) {
        await tx.insert(tareaHistorial).values(histEntries);
      }
    });

    return NextResponse.json({ message: "Tarea actualizada" });
  } catch (error) {
    console.error("Error updating tarea:", error);
    return NextResponse.json(
      { error: "Error al actualizar la tarea" },
      { status: 500 }
    );
  }
}

const comentarioSchema = z.object({
  texto: z.string().min(1, "El comentario no puede estar vacío"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = comentarioSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const [comentario] = await db
      .insert(tareaComentario)
      .values({
        id: crypto.randomUUID(),
        tareaId: id,
        texto: result.data.texto,
        creadoPor: session.user.id,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      { message: "Comentario agregado", comentario },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json(
      { error: "Error al agregar el comentario" },
      { status: 500 }
    );
  }
}
