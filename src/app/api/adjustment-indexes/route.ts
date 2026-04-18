import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { customAdjustmentIndex } from "@/db/schema/custom-adjustment-index";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { z } from "zod";
import { asc } from "drizzle-orm";

const createIndexSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Solo letras mayúsculas, números, guiones y guiones bajos"),
  label: z.string().min(1).max(80),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const rows = await db
      .select({
        id: customAdjustmentIndex.id,
        code: customAdjustmentIndex.code,
        label: customAdjustmentIndex.label,
      })
      .from(customAdjustmentIndex)
      .orderBy(asc(customAdjustmentIndex.label));

    return NextResponse.json({ indexes: rows });
  } catch (error) {
    console.error("Error fetching custom adjustment indexes:", error);
    return NextResponse.json({ error: "Error al obtener índices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = createIndexSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { code, label } = result.data;

    const [newIndex] = await db
      .insert(customAdjustmentIndex)
      .values({
        id: crypto.randomUUID(),
        code,
        label,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ index: newIndex }, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint violation (code already exists)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Ya existe un índice con ese código" },
        { status: 409 }
      );
    }
    console.error("Error creating custom adjustment index:", error);
    return NextResponse.json({ error: "Error al crear el índice" }, { status: 500 });
  }
}
