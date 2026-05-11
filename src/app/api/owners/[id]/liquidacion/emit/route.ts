import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { agency as agencyTable } from "@/db/schema/agency";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { isUniqueViolation } from "@/lib/receipts/db-errors";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";

const schema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  movimientoIds: z.array(z.string().min(1)).min(1),
  honorariosPct: z.number().min(0).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let capturedIdempotencyKey: string | undefined;
  let capturedAgencyId: string | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    capturedAgencyId = agencyId;
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: propietarioId } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { periodo, movimientoIds, honorariosPct, fecha, observaciones, idempotencyKey, action } = parsed.data;
    capturedIdempotencyKey = idempotencyKey;

    // Early return idempotente: si ya emitimos una liquidación con esta key,
    // devolver el resultado anterior. Filtramos por categoria para distinguir
    // del recibo (que también usa idempotencyKey).
    const existing = await db
      .select({ batch: cajaMovimiento.settlementBatchId, id: cajaMovimiento.id })
      .from(cajaMovimiento)
      .where(and(
        eq(cajaMovimiento.idempotencyKey, idempotencyKey),
        eq(cajaMovimiento.agencyId, agencyId),
        eq(cajaMovimiento.categoria, "transferencia_propietario"),
      ))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({
        settlementBatchId: existing[0].batch,
        movimientoId: existing[0].id,
        deduplicated: true,
      }, { status: 200 });
    }

    // Cargar movimientos: pertenecen al propietario, agencia, y NO están
    // todavía liquidados (settlementBatchId IS NULL).
    const movs = await db
      .select()
      .from(cajaMovimiento)
      .where(and(
        inArray(cajaMovimiento.id, movimientoIds),
        eq(cajaMovimiento.agencyId, agencyId),
        eq(cajaMovimiento.propietarioId, propietarioId),
        isNull(cajaMovimiento.settlementBatchId),
      ));

    if (movs.length !== movimientoIds.length) {
      return NextResponse.json({
        error: "Algunos movimientos no existen, no pertenecen al propietario, o ya fueron liquidados",
      }, { status: 409 });
    }

    // Validar que todos pertenecen al período declarado
    const offPeriod = movs.filter((m) => (m.period ?? m.date.slice(0, 7)) !== periodo);
    if (offPeriod.length > 0) {
      return NextResponse.json({
        error: `Hay movimientos fuera del período ${periodo}: ${offPeriod.map((m) => m.description).join(", ")}`,
      }, { status: 422 });
    }

    // Calcular total a transferir
    const totalIngresos = movs
      .filter((m) => m.tipo === "income")
      .reduce((s, m) => s + Number(m.amount), 0);
    const totalEgresos = movs
      .filter((m) => m.tipo === "expense")
      .reduce((s, m) => s + Number(m.amount), 0);
    const baseNeto = totalIngresos - totalEgresos;
    const honorarios = round2(baseNeto * honorariosPct / 100);
    const totalTransferir = round2(baseNeto - honorarios);

    if (totalTransferir <= 0) {
      return NextResponse.json({ error: "El total a transferir debe ser mayor a 0" }, { status: 422 });
    }

    const [propRow] = await db
      .select({ firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(and(eq(client.id, propietarioId), eq(client.agencyId, agencyId)))
      .limit(1);
    const propName = propRow
      ? [propRow.firstName, propRow.lastName].filter(Boolean).join(" ")
      : "Propietario";

    const txResult = await db.transaction(async (tx) => {
      const now = new Date();
      const settlementBatchId = crypto.randomUUID();

      // Incrementar contador de liquidación atómicamente
      const [current] = await tx
        .select({ n: agencyTable.liquidacionUltimoNumero })
        .from(agencyTable)
        .where(eq(agencyTable.id, agencyId))
        .limit(1);
      const nextNum = (current?.n ?? 0) + 1;
      await tx
        .update(agencyTable)
        .set({ liquidacionUltimoNumero: nextNum })
        .where(eq(agencyTable.id, agencyId));
      const liquidacionNumero = `LIQ-${String(nextNum).padStart(8, "0")}`;

      // Marcar todos los movimientos como liquidados
      await tx
        .update(cajaMovimiento)
        .set({
          settlementBatchId,
          liquidadoAt: now,
          liquidadoPor: session!.user.id,
          updatedAt: now,
        })
        .where(and(
          inArray(cajaMovimiento.id, movimientoIds),
          eq(cajaMovimiento.agencyId, agencyId),
        ));

      // Crear el movimiento de transferencia al propietario
      const [transferMov] = await tx
        .insert(cajaMovimiento)
        .values({
          agencyId,
          tipo: "expense",
          description: `Transferencia ${liquidacionNumero} — ${propName}`,
          amount: String(totalTransferir),
          date: fecha,
          categoria: "transferencia_propietario",
          period: periodo,
          propietarioId,
          tipoFondo: "propietario",
          source: "settlement",
          settlementBatchId,
          liquidadoAt: now,
          liquidadoPor: session!.user.id,
          idempotencyKey,
          note: observaciones ?? null,
          createdBy: session!.user.id,
        })
        .returning();

      return { settlementBatchId, movimientoId: transferMov.id, liquidacionNumero, totalTransferir };
    });

    if (action === "email") {
      // TODO PR3: integrar con sistema de mails. Por ahora marker.
      console.log(`[liquidacion/emit] Email solicitado para ${txResult.liquidacionNumero}`);
    }

    return NextResponse.json(txResult, { status: 201 });
  } catch (error) {
    // Race condition: otro request con la misma idempotencyKey ganó la inserción.
    // Hacemos replay del lookup para devolver la respuesta deduplicada.
    if (
      capturedIdempotencyKey &&
      capturedAgencyId &&
      isUniqueViolation(error, "cash_movement_idempotency_key_idx")
    ) {
      try {
        const existing = await db
          .select({ batch: cajaMovimiento.settlementBatchId, id: cajaMovimiento.id })
          .from(cajaMovimiento)
          .where(and(
            eq(cajaMovimiento.idempotencyKey, capturedIdempotencyKey),
            eq(cajaMovimiento.agencyId, capturedAgencyId),
            eq(cajaMovimiento.categoria, "transferencia_propietario"),
          ))
          .limit(1);
        if (existing.length > 0) {
          return NextResponse.json({
            settlementBatchId: existing[0].batch,
            movimientoId: existing[0].id,
            deduplicated: true,
          }, { status: 200 });
        }
      } catch {
        // Si el replay falla, dejar fluir al handler de error genérico.
      }
    }

    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST /api/owners/[id]/liquidacion/emit:", error);
    return NextResponse.json({ error: "Error al emitir la liquidación" }, { status: 500 });
  }
}
