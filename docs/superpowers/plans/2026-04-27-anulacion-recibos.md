# Anulación de Recibos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir anular recibos de caja (movimientos con `source: "contract"`) desde la lista de caja y desde la vista del recibo, con trazabilidad completa y recálculo automático del ledger del inquilino.

**Architecture:** Nueva tabla `receipt_annulment` para trazabilidad. Los movimientos se marcan con `anuladoAt`/`anuladoPor`/`annulmentId` pero permanecen en DB. Un endpoint POST transaccional realiza la anulación, limpia las `receipt_allocation` y recalcula el `tenantLedger`. La UI muestra los movimientos anulados con badge rojo y excluye sus montos de los totales.

**Tech Stack:** Next.js App Router · Drizzle ORM · PostgreSQL (Neon MCP para migración) · React 19 · TanStack Query · shadcn/ui · Tailwind v4

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `src/db/schema/receipt-annulment.ts` |
| Modificar | `src/db/schema/caja.ts` |
| Modificar | `src/db/schema/index.ts` |
| Crear | `src/app/api/receipts/[reciboNumero]/annul/route.ts` |
| Modificar | `src/app/api/cash/movimientos/route.ts` |
| Crear | `src/components/caja/annul-receipt-modal.tsx` |
| Modificar | `src/app/(dashboard)/caja/caja-general-client.tsx` |
| Modificar | `src/app/(dashboard)/recibos/[id]/page.tsx` |

---

## Task 1: DB Schema — tabla receipt_annulment + columnas en cash_movement

**Files:**
- Create: `src/db/schema/receipt-annulment.ts`
- Modify: `src/db/schema/caja.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Crear `src/db/schema/receipt-annulment.ts`**

```typescript
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./better-auth";

export const receiptAnnulment = pgTable("receipt_annulment", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reciboNumero: text("recibo_numero").notNull(),
  motivo: text("motivo"),
  teniaPagosLiquidados: boolean("tenia_pagos_liquidados").notNull().default(false),
  anuladoPor: text("anulado_por").references(() => user.id, { onDelete: "set null" }),
  anuladoAt: timestamp("anulado_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Agregar 3 columnas a `src/db/schema/caja.ts`**

Agregar después de `createdBy` y antes de `createdAt`:

```typescript
  // Anulación — solo para movimientos con source="contract"
  anuladoAt: timestamp("anulado_at"),
  anuladoPor: text("anulado_por").references(() => user.id, { onDelete: "set null" }),
  annulmentId: text("annulment_id"),
  // Sin FK para evitar import circular. La integridad se mantiene en la transacción de anulación.
```

- [ ] **Step 3: Re-exportar desde `src/db/schema/index.ts`**

Agregar la línea:

```typescript
export * from "./receipt-annulment";
```

- [ ] **Step 4: Aplicar migración con Neon MCP**

Ejecutar en Neon (proyecto de desarrollo):

```sql
CREATE TABLE receipt_annulment (
  id TEXT PRIMARY KEY,
  recibo_numero TEXT NOT NULL,
  motivo TEXT,
  tenia_pagos_liquidados BOOLEAN NOT NULL DEFAULT false,
  anulado_por TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  anulado_at TIMESTAMP DEFAULT now() NOT NULL
);

ALTER TABLE cash_movement
  ADD COLUMN anulado_at TIMESTAMP,
  ADD COLUMN anulado_por TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN annulment_id TEXT;

CREATE INDEX idx_receipt_annulment_recibo ON receipt_annulment(recibo_numero);
CREATE INDEX idx_cash_movement_annulment ON cash_movement(annulment_id);
```

- [ ] **Step 5: Verificar que Drizzle no tiene conflictos**

```bash
bun run db:generate
```

Expected: genera una migración vacía o solo confirma el estado actual (porque ya aplicamos el SQL directo con Neon).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/receipt-annulment.ts src/db/schema/caja.ts src/db/schema/index.ts
git commit -m "feat(db): add receipt_annulment table and annulment columns to cash_movement"
```

---

## Task 2: Agregar campos de anulación al GET /api/cash/movimientos

**Files:**
- Modify: `src/app/api/cash/movimientos/route.ts`

- [ ] **Step 1: Agregar campos al `.select()` en el GET**

En `src/app/api/cash/movimientos/route.ts`, dentro del objeto `.select({...})` (línea ~41), agregar después de `creadoEn`:

```typescript
      reciboNumero: cajaMovimiento.reciboNumero,
      settledAt: cajaMovimiento.settledAt,
      anuladoAt: cajaMovimiento.anuladoAt,
      annulmentId: cajaMovimiento.annulmentId,
```

- [ ] **Step 2: Excluir anulados del cálculo de totales**

Reemplazar las líneas de `totalIngresos` y `totalEgresos` (línea ~90):

```typescript
  const movimientosActivos = movimientos.filter((m) => m.anuladoAt === null);

  const totalIngresos = movimientosActivos
    .filter((m) => m.tipo === "income")
    .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);

  const totalEgresos = movimientosActivos
    .filter((m) => m.tipo === "expense")
    .reduce((acc, m) => acc + parseFloat(m.monto ?? "0"), 0);
```

- [ ] **Step 3: Verificar manualmente**

```bash
bun dev
```

Abrir `/caja` en el browser. Los totales no deben haber cambiado (no hay anulados aún). La consola no debe mostrar errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cash/movimientos/route.ts
git commit -m "feat(api): expose reciboNumero, settledAt, anuladoAt in GET movimientos; exclude anulados from totals"
```

---

## Task 3: Endpoint POST /api/receipts/[reciboNumero]/annul

**Files:**
- Create: `src/app/api/receipts/[reciboNumero]/annul/route.ts`

- [ ] **Step 1: Crear el archivo con la implementación completa**

Crear `src/app/api/receipts/[reciboNumero]/annul/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { receiptAnnulment } from "@/db/schema/receipt-annulment";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { eq, sum, isNull } from "drizzle-orm";

const annulSchema = z.object({
  motivo: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reciboNumero: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (session.user.role !== "account_admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { reciboNumero } = await params;

  const body = await request.json();
  const parsed = annulSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { motivo } = parsed.data;

  const result = await db.transaction(async (tx) => {
    // 1. Buscar todos los movimientos de este recibo
    const movimientos = await tx
      .select()
      .from(cajaMovimiento)
      .where(eq(cajaMovimiento.reciboNumero, reciboNumero));

    if (movimientos.length === 0) {
      return { error: "No se encontró el recibo", status: 404 } as const;
    }

    // 2. Verificar que no estén ya todos anulados
    const allAnnulled = movimientos.every((m) => m.anuladoAt !== null);
    if (allAnnulled) {
      return { error: "Este recibo ya fue anulado", status: 422 } as const;
    }

    // 3. Detectar si alguno fue liquidado
    const teniaPagosLiquidados = movimientos.some((m) => m.settledAt !== null);

    // 4. Crear registro de anulación
    const now = new Date();
    const [annulment] = await tx
      .insert(receiptAnnulment)
      .values({
        reciboNumero,
        motivo: motivo ?? null,
        teniaPagosLiquidados,
        anuladoPor: session.user.id,
        anuladoAt: now,
      })
      .returning();

    // 5. Marcar todos los movimientos como anulados
    await tx
      .update(cajaMovimiento)
      .set({
        anuladoAt: now,
        anuladoPor: session.user.id,
        annulmentId: annulment.id,
      })
      .where(eq(cajaMovimiento.reciboNumero, reciboNumero));

    // 6. Obtener ledger entries afectadas antes de borrar allocations
    const allocations = await tx
      .select({ ledgerEntryId: receiptAllocation.ledgerEntryId })
      .from(receiptAllocation)
      .where(eq(receiptAllocation.reciboNumero, reciboNumero));

    const ledgerEntryIds = [...new Set(allocations.map((a) => a.ledgerEntryId))];

    // 7. Eliminar las allocations de este recibo
    await tx
      .delete(receiptAllocation)
      .where(eq(receiptAllocation.reciboNumero, reciboNumero));

    // 8. Recalcular montoPagado y estado por cada ledger entry afectada
    for (const entryId of ledgerEntryIds) {
      const [entry] = await tx
        .select({ monto: tenantLedger.monto })
        .from(tenantLedger)
        .where(eq(tenantLedger.id, entryId));

      if (!entry || entry.monto === null) continue;

      const [sumaRow] = await tx
        .select({ total: sum(receiptAllocation.monto) })
        .from(receiptAllocation)
        .where(eq(receiptAllocation.ledgerEntryId, entryId));

      const montoPagado = Number(sumaRow?.total ?? 0);
      const montoTotal = Number(entry.monto);

      let estado: string;
      if (montoPagado <= 0) {
        estado = "pendiente";
      } else if (montoPagado < montoTotal) {
        estado = "pago_parcial";
      } else {
        estado = "conciliado";
      }

      await tx
        .update(tenantLedger)
        .set({
          montoPagado: String(montoPagado),
          estado,
          ...(estado !== "conciliado"
            ? { conciliadoAt: null, conciliadoPor: null }
            : {}),
          updatedAt: now,
        })
        .where(eq(tenantLedger.id, entryId));
    }

    return { annulmentId: annulment.id, teniaPagosLiquidados };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
bun run build 2>&1 | head -30
```

Expected: sin errores de tipos en el nuevo archivo.

- [ ] **Step 3: Probar el endpoint manualmente**

Con `bun dev` corriendo, emitir un recibo de prueba desde la UI y luego ejecutar en la terminal:

```bash
curl -s -X POST http://localhost:3000/api/receipts/R-0001/annul \
  -H "Content-Type: application/json" \
  -b "<cookie de sesión admin>" \
  -d '{"motivo":"Test de anulación"}' | jq .
```

Expected: `{ "annulmentId": "...", "teniaPagosLiquidados": false }`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/receipts/[reciboNumero]/annul/route.ts
git commit -m "feat(api): POST /api/receipts/[reciboNumero]/annul — transactional receipt annulment"
```

---

## Task 4: Modal de anulación (componente reutilizable)

**Files:**
- Create: `src/components/caja/annul-receipt-modal.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/caja/annul-receipt-modal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Info } from "lucide-react";

interface AnnulReceiptModalProps {
  open: boolean;
  onClose: () => void;
  reciboNumero: string;
  fecha: string;
  monto: string;
  inquilinoNombre?: string | null;
  teniaPagosLiquidados?: boolean;
  tieneRecibosPosteriores?: boolean;
  onSuccess?: () => void;
  queryKeysToInvalidate?: unknown[][];
}

export function AnnulReceiptModal({
  open,
  onClose,
  reciboNumero,
  fecha,
  monto,
  inquilinoNombre,
  teniaPagosLiquidados = false,
  tieneRecibosPosteriores = false,
  onSuccess,
  queryKeysToInvalidate = [],
}: AnnulReceiptModalProps) {
  const [motivo, setMotivo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/receipts/${encodeURIComponent(reciboNumero)}/annul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error al anular el recibo");
      }
      return res.json();
    },
    onSuccess: () => {
      for (const key of queryKeysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
      onSuccess?.();
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setMotivo("");
    setConfirmed(false);
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular recibo {reciboNumero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-border p-3 space-y-1 text-muted-foreground">
            <div><span className="text-foreground font-medium">Fecha:</span> {fecha}</div>
            <div><span className="text-foreground font-medium">Monto:</span> ${Number(monto).toLocaleString("es-AR")}</div>
            {inquilinoNombre && (
              <div><span className="text-foreground font-medium">Inquilino:</span> {inquilinoNombre}</div>
            )}
          </div>

          {teniaPagosLiquidados && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>Este recibo incluye pagos ya liquidados al propietario. Deberás corregir el descuadre manualmente con un movimiento en caja.</p>
            </div>
          )}

          {tieneRecibosPosteriores && (
            <div className="flex gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-blue-400">
              <Info className="size-4 shrink-0 mt-0.5" />
              <p>Hay otros pagos aplicados a este ítem. El saldo del inquilino se recalculará automáticamente.</p>
            </div>
          )}

          {mutation.error && (
            <p className="text-destructive text-xs">{mutation.error.message}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo de anulación (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Ej: recibo emitido por error, monto incorrecto..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              disabled={mutation.isPending}
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={mutation.isPending}
            />
            <span className="text-muted-foreground text-xs">
              Entiendo que esta acción es irreversible. El recibo quedará marcado como anulado.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!confirmed || mutation.isPending}
          >
            {mutation.isPending ? "Anulando..." : `Anular ${reciboNumero}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
bun run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: sin errores en el nuevo componente.

- [ ] **Step 3: Commit**

```bash
git add src/components/caja/annul-receipt-modal.tsx
git commit -m "feat(ui): AnnulReceiptModal — reusable receipt annulment dialog"
```

---

## Task 5: Caja UI — 🔒 clickeable + badge "Anulado"

**Files:**
- Modify: `src/app/(dashboard)/caja/caja-general-client.tsx`

> Este archivo es largo (~1000+ líneas). Los cambios son quirúrgicos en tres lugares específicos.

- [ ] **Step 1: Agregar imports, sesión y estado del modal al componente principal**

En `caja-general-client.tsx`, agregar al bloque de imports al inicio (junto a los existentes):

```typescript
import { useSession } from "@/lib/auth/client";
import { AnnulReceiptModal } from "@/components/caja/annul-receipt-modal";
```

Dentro de `CajaGeneralClient()` (el componente principal), junto a los otros `useState` ya existentes, agregar:

```typescript
const { data: sessionData } = useSession();
const [annulTarget, setAnnulTarget] = useState<{
  reciboNumero: string;
  fecha: string;
  monto: string;
  inquilinoNombre?: string | null;
  teniaPagosLiquidados: boolean;
} | null>(null);
```

- [ ] **Step 2: Agregar los tipos nuevos al tipo del movimiento en la UI**

Buscar la interfaz o tipo que define el objeto `movimiento` en la UI (probablemente `type Movimiento = {...}` o similar). Agregar los campos nuevos:

```typescript
reciboNumero?: string | null;
settledAt?: string | null;
anuladoAt?: string | null;
annulmentId?: string | null;
```

- [ ] **Step 3: Hacer el 🔒 clickeable para account_admin**

Buscar el bloque donde se renderiza el 🔒 (alrededor de la línea 648). Actualmente:

```typescript
<span title="Generado automáticamente — no se puede eliminar">🔒</span>
```

Reemplazar con:

```typescript
{sessionData?.user?.role === "account_admin" && m.reciboNumero ? (
  <button
    type="button"
    title={`Anular recibo ${m.reciboNumero}`}
    className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
    onClick={() => setAnnulTarget({
      reciboNumero: m.reciboNumero!,
      fecha: m.fecha,
      monto: m.monto,
      inquilinoNombre: m.inquilinoNombre,
      teniaPagosLiquidados: m.settledAt !== null && m.settledAt !== undefined,
    })}
  >
    🔒
  </button>
) : (
  <span title="Generado automáticamente — no se puede eliminar">🔒</span>
)}
```

> `useSession` NO estaba en el componente originalmente — por eso el Step 1 lo agrega explícitamente. Usar `sessionData` (no `session`) en todo el componente de caja para no confundir con el `session` del servidor.

- [ ] **Step 4: Mostrar badge "Anulado" en movimientos anulados**

En la fila del movimiento (`FilaMovimiento`), buscar donde se muestra la descripción o el tipo del movimiento. Agregar el badge cuando `m.anuladoAt` tiene valor:

```typescript
{m.anuladoAt && (
  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/20 text-destructive border border-destructive/30 ml-1">
    Anulado
  </span>
)}
```

Adicionalmente, si la fila tiene estilos de texto, agregar clase condicional al elemento contenedor de la descripción:

```typescript
className={cn("...", m.anuladoAt && "line-through opacity-40")}
```

- [ ] **Step 5: Renderizar el modal al final del JSX del componente principal**

Justo antes del último `</div>` o `</>` del return principal, agregar:

```typescript
{annulTarget && (
  <AnnulReceiptModal
    open={annulTarget !== null}
    onClose={() => setAnnulTarget(null)}
    reciboNumero={annulTarget.reciboNumero}
    fecha={annulTarget.fecha}
    monto={annulTarget.monto}
    inquilinoNombre={annulTarget.inquilinoNombre}
    teniaPagosLiquidados={annulTarget.teniaPagosLiquidados}
    queryKeysToInvalidate={[["movimientos"]]}
    onSuccess={() => setAnnulTarget(null)}
  />
)}
```

- [ ] **Step 6: Verificar en el browser**

```bash
bun dev
```

1. Ir a `/caja`
2. Con un usuario `account_admin`, verificar que el 🔒 en movimientos con `reciboNumero` es clickeable
3. Click abre el modal de anulación
4. Anular un recibo de prueba
5. Verificar que el movimiento aparece tachado con badge "Anulado"
6. Verificar que los totales del período cambiaron correctamente

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/caja/caja-general-client.tsx
git commit -m "feat(ui): clickable lock for receipt annulment in caja + anulado badge"
```

---

## Task 6: Página del recibo — botón "Anular recibo"

**Files:**
- Modify: `src/app/(dashboard)/recibos/[id]/page.tsx`

- [ ] **Step 1: Agregar import del modal**

En `src/app/(dashboard)/recibos/[id]/page.tsx`, agregar el import:

```typescript
import { AnnulReceiptModal } from "@/components/caja/annul-receipt-modal";
```

- [ ] **Step 2: Agregar estado del modal**

Dentro de `ReciboPage()`, junto a los otros `useState`:

```typescript
const [showAnnulModal, setShowAnnulModal] = useState(false);
```

- [ ] **Step 3: Agregar useSession, estado y botón "Anular recibo"**

Primero, agregar al bloque de imports al inicio del archivo:

```typescript
import { useSession } from "@/lib/auth/client";
import { AnnulReceiptModal } from "@/components/caja/annul-receipt-modal";
```

Dentro de `ReciboPage()`, junto a los otros hooks:

```typescript
const { data: sessionData } = useSession();
```

En la UI de la página, buscar la sección con los botones de acción (imprimir, enviar por email, etc. — alrededor de la línea 155). Agregar el botón de anulación:

```typescript
{data?.movimiento.anuladoAt ? (
  <span className="text-xs text-destructive border border-destructive/30 rounded px-2 py-1 bg-destructive/10">
    Recibo anulado
  </span>
) : sessionData?.user?.role === "account_admin" ? (
  <button
    onClick={() => setShowAnnulModal(true)}
    className="text-[0.72rem] text-destructive hover:underline flex items-center gap-1"
  >
    Anular recibo
  </button>
) : null}
```

- [ ] **Step 4: Renderizar el modal**

Al final del JSX, antes del cierre:

```typescript
{data && (
  <AnnulReceiptModal
    open={showAnnulModal}
    onClose={() => setShowAnnulModal(false)}
    reciboNumero={data.movimiento.reciboNumero ?? ""}
    fecha={data.movimiento.date}
    monto={data.movimiento.amount}
    inquilinoNombre={
      data.inquilino
        ? [data.inquilino.firstName, data.inquilino.lastName].filter(Boolean).join(" ")
        : null
    }
    teniaPagosLiquidados={data.movimiento.settledAt !== null}
    queryKeysToInvalidate={[["receipt", id]]}
    onSuccess={() => router.push("/caja")}
  />
)}
```

- [ ] **Step 5: Verificar en el browser**

```bash
bun dev
```

1. Ir a `/recibos/<id>` de un recibo existente
2. Con `account_admin`: verificar que aparece el botón "Anular recibo"
3. Click → modal → anular
4. Verificar que redirige a `/caja`
5. Verificar que el movimiento aparece como anulado en caja

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/recibos/[id]/page.tsx
git commit -m "feat(ui): add annul button to receipt page for account_admin"
```

---

## Verificación final

- [ ] Emitir un recibo nuevo → verificar 🔒 en caja
- [ ] Anular desde caja → movimiento aparece tachado + badge Anulado + totales actualizados
- [ ] Anular desde la vista del recibo → redirige a caja con el movimiento anulado
- [ ] Intentar anular el mismo recibo dos veces → error 422 "Este recibo ya fue anulado"
- [ ] Verificar en Neon que `receipt_annulment` tiene el registro y `cash_movement` tiene `anulado_at` poblado
- [ ] Verificar que el `tenant_ledger` actualizó `montoPagado` y `estado` correctamente
