import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractGuarantee } from "@/db/schema/contract-guarantee";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { z } from "zod";

const addGuaranteeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("personal"),
    clientId: z.string().min(1, "El garante es requerido"),
  }),
  z.object({
    type: z.literal("real"),
    propertyId: z.string().optional(),
    externalAddress: z.string().optional(),
    externalCadastralRef: z.string().optional(),
    externalOwnerName: z.string().optional(),
    externalOwnerDni: z.string().optional(),
  }),
]);

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
    const result = addGuaranteeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    if (data.type === "personal") {
      const [existingClient] = await db
        .select({ id: client.id })
        .from(client)
        .where(eq(client.id, data.clientId))
        .limit(1);
      if (!existingClient) {
        return NextResponse.json({ error: "El garante no existe" }, { status: 400 });
      }
    }

    if (data.type === "real" && data.propertyId) {
      const [existingProp] = await db
        .select({ id: property.id })
        .from(property)
        .where(eq(property.id, data.propertyId))
        .limit(1);
      if (!existingProp) {
        return NextResponse.json(
          { error: "La propiedad de garantía no existe" },
          { status: 400 }
        );
      }
    }

    const insertValues =
      data.type === "personal"
        ? { contractId: id, type: data.type, clientId: data.clientId }
        : {
            contractId: id,
            type: data.type,
            propertyId: data.propertyId ?? null,
            externalAddress: data.externalAddress ?? null,
            externalCadastralRef: data.externalCadastralRef ?? null,
            externalOwnerName: data.externalOwnerName ?? null,
            externalOwnerDni: data.externalOwnerDni ?? null,
          };

    const [inserted] = await db
      .insert(contractGuarantee)
      .values(insertValues)
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("Error adding guarantee:", error);
    return NextResponse.json(
      { error: "Error al agregar garantía" },
      { status: 500 }
    );
  }
}
