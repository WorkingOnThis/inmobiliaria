# Comprobante de Liquidación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la página `/comprobantes/[id]` (HTML imprimible vía `@media print`) que muestra el comprobante de liquidación al propietario por cada recibo de cobro, con botón "Imprimir" y "Enviar por email" manual.

**Architecture:** Módulo paralelo a `/recibos`. Loader (`loadComprobanteData`) que junta los `tenantLedger` saldados por un `reciboNumero`, computa neto/comisión por ítem usando una función compartida extraída de la API de la CC del propietario, y resuelve al legal owner desde la propiedad. Página A4 con `@media print`. Email con plantilla HTML que manda link al comprobante.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM · Better Auth · Resend · Tailwind v4

---

## Mapa de archivos

| Archivo | Tipo | Qué hace |
|---|---|---|
| `src/lib/owners/commission.ts` | Create | Función `computeNetAndCommission` extraída de la API CC propietario para reuso |
| `src/app/api/owners/[id]/cuenta-corriente/route.ts` | Modify | Importa `computeNetAndCommission` desde la nueva ubicación (sin cambiar comportamiento) |
| `src/lib/comprobantes/load.ts` | Create | `loadComprobanteData(movimientoId, ownerId)` — devuelve `ComprobanteData` |
| `src/app/api/comprobantes/[id]/route.ts` | Create | GET handler que envuelve `loadComprobanteData` |
| `src/app/(dashboard)/comprobantes/[id]/page.tsx` | Create | Página A4 cliente con `@media print` |
| `src/lib/comprobantes/email-template.ts` | Create | `buildComprobanteEmailHTML(data)` — HTML del email |
| `src/app/api/comprobantes/[id]/send/route.ts` | Create | POST handler que manda mail con link al comprobante |
| `src/components/tenants/ledger-table.tsx` | Modify | Sumar ítem "Ver comprobante de liquidación" al `DropdownMenuContent` cuando aplica |
| `PENDIENTES.md` | Modify | Tachar item, sumar items diferidos |
| `HISTORIAL.md` | Modify | Registrar el feature completo |

---

## Task 1: Extraer `computeNetAndCommission` a `src/lib/owners/commission.ts`

**Files:**
- Create: `src/lib/owners/commission.ts`
- Modify: `src/app/api/owners/[id]/cuenta-corriente/route.ts`

- [ ] **Paso 1: Crear `src/lib/owners/commission.ts` con la función compartida**

Crear el archivo con este contenido exacto:

```ts
// src/lib/owners/commission.ts

export type SplitBreakdown = { propietario: number; administracion: number };

export type CommissionResult = {
  net: number;
  commission: number;
  effectivePct: number;
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeNetAndCommission(
  entry: {
    monto: string | null;
    splitBreakdown: string | null;
    incluirEnBaseComision: boolean;
  },
  contractCommissionPct: number
): CommissionResult {
  const grossNum = Number(entry.monto ?? 0);

  // Conciliated split: use stored breakdown
  if (entry.splitBreakdown) {
    try {
      const sb = JSON.parse(entry.splitBreakdown) as SplitBreakdown;
      const net = round2(sb.propietario);
      const commission = round2(sb.administracion);
      const effectivePct =
        grossNum > 0 ? round2((commission / grossNum) * 100) : contractCommissionPct;
      return { net, commission, effectivePct };
    } catch {
      // Fall through to default computation if JSON is malformed
    }
  }

  // No commission applies (descuentos, bonificaciones, punitorios sometimes)
  if (!entry.incluirEnBaseComision) {
    return { net: grossNum, commission: 0, effectivePct: 0 };
  }

  // Default: apply contract pct
  const commission = round2((grossNum * contractCommissionPct) / 100);
  const net = round2(grossNum - commission);
  return { net, commission, effectivePct: contractCommissionPct };
}
```

- [ ] **Paso 2: Modificar `src/app/api/owners/[id]/cuenta-corriente/route.ts` para importar desde la nueva ubicación**

Abrir `src/app/api/owners/[id]/cuenta-corriente/route.ts`. Cambiar la línea de imports (al inicio):

```ts
import { and, eq } from "drizzle-orm";
```

a:

```ts
import { and, eq } from "drizzle-orm";
import { computeNetAndCommission, round2 } from "@/lib/owners/commission";
```

Después, eliminar las definiciones locales de `SplitBreakdown`, `round2`, y `computeNetAndCommission` que están en el archivo (líneas ~11 a ~71 aprox., todo el bloque desde `type SplitBreakdown` hasta el cierre de la función `computeNetAndCommission`). Borrar exactamente:

```ts
type SplitBreakdown = { propietario: number; administracion: number };
```

(eliminar la línea — ya no se usa localmente)

```ts
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeNetAndCommission(
  entry: { monto: string | null; splitBreakdown: string | null; incluirEnBaseComision: boolean },
  contractCommissionPct: number
): { net: number; commission: number; effectivePct: number } {
  const grossNum = Number(entry.monto ?? 0);

  // Conciliated split: use stored breakdown
  if (entry.splitBreakdown) {
    try {
      const sb = JSON.parse(entry.splitBreakdown) as SplitBreakdown;
      const net = round2(sb.propietario);
      const commission = round2(sb.administracion);
      const effectivePct = grossNum > 0 ? round2((commission / grossNum) * 100) : contractCommissionPct;
      return { net, commission, effectivePct };
    } catch {
      // Fall through to default computation if JSON is malformed
    }
  }

  // No commission applies (descuentos, bonificaciones, punitorios sometimes)
  if (!entry.incluirEnBaseComision) {
    return { net: grossNum, commission: 0, effectivePct: 0 };
  }

  // Default: apply contract pct
  const commission = round2(grossNum * contractCommissionPct / 100);
  const net = round2(grossNum - commission);
  return { net, commission, effectivePct: contractCommissionPct };
}
```

(eliminar el bloque entero — ahora viene del nuevo archivo)

El resto del archivo no se modifica.

- [ ] **Paso 3: Verificar compilación**

```bash
bun run build
```

Esperado: el build pasa sin errores. Si hay error de import circular o de `round2`/`computeNetAndCommission` no encontrado, revisar Paso 2.

- [ ] **Paso 4: Verificar que la cuenta corriente del propietario sigue funcionando**

Iniciar dev server con `bun dev`. Abrir un propietario con cobros conciliados → tab "Cuenta corriente". ✓ Los KPIs y la tabla se ven idénticos a antes (filas sintéticas de honorarios incluidas).

- [ ] **Paso 5: Commit**

```bash
git add src/lib/owners/commission.ts src/app/api/owners/[id]/cuenta-corriente/route.ts
git commit -m "refactor(owners): extract computeNetAndCommission to shared lib"
```

---

## Task 2: Crear loader `loadComprobanteData`

**Files:**
- Create: `src/lib/comprobantes/load.ts`

- [ ] **Paso 1: Crear el archivo con el loader**

Crear `src/lib/comprobantes/load.ts` con este contenido exacto:

```ts
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { agency } from "@/db/schema/agency";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { and, eq, inArray, or } from "drizzle-orm";
import { computeNetAndCommission, round2 } from "@/lib/owners/commission";

export type ComprobanteData = {
  movimiento: {
    id: string;
    reciboNumero: string;
    date: string;
    period: string | null;
    amount: string;
    paymentModality: "A" | "split";
    anuladoAt: Date | null;
  };
  contrato: {
    contractNumber: string;
    paymentModality: "A" | "split";
    managementCommissionPct: number;
  };
  propiedad: {
    address: string;
    floorUnit: string | null;
  };
  inquilino: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
  } | null;
  propietario: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
    email: string | null;
    cbu: string | null;
    alias: string | null;
  };
  items: {
    id: string;
    descripcion: string;
    period: string | null;
    bruto: number;
    comisionPct: number;
    comision: number;
    neto: number;
  }[];
  totales: {
    bruto: number;
    comision: number;
    neto: number;
  };
  agency: {
    name: string;
    tradeName: string | null;
    legalName: string | null;
    cuit: string | null;
    vatStatus: string | null;
    logoUrl: string | null;
    fiscalAddress: string | null;
    city: string | null;
    phone: string | null;
    contactEmail: string | null;
    licenseNumber: string | null;
    signatory: string | null;
    signatoryTitle: string | null;
    signatureUrl: string | null;
    bancoCBU: string | null;
    bancoAlias: string | null;
    clauses: { id: string; texto: string }[];
  } | null;
};

export async function loadComprobanteData(
  movimientoId: string,
  agencyOwnerId: string
): Promise<ComprobanteData | null> {
  // 1. Get cash movement
  const [movimiento] = await db
    .select()
    .from(cajaMovimiento)
    .where(eq(cajaMovimiento.id, movimientoId))
    .limit(1);

  if (
    !movimiento ||
    !movimiento.reciboNumero ||
    !movimiento.propiedadId ||
    !movimiento.contratoId
  ) {
    return null;
  }

  // 2. Get all ledger entries saldadas por este recibo, joineadas con contract
  const allocations = await db
    .select({ ledgerEntryId: receiptAllocation.ledgerEntryId })
    .from(receiptAllocation)
    .where(eq(receiptAllocation.reciboNumero, movimiento.reciboNumero));

  const ledgerEntryIds = allocations.map((a) => a.ledgerEntryId);

  if (ledgerEntryIds.length === 0) return null;

  const ledgerRows = await db
    .select({
      entry: tenantLedger,
      managementCommissionPct: contract.managementCommissionPct,
    })
    .from(tenantLedger)
    .innerJoin(contract, eq(tenantLedger.contratoId, contract.id))
    .where(inArray(tenantLedger.id, ledgerEntryIds));

  // 3. Build items + totales
  const items: ComprobanteData["items"] = [];
  let brutoTotal = 0;
  let comisionTotal = 0;
  let netoTotal = 0;

  for (const { entry, managementCommissionPct } of ledgerRows) {
    const pct = Number(managementCommissionPct ?? 10);
    const { net, commission, effectivePct } = computeNetAndCommission(entry, pct);
    const bruto = Number(entry.monto ?? 0);

    items.push({
      id: entry.id,
      descripcion: entry.descripcion,
      period: entry.period,
      bruto,
      comisionPct: effectivePct,
      comision: commission,
      neto: net,
    });

    brutoTotal += bruto;
    comisionTotal += commission;
    netoTotal += net;
  }

  // 4. Resolve legal owner from property + property_co_owner
  const [propRow] = await db
    .select()
    .from(property)
    .where(eq(property.id, movimiento.propiedadId))
    .limit(1);

  if (!propRow) return null;

  const candidates: { clientId: string; createdAt: Date }[] = [];

  if (propRow.ownerRole === "legal" || propRow.ownerRole === "ambos") {
    candidates.push({ clientId: propRow.ownerId, createdAt: propRow.createdAt });
  }

  const coOwners = await db
    .select({ clientId: propertyCoOwner.clientId, createdAt: propertyCoOwner.createdAt })
    .from(propertyCoOwner)
    .where(
      and(
        eq(propertyCoOwner.propertyId, movimiento.propiedadId),
        or(eq(propertyCoOwner.role, "legal"), eq(propertyCoOwner.role, "ambos"))
      )
    );
  candidates.push(...coOwners);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const legalOwnerId = candidates[0].clientId;

  // 5. Get owner client data
  const [propietarioRow] = await db
    .select({
      firstName: client.firstName,
      lastName: client.lastName,
      dni: client.dni,
      email: client.email,
      cbu: client.cbu,
      alias: client.alias,
    })
    .from(client)
    .where(eq(client.id, legalOwnerId))
    .limit(1);

  if (!propietarioRow) return null;

  // 6. Get inquilino data (if linked)
  const [inqRow] = movimiento.inquilinoId
    ? await db
        .select({
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
        })
        .from(client)
        .where(eq(client.id, movimiento.inquilinoId))
        .limit(1)
    : [null];

  // 7. Get contrato data
  const [contratoRow] = await db
    .select({
      contractNumber: contract.contractNumber,
      paymentModality: contract.paymentModality,
      managementCommissionPct: contract.managementCommissionPct,
    })
    .from(contract)
    .where(eq(contract.id, movimiento.contratoId))
    .limit(1);

  if (!contratoRow) return null;

  // 8. Get agency
  const [agencyRow] = await db
    .select()
    .from(agency)
    .where(eq(agency.ownerId, agencyOwnerId))
    .limit(1);

  const agencyData: ComprobanteData["agency"] = agencyRow
    ? {
        name: agencyRow.name,
        tradeName: agencyRow.tradeName,
        legalName: agencyRow.legalName,
        cuit: agencyRow.cuit,
        vatStatus: agencyRow.vatStatus,
        logoUrl: agencyRow.logoUrl,
        fiscalAddress: agencyRow.fiscalAddress,
        city: agencyRow.city,
        phone: agencyRow.phone,
        contactEmail: agencyRow.contactEmail,
        licenseNumber: agencyRow.licenseNumber,
        signatory: agencyRow.signatory,
        signatoryTitle: agencyRow.signatoryTitle,
        signatureUrl: agencyRow.signatureUrl,
        bancoCBU: agencyRow.bancoCBU,
        bancoAlias: agencyRow.bancoAlias,
        clauses: (() => {
          try {
            const p = JSON.parse(agencyRow.clauses ?? "[]");
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })(),
      }
    : null;

  return {
    movimiento: {
      id: movimiento.id,
      reciboNumero: movimiento.reciboNumero,
      date: movimiento.date,
      period: movimiento.period,
      amount: movimiento.amount,
      paymentModality: (movimiento.paymentModality ?? contratoRow.paymentModality) as
        | "A"
        | "split",
      anuladoAt: movimiento.anuladoAt,
    },
    contrato: {
      contractNumber: contratoRow.contractNumber,
      paymentModality: contratoRow.paymentModality as "A" | "split",
      managementCommissionPct: Number(contratoRow.managementCommissionPct ?? 10),
    },
    propiedad: {
      address: propRow.address,
      floorUnit: propRow.floorUnit,
    },
    inquilino: inqRow ?? null,
    propietario: propietarioRow,
    items,
    totales: {
      bruto: round2(brutoTotal),
      comision: round2(comisionTotal),
      neto: round2(netoTotal),
    },
    agency: agencyData,
  };
}
```

- [ ] **Paso 2: Verificar compilación**

```bash
bun run build
```

Esperado: build pasa. Si hay error de tipos en `propietario` o `inquilino`, revisar el shape devuelto vs el `type ComprobanteData`.

- [ ] **Paso 3: Commit**

```bash
git add src/lib/comprobantes/load.ts
git commit -m "feat(comprobantes): add loadComprobanteData loader"
```

---

## Task 3: Crear API GET `/api/comprobantes/[id]`

**Files:**
- Create: `src/app/api/comprobantes/[id]/route.ts`

- [ ] **Paso 1: Crear el route handler**

Crear `src/app/api/comprobantes/[id]/route.ts` con este contenido:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadComprobanteData } from "@/lib/comprobantes/load";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const data = await loadComprobanteData(id, session.user.id);

    if (!data) {
      return NextResponse.json(
        { error: "Comprobante no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET /api/comprobantes/:id:", error);
    return NextResponse.json(
      { error: "Error al obtener el comprobante" },
      { status: 500 }
    );
  }
}
```

- [ ] **Paso 2: Verificar el endpoint manualmente**

Iniciar `bun dev`. En el browser, abrir DevTools → Console. Buscar en la base un `cash_movement.id` cuyo `reciboNumero` no sea null (puede ser cualquier recibo emitido). Ejecutar:

```js
fetch('/api/comprobantes/<id>').then(r => r.json()).then(console.log)
```

Esperado: respuesta JSON con `movimiento`, `contrato`, `propiedad`, `inquilino`, `propietario`, `items[]`, `totales`, `agency`. Si responde 404, verificar que el movimiento tenga `reciboNumero`, `propiedadId`, `contratoId` y que la propiedad tenga al menos un legal owner (`property.ownerRole IN ("legal","ambos")` o `property_co_owner` con esos roles).

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/comprobantes/[id]/route.ts
git commit -m "feat(api): add GET /api/comprobantes/:id"
```

---

## Task 4: Crear página `/comprobantes/[id]/page.tsx`

**Files:**
- Create: `src/app/(dashboard)/comprobantes/[id]/page.tsx`

- [ ] **Paso 1: Crear la página completa**

Crear `src/app/(dashboard)/comprobantes/[id]/page.tsx` con este contenido:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Printer, ArrowLeft, Mail, Check } from "lucide-react";
import type { ComprobanteData } from "@/lib/comprobantes/load";
import {
  formatMonto,
  formatFecha,
  formatPeriodo,
  montoEnLetras,
  agencyDisplayName,
} from "@/lib/receipts/format";

const PALETTE = {
  bg: "#f7f5ef",
  text: "#1a1614",
  muted: "#5a514c",
  border: "#d9d1c3",
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export default function ComprobantePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: string[] } | null>(
    null
  );

  const { data, isLoading, error } = useQuery<ComprobanteData>({
    queryKey: ["comprobante", id],
    queryFn: async () => {
      const res = await fetch(`/api/comprobantes/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el comprobante");
      }
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!data?.propietario.email) throw new Error("Sin email del propietario");
      const res = await fetch(`/api/comprobantes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: [data.propietario.email] }),
      });
      if (!res.ok) {
        let errorMsg = "Error al enviar";
        try {
          const d = await res.json();
          errorMsg = d.error ?? errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      return res.json() as Promise<{ sent: number; failed: string[] }>;
    },
    onSuccess: (result) => setSendResult(result),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="text-[0.85rem]">
          {(error as Error)?.message ?? "Comprobante no encontrado"}
        </div>
        <button
          onClick={() => router.back()}
          className="text-[0.72rem] text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Volver
        </button>
      </div>
    );
  }

  const { movimiento, contrato, propiedad, inquilino, propietario, items, totales, agency } =
    data;

  const isSplit = movimiento.paymentModality === "split";
  const tituloDoc = isSplit
    ? "CONSTANCIA DE COBRO DISTRIBUIDO"
    : "COMPROBANTE DE LIQUIDACIÓN";
  const textoIntro = isSplit
    ? "Dejamos constancia de que el inquilino transfirió directamente los siguientes conceptos conforme al desglose adjunto, correspondientes al contrato indicado."
    : "Comprobamos haber percibido del inquilino los siguientes conceptos correspondientes al contrato indicado, y procedido a su liquidación según el detalle adjunto.";

  const agencyName = agencyDisplayName(agency);
  const agencyInitial = (agencyName[0] ?? "A").toUpperCase();
  const cityLine = [agency?.fiscalAddress, agency?.city].filter(Boolean).join(", ");
  const contactLine = [
    agency?.phone ? `Tel. ${agency.phone}` : null,
    agency?.contactEmail,
  ]
    .filter(Boolean)
    .join(" · ");

  const nombrePropietario = [propietario.firstName, propietario.lastName]
    .filter(Boolean)
    .join(" ");
  const nombreInquilino = inquilino
    ? [inquilino.firstName, inquilino.lastName].filter(Boolean).join(" ")
    : null;

  const periodoLabel = movimiento.period ? formatPeriodo(movimiento.period) : null;
  const direccionPropiedad = `${propiedad.address}${
    propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""
  }`;

  const signatoryName = agency?.signatory;
  const signatoryTitle = agency?.signatoryTitle || "Administrador";

  const isAnulado = movimiento.anuladoAt !== null;
  const propietarioEmail = propietario.email;

  return (
    <div className="min-h-screen bg-bg print:bg-white relative">
      {/* Top action bar — print:hidden */}
      <div className="print:hidden h-14 bg-surface border-b border-border flex items-center justify-between px-7">
        <button
          onClick={() => router.back()}
          className="text-[0.8rem] text-text-secondary hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft size={13} /> Volver
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSendResult(null);
              setShowEmailDialog(true);
            }}
            disabled={!propietarioEmail}
            title={
              !propietarioEmail
                ? "El propietario no tiene email cargado"
                : `Enviar a ${propietarioEmail}`
            }
            className="flex items-center gap-2 text-[0.8rem] font-semibold px-4 py-2 rounded-[8px] transition-colors border border-border hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Mail size={14} /> Enviar por email
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-primary text-white text-[0.8rem] font-semibold px-4 py-2 rounded-[8px] hover:bg-primary/90 transition-colors"
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      {/* Email dialog */}
      {showEmailDialog && propietarioEmail && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-[12px] shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.95rem] font-semibold text-on-bg">
                Enviar comprobante por email
              </h3>
              <button
                onClick={() => setShowEmailDialog(false)}
                className="text-muted-foreground hover:text-on-bg"
              >
                ✕
              </button>
            </div>

            {sendResult ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="size-10 rounded-full bg-income-dim flex items-center justify-center">
                  <Check size={20} className="text-income" />
                </div>
                <p className="text-[0.9rem] font-semibold text-on-bg">
                  {sendResult.sent === 1
                    ? "Comprobante enviado"
                    : `${sendResult.sent} comprobantes enviados`}
                </p>
                {sendResult.failed.length > 0 && (
                  <p className="text-[0.78rem] text-destructive">
                    No se pudo enviar a: {sendResult.failed.join(", ")}
                  </p>
                )}
                <button
                  onClick={() => setShowEmailDialog(false)}
                  className="mt-1 text-[0.8rem] text-primary hover:underline"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <p className="text-[0.78rem] text-muted-foreground">
                  Se enviará el comprobante con un link al propietario:
                </p>
                <div className="text-[0.85rem] text-on-bg border border-border rounded-[6px] px-3 py-2 bg-muted/20">
                  {propietarioEmail}
                </div>
                {sendMutation.isError && (
                  <p className="text-[0.75rem] text-destructive">
                    {(sendMutation.error as Error).message}
                  </p>
                )}
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    onClick={() => setShowEmailDialog(false)}
                    className="text-[0.8rem] px-3 py-1.5 border border-border rounded-[6px] text-text-secondary hover:bg-muted/30"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending}
                    className="flex items-center gap-1.5 text-[0.8rem] font-semibold px-4 py-1.5 rounded-[6px] bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Mail size={13} />
                    {sendMutation.isPending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Comprobante — A4 centered */}
      <div className="mx-auto max-w-[760px] p-8 print:p-0 print:max-w-none">
        <div
          style={{
            background: PALETTE.bg,
            color: PALETTE.text,
            fontFamily: "Inter, -apple-system, sans-serif",
            padding: "44px 48px",
            borderRadius: "8px",
            fontSize: "13px",
            lineHeight: 1.5,
            position: "relative",
          }}
          className="print:rounded-none print:shadow-none print:!bg-white shadow-[0_8px_24px_rgba(0,0,0,.3)]"
        >
          {/* ANULADO stamp */}
          {isAnulado && (
            <div
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-25deg)",
                fontSize: "72px",
                fontWeight: 800,
                color: "rgba(220, 38, 38, 0.3)",
                border: "6px solid rgba(220, 38, 38, 0.3)",
                padding: "12px 36px",
                borderRadius: "8px",
                letterSpacing: ".1em",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              ANULADO
            </div>
          )}

          {/* Header */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              alignItems: "flex-start",
              paddingBottom: "18px",
              borderBottom: `1.5px solid ${PALETTE.text}`,
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "12px",
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                ...(agency?.logoUrl
                  ? {}
                  : {
                      background: "linear-gradient(135deg, #e85a3c, #c03c1f)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "26px",
                    }),
              }}
            >
              {agency?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agency.logoUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                agencyInitial
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-.01em" }}>
                {agencyName}
              </div>
              {(agency?.cuit || agency?.vatStatus) && (
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>
                  {agency?.cuit ? `CUIT ${agency.cuit}` : ""}
                  {agency?.cuit && agency?.vatStatus ? " · " : ""}
                  {agency?.vatStatus || ""}
                </div>
              )}
              {cityLine && (
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>{cityLine}</div>
              )}
              {contactLine && (
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>{contactLine}</div>
              )}
            </div>
            <div style={{ textAlign: "right", fontFamily: PALETTE.mono }}>
              <div
                style={{
                  fontSize: "11px",
                  color: PALETTE.muted,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                }}
              >
                {tituloDoc}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>
                {movimiento.reciboNumero}
              </div>
              {agency?.licenseNumber && (
                <div
                  style={{ fontSize: "11px", color: PALETTE.muted, marginTop: "4px" }}
                >
                  Mat. {agency.licenseNumber}
                </div>
              )}
            </div>
          </div>

          {/* Identificación */}
          <div style={{ marginTop: "22px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginBottom: "4px",
                  }}
                >
                  Liquidado a
                </div>
                <div style={{ fontSize: "15px", fontWeight: 500 }}>
                  {nombrePropietario}
                </div>
                {propietario.dni && (
                  <div style={{ fontSize: "12px", color: PALETTE.muted }}>
                    DNI {propietario.dni}
                  </div>
                )}
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>
                  {direccionPropiedad}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginBottom: "4px",
                  }}
                >
                  Fecha
                </div>
                <div style={{ fontSize: "15px", fontWeight: 500 }}>
                  {formatFecha(movimiento.date)}
                </div>
                {periodoLabel && (
                  <>
                    <div
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        color: PALETTE.muted,
                        marginTop: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      Período
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 500 }}>
                      {periodoLabel}
                    </div>
                  </>
                )}
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginTop: "8px",
                    marginBottom: "4px",
                  }}
                >
                  Contrato
                </div>
                <div style={{ fontSize: "13px", fontFamily: PALETTE.mono }}>
                  {contrato.contractNumber}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginTop: "8px",
                    marginBottom: "4px",
                  }}
                >
                  Modalidad
                </div>
                <div style={{ fontSize: "13px" }}>
                  {isSplit ? "Pago dividido" : "Cobro por administradora"}
                </div>
              </div>
            </div>

            {/* Inquilino tagline */}
            {nombreInquilino && (
              <div
                style={{
                  fontSize: "12px",
                  color: PALETTE.muted,
                  paddingBottom: "14px",
                  borderBottom: `1px dashed ${PALETTE.border}`,
                }}
              >
                Inquilino: <strong style={{ color: PALETTE.text }}>{nombreInquilino}</strong>
                {inquilino?.dni && ` · DNI ${inquilino.dni}`}
              </div>
            )}

            {/* Texto introductorio */}
            <div style={{ marginTop: "16px", fontSize: "12.5px", lineHeight: 1.6 }}>
              {textoIntro}
            </div>

            {/* Tabla detalle */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12.5px",
                marginTop: "16px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Concepto
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Bruto
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                      width: "50px",
                    }}
                  >
                    %
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Honorarios
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Neto
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        fontFamily: PALETTE.mono,
                      }}
                    >
                      {it.descripcion}
                      {it.period && (
                        <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>
                          · {formatPeriodo(it.period)}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                      }}
                    >
                      {formatMonto(it.bruto)}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                        color: PALETTE.muted,
                      }}
                    >
                      {it.comisionPct > 0 ? `${it.comisionPct}%` : "—"}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                        color: PALETTE.muted,
                      }}
                    >
                      {it.comision > 0 ? formatMonto(it.comision) : "—"}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                      }}
                    >
                      {formatMonto(it.neto)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    style={{
                      padding: "10px 6px",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Totales
                  </td>
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontFamily: PALETTE.mono,
                      fontWeight: 600,
                    }}
                  >
                    {formatMonto(totales.bruto)}
                  </td>
                  <td />
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontFamily: PALETTE.mono,
                      fontWeight: 600,
                      color: PALETTE.muted,
                    }}
                  >
                    {totales.comision > 0 ? formatMonto(totales.comision) : "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontFamily: PALETTE.mono,
                      fontWeight: 600,
                    }}
                  >
                    {formatMonto(totales.neto)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total destacado */}
            <div
              style={{
                marginTop: "16px",
                textAlign: "right",
                fontSize: "15px",
                fontWeight: 700,
                paddingTop: "10px",
                borderTop: `1.5px solid ${PALETTE.text}`,
                fontFamily: PALETTE.mono,
              }}
            >
              Neto al propietario: {formatMonto(totales.neto)}
            </div>
            <div
              style={{
                textAlign: "right",
                marginTop: "4px",
                fontSize: "11px",
                fontStyle: "italic",
                color: PALETTE.muted,
              }}
            >
              Son: {montoEnLetras(totales.neto)}
            </div>

            {/* Distribución según modalidad */}
            <div
              style={{
                marginTop: "20px",
                paddingTop: "12px",
                borderTop: `1px solid ${PALETTE.border}`,
                fontSize: "12px",
              }}
            >
              {isSplit ? (
                <>
                  <div
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      marginBottom: "6px",
                    }}
                  >
                    Distribución del cobro
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Propietario:</strong> {formatMonto(totales.neto)}
                    {(propietario.cbu || propietario.alias) && (
                      <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>
                        →{propietario.cbu ? ` CBU ${propietario.cbu}` : ""}
                        {propietario.cbu && propietario.alias ? " · " : " "}
                        {propietario.alias ? `Alias ${propietario.alias}` : ""}
                      </span>
                    )}
                  </div>
                  {totales.comision > 0 && (
                    <div>
                      <strong>Administración:</strong> {formatMonto(totales.comision)}
                      {(agency?.bancoCBU || agency?.bancoAlias) && (
                        <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>
                          →{agency?.bancoCBU ? ` CBU ${agency.bancoCBU}` : ""}
                          {agency?.bancoCBU && agency?.bancoAlias ? " · " : " "}
                          {agency?.bancoAlias ? `Alias ${agency.bancoAlias}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                (propietario.cbu || propietario.alias) && (
                  <div style={{ color: PALETTE.muted }}>
                    Neto transferido a
                    {propietario.cbu ? ` CBU ${propietario.cbu}` : ""}
                    {propietario.cbu && propietario.alias ? " · " : " "}
                    {propietario.alias ? `Alias ${propietario.alias}` : ""}
                  </div>
                )
              )}
            </div>

            {/* Cláusulas */}
            {agency?.clauses && agency.clauses.length > 0 && (
              <div
                style={{
                  marginTop: "20px",
                  fontSize: "11px",
                  color: PALETTE.muted,
                  borderTop: `1px solid ${PALETTE.border}`,
                  paddingTop: "12px",
                }}
              >
                <ol style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.6 }}>
                  {agency.clauses.map((c) => (
                    <li key={c.id} style={{ marginBottom: "4px" }}>
                      {c.texto}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Firma */}
            <div
              style={{
                marginTop: "44px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <div style={{ width: "220px", textAlign: "center" }}>
                {agency?.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agency.signatureUrl}
                    alt="Firma"
                    style={{
                      height: "50px",
                      objectFit: "contain",
                      margin: "0 auto 6px",
                    }}
                  />
                ) : signatoryName ? (
                  <div
                    style={{
                      fontFamily: '"Brush Script MT", cursive',
                      fontSize: "22px",
                      transform: "rotate(-3deg)",
                      marginBottom: "6px",
                    }}
                  >
                    {signatoryName}
                  </div>
                ) : null}
                <div
                  style={{
                    borderTop: `1px solid ${PALETTE.text}`,
                    paddingTop: "6px",
                    fontSize: "11px",
                    color: PALETTE.muted,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  {signatoryName
                    ? `${signatoryName} · ${signatoryTitle}`
                    : `${agencyName} · ${signatoryTitle}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar visualmente**

Iniciar `bun dev`. Buscar en la base un `cash_movement.id` con `reciboNumero` no nulo. En el browser, ir a `/comprobantes/<id>`.

Verificar:
- ✓ Se ve el header con logo, nombre de la administradora, CUIT
- ✓ Esquina superior derecha: tipo de documento (`COMPROBANTE DE LIQUIDACIÓN` o `CONSTANCIA DE COBRO DISTRIBUIDO` según modalidad), nº recibo
- ✓ Bloque "Liquidado a": nombre del propietario legal, DNI, dirección
- ✓ Bloque derecho: fecha, período, contrato, modalidad
- ✓ Línea aclaratoria del inquilino con DNI
- ✓ Texto introductorio aparece
- ✓ Tabla con columnas: Concepto / Bruto / % / Honorarios / Neto
- ✓ Fila de totales abajo
- ✓ "Neto al propietario: $X" destacado + "Son: ..." en letras
- ✓ Bloque de distribución según modalidad
- ✓ Firma de la administradora
- ✓ Si `cash_movement.anuladoAt` no es null → sello "ANULADO" diagonal

`Ctrl+P` → preview muestra solo el comprobante (sin barra superior).

- [ ] **Paso 3: Commit**

```bash
git add src/app/(dashboard)/comprobantes/[id]/page.tsx
git commit -m "feat(comprobantes): add /comprobantes/[id] page with @media print"
```

---

## Task 5: Crear plantilla HTML de email

**Files:**
- Create: `src/lib/comprobantes/email-template.ts`

- [ ] **Paso 1: Crear el archivo de plantilla**

Crear `src/lib/comprobantes/email-template.ts` con este contenido:

```ts
import type { ComprobanteData } from "./load";
import { formatMonto, formatFecha, formatPeriodo, agencyDisplayName } from "@/lib/receipts/format";

export function buildComprobanteEmailHTML(data: ComprobanteData, baseUrl: string): string {
  const { movimiento, contrato, propiedad, propietario, totales, agency } = data;

  const isSplit = movimiento.paymentModality === "split";
  const tituloDoc = isSplit
    ? "Constancia de cobro distribuido"
    : "Comprobante de liquidación";

  const agencyName = agencyDisplayName(agency);
  const nombrePropietario = [propietario.firstName, propietario.lastName]
    .filter(Boolean)
    .join(" ");
  const periodoLabel = movimiento.period ? formatPeriodo(movimiento.period) : "";
  const direccion = `${propiedad.address}${propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""}`;

  const link = `${baseUrl}/comprobantes/${movimiento.id}`;

  const BG = "#f7f5ef";
  const TEXT = "#1a1614";
  const MUTED = "#5a514c";
  const BORDER = "#d9d1c3";
  const SANS = "Arial, Helvetica, sans-serif";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${tituloDoc} ${movimiento.reciboNumero}</title></head>
<body style="margin:0;padding:0;background:#1a1614;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1614;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:${BG};border-radius:8px;overflow:hidden;font-family:${SANS};color:${TEXT};">

  <tr>
    <td style="padding:32px 40px 16px;border-bottom:2px solid ${TEXT};">
      <div style="font-size:20px;font-weight:700;letter-spacing:-.01em;">${agencyName}</div>
      <div style="font-size:13px;color:${MUTED};margin-top:4px;text-transform:uppercase;letter-spacing:.05em;">
        ${tituloDoc}
      </div>
      <div style="font-size:14px;font-family:Courier New,monospace;margin-top:2px;">
        ${movimiento.reciboNumero}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 40px 8px;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px;">Hola ${nombrePropietario},</p>
      <p style="margin:0 0 12px;">
        Te enviamos el ${tituloDoc.toLowerCase()} correspondiente al
        contrato <strong>${contrato.contractNumber}</strong> sobre la propiedad
        <strong>${direccion}</strong>${periodoLabel ? `, período <strong>${periodoLabel}</strong>` : ""}.
      </p>
      <p style="margin:0 0 12px;">
        <strong>Neto ${isSplit ? "recibido" : "liquidado"}:</strong> ${formatMonto(totales.neto)}<br>
        <span style="color:${MUTED};font-size:12px;">Fecha del cobro: ${formatFecha(movimiento.date)}</span>
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:8px 40px 32px;text-align:center;">
      <a href="${link}"
         style="display:inline-block;background:${TEXT};color:${BG};text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.02em;">
        Ver comprobante completo
      </a>
      <div style="margin-top:8px;font-size:11px;color:${MUTED};">
        ${link}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:16px 40px 32px;border-top:1px solid ${BORDER};font-size:11px;color:${MUTED};">
      Este mail fue enviado por ${agencyName}. Si tenés dudas, respondé directamente a este mensaje.
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
```

- [ ] **Paso 2: Verificar compilación**

```bash
bun run build
```

Esperado: pasa sin errores de TypeScript.

- [ ] **Paso 3: Commit**

```bash
git add src/lib/comprobantes/email-template.ts
git commit -m "feat(comprobantes): add email HTML template"
```

---

## Task 6: Crear API POST `/api/comprobantes/[id]/send`

**Files:**
- Create: `src/app/api/comprobantes/[id]/send/route.ts`

- [ ] **Paso 1: Crear el route handler**

Crear `src/app/api/comprobantes/[id]/send/route.ts` con este contenido:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadComprobanteData } from "@/lib/comprobantes/load";
import { buildComprobanteEmailHTML } from "@/lib/comprobantes/email-template";
import { agencyDisplayName } from "@/lib/receipts/format";
import { sendEmail } from "@/lib/auth/email";
import { z } from "zod";

const sendSchema = z.object({
  to: z.array(z.string().email()).min(1, "Seleccioná al menos un destinatario"),
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
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = await loadComprobanteData(id, session.user.id);
    if (!data) {
      return NextResponse.json(
        { error: "Comprobante no encontrado" },
        { status: 404 }
      );
    }

    const isSplit = data.movimiento.paymentModality === "split";
    const tituloDoc = isSplit ? "Constancia de cobro" : "Comprobante de liquidación";
    const agencyName = agencyDisplayName(data.agency);
    const subject = `${tituloDoc} ${data.movimiento.reciboNumero} — ${agencyName}`;

    const baseUrl =
      request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "";
    const html = buildComprobanteEmailHTML(data, baseUrl);

    const results = await Promise.allSettled(
      parsed.data.to.map((email) => sendEmail({ to: email, subject, html }))
    );

    const failed = parsed.data.to.filter(
      (_, i) => results[i].status === "rejected"
    );
    const sent = parsed.data.to.length - failed.length;

    if (sent === 0) {
      const reasons = results.map((r) =>
        r.status === "rejected" ? String(r.reason) : "ok"
      );
      console.error("Send failed for all recipients:", reasons);
      return NextResponse.json(
        { error: "No se pudo enviar el comprobante", failed },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("Error POST /api/comprobantes/:id/send:", error);
    return NextResponse.json(
      { error: "Error al enviar el comprobante" },
      { status: 500 }
    );
  }
}
```

- [ ] **Paso 2: Verificar manualmente el envío**

`bun dev`. Abrir `/comprobantes/<id>` para un movimiento con un propietario que tenga email. Click "Enviar por email" → click "Enviar".

Esperado:
- ✓ El modal cambia al estado de éxito ("Comprobante enviado")
- ✓ El email llega a la bandeja del propietario
- ✓ El email tiene asunto correcto y un botón "Ver comprobante completo" con link a `/comprobantes/[id]`

Si la API local de Resend está en modo sandbox y no tenés el dominio verificado, puede fallar — verificar el log del server. En ese caso, validar que la respuesta sea 500 con `failed` poblado y el modal muestre el mensaje de error.

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/comprobantes/[id]/send/route.ts
git commit -m "feat(api): add POST /api/comprobantes/:id/send"
```

---

## Task 7: Sumar ítem "Ver comprobante de liquidación" al menú de la CC propietario

**Files:**
- Modify: `src/app/api/owners/[id]/cuenta-corriente/route.ts`
- Modify: `src/components/tenants/ledger-table.tsx`

> **Contexto previo:** la ruta `/comprobantes/[id]` espera el `cash_movement.id`. La cuenta corriente del propietario hoy devuelve filas cuyo `id` es el `tenantLedger.id`. Hay que agregar un nuevo campo `cashMovementId` a las entries conciliadas para poder linkearlas correctamente.

- [ ] **Paso 1: Agregar campo `cashMovementId` al tipo `EnrichedEntry` y a la query de la API**

Abrir `src/app/api/owners/[id]/cuenta-corriente/route.ts`.

Cambiar los imports:

```ts
import { and, eq } from "drizzle-orm";
import { computeNetAndCommission, round2 } from "@/lib/owners/commission";
```

a:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { computeNetAndCommission, round2 } from "@/lib/owners/commission";
import { cajaMovimiento } from "@/db/schema/caja";
```

Agregar el campo `cashMovementId: string | null` al final del tipo `EnrichedEntry` (antes del `};` de cierre). El tipo queda así:

```ts
type EnrichedEntry = {
  id: string;
  contratoId: string;
  inquilinoId: string;
  propietarioId: string;
  propiedadId: string;
  period: string | null;
  dueDate: string | null;
  tipo: string;
  descripcion: string;
  monto: string | null;
  estado: string;
  installmentOf: string | null;
  reciboNumero: string | null;
  montoPagado: string | null;
  ultimoPagoAt: string | null;
  cancellationReason: string | null;
  isAutoGenerated: boolean;
  impactaPropietario: boolean;
  incluirEnBaseComision: boolean;
  impactaCaja: boolean;
  beneficiario: string | null;
  splitBreakdown: string | null;
  isSynthetic?: boolean;
  cashMovementId: string | null;
};
```

Localizar el final de la query `rawRows` (línea con `.orderBy(tenantLedger.period, tenantLedger.tipo);`). Inmediatamente después de esa línea, antes del bloque `// Build enriched entries`, agregar la query secundaria:

```ts
// Map ledgerEntryId → cashMovementId (only conciliated rows have one)
const conciliatedLedgerIds = rawRows
  .filter(({ entry }) => entry.estado === "conciliado" && entry.reciboNumero)
  .map(({ entry }) => entry.id);

const cashMovementMap = new Map<string, string>();
if (conciliatedLedgerIds.length > 0) {
  const cashRows = await db
    .select({ id: cajaMovimiento.id, ledgerEntryId: cajaMovimiento.ledgerEntryId })
    .from(cajaMovimiento)
    .where(inArray(cajaMovimiento.ledgerEntryId, conciliatedLedgerIds));
  for (const row of cashRows) {
    if (row.ledgerEntryId) cashMovementMap.set(row.ledgerEntryId, row.id);
  }
}
```

En el loop `for (const { entry, managementCommissionPct } of rawRows) {`, localizar la línea `ledgerEntries.push({ ...entry });` y reemplazarla por:

```ts
ledgerEntries.push({
  ...entry,
  cashMovementId: cashMovementMap.get(entry.id) ?? null,
});
```

En el mismo loop, localizar el bloque que construye la fila sintética (`ledgerEntries.push({ id: \`synthetic-honorarios-${entry.id}\`, ...`). Justo antes del cierre `});`, después de la línea `isSynthetic: true,`, agregar:

```ts
cashMovementId: null,
```

- [ ] **Paso 2: Agregar el campo al tipo `LedgerEntry` en `ledger-table.tsx`**

Abrir `src/components/tenants/ledger-table.tsx`. Localizar la definición del tipo (línea ~17):

```tsx
export type LedgerEntry = {
  id: string;
  // ...campos existentes...
  splitBreakdown: string | null;
  isSynthetic?: boolean;
};
```

Agregar la línea `cashMovementId?: string | null;` antes del `};` de cierre. Queda:

```tsx
export type LedgerEntry = {
  id: string;
  // ...campos existentes...
  splitBreakdown: string | null;
  isSynthetic?: boolean;
  cashMovementId?: string | null;
};
```

- [ ] **Paso 3: Agregar imports `FileText` y `useRouter`**

En el mismo `ledger-table.tsx`, cambiar:

```tsx
import { MoreHorizontal } from "lucide-react";
```

por:

```tsx
import { MoreHorizontal, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
```

- [ ] **Paso 4: Agregar `useRouter()` dentro del componente**

Localizar el inicio de la función `LedgerTable` (línea ~197). Después de la línea `const showDestino = isSplitContract || isOwnerView;` agregar:

```tsx
const router = useRouter();
```

- [ ] **Paso 5: Sumar el ítem al `DropdownMenuContent`**

Localizar el `<DropdownMenuContent align="end">` (alrededor de la línea 477). El bloque actual es:

```tsx
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={() => onViewDetail(entry)}>
    Ver detalle
  </DropdownMenuItem>
  {!isOwnerView && isPunitorio && entry.estado !== "conciliado" && (
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onCancelEntry(entry)}
    >
      Cancelar punitorio
    </DropdownMenuItem>
  )}
  {!isOwnerView && !isPunitorio && isCancelable(entry) && (
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onCancelEntry(entry)}
    >
      Cancelar movimiento
    </DropdownMenuItem>
  )}
  {!isOwnerView && entry.reciboNumero && ["conciliado", "pago_parcial"].includes(entry.estado) && (
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onAnularRecibo(entry.reciboNumero!)}
    >
      Anular recibo
    </DropdownMenuItem>
  )}
</DropdownMenuContent>
```

Reemplazarlo por:

```tsx
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={() => onViewDetail(entry)}>
    Ver detalle
  </DropdownMenuItem>
  {isOwnerView && entry.cashMovementId && entry.estado === "conciliado" && (
    <DropdownMenuItem onClick={() => router.push(`/comprobantes/${entry.cashMovementId}`)}>
      <FileText className="mr-2 size-4" />
      Ver comprobante de liquidación
    </DropdownMenuItem>
  )}
  {!isOwnerView && isPunitorio && entry.estado !== "conciliado" && (
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onCancelEntry(entry)}
    >
      Cancelar punitorio
    </DropdownMenuItem>
  )}
  {!isOwnerView && !isPunitorio && isCancelable(entry) && (
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onCancelEntry(entry)}
    >
      Cancelar movimiento
    </DropdownMenuItem>
  )}
  {!isOwnerView && entry.reciboNumero && ["conciliado", "pago_parcial"].includes(entry.estado) && (
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onAnularRecibo(entry.reciboNumero!)}
    >
      Anular recibo
    </DropdownMenuItem>
  )}
</DropdownMenuContent>
```

- [ ] **Paso 6: Verificar compilación**

```bash
bun run build
```

Esperado: pasa sin errores. Si hay error de tipo en `EnrichedEntry` (ej. fila sintética sin `cashMovementId`), revisar Paso 1.

- [ ] **Paso 7: Verificar manualmente**

`bun dev`. Abrir un propietario con cobros conciliados → tab "Cuenta corriente" → en una fila conciliada (estado "Pagado") clickear el menú `···`.

Verificar:
- ✓ Aparece "Ver comprobante de liquidación" debajo de "Ver detalle"
- ✓ Click en ese ítem → navega a `/comprobantes/<uuid>` y se ve el comprobante
- ✓ En filas pendientes/registradas → el ítem **no** aparece (porque no tienen `cashMovementId`)
- ✓ En filas sintéticas (honorarios en gris cursiva) → el menú `···` no aparece (igual que antes)

Verificar también la cuenta corriente del **inquilino**:
- ✓ Cuando `isOwnerView=false`, el ítem "Ver comprobante de liquidación" **no** aparece
- ✓ El menú sigue mostrando "Cancelar movimiento", "Anular recibo", etc., como antes

- [ ] **Paso 8: Commit**

```bash
git add src/components/tenants/ledger-table.tsx src/app/api/owners/[id]/cuenta-corriente/route.ts
git commit -m "feat(owner-cc): add 'Ver comprobante de liquidación' menu item"
```

---

## Task 8: Actualizar PENDIENTES.md y HISTORIAL.md

**Files:**
- Modify: `PENDIENTES.md`
- Modify: `HISTORIAL.md`

- [ ] **Paso 1: Tachar el ítem completado en PENDIENTES.md**

En `PENDIENTES.md`, localizar la línea (en 🟡 Prioridad media):

```
- [ ] **Comprobante de liquidación al propietario (PDF)** — al emitir un recibo, generar también un PDF que el propietario pueda guardar/imprimir con: bruto cobrado, % comisión, neto recibido, datos del contrato y propiedad. Página `/comprobantes/[id]`, link desde cada entry conciliado en la CC · [contabilidad](docs/decisions/contabilidad.md)
```

Cambiarla a:

```
- [x] **Comprobante de liquidación al propietario (PDF)** — al emitir un recibo, generar también un PDF que el propietario pueda guardar/imprimir con: bruto cobrado, % comisión, neto recibido, datos del contrato y propiedad. Página `/comprobantes/[id]`, link desde cada entry conciliado en la CC · [contabilidad](docs/decisions/contabilidad.md)
```

- [ ] **Paso 2: Sumar items diferidos a la sección 🟢 Prioridad baja**

En `PENDIENTES.md`, localizar la sección `## 🟢 Prioridad baja`. Agregar al final de esa sección, antes del separador `---`:

```
- [ ] **Resumen de liquidaciones del año (CC propietario)** — botón global arriba de la tabla de la CC del propietario que liste todos los comprobantes emitidos en un período (mes/año). Permite imprimir o exportar la serie completa. Diferido del MVP de comprobantes de liquidación · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Generación servidor de PDFs (puppeteer/react-pdf)** — evaluar reemplazo del enfoque `@media print` por generación PDF en servidor. Habilitaría adjuntar PDFs al email (recibos del inquilino + comprobantes del propietario) y generación masiva. Costo: dependencia nueva pesada (Chromium si puppeteer). Revisar cuando el flujo de envío por email se vuelva el principal · [contabilidad](docs/decisions/contabilidad.md)
```

- [ ] **Paso 3: Agregar entrada en HISTORIAL.md**

Abrir `HISTORIAL.md`. Agregar al inicio de la lista de completados (debajo del título de la sección más reciente):

```
- **2026-05-06** — Comprobante de liquidación al propietario: nueva página `/comprobantes/[id]` (HTML imprimible vía `@media print`) con título dinámico según modalidad (`COMPROBANTE DE LIQUIDACIÓN` para A, `CONSTANCIA DE COBRO DISTRIBUIDO` para split). Tabla con bruto/comisión/neto por concepto, totales, distribución de fondos y firma. Botón "Enviar por email" manda link al propietario. Acceso desde menú `···` de filas conciliadas en la CC del propietario. Refactor: `computeNetAndCommission` extraída a `src/lib/owners/commission.ts`.
```

- [ ] **Paso 4: Commit**

```bash
git add PENDIENTES.md HISTORIAL.md
git commit -m "chore: mark comprobante de liquidación as complete; defer global summary + server PDF"
```

---

## Verificación final (después de todas las tasks)

Ejecutar:

```bash
bun run build
bun run lint
```

Esperado: ambos pasan sin errores ni warnings nuevos.

**Validación manual end-to-end** (con `bun dev`):

### Modalidad A
1. Propietario con cobros modalidad A → CC → fila conciliada → menú `···` → "Ver comprobante de liquidación"
2. ✓ URL es `/comprobantes/<uuid>`
3. ✓ Título "COMPROBANTE DE LIQUIDACIÓN"
4. ✓ Texto introductorio "Comprobamos haber percibido..."
5. ✓ Tabla con bruto/%/honorarios/neto por concepto
6. ✓ "Neto al propietario: $X" + monto en letras
7. ✓ Pie: "Neto transferido a CBU XXX · Alias YYY" si el propietario tiene esos datos
8. ✓ Firma de la administradora
9. ✓ `Ctrl+P` → preview correcto

### Modalidad split
1. Propietario con cobros modalidad split → fila conciliada → menú `···` → "Ver comprobante de liquidación"
2. ✓ Título "CONSTANCIA DE COBRO DISTRIBUIDO"
3. ✓ Texto "Dejamos constancia de que el inquilino transfirió directamente..."
4. ✓ Pie: "Distribución del cobro: Propietario $X → CBU... · Administración $Y → CBU..."

### Edge cases
- ✓ Comisión 0% → columnas `%` y `Honorarios` con "—", neto = bruto
- ✓ Recibo anulado (movimiento.anuladoAt != null) → sello "ANULADO" diagonal visible en pantalla y en print
- ✓ URL inválida `/comprobantes/aaaa-bbbb` → "Comprobante no encontrado"
- ✓ Movimiento sin reciboNumero (cargo manual) → "Comprobante no encontrado"
- ✓ Propietario sin email → botón "Enviar por email" deshabilitado con tooltip "El propietario no tiene email cargado"
- ✓ Propietario sin CBU → bloque bancario omitido (modalidad A) o sin "→ CBU..." (modalidad split)

### Email
1. Click "Enviar por email" → modal con email del propietario
2. Click "Enviar" → ✓ "Comprobante enviado"
3. Bandeja del propietario → ✓ llega mail con link `/comprobantes/<uuid>`

### Regresión
- ✓ `/recibos/[id]` sigue funcionando idéntico
- ✓ CC propietario: KPIs, filtros, accordion sin cambios visibles
- ✓ CC inquilino: menú `···` sigue mostrando "Cancelar movimiento" y "Anular recibo", **no** muestra "Ver comprobante"
- ✓ Filas pendientes/futuras del propietario → menú `···` no muestra "Ver comprobante"
- ✓ Filas sintéticas (honorarios) → no muestran menú `···` ni opción de ver comprobante
