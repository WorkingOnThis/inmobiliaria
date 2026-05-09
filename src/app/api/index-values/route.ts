import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentIndexValue } from "@/db/schema/adjustment-index-value";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { applyIndexToContracts } from "@/lib/ledger/apply-index";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const VALID_INDEX_TYPES = ["ICL", "IPC", "CER", "UVA"] as const;

const postSchema = z.object({
  indexType: z.enum(VALID_INDEX_TYPES),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Formato debe ser YYYY-MM"),
  value: z.coerce.number().min(0).max(200),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const values = await db
      .select()
      .from(adjustmentIndexValue)
      .where(eq(adjustmentIndexValue.agencyId, agencyId))
      .orderBy(desc(adjustmentIndexValue.period), adjustmentIndexValue.indexType);

    return NextResponse.json(values);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al listar índices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const result = postSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { indexType, period, value } = result.data;

    // Verificar que no exista ya para ese período
    const [existing] = await db
      .select({ id: adjustmentIndexValue.id })
      .from(adjustmentIndexValue)
      .where(
        and(
          eq(adjustmentIndexValue.agencyId, agencyId),
          eq(adjustmentIndexValue.indexType, indexType),
          eq(adjustmentIndexValue.period, period),
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un valor de ${indexType} para ${period}` },
        { status: 409 }
      );
    }

    // Insertar
    await db.insert(adjustmentIndexValue).values({
      agencyId,
      indexType,
      period,
      value: value.toString(),
      loadedBy: session!.user.id,
    });

    // Aplicar a contratos automáticamente
    const { contractsAffected, provisionalCount } = await applyIndexToContracts(
      indexType,
      agencyId,
      session!.user.id,
    );

    return NextResponse.json(
      { message: "Índice cargado", contractsAffected, provisionalCount },
      { status: 201 }
    );
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("POST /api/index-values:", error);
    return NextResponse.json({ error: "Error al cargar el índice" }, { status: 500 });
  }
}
