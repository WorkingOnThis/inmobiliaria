# Vista Previa Recibo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insertar una pantalla de vista previa estilo papel (réplica de `docs/design/vista-previa-recibo/Vista Previa Recibo.html`) entre el momento en que el usuario decide cobrar/liquidar y la materialización en DB. Aplica a cobro al inquilino y liquidación al propietario.

**Architecture:** Sin draft persistido. La selección viaja en `localStorage` con TTL de 30 min y la pantalla preview lee de ahí. Idempotencia garantizada por `idempotencyKey` en los endpoints de emit. Materialización atómica (transacción Drizzle) sólo cuando el usuario presiona Imprimir, Enviar email o Confirmar.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle ORM · PostgreSQL · TanStack Query · shadcn/ui · Bun test runner.

**Spec:** `docs/superpowers/specs/2026-05-11-vista-previa-recibo-design.md`
**Diseño visual:** `docs/design/vista-previa-recibo/Vista Previa Recibo.html`

---

## File Structure

### Nuevos
- `drizzle/<next-N>_vista_previa_recibo.sql` (autogenerado por drizzle-kit)
- `src/lib/utils/local-storage-ttl.ts` — helper de localStorage con TTL
- `src/lib/utils/local-storage-ttl.test.ts`
- `src/lib/receipts/idempotency.ts` — helper compartido para resolver idempotencyKey colisiones
- `src/lib/receipts/idempotency.test.ts`
- `src/components/document-preview/document-preview-shell.tsx`
- `src/components/document-preview/paper.tsx`
- `src/components/document-preview/paper-header.tsx`
- `src/components/document-preview/paper-meta-block.tsx`
- `src/components/document-preview/paper-items-table.tsx`
- `src/components/document-preview/paper-totals.tsx`
- `src/components/document-preview/paper-footer.tsx`
- `src/components/document-preview/side-summary-card.tsx`
- `src/components/document-preview/side-print-options.tsx`
- `src/components/document-preview/side-recipients.tsx`
- `src/components/document-preview/side-observations.tsx`
- `src/components/document-preview/topbar.tsx`
- `src/app/(dashboard)/inquilinos/[id]/cobro/preview/page.tsx`
- `src/app/api/owners/[id]/liquidacion/emit/route.ts`
- `src/app/api/owners/[id]/liquidacion/emit/route.test.ts`
- `src/app/api/receipts/emit/route.test.ts`

### Modificados
- `src/db/schema/caja.ts` — agregar `idempotencyKey`, `settlementBatchId`, `liquidadoAt`, `liquidadoPor`
- `src/db/schema/agency.ts` — agregar `liquidacionUltimoNumero`
- `src/app/api/receipts/emit/route.ts` — aceptar `idempotencyKey` + `observaciones` + `action`, devolver early si la key ya existe
- `src/components/tenants/tenant-tab-current-account.tsx` — reemplazar dialog por `window.open` a la preview
- `src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx` — refactorizar para usar componentes compartidos + wire al nuevo endpoint

---

## PR1 — Backend foundations (migraciones + idempotencyKey)

### Task 1.1: Agregar campos al schema de DB

**Files:**
- Modify: `src/db/schema/caja.ts`
- Modify: `src/db/schema/agency.ts`

- [ ] **Step 1: Agregar columnas a `cajaMovimiento`**

Editar `src/db/schema/caja.ts`. Después del bloque de `anuladoAt` / `annulmentId` (línea ~89) y antes de `createdAt`, agregar:

```ts
  // Idempotencia: evita duplicar movimientos cuando la misma operación de
  // emisión se reintenta (doble click, network blip). Mismo valor en todos
  // los movimientos de un mismo recibo/liquidación.
  idempotencyKey: text("idempotencyKey"),

  // Liquidación al propietario: agrupa los movimientos incluidos en una
  // misma corrida de liquidación. NULL hasta que el período se liquida.
  settlementBatchId: text("settlementBatchId"),
  liquidadoAt: timestamp("liquidadoAt"),
  liquidadoPor: text("liquidadoPor").references(() => user.id, { onDelete: "set null" }),
```

- [ ] **Step 2: Agregar contador de número de liquidación a `agency`**

Editar `src/db/schema/agency.ts`. Después de `decimals` (línea ~49):

```ts
  liquidacionUltimoNumero: integer("liquidacionUltimoNumero").notNull().default(0),
```

- [ ] **Step 3: Generar migración**

Run: `bun run db:generate`

Verificar que crea un nuevo archivo en `drizzle/` con `ALTER TABLE cash_movement ADD COLUMN ...` y `ALTER TABLE agency ADD COLUMN liquidacionUltimoNumero ...`.

- [ ] **Step 4: Aplicar migración**

Run: `bun run db:migrate`

Expected: ejecuta sin error. Si la DB ya tiene datos, las columnas se crean nullable (excepto `liquidacionUltimoNumero` que tiene default 0).

- [ ] **Step 5: Crear índice único condicional para `idempotencyKey`**

Drizzle no permite unique condicional inline en el schema; lo agregamos en una migración manual. Editar el SQL generado en el paso 3 y agregar al final:

```sql
CREATE UNIQUE INDEX cash_movement_idempotency_key_idx
  ON cash_movement (agencyId, idempotencyKey)
  WHERE idempotencyKey IS NOT NULL;

CREATE INDEX cash_movement_settlement_batch_idx
  ON cash_movement (settlementBatchId)
  WHERE settlementBatchId IS NOT NULL;
```

Re-aplicar con `bun run db:migrate`.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/caja.ts src/db/schema/agency.ts drizzle/
git commit -m "feat(db): add idempotencyKey, settlementBatchId, liquidacion fields"
```

---

### Task 1.2: Helper de idempotencia con tests

**Files:**
- Create: `src/lib/receipts/idempotency.ts`
- Test: `src/lib/receipts/idempotency.test.ts`

- [ ] **Step 1: Escribir el test fallando**

Crear `src/lib/receipts/idempotency.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { isValidIdempotencyKey } from "./idempotency";

describe("isValidIdempotencyKey", () => {
  test("acepta UUID v4 válido", () => {
    expect(isValidIdempotencyKey("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });
  test("rechaza string vacío", () => {
    expect(isValidIdempotencyKey("")).toBe(false);
  });
  test("rechaza string que no es UUID", () => {
    expect(isValidIdempotencyKey("not-a-uuid")).toBe(false);
  });
  test("rechaza UUID con espacios", () => {
    expect(isValidIdempotencyKey(" 123e4567-e89b-12d3-a456-426614174000 ")).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `bun test src/lib/receipts/idempotency.test.ts`
Expected: FAIL — "Cannot find module './idempotency'"

- [ ] **Step 3: Implementar**

Crear `src/lib/receipts/idempotency.ts`:

```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && UUID_REGEX.test(key);
}
```

- [ ] **Step 4: Verificar PASS**

Run: `bun test src/lib/receipts/idempotency.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receipts/idempotency.ts src/lib/receipts/idempotency.test.ts
git commit -m "feat(receipts): add idempotency key validator"
```

---

### Task 1.3: Idempotencia en `POST /api/receipts/emit`

**Files:**
- Modify: `src/app/api/receipts/emit/route.ts`
- Test: `src/app/api/receipts/emit/route.test.ts`

- [ ] **Step 1: Escribir el test de idempotencia**

Crear `src/app/api/receipts/emit/route.test.ts`. Este archivo es un test de unidad de la lógica del schema y la rama de "early return". El test full integration corre manualmente.

```ts
import { describe, expect, test } from "bun:test";
import { z } from "zod";

// Re-declarar el schema para testear que acepta los nuevos campos.
// (No re-exportamos el schema desde el route porque Next inlines route handlers.)
const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
  montoOverrides: z.record(z.string(), z.string()).default({}),
  splitBreakdowns: z.record(z.string(), z.object({ propietario: z.number(), administracion: z.number() })).optional(),
  idempotencyKey: z.string().uuid(),
  observaciones: z.string().max(500).optional(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});

describe("emit schema", () => {
  test("requiere idempotencyKey", () => {
    const result = emitSchema.safeParse({
      ledgerEntryIds: ["a"],
      fecha: "2026-05-11",
      honorariosPct: 7,
    });
    expect(result.success).toBe(false);
  });
  test("acepta payload completo", () => {
    const result = emitSchema.safeParse({
      ledgerEntryIds: ["a"],
      fecha: "2026-05-11",
      honorariosPct: 7,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      observaciones: "Pago parcial",
      action: "email",
    });
    expect(result.success).toBe(true);
  });
  test("rechaza observaciones > 500 chars", () => {
    const result = emitSchema.safeParse({
      ledgerEntryIds: ["a"],
      fecha: "2026-05-11",
      honorariosPct: 7,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      observaciones: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `bun test src/app/api/receipts/emit/route.test.ts`
Expected: FAIL — los tests de "requiere idempotencyKey" y "acepta payload completo" deberían fallar porque el route real todavía no exige la key. (En realidad este test es self-contained y va a pasar — saltar al step 3 directo. Estos tests sirven como documentación viva del schema esperado.)

- [ ] **Step 3: Modificar el schema en el route**

Editar `src/app/api/receipts/emit/route.ts`. Reemplazar el `emitSchema` (líneas 16-23) por:

```ts
const emitSchema = z.object({
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  honorariosPct: z.number().min(0).max(100),
  trasladarAlPropietario: z.boolean().default(true),
  montoOverrides: z.record(z.string(), z.string()).default({}),
  splitBreakdowns: z.record(z.string(), z.object({ propietario: z.number(), administracion: z.number() })).optional(),
  idempotencyKey: z.string().uuid(),
  observaciones: z.string().max(500).optional(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});
```

- [ ] **Step 4: Agregar early-return de idempotencia**

En el mismo archivo, después de extraer `parsed.data` (línea ~61) y ANTES de cargar entries (línea 65), insertar:

```ts
    const { idempotencyKey, observaciones, action } = parsed.data;

    // Early return: si ya emitimos un recibo con esta idempotencyKey,
    // devolver el resultado anterior sin duplicar movimientos.
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
```

(Verificar que `eq` y `and` ya están importados desde `drizzle-orm` — sí lo están en línea 14.)

- [ ] **Step 5: Persistir `idempotencyKey` y `observaciones` en cada inserción**

En las llamadas `tx.insert(cajaMovimiento).values({...})` dentro de la transacción (3 ocurrencias en el archivo), agregar:

```ts
            idempotencyKey,
            note: observaciones ?? null,
```

a los `.values({...})`. La columna `note` ya existe — la usamos para observaciones.

Específicamente, los 3 lugares son:
1. La inserción `movComision` (split path, ~línea 195) — agregar las 2 líneas.
2. La inserción `movAgencia` (modality A, ~línea 215) — agregar las 2 líneas.
3. Las inserciones `ingreso_inquilino` y `honorarios_administracion` (~líneas 235, 254) — agregar `idempotencyKey` (sin `note`, no necesitan duplicar la observación).

- [ ] **Step 6: Manejo de email post-commit**

Después del `return txResult` dentro de la transacción y antes del `return NextResponse.json(...)`, agregar (en outer scope, después de `await db.transaction(...)`):

```ts
    if (action === "email") {
      // TODO PR3: integrar con sistema de mails. Por ahora marker.
      console.log(`[emit] Email solicitado para recibo ${txResult.reciboNumero}`);
    }
```

- [ ] **Step 7: Verificar tests + lint**

Run: `bun test src/app/api/receipts/emit/route.test.ts && bun run lint`
Expected: PASS + lint OK.

- [ ] **Step 8: Verificación manual rápida**

Levantar dev: `bun dev`
- Abrir cuenta corriente de un inquilino.
- Cobrar un ítem (todavía con el dialog viejo). Debe funcionar igual.
- Verificar en DB: `SELECT idempotencyKey, note FROM cash_movement WHERE reciboNumero = '<el último>';` — `idempotencyKey` debe ser NULL (porque el front todavía no lo envía). El backend no rompe si falta — wait, el schema lo requiere. El front actual NO envía idempotencyKey, va a fallar con 400.

Esto es esperado: la brecha la cerramos en PR3 cuando reemplazamos el dialog. Para no romper el flujo viejo durante PR1+PR2, hacer `idempotencyKey` opcional temporalmente:

```ts
  idempotencyKey: z.string().uuid().optional(),
```

Y la lógica de early-return saltarla si `idempotencyKey === undefined`. Y la persistencia: `idempotencyKey: idempotencyKey ?? null`.

Hacer ese cambio antes del commit. En PR3 el front siempre lo envía y podemos endurecer si queremos (o dejar opcional para futuras integraciones).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/receipts/emit/route.ts src/app/api/receipts/emit/route.test.ts
git commit -m "feat(api/receipts/emit): accept idempotencyKey + observaciones, early return on dup"
```

---

## PR2 — Componentes compartidos de document-preview

### Task 2.1: Crear componentes shell + paper extrayendo de la pantalla de liquidación

La pantalla `propietarios/[id]/liquidacion/page.tsx` (693 líneas) ya implementa el papel A4 + sidebar. Extraemos los pieces reutilizables.

**Files:**
- Read first: `src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx` (entera, para entender qué extraer)
- Create: `src/components/document-preview/topbar.tsx`
- Create: `src/components/document-preview/paper.tsx`
- Create: `src/components/document-preview/paper-header.tsx`
- Create: `src/components/document-preview/paper-meta-block.tsx`
- Create: `src/components/document-preview/paper-items-table.tsx`
- Create: `src/components/document-preview/paper-totals.tsx`
- Create: `src/components/document-preview/paper-footer.tsx`
- Create: `src/components/document-preview/side-summary-card.tsx`
- Create: `src/components/document-preview/side-print-options.tsx`
- Create: `src/components/document-preview/side-recipients.tsx`
- Create: `src/components/document-preview/side-observations.tsx`
- Create: `src/components/document-preview/document-preview-shell.tsx`

- [ ] **Step 1: Leer la pantalla actual de liquidación entera**

Run: lee `src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx` completo. Identificar:
- Bloque `<div className="print:hidden sticky top-0 z-20 ...">` → Topbar (líneas ~257-322)
- Bloque `<aside className="print:hidden w-[320px] ...">` → Sidebar wrapper
- Bloques internos del aside: Resumen, Opciones de impresión, Destinatarios, Editar
- El `<div className="paper">` con todo el contenido del recibo

- [ ] **Step 2: Crear `paper.tsx` (shell del papel A4)**

Crear `src/components/document-preview/paper.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PaperProps = {
  watermark?: boolean;
  zoom?: number;
  children: ReactNode;
};

export function Paper({ watermark = false, zoom = 1, children }: PaperProps) {
  return (
    <div className="paper-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform .2s" }}>
      <div
        className={cn(
          "relative w-[794px] min-h-[1123px] bg-[#f7f5ef] text-[#1a1614] shadow-[0_4px_12px_rgba(0,0,0,.4),0_20px_60px_rgba(0,0,0,.5)] rounded-[2px] font-sans p-[56px_64px]",
          watermark && "preview-watermark"
        )}
      >
        {children}
      </div>
      <style jsx global>{`
        .preview-watermark::before {
          content: 'BORRADOR';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-22deg);
          font-size: 140px;
          font-weight: 900;
          color: rgba(232, 90, 60, 0.1);
          letter-spacing: .05em;
          pointer-events: none;
          z-index: 1;
        }
        @media print {
          .preview-watermark::before { display: none; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Crear `paper-header.tsx`**

Crear `src/components/document-preview/paper-header.tsx`:

```tsx
type AgencyHeaderData = {
  name: string;
  cuit: string | null;
  vatStatus: string | null;
  fiscalAddress: string | null;
  city: string | null;
  phone: string | null;
  contactEmail: string | null;
  licenseNumber: string | null;
  professionalAssociation: string | null;
  grossIncome: string | null;
  activityStart: string | null;
  logoUrl: string | null;
};

type PaperHeaderProps = {
  agency: AgencyHeaderData;
  receiptType: string; // "RECIBO C", "RECIBO X", "LIQUIDACIÓN"
  numero: string;       // "0001 - 00000241"
  fechaEmision: string; // "30/04/2026"
};

export function PaperHeader({ agency, receiptType, numero, fechaEmision }: PaperHeaderProps) {
  return (
    <div className="relative z-[2] flex gap-[18px] items-start pb-[18px] border-b-2 border-[#1a1614]">
      {agency.logoUrl ? (
        <img src={agency.logoUrl} alt={agency.name} className="size-[60px] rounded-[10px] object-cover flex-none" />
      ) : (
        <div className="size-[60px] rounded-[10px] bg-gradient-to-br from-[#e85a3c] to-[#c03c1f] text-white grid place-items-center font-bold text-[26px] flex-none">
          {agency.name[0]?.toUpperCase() ?? "A"}
        </div>
      )}
      <div className="flex-1">
        <div className="text-[18px] font-bold tracking-[-.01em]">{agency.name}</div>
        {agency.cuit && <div className="text-[11px] text-[#5a514c] mt-[2px] font-mono">CUIT {agency.cuit}{agency.vatStatus ? ` · ${agency.vatStatus}` : ""}</div>}
        {agency.fiscalAddress && <div className="text-[11px] text-[#5a514c] mt-[2px]">{agency.fiscalAddress}{agency.city ? ` · ${agency.city}` : ""}</div>}
        {(agency.phone || agency.contactEmail) && (
          <div className="text-[11px] text-[#5a514c] mt-[2px]">{[agency.phone && `Tel. ${agency.phone}`, agency.contactEmail].filter(Boolean).join(" · ")}</div>
        )}
        {agency.grossIncome && <div className="text-[11px] text-[#5a514c] mt-[2px] font-mono">IIBB {agency.grossIncome}{agency.activityStart ? ` · Inicio ${agency.activityStart}` : ""}</div>}
      </div>
      <div className="text-right">
        <div className="inline-block px-[10px] py-[2px] border-[1.5px] border-[#1a1614] rounded-[4px] text-[10px] font-bold tracking-[.1em] mb-[6px]">{receiptType}</div>
        <div className="font-mono text-[15px] font-bold">{numero}</div>
        {agency.licenseNumber && <>
          <div className="text-[9.5px] text-[#5a514c] uppercase tracking-[.06em] mt-[6px]">Mat. Profesional</div>
          <div className="font-mono text-[11px] font-medium">{agency.professionalAssociation ? `${agency.professionalAssociation} · ` : ""}{agency.licenseNumber}</div>
        </>}
        <div className="text-[9.5px] text-[#5a514c] uppercase tracking-[.06em] mt-[6px]">Fecha emisión</div>
        <div className="font-mono text-[11px] font-medium">{fechaEmision}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear `paper-meta-block.tsx`**

Crear `src/components/document-preview/paper-meta-block.tsx`:

```tsx
type MetaBlockProps = {
  leftLabel: string;
  leftValue: string;
  leftSub?: string[];
  rightLabel: string;
  rightValue: string;
  rightSub?: string[];
};

export function PaperMetaBlock({ leftLabel, leftValue, leftSub, rightLabel, rightValue, rightSub }: MetaBlockProps) {
  return (
    <div className="grid grid-cols-2 gap-[18px] mt-[20px] relative z-[2]">
      <div>
        <div className="text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] mb-[4px] font-semibold">{leftLabel}</div>
        <div className="text-[16px] font-bold">{leftValue}</div>
        {leftSub?.map((s, i) => <div key={i} className="text-[10.5px] text-[#5a514c] mt-[3px]">{s}</div>)}
      </div>
      <div className="text-right">
        <div className="text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] mb-[4px] font-semibold">{rightLabel}</div>
        <div className="text-[16px] font-bold">{rightValue}</div>
        {rightSub?.map((s, i) => <div key={i} className="text-[10.5px] text-[#5a514c] mt-[3px]">{s}</div>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crear `paper-items-table.tsx`**

Crear `src/components/document-preview/paper-items-table.tsx`:

```tsx
export type PaperItem = {
  fecha: string;       // "01/04/2026"
  concepto: string;
  meta?: string;       // "Av. Rivadavia 4210, 3ºB · Inq. M. Torres"
  importe: number;     // signed
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

type Props = {
  title?: string;
  items: PaperItem[];
};

export function PaperItemsTable({ title = "Detalle de movimientos", items }: Props) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-[.1em] text-[#5a514c] font-bold mt-[22px] mb-[8px] relative z-[2]">{title}</div>
      <table className="w-full border-collapse mt-[8px] relative z-[2] text-[11px]">
        <thead>
          <tr>
            <th className="text-left p-[8px_6px] text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] font-bold border-b-[1.5px] border-[#1a1614] w-[76px]">Fecha</th>
            <th className="text-left p-[8px_6px] text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] font-bold border-b-[1.5px] border-[#1a1614]">Concepto</th>
            <th className="text-right p-[8px_6px] text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] font-bold border-b-[1.5px] border-[#1a1614] w-[110px]">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="p-[7px_6px] border-b border-dashed border-[#d9d1c3] align-top font-mono text-[#5a514c] text-[10.5px] whitespace-nowrap">{it.fecha}</td>
              <td className="p-[7px_6px] border-b border-dashed border-[#d9d1c3] align-top">
                {it.concepto}
                {it.meta && <div className="text-[10px] text-[#5a514c] mt-[2px]">{it.meta}</div>}
              </td>
              <td className={`p-[7px_6px] border-b border-dashed border-[#d9d1c3] align-top text-right font-mono whitespace-nowrap ${it.importe >= 0 ? "text-[#2a6a3a]" : "text-[#9a2a1a]"}`}>
                {it.importe >= 0 ? "+ " : "− "}{fmt(it.importe)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
```

- [ ] **Step 6: Crear `paper-totals.tsx`**

Crear `src/components/document-preview/paper-totals.tsx`:

```tsx
function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

export type TotalLine = { label: string; value: number; sign?: "+" | "−" };

type Props = {
  lines: TotalLine[];
  total: { label: string; value: number };
};

export function PaperTotals({ lines, total }: Props) {
  return (
    <div className="mt-[16px] ml-auto w-[45%] relative z-[2]">
      {lines.map((ln, i) => (
        <div key={i} className="flex justify-between items-center py-[6px] text-[12px] border-b border-dotted border-[#d9d1c3]">
          <span className="text-[#5a514c]">{ln.label}</span>
          <span className="font-mono font-medium">{ln.sign ?? (ln.value >= 0 ? "+ " : "− ")}{fmt(ln.value)}</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-[12px] mt-[6px] border-t-2 border-[#1a1614] text-[15px] font-bold">
        <span className="text-[#5a514c]">{total.label}</span>
        <span className="font-mono text-[17px] text-[#e85a3c]">$ {fmt(total.value)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Crear `paper-footer.tsx`**

Crear `src/components/document-preview/paper-footer.tsx`:

```tsx
type Props = {
  bank: { nombre: string | null; titular: string | null; cbu: string | null; alias: string | null };
  signatory: { nombre: string | null; cargo: string | null; signatureUrl?: string | null };
  clauses: string[];
  showQR?: boolean;
};

export function PaperFooter({ bank, signatory, clauses, showQR = true }: Props) {
  return (
    <>
      {(bank.cbu || bank.alias) && (
        <div className="mt-[24px] flex justify-between items-end relative z-[2]">
          <div className="text-[10px] text-[#5a514c]">
            <div className="text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] mb-[6px]">Transferencia a</div>
            {bank.nombre && <div><b className="text-[#1a1614]">{bank.nombre}</b></div>}
            {bank.titular && <div>Titular: {bank.titular}</div>}
            {bank.cbu && <div>CBU: <b className="text-[#1a1614] font-mono font-medium">{bank.cbu}</b></div>}
            {bank.alias && <div>Alias: <b className="text-[#1a1614] font-mono font-medium">{bank.alias}</b></div>}
          </div>
          {signatory.nombre && (
            <div className="w-[200px] text-center">
              {signatory.signatureUrl
                ? <img src={signatory.signatureUrl} alt="firma" className="max-h-[40px] mx-auto" />
                : <div style={{ fontFamily: '"Brush Script MT", cursive' }} className="text-[26px] -rotate-3 mb-[2px]">{signatory.nombre}</div>}
              <div className="border-t border-[#1a1614] pt-[6px] text-[9.5px] text-[#5a514c] uppercase tracking-[.08em]">{signatory.nombre}{signatory.cargo ? ` · ${signatory.cargo}` : ""}</div>
            </div>
          )}
        </div>
      )}
      <div className="mt-[40px] pt-[18px] border-t border-[#d9d1c3] relative z-[2] grid grid-cols-[1fr_180px] gap-[24px]">
        <div className="text-[9.5px] text-[#5a514c] leading-[1.55]">
          {clauses.map((c, i) => <div key={i} className="py-[3px]">{i + 1}. {c}</div>)}
        </div>
        {showQR && (
          <div>
            <div className="w-[100px] h-[100px] ml-auto border-2 border-[#1a1614] bg-[#f7f5ef] relative" style={{
              backgroundImage: "linear-gradient(90deg, #1a1614 0 2px, transparent 2px 6px), linear-gradient(0deg, #1a1614 0 2px, transparent 2px 6px)",
              backgroundSize: "6px 6px",
            }} />
            <div className="text-[9px] text-center mt-[4px] text-[#5a514c] uppercase tracking-[.08em]">QR transferencia</div>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 8: Crear los componentes del sidebar**

Crear `src/components/document-preview/side-summary-card.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type SummaryRow = { label: string; value: string; mono?: boolean; cls?: string; bold?: boolean };

type Props = { title?: string; rows: SummaryRow[]; total: SummaryRow };

export function SideSummaryCard({ title = "Resumen", rows, total }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">{title}</h3>
      <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
        {rows.map((r, i) => <KVRow key={i} {...r} />)}
        <KVRow {...total} bold />
      </div>
    </div>
  );
}

function KVRow({ label, value, mono, cls, bold }: SummaryRow) {
  return (
    <div className={cn("flex justify-between py-1.5 text-[12.5px] border-b border-border-soft last:border-b-0", bold && "font-semibold pt-2.5 mt-1 border-t border-border")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(mono && "font-mono tabular-nums", cls)}>{value}</span>
    </div>
  );
}
```

Crear `src/components/document-preview/side-print-options.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

export type PrintOption = { key: string; label: string; desc: string; on: boolean; disabled?: boolean };

type Props = { options: PrintOption[]; onToggle: (key: string) => void };

export function SidePrintOptions({ options, onToggle }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Opciones de impresión</h3>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={o.disabled}
            onClick={() => onToggle(o.key)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-[9px] rounded-[8px] bg-surface-mid border border-border text-left",
              "hover:border-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <span className={cn(
              "w-[30px] h-[16px] rounded-full relative flex-none transition-colors",
              o.on ? "bg-primary/20" : "bg-border"
            )}>
              <span className={cn(
                "absolute top-[2px] size-3 rounded-full transition-all",
                o.on ? "left-[16px] bg-primary" : "left-[2px] bg-muted-foreground"
              )} />
            </span>
            <span className="flex-1">
              <span className="block text-[12.5px]">{o.label}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Crear `src/components/document-preview/side-recipients.tsx`:

```tsx
"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = { name: string; email: string | null };

export function SideRecipients({ name, email }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Destinatarios</h3>
      <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
        <div className="text-[12.5px] font-medium text-on-surface mb-1">{name}</div>
        {email
          ? <div className="font-mono text-[11.5px] text-muted-foreground">{email}</div>
          : <div className="text-[11px] text-muted-foreground italic">Sin email registrado</div>}
        <Button variant="outline" size="sm" className="mt-2.5 w-full justify-center gap-1.5" onClick={() => toast.info("Próximamente")}>
          <Mail size={13} /> + Agregar copia (CC)
        </Button>
      </div>
    </div>
  );
}
```

Crear `src/components/document-preview/side-observations.tsx`:

```tsx
"use client";

import { Textarea } from "@/components/ui/textarea";

type Props = { value: string; onChange: (v: string) => void; disabled?: boolean };

export function SideObservations({ value, onChange, disabled }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Observaciones (opcional)</h3>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={500}
        rows={3}
        placeholder="Ej: pago parcial, acuerdo de fecha, seña…"
        className="text-[12.5px] resize-none"
      />
      <div className="text-[10.5px] text-muted-foreground mt-1 text-right">{value.length}/500</div>
    </div>
  );
}
```

- [ ] **Step 9: Crear `topbar.tsx`**

Crear `src/components/document-preview/topbar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Printer, Download, Mail, Check, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  backHref: string;
  breadcrumb: { name: string; ref: string };
  isEmitido: boolean;
  zoom: number;
  onZoom: (delta: number) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onSendEmail: () => void;
  onConfirm: () => void;
  emailDisabled?: boolean;
  busyAction?: "print" | "email" | "confirm" | null;
};

export function PreviewTopbar({
  backHref, breadcrumb, isEmitido, zoom, onZoom,
  onPrint, onDownloadPdf, onSendEmail, onConfirm,
  emailDisabled, busyAction,
}: Props) {
  const lock = isEmitido || busyAction !== null;
  return (
    <div className="print:hidden sticky top-0 z-20 h-14 bg-surface border-b border-border flex items-center gap-3.5 px-6 flex-shrink-0">
      <Link href={backHref} className="size-8 rounded-[7px] border border-border bg-surface-mid flex items-center justify-center text-muted-foreground hover:text-on-surface transition-colors flex-shrink-0">
        <ArrowLeft size={14} />
      </Link>
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="text-on-surface">{breadcrumb.name}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-mono text-[11.5px] px-2 py-[2px] border border-border rounded-[4px] bg-surface-mid text-muted-foreground">{breadcrumb.ref}</span>
      </div>
      {!isEmitido
        ? <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.04em] px-2 py-[3px] rounded-full border ml-2.5 bg-warning/14 text-warning border-warning/25">
            <span className="size-1.5 rounded-full bg-current" />Borrador
          </span>
        : <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.04em] px-2 py-[3px] rounded-full border ml-2.5 bg-success/14 text-success border-success/25">
            <span className="size-1.5 rounded-full bg-current" />Emitida
          </span>}

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center rounded-[7px] border border-border bg-surface-mid overflow-hidden">
          <button onClick={() => onZoom(-0.1)} className="px-2 py-1.5 text-muted-foreground hover:text-on-surface hover:bg-surface transition-colors"><Minus size={13} /></button>
          <span className="px-2.5 py-1 font-mono text-[12px] border-x border-border text-on-surface select-none">{Math.round(zoom * 100)}%</span>
          <button onClick={() => onZoom(0.1)} className="px-2 py-1.5 text-muted-foreground hover:text-on-surface hover:bg-surface transition-colors"><Plus size={13} /></button>
        </div>
        <Button variant="ghost" size="sm" onClick={onPrint} disabled={lock} className="gap-1.5"><Printer size={14} /> Imprimir</Button>
        <Button variant="outline" size="sm" onClick={onDownloadPdf} disabled={lock} className="gap-1.5"><Download size={14} /> Descargar PDF</Button>
        <Button variant="outline" size="sm" onClick={onSendEmail} disabled={lock || emailDisabled} className="gap-1.5"><Mail size={14} /> Enviar por email</Button>
        {!isEmitido && (
          <Button size="sm" onClick={onConfirm} disabled={busyAction !== null} className={cn("gap-1.5 bg-primary text-primary-foreground hover:opacity-90")}>
            <Check size={14} /> Confirmar y emitir
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Crear `document-preview-shell.tsx` (compone topbar + canvas + sidebar)**

Crear `src/components/document-preview/document-preview-shell.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";

type Props = {
  topbar: ReactNode;
  paper: ReactNode;     // wrapped in Paper already
  sidebar: ReactNode;
};

export function DocumentPreviewShell({ topbar, paper, sidebar }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {topbar}
      <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
        <div
          className="overflow-auto p-7 flex justify-center items-start"
          style={{ background: "radial-gradient(circle at 1px 1px, oklch(0.25 0.008 40) 1px, transparent 0) 0 0 / 18px 18px, var(--bg)" }}
        >
          {paper}
        </div>
        <aside className="print:hidden border-l border-border bg-surface overflow-y-auto sticky top-14 h-[calc(100vh-56px)]">
          <div className="p-[18px] pb-6 flex flex-col gap-5">{sidebar}</div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Lint check**

Run: `bun run lint`
Expected: PASS (los componentes son client-side, exports nombrados, sin warnings).

- [ ] **Step 12: Commit**

```bash
git add src/components/document-preview/
git commit -m "feat(document-preview): extract reusable shell + paper + sidebar pieces"
```

---

### Task 2.2: Refactorizar la pantalla de liquidación para usar los nuevos componentes

**Files:**
- Modify: `src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx`

- [ ] **Step 1: Identificar bloques a reemplazar**

Leer el archivo entero. Tiene 693 líneas. Reemplazar:
- El `<div className="print:hidden sticky ...">` (topbar) por `<PreviewTopbar ... />`
- El `<div className="paper">` y todo su contenido por composición de `<Paper><PaperHeader/>...<PaperFooter/></Paper>`
- El `<aside>` por composición de los `<Side*/>` componentes
- El wrapper general por `<DocumentPreviewShell topbar={...} paper={...} sidebar={...} />`

- [ ] **Step 2: Importar los nuevos componentes**

Al tope del archivo, añadir:

```ts
import { DocumentPreviewShell } from "@/components/document-preview/document-preview-shell";
import { PreviewTopbar } from "@/components/document-preview/topbar";
import { Paper } from "@/components/document-preview/paper";
import { PaperHeader } from "@/components/document-preview/paper-header";
import { PaperMetaBlock } from "@/components/document-preview/paper-meta-block";
import { PaperItemsTable, type PaperItem } from "@/components/document-preview/paper-items-table";
import { PaperTotals } from "@/components/document-preview/paper-totals";
import { PaperFooter } from "@/components/document-preview/paper-footer";
import { SideSummaryCard } from "@/components/document-preview/side-summary-card";
import { SidePrintOptions } from "@/components/document-preview/side-print-options";
import { SideRecipients } from "@/components/document-preview/side-recipients";
import { SideObservations } from "@/components/document-preview/side-observations";
```

- [ ] **Step 3: Reemplazar el JSX gigante por composición**

Reemplazar todo el `return (...)` (líneas ~254-690) por el patrón:

```tsx
  const items: PaperItem[] = movimientos.map((m) => ({
    fecha: fmtDate(m.fecha),
    concepto: m.descripcion,
    meta: m.propiedadAddress ?? undefined,
    importe: m.tipo === "income" ? Number(m.monto) : -Number(m.monto),
  }));

  const printOptions = [
    { key: "watermark", label: "Marca de agua", desc: 'Mostrar "BORRADOR"', on: showWatermark && !isEmitido, disabled: isEmitido },
    { key: "qr", label: "Incluir QR", desc: "Pie del documento", on: showQR },
    { key: "detalle", label: "Detalle de movimientos", desc: "Tabla completa", on: showDetalle },
    { key: "duplicate", label: "Copia duplicada", desc: "Original + duplicado", on: showDuplicate },
  ];

  function handleToggleOption(key: string) {
    if (key === "watermark") setShowWatermark((v) => !v);
    if (key === "qr") setShowQR((v) => !v);
    if (key === "detalle") setShowDetalle((v) => !v);
    if (key === "duplicate") setShowDuplicate((v) => !v);
  }

  return (
    <DocumentPreviewShell
      topbar={
        <PreviewTopbar
          backHref={`/propietarios/${id}?tab=cuenta-corriente`}
          breadcrumb={{ name: propietarioName, ref: periodo }}
          isEmitido={isEmitido}
          zoom={zoom}
          onZoom={(d) => setZoom((z) => Math.min(1.5, Math.max(0.5, z + d)))}
          onPrint={() => window.print()}
          onDownloadPdf={() => toast.info("Descarga de PDF próximamente")}
          onSendEmail={() => toast.info(`Enviado a ${propietario?.email ?? "destinatario"}`)}
          onConfirm={handleEmitir}
          emailDisabled={!propietario?.email}
        />
      }
      paper={
        <Paper watermark={showWatermark && !isEmitido} zoom={zoom}>
          <PaperHeader
            agency={{
              name: agency?.legalName ?? agency?.tradeName ?? "Administradora",
              cuit: agency?.cuit ?? null,
              vatStatus: agency?.vatStatus ?? null,
              fiscalAddress: agency?.fiscalAddress ?? null,
              city: agency?.city ?? null,
              phone: agency?.phone ?? null,
              contactEmail: agency?.contactEmail ?? null,
              licenseNumber: agency?.licenseNumber ?? null,
              professionalAssociation: null,
              grossIncome: null,
              activityStart: null,
              logoUrl: agency?.logoUrl ?? null,
            }}
            receiptType="LIQUIDACIÓN"
            numero={`${agency?.invoicePoint ?? "0001"} - ${(agency?.nextNumber ?? "00000001").padStart(8, "0")}`}
            fechaEmision={fmtDate(today)}
          />
          <PaperMetaBlock
            leftLabel="Liquidación a"
            leftValue={propietarioName}
            leftSub={[
              propietario?.dni ? `DNI ${propietario.dni}` : "",
              propietario?.email ?? "",
            ].filter(Boolean)}
            rightLabel="Período"
            rightValue={periodLabel(periodo)}
            rightSub={[`${propiedades.length} ${propiedades.length === 1 ? "propiedad administrada" : "propiedades administradas"}`]}
          />
          {showDetalle && <PaperItemsTable items={items} />}
          <PaperTotals
            lines={[
              { label: "Subtotal ingresos", value: totalIngresos },
              { label: "Subtotal egresos", value: -totalEgresos },
              { label: "Honorarios (7%)", value: -honorarios },
            ]}
            total={{ label: "Total a transferir", value: totalTransferir }}
          />
          <PaperFooter
            bank={{
              nombre: propietario?.bank ?? null,
              titular: propietarioName,
              cbu: propietario?.cbu ?? null,
              alias: propietario?.alias ?? null,
            }}
            signatory={{
              nombre: agency?.signatory ?? null,
              cargo: agency?.signatoryTitle ?? null,
              signatureUrl: agency?.signatureUrl ?? null,
            }}
            clauses={parseClauses(agency?.clauses)}
            showQR={showQR}
          />
        </Paper>
      }
      sidebar={
        <>
          <SideSummaryCard
            rows={[
              { label: "Propietario", value: propietarioName },
              { label: "Período", value: periodLabel(periodo), mono: true },
              { label: "Propiedades", value: String(propiedades.length), mono: true },
              { label: "Movimientos", value: String(movimientos.length), mono: true },
              { label: "Ingresos", value: `+ ${fmt(totalIngresos)}`, mono: true, cls: "text-success" },
              { label: "Egresos", value: `− ${fmt(totalEgresos)}`, mono: true, cls: "text-error" },
              { label: "Honorarios", value: `− ${fmt(honorarios)}`, mono: true, cls: "text-error" },
            ]}
            total={{ label: "Total a transferir", value: `$ ${fmt(totalTransferir)}`, mono: true, cls: "text-primary" }}
          />
          <SidePrintOptions options={printOptions} onToggle={handleToggleOption} />
          <SideRecipients name={propietarioName} email={propietario?.email ?? null} />
          <SideObservations value={observations} onChange={setObservations} disabled={isEmitido} />
        </>
      }
    />
  );
```

- [ ] **Step 4: Agregar state para `observations` y helper `parseClauses`**

Cerca de los otros `useState` (línea ~170), agregar:

```ts
const [observations, setObservations] = useState("");
```

Antes del componente, agregar:

```ts
function parseClauses(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((c) => typeof c === "string" ? c : c.texto).filter(Boolean);
  } catch {
    // raw no es JSON; devolver como párrafo único
    return [raw];
  }
  return [];
}
```

- [ ] **Step 5: Eliminar código muerto**

Borrar las funciones helper inline que ya no se usan (KVRow, ToggleOpt) si quedaron en el archivo. Mantener `fmt`, `fmtDate`, `currentPeriod`, `periodLabel`.

- [ ] **Step 6: Smoke test manual**

Run: `bun dev`
- Visitar `/propietarios/<id>/liquidacion?periodo=2026-04` con un propietario que tenga movimientos.
- Verificar visualmente: papel A4 con marca BORRADOR, sidebar con resumen, opciones funcionan, observaciones se escribe.
- Click en Confirmar y emitir → BORRADOR desaparece, pill cambia a Emitida (todavía no hace nada en backend; eso viene en PR4).

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx
git commit -m "refactor(liquidacion): use shared document-preview components"
```

---

## PR3 — Cobro inquilino preview (reemplaza dialog)

### Task 3.1: Helper de localStorage con TTL + tests

**Files:**
- Create: `src/lib/utils/local-storage-ttl.ts`
- Test: `src/lib/utils/local-storage-ttl.test.ts`

- [ ] **Step 1: Test fallando**

Crear `src/lib/utils/local-storage-ttl.test.ts`:

```ts
import { describe, expect, test, beforeEach } from "bun:test";
import { setWithTTL, getWithTTL, removeKey } from "./local-storage-ttl";

// Stub mínimo de localStorage para Bun (no es DOM env por defecto).
class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemStorage();
});

describe("localStorage TTL helper", () => {
  test("setWithTTL / getWithTTL roundtrip", () => {
    setWithTTL("foo", { hello: "world" }, 60_000);
    expect(getWithTTL("foo")).toEqual({ hello: "world" });
  });

  test("getWithTTL devuelve null si vencido", () => {
    setWithTTL("foo", { x: 1 }, -1);
    expect(getWithTTL("foo")).toBeNull();
  });

  test("getWithTTL devuelve null si key no existe", () => {
    expect(getWithTTL("missing")).toBeNull();
  });

  test("removeKey borra la key", () => {
    setWithTTL("foo", "bar", 60_000);
    removeKey("foo");
    expect(getWithTTL("foo")).toBeNull();
  });

  test("getWithTTL ignora payloads malformados", () => {
    localStorage.setItem("garbage", "{not json");
    expect(getWithTTL("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Verificar fail**

Run: `bun test src/lib/utils/local-storage-ttl.test.ts`
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implementar**

Crear `src/lib/utils/local-storage-ttl.ts`:

```ts
type Wrapped<T> = { v: T; exp: number };

export function setWithTTL<T>(key: string, value: T, ttlMs: number): void {
  if (typeof localStorage === "undefined") return;
  const wrapped: Wrapped<T> = { v: value, exp: Date.now() + ttlMs };
  localStorage.setItem(key, JSON.stringify(wrapped));
}

export function getWithTTL<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const wrapped = JSON.parse(raw) as Wrapped<T>;
    if (typeof wrapped.exp !== "number" || Date.now() > wrapped.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return wrapped.v;
  } catch {
    return null;
  }
}

export function removeKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}
```

- [ ] **Step 4: PASS**

Run: `bun test src/lib/utils/local-storage-ttl.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/local-storage-ttl.ts src/lib/utils/local-storage-ttl.test.ts
git commit -m "feat(utils): localStorage TTL helper for cross-tab draft transfer"
```

---

### Task 3.2: Pantalla de preview del cobro al inquilino

**Files:**
- Create: `src/app/(dashboard)/inquilinos/[id]/cobro/preview/page.tsx`

- [ ] **Step 1: Crear el archivo con el esqueleto**

Crear `src/app/(dashboard)/inquilinos/[id]/cobro/preview/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getWithTTL, removeKey } from "@/lib/utils/local-storage-ttl";
import { DocumentPreviewShell } from "@/components/document-preview/document-preview-shell";
import { PreviewTopbar } from "@/components/document-preview/topbar";
import { Paper } from "@/components/document-preview/paper";
import { PaperHeader } from "@/components/document-preview/paper-header";
import { PaperMetaBlock } from "@/components/document-preview/paper-meta-block";
import { PaperItemsTable, type PaperItem } from "@/components/document-preview/paper-items-table";
import { PaperTotals } from "@/components/document-preview/paper-totals";
import { PaperFooter } from "@/components/document-preview/paper-footer";
import { SideSummaryCard } from "@/components/document-preview/side-summary-card";
import { SidePrintOptions } from "@/components/document-preview/side-print-options";
import { SideRecipients } from "@/components/document-preview/side-recipients";
import { SideObservations } from "@/components/document-preview/side-observations";

type Draft = {
  ledgerEntryIds: string[];
  montoOverrides: Record<string, string>;
  beneficiarioOverrides: Record<string, string>;
  honorariosPct: number;
  fecha: string;
  idempotencyKey: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}
function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export default function CobroPreviewPage() {
  const router = useRouter();
  const { id: tenantId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Watermark + opciones
  const [showWatermark, setShowWatermark] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showDetalle, setShowDetalle] = useState(true);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [observations, setObservations] = useState("");

  // Estado de emisión
  const [isEmitido, setIsEmitido] = useState(false);
  const [reciboNumero, setReciboNumero] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"print" | "email" | "confirm" | null>(null);

  // Leer draft de localStorage al montar
  useEffect(() => {
    if (!draftId) {
      setDraftError("Falta el parámetro draft. Volvé a la cuenta corriente y volvé a apretar Cobrar.");
      return;
    }
    const data = getWithTTL<Draft>(`cobro-draft-${draftId}`);
    if (!data) {
      setDraftError("La selección expiró o no se encontró. Volvé a la cuenta corriente y volvé a apretar Cobrar.");
      return;
    }
    setDraft(data);
    // No removemos la key acá: si el usuario refresca, queremos que sobreviva.
    // La sacamos solo cuando se emite.
  }, [draftId]);

  // Datos del inquilino + ledger entries
  const { data: tenantData } = useQuery({
    queryKey: ["tenant-cuenta-corriente", tenantId],
    queryFn: async () => {
      const r = await fetch(`/api/tenants/${tenantId}/cuenta-corriente`);
      if (!r.ok) throw new Error("Error al cargar cuenta corriente");
      return r.json();
    },
    enabled: !!tenantId && !!draft,
  });

  const { data: agencyData } = useQuery({
    queryKey: ["agency"],
    queryFn: async () => {
      const r = await fetch("/api/agency");
      if (!r.ok) return { agency: null };
      return r.json();
    },
  });

  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const r = await fetch(`/api/tenants/${tenantId}`);
      if (!r.ok) throw new Error("Error al cargar inquilino");
      return r.json();
    },
    enabled: !!tenantId,
  });

  const agency = agencyData?.agency;
  const tenant = tenantInfo?.tenant ?? tenantInfo;

  const selectedEntries = useMemo(() => {
    if (!draft || !tenantData?.ledgerEntries) return [];
    const ids = new Set(draft.ledgerEntryIds);
    return tenantData.ledgerEntries.filter((e: any) => ids.has(e.id));
  }, [draft, tenantData]);

  const items: PaperItem[] = useMemo(() => selectedEntries.map((e: any) => {
    const monto = draft?.montoOverrides?.[e.id] !== undefined
      ? Number(draft.montoOverrides[e.id])
      : Number(e.montoManual ?? e.monto);
    const sign = e.tipo === "descuento" || e.tipo === "bonificacion" ? -1 : 1;
    return {
      fecha: fmtDate(draft?.fecha ?? new Date().toISOString().slice(0, 10)),
      concepto: e.descripcion,
      meta: e.period ? `Período ${e.period}` : undefined,
      importe: monto * sign,
    };
  }), [selectedEntries, draft]);

  const totalRecibo = items.reduce((s, it) => s + it.importe, 0);
  const honorariosPct = draft?.honorariosPct ?? 0;
  const honorarios = totalRecibo * honorariosPct / 100;
  const propietarioRecibe = totalRecibo - honorarios;

  const tenantFullName = tenant ? [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") : "Inquilino";

  async function emit(action: "print" | "email" | "confirm") {
    if (!draft) return;
    setBusyAction(action);
    try {
      const splitMeta = tenantData?.splitMeta;
      const splitBreakdowns: Record<string, { propietario: number; administracion: number }> = {};
      if (splitMeta) {
        for (const e of selectedEntries) {
          const monto = draft.montoOverrides?.[e.id] !== undefined ? Number(draft.montoOverrides[e.id]) : Number(e.montoManual ?? e.monto);
          const propietarioPct = 100 - (splitMeta.managementCommissionPct ?? 0);
          splitBreakdowns[e.id] = {
            propietario: Math.round(monto * propietarioPct) / 100,
            administracion: Math.round(monto * (splitMeta.managementCommissionPct ?? 0)) / 100,
          };
        }
      }

      const res = await fetch("/api/receipts/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerEntryIds: draft.ledgerEntryIds,
          fecha: draft.fecha,
          honorariosPct: splitMeta?.managementCommissionPct ?? draft.honorariosPct,
          trasladarAlPropietario: true,
          montoOverrides: draft.montoOverrides,
          ...(Object.keys(splitBreakdowns).length > 0 && { splitBreakdowns }),
          idempotencyKey: draft.idempotencyKey,
          observaciones: observations || undefined,
          action,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al emitir el recibo");
      }
      const result = await res.json();
      setIsEmitido(true);
      setShowWatermark(false);
      setReciboNumero(result.reciboNumero);
      removeKey(`cobro-draft-${draftId}`);
      toast.success(`Recibo ${result.reciboNumero} emitido`);
      if (action === "print") window.print();
      // No cerramos la tab automáticamente — dejamos al user decidir.
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  if (draftError) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md text-center">
          <div className="text-lg font-medium mb-2">No se pudo cargar la vista previa</div>
          <div className="text-muted-foreground text-sm mb-4">{draftError}</div>
          <button onClick={() => router.push(`/inquilinos/${tenantId}`)} className="text-primary underline">Volver al inquilino</button>
        </div>
      </div>
    );
  }
  if (!draft || !tenantData || !agency || !tenant) {
    return <div className="flex h-screen items-center justify-center bg-bg"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  }

  const printOptions = [
    { key: "watermark", label: "Marca de agua", desc: 'Mostrar "BORRADOR"', on: showWatermark && !isEmitido, disabled: isEmitido },
    { key: "qr", label: "Incluir QR", desc: "Pie del documento", on: showQR },
    { key: "detalle", label: "Detalle de movimientos", desc: "Tabla completa", on: showDetalle },
    { key: "duplicate", label: "Copia duplicada", desc: "Original + duplicado", on: showDuplicate },
  ];
  function toggleOption(k: string) {
    if (k === "watermark") setShowWatermark((v) => !v);
    if (k === "qr") setShowQR((v) => !v);
    if (k === "detalle") setShowDetalle((v) => !v);
    if (k === "duplicate") setShowDuplicate((v) => !v);
  }

  const numero = reciboNumero ?? `${agency?.invoicePoint ?? "0001"} - próximo`;

  return (
    <DocumentPreviewShell
      topbar={
        <PreviewTopbar
          backHref={`/inquilinos/${tenantId}`}
          breadcrumb={{ name: tenantFullName, ref: numero }}
          isEmitido={isEmitido}
          zoom={zoom}
          onZoom={(d) => setZoom((z) => Math.min(1.5, Math.max(0.5, z + d)))}
          onPrint={() => emit("print")}
          onDownloadPdf={() => toast.info("Descarga de PDF próximamente")}
          onSendEmail={() => emit("email")}
          onConfirm={() => emit("confirm")}
          emailDisabled={!tenant?.email}
          busyAction={busyAction}
        />
      }
      paper={
        <Paper watermark={showWatermark && !isEmitido} zoom={zoom}>
          <PaperHeader
            agency={{
              name: agency?.legalName ?? agency?.tradeName ?? "Administradora",
              cuit: agency?.cuit ?? null,
              vatStatus: agency?.vatStatus ?? null,
              fiscalAddress: agency?.fiscalAddress ?? null,
              city: agency?.city ?? null,
              phone: agency?.phone ?? null,
              contactEmail: agency?.contactEmail ?? null,
              licenseNumber: agency?.licenseNumber ?? null,
              professionalAssociation: agency?.professionalAssociation ?? null,
              grossIncome: agency?.grossIncome ?? null,
              activityStart: agency?.activityStart ?? null,
              logoUrl: agency?.logoUrl ?? null,
            }}
            receiptType={agency?.receiptType ?? "RECIBO X"}
            numero={numero}
            fechaEmision={fmtDate(draft.fecha)}
          />
          <PaperMetaBlock
            leftLabel="Recibí de"
            leftValue={tenantFullName}
            leftSub={[
              tenant.dni ? `DNI ${tenant.dni}` : "",
              tenant.email ?? "",
            ].filter(Boolean)}
            rightLabel="Concepto"
            rightValue={items.length === 1 ? items[0].concepto : `${items.length} ítems`}
            rightSub={[fmtDate(draft.fecha)]}
          />
          {showDetalle && <PaperItemsTable items={items} />}
          <PaperTotals
            lines={[
              { label: "Subtotal recibo", value: totalRecibo },
              ...(honorariosPct > 0 ? [{ label: `Honorarios (${honorariosPct}%)`, value: -honorarios }] : []),
            ]}
            total={{ label: honorariosPct > 0 ? "Propietario recibe" : "Total recibo", value: propietarioRecibe }}
          />
          <PaperFooter
            bank={{
              nombre: agency?.bancoNombre ?? null,
              titular: agency?.bancoTitular ?? null,
              cbu: agency?.bancoCBU ?? null,
              alias: agency?.bancoAlias ?? null,
            }}
            signatory={{
              nombre: agency?.signatory ?? null,
              cargo: agency?.signatoryTitle ?? null,
              signatureUrl: agency?.signatureUrl ?? null,
            }}
            clauses={parseClauses(agency?.clauses)}
            showQR={showQR}
          />
        </Paper>
      }
      sidebar={
        <>
          <SideSummaryCard
            rows={[
              { label: "Inquilino", value: tenantFullName },
              { label: "Ítems", value: String(items.length), mono: true },
              { label: "Subtotal", value: `$ ${fmt(totalRecibo)}`, mono: true },
              ...(honorariosPct > 0 ? [{ label: "Honorarios", value: `− ${fmt(honorarios)}`, mono: true, cls: "text-error" }] : []),
            ]}
            total={{ label: honorariosPct > 0 ? "Propietario recibe" : "Total recibo", value: `$ ${fmt(propietarioRecibe)}`, mono: true, cls: "text-primary" }}
          />
          <SidePrintOptions options={printOptions} onToggle={toggleOption} />
          <SideRecipients name={tenantFullName} email={tenant.email ?? null} />
          <SideObservations value={observations} onChange={setObservations} disabled={isEmitido} />
        </>
      }
    />
  );
}

function parseClauses(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((c) => typeof c === "string" ? c : c.texto).filter(Boolean);
  } catch {
    return [raw];
  }
  return [];
}
```

- [ ] **Step 2: Smoke test (incompleto, sin disparador todavía)**

Run: `bun dev`
- Visitar manualmente `/inquilinos/<id>/cobro/preview` (sin draft) → debe mostrar el error "Falta el parámetro draft".
- Verifica que la ruta existe y no 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/inquilinos/[id]/cobro/preview/page.tsx
git commit -m "feat(inquilinos): cobro preview screen reading draft from localStorage"
```

---

### Task 3.3: Reemplazar el dialog "Confirmar recibo" por window.open a la preview

**Files:**
- Modify: `src/components/tenants/tenant-tab-current-account.tsx`

- [ ] **Step 1: Identificar el dialog actual y su trigger**

Buscar en el archivo (usar `grep "showEmit\|setShowEmit\|emitirMutation"`). Ubicar:
- `const [showEmit, setShowEmit] = useState(false);` (línea ~112)
- `const emitirMutation = useMutation({...})` (líneas ~138-183)
- El JSX `<Dialog open={showEmit} ...>` con el botón "Confirmar y emitir" interno
- El botón externo que dispara `setShowEmit(true)`

- [ ] **Step 2: Importar el helper de localStorage**

Al tope del archivo:

```ts
import { setWithTTL } from "@/lib/utils/local-storage-ttl";
```

- [ ] **Step 3: Reemplazar el handler que abre el dialog**

Encontrar el botón "Cobrar"/"Emitir" que hace `setShowEmit(true)`. Reemplazar su `onClick` por:

```ts
onClick={() => {
  if (selectedIds.size === 0) return;
  const draftId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  setWithTTL(`cobro-draft-${draftId}`, {
    ledgerEntryIds: [...selectedIds],
    montoOverrides,
    beneficiarioOverrides,
    honorariosPct: data?.splitMeta?.managementCommissionPct ?? honorariosPct,
    fecha: new Date().toISOString().slice(0, 10),
    idempotencyKey,
  }, 30 * 60 * 1000);
  window.open(`/inquilinos/${inquilinoId}/cobro/preview?draft=${draftId}`, "_blank", "noopener,noreferrer");
  setSelectedIds(new Set());
  setMontoOverrides({});
  setBeneficiarioOverrides({});
}}
```

- [ ] **Step 4: Eliminar el dialog y la mutación obsoleta**

- Borrar todo el `<Dialog open={showEmit} ...>` del JSX.
- Borrar `const [showEmit, setShowEmit] = useState(false);`.
- Borrar `const [observations, setObservations] = useState("");`.
- Borrar `const [emitError, setEmitError] = useState<string | null>(null);`.
- Borrar `const emitirMutation = useMutation({...})` entera (la mutación queda solo en la pantalla preview).
- Si quedaron imports sin usar (`Dialog`, `DialogContent`, etc.), removerlos.

- [ ] **Step 5: Verificar lint**

Run: `bun run lint`
Expected: PASS, sin warnings de imports no usados.

- [ ] **Step 6: Smoke test manual**

Run: `bun dev`
- Cuenta corriente de un inquilino.
- Seleccionar uno o más ítems.
- Click en Cobrar → debe abrir nueva tab con la pantalla preview, ya con los ítems.
- En la nueva tab: papel A4 con marca BORRADOR, sidebar con resumen.
- Click en Confirmar y emitir → debe llamar al endpoint emit, marcar Emitido, y `removeKey` de localStorage. Toast "Recibo X emitido".
- Volver a la tab original, refrescar cuenta corriente → ítems pagados deben aparecer como conciliados.

- [ ] **Step 7: Test de doble click (idempotencia end-to-end)**

- Repetir el flujo, pero apretar dos veces rápido "Confirmar y emitir".
- Verificar en DB: `SELECT count(*) FROM cash_movement WHERE idempotencyKey = '<la key>';` → debe haber UNA fila por movimiento normal del recibo, no dos juegos.

- [ ] **Step 8: Commit**

```bash
git add src/components/tenants/tenant-tab-current-account.tsx
git commit -m "feat(tenants): replace confirm dialog with full-page preview tab"
```

---

## PR4 — Liquidación propietario backend + wire

### Task 4.1: Endpoint `POST /api/owners/[id]/liquidacion/emit`

**Files:**
- Create: `src/app/api/owners/[id]/liquidacion/emit/route.ts`
- Test: `src/app/api/owners/[id]/liquidacion/emit/route.test.ts`

- [ ] **Step 1: Test del schema**

Crear `src/app/api/owners/[id]/liquidacion/emit/route.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { z } from "zod";

const liquidacionEmitSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  movimientoIds: z.array(z.string().min(1)).min(1),
  honorariosPct: z.number().min(0).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
});

describe("liquidacion emit schema", () => {
  test("payload mínimo válido", () => {
    const r = liquidacionEmitSchema.safeParse({
      periodo: "2026-04",
      movimientoIds: ["a", "b"],
      honorariosPct: 7,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(true);
  });
  test("rechaza periodo mal formado", () => {
    const r = liquidacionEmitSchema.safeParse({
      periodo: "abr-2026",
      movimientoIds: ["a"],
      honorariosPct: 7,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(false);
  });
  test("rechaza si no hay movimientos", () => {
    const r = liquidacionEmitSchema.safeParse({
      periodo: "2026-04",
      movimientoIds: [],
      honorariosPct: 7,
      fecha: "2026-04-30",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(false);
  });
});
```

Run: `bun test src/app/api/owners/[id]/liquidacion/emit/route.test.ts`
Expected: PASS (es self-contained).

- [ ] **Step 2: Implementar el route**

Crear `src/app/api/owners/[id]/liquidacion/emit/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { agency as agencyTable } from "@/db/schema/agency";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
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
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
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

    // Early return idempotente
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

    // Cargar movimientos y validar que pertenecen al propietario y no están liquidados
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

    // Calcular total
    const totalIngresos = movs.filter((m) => m.tipo === "income").reduce((s, m) => s + Number(m.amount), 0);
    const totalEgresos = movs.filter((m) => m.tipo === "expense").reduce((s, m) => s + Number(m.amount), 0);
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
    const propName = propRow ? [propRow.firstName, propRow.lastName].filter(Boolean).join(" ") : "Propietario";

    const txResult = await db.transaction(async (tx) => {
      const now = new Date();
      const settlementBatchId = crypto.randomUUID();

      // Incrementar el contador de número
      const [updatedAgency] = await tx
        .update(agencyTable)
        .set({ liquidacionUltimoNumero: (await tx.select({ n: agencyTable.liquidacionUltimoNumero }).from(agencyTable).where(eq(agencyTable.id, agencyId)).limit(1))[0].n + 1 })
        .where(eq(agencyTable.id, agencyId))
        .returning({ n: agencyTable.liquidacionUltimoNumero });
      const liquidacionNumero = `LIQ-${String(updatedAgency.n).padStart(8, "0")}`;

      // Marcar los movimientos como liquidados
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
      console.log(`[liquidacion/emit] Email solicitado para ${txResult.liquidacionNumero}`);
    }

    return NextResponse.json(txResult, { status: 201 });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST /api/owners/[id]/liquidacion/emit:", error);
    return NextResponse.json({ error: "Error al emitir la liquidación" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Lint check**

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 4: Verificación manual con curl**

Levantar dev (`bun dev`). Con un propietario que tenga movimientos del período en DB:

```bash
curl -X POST http://localhost:3000/api/owners/<propietarioId>/liquidacion/emit \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookie>" \
  -d '{"periodo":"2026-04","movimientoIds":["<id1>","<id2>"],"honorariosPct":7,"fecha":"2026-04-30","idempotencyKey":"123e4567-e89b-12d3-a456-426614174000"}'
```

Verificar:
- 201 con `{settlementBatchId, movimientoId, liquidacionNumero, totalTransferir}`.
- En DB: los `cajaMovimiento` originales tienen `settlementBatchId` seteado; hay un nuevo movimiento de `categoria='transferencia_propietario'`.
- Repetir mismo curl → debe devolver 200 con `deduplicated: true`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/owners/[id]/liquidacion/emit/
git commit -m "feat(api): POST /owners/[id]/liquidacion/emit with idempotency + batch settlement"
```

---

### Task 4.2: Conectar la pantalla de liquidación al endpoint nuevo

**Files:**
- Modify: `src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx`

- [ ] **Step 1: Reescribir `handleEmitir`**

En el archivo, reemplazar `handleEmitir` (la función que solo hacía `setIsEmitido(true)`) por:

```ts
const [busyAction, setBusyAction] = useState<"print" | "email" | "confirm" | null>(null);
const [liquidacionNumero, setLiquidacionNumero] = useState<string | null>(null);
const idempotencyKey = useMemo(() => crypto.randomUUID(), []); // estable por mount

async function emit(action: "print" | "email" | "confirm") {
  setBusyAction(action);
  try {
    const res = await fetch(`/api/owners/${id}/liquidacion/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodo,
        movimientoIds: movimientos.map((m) => m.id),
        honorariosPct: 7,
        fecha: today,
        observaciones: observations || undefined,
        idempotencyKey,
        action,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al emitir liquidación");
    }
    const result = await res.json();
    setIsEmitido(true);
    setShowWatermark(false);
    setLiquidacionNumero(result.liquidacionNumero);
    toast.success(`Liquidación ${result.liquidacionNumero} emitida`);
    if (action === "print") window.print();
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    setBusyAction(null);
  }
}
```

- [ ] **Step 2: Wire los botones del topbar a `emit`**

En el `<PreviewTopbar>`, cambiar:

```tsx
onPrint={() => emit("print")}
onSendEmail={() => emit("email")}
onConfirm={() => emit("confirm")}
busyAction={busyAction}
```

(`onDownloadPdf` queda con el toast "Próximamente" — no materializa.)

- [ ] **Step 3: Mostrar el número emitido en el header del paper**

En el `<PaperHeader>`, cambiar la prop `numero`:

```tsx
numero={liquidacionNumero ?? `LIQ-próximo`}
```

- [ ] **Step 4: Importar `useMemo`**

Si no estaba importado: `import { useState, useMemo } from "react";`

- [ ] **Step 5: Eliminar el `incrementarNumero` viejo**

El `handleEmitir` viejo hacía un PATCH a `/api/agency` con `incrementarNumero: true`. El nuevo endpoint ya incrementa el contador en transacción. Borrar esa llamada.

- [ ] **Step 6: Smoke test manual**

Run: `bun dev`
- Visitar `/propietarios/<id>/liquidacion?periodo=2026-04`.
- Click en "Confirmar y emitir" → toast con número, BORRADOR desaparece.
- Verificar en DB: `SELECT * FROM cash_movement WHERE settlementBatchId IS NOT NULL ORDER BY createdAt DESC LIMIT 10;`
- Recargar la página → debería seguir mostrando los movimientos pero ya con `settlementBatchId` (la pantalla no los excluye, los muestra históricamente).
- Repetir Confirmar (sin recargar) → no debe crear duplicados (mismo idempotencyKey por mount).
- Recargar y volver a Confirmar → nuevo idempotencyKey, pero el endpoint debe rechazar con 409 porque los movimientos ya tienen `settlementBatchId`.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/propietarios/[id]/liquidacion/page.tsx
git commit -m "feat(liquidacion): wire confirm/print/email to new emit endpoint"
```

---

## Verificación final

- [ ] **Build completo**

Run: `bun run build`
Expected: PASS sin warnings de tipos.

- [ ] **Lint completo**

Run: `bun run lint`
Expected: PASS.

- [ ] **Test suite**

Run: `bun test`
Expected: TODOS los tests verdes (los nuevos + los preexistentes).

- [ ] **Smoke test end-to-end manual**

1. Login. Ir a un inquilino con ledger entries pendientes.
2. Seleccionar 2 ítems, click Cobrar → nueva tab abre con preview.
3. Cambiar observaciones. Toggle "Marca de agua" off y on. Cambiar zoom.
4. Confirmar y emitir → recibo emitido, BORRADOR desaparece, pill verde.
5. Volver a tab original, refrescar → ítems aparecen como conciliados.
6. En la cuenta corriente del propietario asociado, generar liquidación del período.
7. Pantalla preview con todos los movimientos. Confirmar → nuevo movimiento de transferencia + batchId asignado.
8. Probar doble click en Confirmar (en ambas pantallas) → no se duplican movimientos.

---

## Notas de implementación

- **Tokens visuales**: las clases `bg-surface`, `bg-surface-mid`, `text-on-surface`, `border-border`, `border-border-soft`, `text-warning`, `text-success`, `text-error`, `text-primary` ya existen en el proyecto y mapean a la paleta oklch del handoff. NO crear tokens nuevos.

- **Logo agencia**: el handoff usa un `<div>` con gradiente y letra inicial. Como el usuario ya subió el logo (en `agency.logoUrl`), `PaperHeader` lo prefiere. Fallback al gradiente solo si no hay URL.

- **Print CSS**: el `Paper` componente incluye su propio `<style jsx global>` con `@media print` para ocultar la marca de agua al imprimir. La pantalla DocumentPreviewShell tiene `print:hidden` en topbar y sidebar.

- **Tabs vs popups**: la preview se abre con `window.open(_, '_blank')`. Si el navegador bloquea popups, el usuario verá un bloqueo nativo. No agregamos workaround porque es disparado por click directo (los popups directos no se bloquean).

- **No tocar el receipts/[id]/route.ts existente**: la pantalla de visualización de recibos emitidos sigue funcionando igual.
