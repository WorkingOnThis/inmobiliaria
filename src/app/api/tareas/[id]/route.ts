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
        clienteId: tarea.clienteId,
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
      .leftJoin(clienteAlias, eq(tarea.clienteId, clienteAlias.id))
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

    const archivos = await db
      .select({
        id: tareaArchivo.id,
        nombre: tareaArchivo.nombre,
        url: tareaArchivo.url,
        tipo: tareaArchivo.tipo,
        tamaño: tareaArchivo.tamaño,
        createdAt: tareaArchivo.createdAt,
      })
      .from(tareaArchivo)
      .where(eq(tareaArchivo.tareaId, id))
      .orderBy(desc(tareaArchivo.createdAt));

    return NextResponse.json({ ...row, historial, comentarios, archivos });
  } catch (error) {
    console.error("Error fetching tarea:", error);
    return NextResponse.json(
      { error: "Error al obtener la tarea" },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  prioridad: z.enum(["urgent", "high", "medium", "low"]).optional(),
  estado: z.enum(["pending", "in_progress", "resolved"]).optional(),
  assignedTo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  titulo: z.string().min(1).optional(),
  fechaVencimiento: z.string().nullable().optional(),
  clienteId: z.string().nullable().optional(),
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
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
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
      if (patch.prioridad !== undefined) updateData.prioridad = patch.prioridad;
      if (patch.estado !== undefined) updateData.estado = patch.estado;
      if (patch.assignedTo !== undefined) updateData.assignedTo = patch.assignedTo;
      if (patch.descripcion !== undefined) updateData.descripcion = patch.descripcion;
      if (patch.titulo !== undefined) updateData.titulo = patch.titulo;
      if (patch.clienteId !== undefined) updateData.clienteId = patch.clienteId;
      if (patch.propertyId !== undefined) updateData.propertyId = patch.propertyId;
      if (patch.fechaVencimiento !== undefined) {
        updateData.fechaVencimiento = patch.fechaVencimiento
          ? new Date(patch.fechaVencimiento)
          : null;
      }

      await tx.update(tarea).set(updateData).where(eq(tarea.id, id));

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

      if (patch.titulo !== undefined) {
        histEntries.push({
          id: crypto.randomUUID(),
          tareaId: id,
          texto: `Título actualizado`,
          tipo: "manual" as const,
          creadoPor: session.user.id,
          createdAt: now,
        });
      }

      if (patch.clienteId !== undefined) {
        histEntries.push({
          id: crypto.randomUUID(),
          tareaId: id,
          texto: patch.clienteId ? `Persona vinculada actualizada` : `Persona vinculada eliminada`,
          tipo: "manual" as const,
          creadoPor: session.user.id,
          createdAt: now,
        });
      }

      if (patch.propertyId !== undefined) {
        histEntries.push({
          id: crypto.randomUUID(),
          tareaId: id,
          texto: patch.propertyId ? `Propiedad vinculada actualizada` : `Propiedad vinculada eliminada`,
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
    return NextResponse.json(
      { error: "Error al eliminar la tarea" },
      { status: 500 }
    );
  }
}
