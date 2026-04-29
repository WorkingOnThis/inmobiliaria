import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import {
  ALLOWED_FIELDS,
  FIELD_LABELS,
  REQUIRES_EFFECTIVE_DATE,
  REQUIRES_DESCRIPTION,
  type AmendmentType,
} from "@/lib/contracts/amendments";

const postSchema = z.object({
  type: z.enum([
    "erratum", "modification", "extension",
    "termination", "guarantee_substitution", "index_change",
  ]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fieldsChanged: z.record(z.object({
    before: z.unknown(),
    after: z.unknown(),
  })).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id: contractId } = await params;

    const rows = await db
      .select()
      .from(contractAmendment)
      .where(eq(contractAmendment.contractId, contractId))
      .orderBy(contractAmendment.sequenceNumber);

    // Compute typeSequenceNumber in JS: count rows of same type before each row
    const typeCounters: Record<string, number> = {};
    const items = rows.map((row) => {
      typeCounters[row.type] = (typeCounters[row.type] ?? 0) + 1;
      const enrichedFields: Record<string, { before: unknown; after: unknown; label: string }> = {};
      const fc = (row.fieldsChanged ?? {}) as Record<string, { before: unknown; after: unknown }>;
      for (const [field, val] of Object.entries(fc)) {
        enrichedFields[field] = { ...val, label: FIELD_LABELS[field] ?? field };
      }
      return {
        id: row.id,
        type: row.type,
        sequenceNumber: row.sequenceNumber,
        typeSequenceNumber: typeCounters[row.type],
        status: row.status,
        title: row.title,
        description: row.description,
        fieldsChanged: enrichedFields,
        effectiveDate: row.effectiveDate,
        hasDocument: !!row.documentContent,
        signedAt: row.signedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ amendments: items });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;
    const body = postSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "Datos inválidos", details: body.error.flatten() }, { status: 400 });
    }

    const { type, title, description, effectiveDate, fieldsChanged = {} } = body.data;
    const amendmentType = type as AmendmentType;

    if (REQUIRES_EFFECTIVE_DATE[amendmentType] && !effectiveDate) {
      return NextResponse.json({ error: "effectiveDate es requerida para este tipo" }, { status: 400 });
    }

    if (REQUIRES_DESCRIPTION[amendmentType] && !description?.trim()) {
      return NextResponse.json({ error: "description es requerida para este tipo" }, { status: 400 });
    }

    // Whitelist check
    const allowed = ALLOWED_FIELDS[amendmentType];
    for (const field of Object.keys(fieldsChanged)) {
      if (!allowed.includes(field)) {
        return NextResponse.json({ error: `Campo no permitido para tipo ${type}: ${field}` }, { status: 400 });
      }
    }

    // Types that require at least one field change
    if (["erratum", "modification", "extension", "index_change"].includes(type)) {
      if (Object.keys(fieldsChanged).length === 0) {
        return NextResponse.json({ error: "Debe especificar al menos un campo modificado" }, { status: 400 });
      }
    }

    // Validate extension: new endDate must be after current
    if (type === "extension" && fieldsChanged["endDate"]) {
      const newEnd = String(fieldsChanged["endDate"].after);
      const oldEnd = String(fieldsChanged["endDate"].before);
      if (newEnd <= oldEnd) {
        return NextResponse.json({ error: "La nueva fecha de fin debe ser posterior a la actual" }, { status: 400 });
      }
    }

    const result = await db.transaction(async (tx) => {
      // 1. Snapshot current contract state
      const [currentContract] = await tx
        .select()
        .from(contract)
        .where(eq(contract.id, contractId))
        .limit(1);

      if (!currentContract) throw new Error("Contrato no encontrado");

      if (type === "termination" && !["active", "expiring_soon"].includes(currentContract.status)) {
        throw new Error("Solo se puede rescindir un contrato activo");
      }

      // 2. Next sequenceNumber
      const [maxRow] = await tx
        .select({ maxSeq: max(contractAmendment.sequenceNumber) })
        .from(contractAmendment)
        .where(eq(contractAmendment.contractId, contractId));
      const sequenceNumber = (maxRow?.maxSeq ?? 0) + 1;

      // 3. Apply fieldsChanged to contract
      if (Object.keys(fieldsChanged).length > 0) {
        const contractUpdate: Record<string, unknown> = { updatedAt: new Date() };
        for (const [field, { after }] of Object.entries(fieldsChanged)) {
          contractUpdate[field] = after;
        }
        await tx
          .update(contract)
          .set(contractUpdate as never)
          .where(eq(contract.id, contractId));
      }

      // 4. Insert amendment
      const amendmentId = crypto.randomUUID();
      const [inserted] = await tx
        .insert(contractAmendment)
        .values({
          id: amendmentId,
          contractId,
          type,
          sequenceNumber,
          status: "registered",
          title,
          description: description ?? null,
          fieldsChanged: fieldsChanged as Record<string, { before: unknown; after: unknown }>,
          contractSnapshot: currentContract as unknown as Record<string, unknown>,
          effectiveDate: effectiveDate ?? null,
          createdBy: session.user.id,
        })
        .returning();

      return inserted;
    });

    return NextResponse.json({ amendment: result }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error(e);
    if (msg === "Contrato no encontrado") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.startsWith("Solo se puede")) return NextResponse.json({ error: msg }, { status: 422 });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
