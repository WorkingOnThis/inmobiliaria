import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { contract } from "@/db/schema/contract";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { nextReciboNumero } from "@/lib/receipts/numbering";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

function isUniqueViolation(err: unknown, indexName?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e.code ?? e.cause?.code;
  const constraint = e.constraint ?? e.cause?.constraint;
  if (code !== "23505") return false;
  return indexName ? constraint === indexName : true;
}

const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
  montoOverrides: z.record(z.string(), z.string()).default({}),
  splitBreakdowns: z.record(z.string(), z.object({ propietario: z.number(), administracion: z.number() })).optional(),
  // idempotencyKey is optional during PR1+PR2 so the existing dialog flow still works.
  // PR3 will always send it from the new preview screen.
  idempotencyKey: z.string().uuid().optional(),
  observaciones: z.string().max(500).optional(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getEffectiveAmount(
  entry: { id: string; monto: string | null; montoManual: string | null },
  overrides: Record<string, string>
): number {
  const override = overrides[entry.id];
  if (override !== undefined) return Number(override);
  if (entry.montoManual !== null) return Number(entry.montoManual);
  return Number(entry.monto);
}

function getSignedEffectiveAmount(
  entry: { id: string; monto: string | null; montoManual: string | null; tipo: string },
  overrides: Record<string, string>
): number {
  const raw = getEffectiveAmount(entry, overrides);
  return entry.tipo === "descuento" || entry.tipo === "bonificacion" ? -raw : raw;
}

export async function POST(request: NextRequest) {
  let capturedIdempotencyKey: string | undefined;
  let capturedAgencyId: string | undefined;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    capturedAgencyId = agencyId;
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = emitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { ledgerEntryIds, fecha, honorariosPct, trasladarAlPropietario, montoOverrides, splitBreakdowns, idempotencyKey, observaciones, action } = parsed.data;
    capturedIdempotencyKey = idempotencyKey;

    // Early return: si ya emitimos un recibo con esta idempotencyKey,
    // devolver el resultado anterior sin duplicar movimientos.
    if (idempotencyKey) {
      const existing = await db
        .select({
          reciboNumero: cajaMovimiento.reciboNumero,
          movimientoAgenciaId: cajaMovimiento.id,
        })
        .from(cajaMovimiento)
        .where(and(
          eq(cajaMovimiento.idempotencyKey, idempotencyKey),
          eq(cajaMovimiento.agencyId, agencyId),
          eq(cajaMovimiento.tipoFondo, "agencia"),
        ))
        .limit(1);
      if (existing.length > 0 && existing[0].reciboNumero) {
        return NextResponse.json({
          reciboNumero: existing[0].reciboNumero,
          movimientoAgenciaId: existing[0].movimientoAgenciaId,
          deduplicated: true,
        }, { status: 200 });
      }
    }

    // Cargar ledger entries scoped por agency. Si alguno pertenece a otra
    // agency, no aparecerá acá y se reportará como "no encontrado".
    const entries = await db
      .select()
      .from(tenantLedger)
      .where(and(inArray(tenantLedger.id, ledgerEntryIds), eq(tenantLedger.agencyId, agencyId)));

    if (entries.length !== ledgerEntryIds.length) {
      return NextResponse.json({ error: "Uno o más ítems no fueron encontrados" }, { status: 404 });
    }

    const notReady = entries.filter(
      (e) => e.tipo === "ajuste_indice" || !["pendiente", "registrado", "pago_parcial"].includes(e.estado)
    );
    if (notReady.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes ítems no están listos: ${notReady.map((e) => e.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    const nullMonto = entries.filter((e) => e.monto === null);
    if (nullMonto.length > 0) {
      return NextResponse.json(
        { error: `Los siguientes ítems no tienen monto definido: ${nullMonto.map((e) => e.descripcion).join(", ")}` },
        { status: 422 }
      );
    }

    // Validate that all overrides are positive amounts
    const invalidOverrides = entries.filter((e) => {
      const override = montoOverrides[e.id];
      if (override === undefined) return false;
      const num = Number(override);
      return isNaN(num) || num <= 0;
    });
    if (invalidOverrides.length > 0) {
      return NextResponse.json(
        { error: `Montos inválidos en los ítems: ${invalidOverrides.map((e) => e.descripcion).join(", ")}` },
        { status: 400 }
      );
    }

    const contratoIds = new Set(entries.map((e) => e.contratoId));
    if (contratoIds.size > 1) {
      return NextResponse.json(
        { error: "Todos los ítems deben pertenecer al mismo contrato" },
        { status: 422 }
      );
    }

    const first = entries[0];
    const contratoId = first.contratoId;

    const [contratoRow] = await db
      .select({ paymentModality: contract.paymentModality })
      .from(contract)
      .where(and(eq(contract.id, contratoId), eq(contract.agencyId, agencyId)))
      .limit(1);
    const paymentModality = contratoRow?.paymentModality ?? null;
    const inquilinoId = first.inquilinoId;
    const propietarioId = first.propietarioId;
    const propiedadId = first.propiedadId;

    const [inquilinoRow] = await db
      .select({ firstName: client.firstName, lastName: client.lastName })
      .from(client)
      .where(and(eq(client.id, inquilinoId), eq(client.agencyId, agencyId)))
      .limit(1);

    const nombreInquilino = inquilinoRow
      ? [inquilinoRow.firstName, inquilinoRow.lastName].filter(Boolean).join(" ")
      : "Inquilino";

    // Commission base = sum of entries where incluirEnBaseComision=true
    const totalRecibo = round2(
      entries.reduce((s, e) => s + getSignedEffectiveAmount(e, montoOverrides), 0)
    );
    const baseComision = entries
      .filter((e) => e.incluirEnBaseComision)
      .reduce((s, e) => s + getSignedEffectiveAmount(e, montoOverrides), 0);
    const montoHonorarios = round2(baseComision * honorariosPct / 100);

    const txResult = await db.transaction(async (tx) => {
      const now = new Date();
      const reciboNumero = await nextReciboNumero(agencyId, tx);

      for (const entry of entries) {
        const effectiveAmount = getEffectiveAmount(entry, montoOverrides);
        const prevPagado = Number(entry.montoPagado ?? 0);
        const newMontoPagado = round2(prevPagado + effectiveAmount);
        const effectiveBase = Number(entry.montoManual ?? entry.monto);
        const isFullyPaid = newMontoPagado >= effectiveBase;

        await tx
          .update(tenantLedger)
          .set({
            estado: isFullyPaid ? "conciliado" : "pago_parcial",
            montoPagado: String(newMontoPagado),
            ultimoPagoAt: fecha,
            reciboNumero,
            reciboEmitidoAt: now,
            ...(isFullyPaid
              ? { conciliadoAt: now, conciliadoPor: session!.user.id }
              : {}),
            ...(splitBreakdowns?.[entry.id] && {
              splitBreakdown: JSON.stringify(splitBreakdowns[entry.id]),
            }),
            updatedAt: now,
          })
          .where(and(eq(tenantLedger.id, entry.id), eq(tenantLedger.agencyId, agencyId)));

        await tx.insert(receiptAllocation).values({
          reciboNumero,
          ledgerEntryId: entry.id,
          monto: String(effectiveAmount),
        });
      }

      let movimientoAgenciaId: string | null = null;

      if (paymentModality === "split") {
        // Split: tenant pays owner directly. Agency only receives its management commission.
        // Always create this movement (even when montoHonorarios = 0) so the receipt
        // lookup page can find an anchor row via reciboNumero + tipoFondo = "agencia".
        const [movComision] = await tx
          .insert(cajaMovimiento)
          .values({
            agencyId,
            tipo: "income",
            description: `Honorarios administración — ${reciboNumero} — ${nombreInquilino}`,
            amount: String(montoHonorarios),
            date: fecha,
            categoria: "honorarios_administracion",
            reciboNumero,
            inquilinoId,
            propietarioId,
            contratoId,
            propiedadId,
            tipoFondo: "agencia",
            source: "contract",
            paymentModality,
            createdBy: session!.user.id,
            idempotencyKey: idempotencyKey ?? null,
            note: observaciones ?? null,
          })
          .returning();
        movimientoAgenciaId = movComision.id;
      } else {
        // Modality A: agency collects full rent, then settles to owner later.
        const [movAgencia] = await tx
          .insert(cajaMovimiento)
          .values({
            agencyId,
            tipo: "income",
            description: `Recibo ${reciboNumero} — ${nombreInquilino}`,
            amount: String(totalRecibo),
            date: fecha,
            categoria: "alquiler",
            reciboNumero,
            inquilinoId,
            propietarioId,
            contratoId,
            propiedadId,
            tipoFondo: "agencia",
            source: "contract",
            paymentModality,
            createdBy: session!.user.id,
            idempotencyKey: idempotencyKey ?? null,
            note: observaciones ?? null,
          })
          .returning();
        movimientoAgenciaId = movAgencia.id;

        if (trasladarAlPropietario) {
          // Owner in-transit income (to be settled later)
          await tx.insert(cajaMovimiento).values({
            agencyId,
            tipo: "income",
            description: `Ingreso inquilino — ${reciboNumero}`,
            amount: String(totalRecibo),
            date: fecha,
            categoria: "ingreso_inquilino",
            reciboNumero,
            propietarioId,
            contratoId,
            propiedadId,
            tipoFondo: "propietario",
            source: "contract",
            paymentModality,
            createdBy: session!.user.id,
            idempotencyKey: idempotencyKey ?? null,
          });

          // Agency commission expense (deducted from owner settlement)
          if (montoHonorarios > 0) {
            await tx.insert(cajaMovimiento).values({
              agencyId,
              tipo: "expense",
              description: `Honorarios administración — ${reciboNumero}`,
              amount: String(montoHonorarios),
              date: fecha,
              categoria: "honorarios_administracion",
              reciboNumero,
              propietarioId,
              contratoId,
              propiedadId,
              tipoFondo: "agencia",
              source: "contract",
              paymentModality,
              createdBy: session!.user.id,
              idempotencyKey: idempotencyKey ?? null,
            });
          }
        }
      }

      return { reciboNumero, movimientoAgenciaId, totalRecibo, montoHonorarios };
    });

    if (action === "email") {
      // TODO PR3: integrar con sistema de mails. Por ahora marker.
      console.log(`[emit] Email solicitado para recibo ${txResult.reciboNumero}`);
    }

    return NextResponse.json(txResult, { status: 201 });
  } catch (error) {
    // Race condition: another request with the same idempotencyKey beat us
    // to the insert. Replay the deduplicated response.
    if (
      capturedIdempotencyKey &&
      capturedAgencyId &&
      isUniqueViolation(error, "cash_movement_idempotency_key_idx")
    ) {
      try {
        const existing = await db
          .select({ reciboNumero: cajaMovimiento.reciboNumero, movimientoAgenciaId: cajaMovimiento.id })
          .from(cajaMovimiento)
          .where(and(
            eq(cajaMovimiento.idempotencyKey, capturedIdempotencyKey),
            eq(cajaMovimiento.agencyId, capturedAgencyId),
            eq(cajaMovimiento.tipoFondo, "agencia"),
          ))
          .limit(1);
        if (existing.length > 0 && existing[0].reciboNumero) {
          return NextResponse.json({
            reciboNumero: existing[0].reciboNumero,
            movimientoAgenciaId: existing[0].movimientoAgenciaId,
            deduplicated: true,
          }, { status: 200 });
        }
      } catch {
        // Si el replay falla, dejar fluir al handler de error genérico.
      }
    }

    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST /api/receipts/emit:", error);
    return NextResponse.json({ error: "Error al emitir el recibo" }, { status: 500 });
  }
}
