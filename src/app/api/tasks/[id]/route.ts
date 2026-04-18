import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { tarea, tareaHistorial, tareaComentario, tareaArchivo } from "@/db/schema/tarea";
import { property } from "@/db/schema/property";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { user } from "@/db/schema/better-auth";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const tenantAlias = alias(client, "tenantClient");
const ownerAlias = alias(client, "ownerClient");
const clienteAlias = alias(client, "clienteClient");
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
        title: tarea.title,
        description: tarea.description,
        priority: tarea.priority,
        status: tarea.status,
        tipo: tarea.tipo,
        categoria: tarea.categoria,
        dueDate: tarea.dueDate,
        propertyId: tarea.propertyId,
        propertyAddress: property.address,
        contractId: tarea.contractId,
        contractNumber: contract.contractNumber,
        tenantId: tarea.tenantId,
        tenantNombre: sql<string | null>`NULLIF(TRIM(COALESCE(${tenantAlias.firstName}, '') || ' ' || COALESCE(${tenantAlias.lastName}, '')), '')`,
        ownerId: tarea.ownerId,
        ownerNombre: sql<string | null>`NULLIF(TRIM(COALESCE(${ownerAlias.firstName}, '') || ' ' || COALESCE(${ownerAlias.lastName}, '')), '')`,
        clientId: tarea.clientId,
        clienteNombre: sql<string | null>`NULLIF(TRIM(COALESCE(${clienteAlias.firstName}, '') || ' ' || COALESCE(${clienteAlias.lastName}, '')), '')`,
        clienteTipo: clienteAlias.type,
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
      .leftJoin(clienteAlias, eq(tarea.clientId, clienteAlias.id))
      .leftJoin(assignedUserAlias, eq(tarea.assignedTo, assignedUserAlias.id))
      .where(eq(tarea.id, id));

    if (!row) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const historial = await db
      .select({
        id: tareaHistorial.id,
        text: tareaHistorial.text,
        tipo: tareaHistorial.tipo,
        createdByName: historialUserAlias.name,
        createdAt: tareaHistorial.createdAt,
      })
      .from(tareaHistorial)
      .leftJoin(historialUserAlias, eq(tareaHistorial.createdBy, historialUserAlias.id))
      .where(eq(tareaHistorial.taskId, id))
      .orderBy(desc(tareaHistorial.createdAt));

    const comentarios = await db
      .select({
        id: tareaComentario.id,
        text: tareaComentario.text,
        createdByName: comentarioUserAlias.name,
        createdAt: tareaComentario.createdAt,
      })
      .from(tareaComentario)
      .leftJoin(comentarioUserAlias, eq(tareaComentario.createdBy, comentarioUserAlias.id))
      .where(eq(tareaComentario.taskId, id))
      .orderBy(desc(tareaComentario.createdAt));

    const archivos = await db
      .select({
        id: tareaArchivo.id,
        name: tareaArchivo.name,
        url: tareaArchivo.url,
        tipo: tareaArchivo.tipo,
        size: tareaArchivo.size,
        createdAt: tareaArchivo.createdAt,
      })
      .from(tareaArchivo)
      .where(eq(tareaArchivo.taskId, id))
      .orderBy(desc(tareaArchivo.createdAt));

    return NextResponse.json({ ...row, historial, comentarios, archivos });
  } catch (error) {
    console.error("Error fetching tarea:", error);
    return NextResponse.json({ error: "Error al obtener la tarea" }, { status: 500 });
  }
}

const patchSchema = z.object({
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  status: z.enum(["pending", "in_progress", "resolved"]).optional(),
  assignedTo: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
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
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const patch = result.data;
    const now = new Date();

    const ESTADO_LABELS: Record<string, string> = {
      pending: "Pendiente",
      in_progress: "En curso",
      resolved: "Resuelta",
    };

    const PRIORIDAD_LABELS: Record<string, string> = {
      urgent: "Urgente",
      high: "Alta",
      medium: "Media",
      low: "Baja",
    };

    await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (patch.priority !== undefined) updateData.priority = patch.priority;
      if (patch.status !== undefined) updateData.status = patch.status;
      if (patch.assignedTo !== undefined) updateData.assignedTo = patch.assignedTo;
      if (patch.description !== undefined) updateData.description = patch.description;
      if (patch.title !== undefined) updateData.title = patch.title;
      if (patch.clientId !== undefined) updateData.clientId = patch.clientId;
      if (patch.propertyId !== undefined) updateData.propertyId = patch.propertyId;
      if (patch.dueDate !== undefined) {
        updateData.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
      }

      await tx.update(tarea).set(updateData).where(eq(tarea.id, id));

      const histEntries = [];

      if (patch.status) {
        histEntries.push({
          id: crypto.randomUUID(),
          taskId: id,
          text: `Estado cambiado a "${ESTADO_LABELS[patch.status] ?? patch.status}"`,
          tipo: "manual" as const,
          createdBy: session.user.id,
          createdAt: now,
        });
      }

      if (patch.priority) {
        histEntries.push({
          id: crypto.randomUUID(),
          taskId: id,
          text: `Prioridad cambiada a "${PRIORIDAD_LABELS[patch.priority] ?? patch.priority}"`,
          tipo: "manual" as const,
          createdBy: session.user.id,
          createdAt: now,
        });
      }

      if (patch.title !== undefined) {
        histEntries.push({
          id: crypto.randomUUID(),
          taskId: id,
          text: `Título actualizado`,
          tipo: "manual" as const,
          createdBy: session.user.id,
          createdAt: now,
        });
      }

      if (patch.clientId !== undefined) {
        histEntries.push({
          id: crypto.randomUUID(),
          taskId: id,
          text: patch.clientId ? `Persona vinculada actualizada` : `Persona vinculada eliminada`,
          tipo: "manual" as const,
          createdBy: session.user.id,
          createdAt: now,
        });
      }

      if (patch.propertyId !== undefined) {
        histEntries.push({
          id: crypto.randomUUID(),
          taskId: id,
          text: patch.propertyId ? `Propiedad vinculada actualizada` : `Propiedad vinculada eliminada`,
          tipo: "manual" as const,
          createdBy: session.user.id,
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
    return NextResponse.json({ error: "Error al actualizar la tarea" }, { status: 500 });
  }
}

const comentarioSchema = z.object({
  text: z.string().min(1, "El comentario no puede estar vacío"),
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
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [comentario] = await db
      .insert(tareaComentario)
      .values({
        id: crypto.randomUUID(),
        taskId: id,
        text: result.data.text,
        createdBy: session.user.id,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ message: "Comentario agregado", comentario }, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Error al agregar el comentario" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(tarea).where(and(eq(tarea.id, id)));
    return NextResponse.json({ message: "Tarea eliminada" });
  } catch (error) {
    console.error("Error deleting tarea:", error);
    return NextResponse.json({ error: "Error al eliminar la tarea" }, { status: 500 });
  }
}
