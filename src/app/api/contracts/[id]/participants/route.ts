import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const addParticipantSchema = z.object({
  clientId: z.string().min(1, "El cliente es requerido"),
  role: z.enum(["owner", "tenant", "guarantor"]),
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
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ id: contract.id })
      .from(contract)
      .where(eq(contract.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = addParticipantSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { clientId, role } = result.data;

    const [existingClient] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.id, clientId))
      .limit(1);
    if (!existingClient) {
      return NextResponse.json({ error: "El cliente no existe" }, { status: 400 });
    }

    const [duplicate] = await db
      .select({ id: contractParticipant.id })
      .from(contractParticipant)
      .where(
        and(
          eq(contractParticipant.contractId, id),
          eq(contractParticipant.clientId, clientId),
          eq(contractParticipant.role, role)
        )
      )
      .limit(1);
    if (duplicate) {
      return NextResponse.json(
        { error: "Este participante ya existe en el contrato" },
        { status: 409 }
      );
    }

    const [inserted] = await db
      .insert(contractParticipant)
      .values({ contractId: id, clientId, role })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("Error adding participant:", error);
    return NextResponse.json(
      { error: "Error al agregar participante" },
      { status: 500 }
    );
  }
}
