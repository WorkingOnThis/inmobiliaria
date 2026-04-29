# Contract Amendments (Instrumentos Post-Firma) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-signature amendment support to contracts — errata, modifications, extensions, consensual terminations, guarantee substitutions, and index changes — with immediate effect on cuenta corriente and optional formal document generation.

**Architecture:** Opción C — contract fields update in place on registration, `contract_amendment` stores a full snapshot of the contract before each change. A new "Instrumentos" tab in the contract detail page manages creation and lifecycle. Document generation produces a printable HTML page (no PDF library needed).

**Tech Stack:** Next.js 15 App Router · Drizzle ORM + PostgreSQL · TanStack Query · shadcn/ui · Zod · TypeScript

**Spec:** `docs/superpowers/specs/2026-04-29-contract-amendments-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/db/schema/contract-amendment.ts` | Create | Drizzle schema for `contract_amendment` table |
| `src/db/schema/index.ts` | Modify | Re-export new schema |
| `src/lib/contracts/amendments.ts` | Create | Types, allowed fields, field labels, validation helpers |
| `src/app/api/contracts/[id]/amendments/route.ts` | Create | GET list + POST create |
| `src/app/api/contracts/[id]/amendments/[aid]/route.ts` | Create | GET detail + PATCH status + DELETE |
| `src/app/api/contracts/[id]/amendments/[aid]/document/route.ts` | Create | GET — returns printable HTML for the instrument |
| `src/components/contracts/contract-tab-amendments.tsx` | Create | Amendments tab: list + status badges + actions |
| `src/components/contracts/amendment-create-modal.tsx` | Create | 2-step modal: type selector + data form |
| `src/components/contracts/contract-detail.tsx` | Modify | Add "Instrumentos" tab + visual indicators on modified fields in Operativo |

---

## Task 1: DB Schema

**Files:**
- Create: `src/db/schema/contract-amendment.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1.1 — Create the schema file**

`src/db/schema/contract-amendment.ts`:

```typescript
import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { user } from "./better-auth";
import { contract } from "./contract";

export const contractAmendment = pgTable("contract_amendment", {
  id:               text("id").primaryKey(),
  contractId:       text("contractId").notNull().references(() => contract.id, { onDelete: "restrict" }),
  type:             text("type").notNull(),
  sequenceNumber:   integer("sequenceNumber").notNull(),
  status:           text("status").notNull().default("registered"),
  title:            text("title").notNull(),
  description:      text("description"),
  fieldsChanged:    jsonb("fieldsChanged").notNull().$type<Record<string, { before: unknown; after: unknown }>>(),
  contractSnapshot: jsonb("contractSnapshot").notNull().$type<Record<string, unknown>>(),
  effectiveDate:    text("effectiveDate"),
  documentContent:  text("documentContent"),
  signedAt:         timestamp("signedAt"),
  createdBy:        text("createdBy").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt:        timestamp("createdAt").notNull().defaultNow(),
  updatedAt:        timestamp("updatedAt").notNull().defaultNow(),
});
```

Note: `documentContent` replaces `documentUrl` from the spec — stores the generated HTML directly in the DB. A route at `/api/contracts/[id]/amendments/[aid]/document` serves it. No external PDF library needed.

- [ ] **Step 1.2 — Re-export from index**

In `src/db/schema/index.ts`, add at the end:

```typescript
export * from "./contract-amendment";
```

- [ ] **Step 1.3 — Generate and run migration**

```bash
bun run db:generate
bun run db:migrate
```

Expected: migration file created in `drizzle/` and applied without errors.

- [ ] **Step 1.4 — Verify in Drizzle Studio**

```bash
bun run db:studio
```

Open the studio and confirm the `contract_amendment` table exists with all columns.

- [ ] **Step 1.5 — Commit**

```bash
git add src/db/schema/contract-amendment.ts src/db/schema/index.ts drizzle/
git commit -m "feat: add contract_amendment schema"
```

---

## Task 2: Business Logic Constants

**Files:**
- Create: `src/lib/contracts/amendments.ts`

- [ ] **Step 2.1 — Create the file**

`src/lib/contracts/amendments.ts`:

```typescript
export const AMENDMENT_TYPES = [
  "erratum",
  "modification",
  "extension",
  "termination",
  "guarantee_substitution",
  "index_change",
] as const;

export type AmendmentType = (typeof AMENDMENT_TYPES)[number];

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  erratum:                "Salvedad",
  modification:           "Acuerdo Modificatorio",
  extension:              "Prórroga",
  termination:            "Rescisión Consensuada",
  guarantee_substitution: "Sustitución de Garantía",
  index_change:           "Cambio de Índice",
};

export const AMENDMENT_TYPE_DESCRIPTIONS: Record<AmendmentType, string> = {
  erratum:                "Corregir un error de dato en el texto del contrato",
  modification:           "Cambiar una condición acordada por las partes",
  extension:              "Extender el plazo del contrato",
  termination:            "Acordar la terminación anticipada del contrato",
  guarantee_substitution: "Reemplazar un garante o garantía existente",
  index_change:           "Acordar un nuevo índice de ajuste",
};

export const AMENDMENT_STATUS_LABELS: Record<string, string> = {
  registered:         "Registrado",
  document_generated: "Documento generado",
  signed:             "Firmado",
};

// Which contract fields each type is allowed to change
export const ALLOWED_FIELDS: Record<AmendmentType, string[]> = {
  erratum:                ["contractType", "startDate", "endDate"],
  modification:           [
    "monthlyAmount", "graceDays", "electronicPaymentFeePct",
    "lateInterestPct", "paymentDay", "paymentModality", "managementCommissionPct",
  ],
  extension:              ["endDate", "monthlyAmount"],
  termination:            ["status"],
  guarantee_substitution: [],
  index_change:           ["adjustmentIndex", "adjustmentFrequency"],
};

// Human-readable Spanish labels for contract fields shown in the UI
export const FIELD_LABELS: Record<string, string> = {
  contractType:           "Tipo de contrato",
  startDate:              "Fecha de inicio",
  endDate:                "Fecha de fin",
  monthlyAmount:          "Canon mensual",
  graceDays:              "Días de gracia",
  electronicPaymentFeePct:"Comisión pago electrónico (%)",
  lateInterestPct:        "Interés por mora (%)",
  paymentDay:             "Día de pago",
  paymentModality:        "Modalidad de pago",
  managementCommissionPct:"Comisión de administración (%)",
  adjustmentIndex:        "Índice de ajuste",
  adjustmentFrequency:    "Frecuencia de ajuste (meses)",
  status:                 "Estado del contrato",
};

// Whether the type requires an effectiveDate
export const REQUIRES_EFFECTIVE_DATE: Record<AmendmentType, boolean> = {
  erratum:                false,
  modification:           true,
  extension:              true,
  termination:            true,
  guarantee_substitution: false,
  index_change:           true,
};

// Whether the type requires a description
export const REQUIRES_DESCRIPTION: Record<AmendmentType, boolean> = {
  erratum:                false,
  modification:           false,
  extension:              false,
  termination:            false,
  guarantee_substitution: true,
  index_change:           false,
};

// Valid status transitions
export const VALID_TRANSITIONS: Record<string, string[]> = {
  registered:         ["document_generated", "signed"],
  document_generated: ["signed"],
  signed:             [],
};

export type AmendmentListItem = {
  id: string;
  type: AmendmentType;
  sequenceNumber: number;
  typeSequenceNumber: number;
  status: string;
  title: string;
  description: string | null;
  fieldsChanged: Record<string, { before: unknown; after: unknown; label: string }>;
  effectiveDate: string | null;
  hasDocument: boolean;
  signedAt: string | null;
  createdAt: string;
};
```

- [ ] **Step 2.2 — Commit**

```bash
git add src/lib/contracts/amendments.ts
git commit -m "feat: add amendment types, labels, and validation constants"
```

---

## Task 3: API — GET List + POST Create

**Files:**
- Create: `src/app/api/contracts/[id]/amendments/route.ts`

- [ ] **Step 3.1 — Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, max, and, lt, sql } from "drizzle-orm";
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

    // Compute typeSequenceNumber in JS: for each row, count how many rows of the same type appeared before it
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
    if (!body.success) return NextResponse.json({ error: "Datos inválidos", details: body.error.flatten() }, { status: 400 });

    const { type, title, description, effectiveDate, fieldsChanged = {} } = body.data;
    const amendmentType = type as AmendmentType;

    // Validate effectiveDate requirement
    if (REQUIRES_EFFECTIVE_DATE[amendmentType] && !effectiveDate) {
      return NextResponse.json({ error: "effectiveDate es requerida para este tipo" }, { status: 400 });
    }

    // Validate description requirement
    if (REQUIRES_DESCRIPTION[amendmentType] && !description?.trim()) {
      return NextResponse.json({ error: "description es requerida para este tipo" }, { status: 400 });
    }

    // Validate fieldsChanged keys against whitelist
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

    // Execute in a transaction: snapshot → update contract → insert amendment
    const result = await db.transaction(async (tx) => {
      // 1. Read current contract state
      const [currentContract] = await tx
        .select()
        .from(contract)
        .where(eq(contract.id, contractId))
        .limit(1);

      if (!currentContract) throw new Error("Contrato no encontrado");

      // Validate termination only on active contracts
      if (type === "termination" && !["active", "expiring_soon"].includes(currentContract.status)) {
        throw new Error("Solo se puede rescindir un contrato activo");
      }

      // 2. Compute next sequenceNumber
      const [maxRow] = await tx
        .select({ maxSeq: max(contractAmendment.sequenceNumber) })
        .from(contractAmendment)
        .where(eq(contractAmendment.contractId, contractId));
      const sequenceNumber = (maxRow?.maxSeq ?? 0) + 1;

      // 3. Apply fieldsChanged to contract
      if (Object.keys(fieldsChanged).length > 0) {
        const contractUpdate: Record<string, unknown> = {};
        for (const [field, { after }] of Object.entries(fieldsChanged)) {
          contractUpdate[field] = after;
        }
        contractUpdate.updatedAt = new Date();
        await tx
          .update(contract)
          .set(contractUpdate)
          .where(eq(contract.id, contractId));
      }

      // 4. Insert amendment with snapshot
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
          fieldsChanged,
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
```

- [ ] **Step 3.2 — Manual test: GET (empty)**

Start the dev server (`bun dev`) and open:

```
GET http://localhost:3000/api/contracts/[valid-contract-id]/amendments
```

Expected response:
```json
{ "amendments": [] }
```

- [ ] **Step 3.3 — Manual test: POST create**

Using a tool like curl or the browser devtools, POST to the same URL:

```json
{
  "type": "modification",
  "title": "Aumento días de gracia",
  "effectiveDate": "2026-05-01",
  "fieldsChanged": {
    "graceDays": { "before": 3, "after": 7 }
  }
}
```

Expected: 201 with amendment object. Verify in Drizzle Studio (`bun run db:studio`) that:
1. `contract_amendment` has a new row with `status: "registered"`
2. The `contract` table has `graceDays = 7`
3. `contractSnapshot` contains the original `graceDays: 3`

- [ ] **Step 3.4 — Commit**

```bash
git add src/app/api/contracts/[id]/amendments/route.ts
git commit -m "feat: add amendments GET list and POST create API"
```

---

## Task 4: API — GET Detail + PATCH + DELETE

**Files:**
- Create: `src/app/api/contracts/[id]/amendments/[aid]/route.ts`

- [ ] **Step 4.1 — Create the route file**

`src/app/api/contracts/[id]/amendments/[aid]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { VALID_TRANSITIONS } from "@/lib/contracts/amendments";

const patchSchema = z.object({
  status: z.enum(["document_generated", "signed"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id: contractId, aid } = await params;

    const [row] = await db
      .select()
      .from(contractAmendment)
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.contractId, contractId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    return NextResponse.json({ amendment: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId, aid } = await params;
    const body = patchSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const { status: newStatus } = body.data;

    const [row] = await db
      .select()
      .from(contractAmendment)
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.contractId, contractId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    // Validate transition
    const validNext = VALID_TRANSITIONS[row.status] ?? [];
    if (!validNext.includes(newStatus)) {
      return NextResponse.json({
        error: `Transición inválida: ${row.status} → ${newStatus}`,
      }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };
    if (newStatus === "signed") update.signedAt = new Date();

    const [updated] = await db
      .update(contractAmendment)
      .set(update)
      .where(eq(contractAmendment.id, aid))
      .returning();

    return NextResponse.json({ amendment: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId, aid } = await params;

    const [row] = await db
      .select()
      .from(contractAmendment)
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.contractId, contractId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    if (row.status !== "registered") {
      return NextResponse.json({
        error: "Solo se pueden eliminar instrumentos en estado 'registrado' sin documento",
      }, { status: 409 });
    }

    if (row.documentContent) {
      return NextResponse.json({
        error: "El instrumento ya tiene un documento generado. No se puede eliminar.",
      }, { status: 409 });
    }

    // Revert contract to snapshot
    const snapshot = row.contractSnapshot as Record<string, unknown>;
    await db.transaction(async (tx) => {
      await tx
        .update(contract)
        .set({ ...snapshot, updatedAt: new Date() } as never)
        .where(eq(contract.id, contractId));

      await tx
        .delete(contractAmendment)
        .where(eq(contractAmendment.id, aid));
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 4.2 — Manual test: PATCH invalid transition**

PATCH the amendment created in Task 3 with `{ "status": "registered" }`.
Expected: 400 with `"Transición inválida"`.

- [ ] **Step 4.3 — Manual test: PATCH valid transition**

PATCH with `{ "status": "signed" }`.
Expected: 200, `signedAt` is set. Verify in Drizzle Studio.

- [ ] **Step 4.4 — Manual test: DELETE**

Create a fresh `modification` amendment, then DELETE it.
Expected: 200 `{ ok: true }`. Verify in Drizzle Studio that:
1. The amendment row is gone
2. `contract.graceDays` reverted to the original value in the snapshot

- [ ] **Step 4.5 — Commit**

```bash
git add src/app/api/contracts/[id]/amendments/[aid]/route.ts
git commit -m "feat: add amendments GET detail, PATCH status, DELETE with revert"
```

---

## Task 5: API — Document Generation

**Files:**
- Create: `src/app/api/contracts/[id]/amendments/[aid]/document/route.ts`

- [ ] **Step 5.1 — Create the document generation route**

`src/app/api/contracts/[id]/amendments/[aid]/document/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { client } from "@/db/schema/client";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import {
  AMENDMENT_TYPE_LABELS,
  FIELD_LABELS,
  type AmendmentType,
} from "@/lib/contracts/amendments";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (field === "monthlyAmount") return `$${Number(value).toLocaleString("es-AR")}`;
  if (field === "paymentModality") return value === "A" ? "Modalidad A (inmobiliaria)" : "Modalidad B (directo)";
  if (field === "startDate" || field === "endDate" || field === "effectiveDate") {
    const d = new Date(String(value) + "T00:00:00");
    return format(d, "dd/MM/yyyy", { locale: es });
  }
  return String(value);
}

function buildDocumentBody(
  type: AmendmentType,
  amendment: { description: string | null; effectiveDate: string | null; fieldsChanged: Record<string, { before: unknown; after: unknown }> }
): string {
  const fc = amendment.fieldsChanged;
  const efDate = amendment.effectiveDate
    ? format(new Date(amendment.effectiveDate + "T00:00:00"), "dd/MM/yyyy", { locale: es })
    : "";

  switch (type) {
    case "erratum": {
      const changedLines = Object.entries(fc)
        .map(([field, { before, after }]) =>
          `<p>En cuanto a <strong>${FIELD_LABELS[field] ?? field}</strong>:<br>
          Donde dice: <em>"${formatFieldValue(field, before)}"</em><br>
          Debe leerse: <em>"${formatFieldValue(field, after)}"</em></p>`
        ).join("");
      return `${changedLines}<p>Las demás cláusulas del contrato permanecen inalteradas.</p>`;
    }
    case "modification": {
      const changedLines = Object.entries(fc)
        .map(([field, { before, after }]) =>
          `<li><strong>${FIELD_LABELS[field] ?? field}:</strong> ${formatFieldValue(field, before)} → ${formatFieldValue(field, after)}</li>`
        ).join("");
      return `<p>Las partes acuerdan modificar las siguientes condiciones, con vigencia a partir del <strong>${efDate}</strong>:</p>
              <ul>${changedLines}</ul>
              <p>Las demás cláusulas permanecen inalteradas.</p>`;
    }
    case "extension": {
      const newEnd = fc["endDate"] ? formatFieldValue("endDate", fc["endDate"].after) : "—";
      const newAmount = fc["monthlyAmount"] ? `$${Number(fc["monthlyAmount"].after).toLocaleString("es-AR")}` : null;
      return `<p>Las partes acuerdan prorrogar el contrato hasta el <strong>${newEnd}</strong>${newAmount ? `, con un canon mensual de <strong>${newAmount}</strong>` : ""}, a partir del <strong>${efDate}</strong>.</p>
              <p>Las demás condiciones permanecen inalteradas.</p>`;
    }
    case "termination":
      return `<p>Las partes acuerdan dar por rescindido el contrato a partir del <strong>${efDate}</strong>, comprometiéndose la parte locataria a la entrega del inmueble en dicha fecha.</p>
              ${amendment.description ? `<p>${amendment.description}</p>` : ""}`;
    case "guarantee_substitution":
      return `<p>Las partes acuerdan sustituir la garantía original conforme lo siguiente:</p>
              <p>${amendment.description ?? ""}</p>`;
    case "index_change": {
      const oldIndex = formatFieldValue("adjustmentIndex", fc["adjustmentIndex"]?.before);
      const newIndex = formatFieldValue("adjustmentIndex", fc["adjustmentIndex"]?.after);
      return `<p>Las partes acuerdan reemplazar el índice de ajuste <strong>${oldIndex}</strong> por <strong>${newIndex}</strong>, con vigencia a partir del <strong>${efDate}</strong>.</p>`;
    }
    default:
      return `<p>${amendment.description ?? ""}</p>`;
  }
}

// POST: generate and save document content, transition to document_generated
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId, aid } = await params;

    const [amendment] = await db
      .select()
      .from(contractAmendment)
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.contractId, contractId)))
      .limit(1);

    if (!amendment) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    const [currentContract] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!currentContract) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });

    const [ownerData] = await db
      .select({ firstName: client.firstName, lastName: client.lastName, dni: client.dni })
      .from(client)
      .where(eq(client.id, currentContract.ownerId))
      .limit(1);

    const ownerName = ownerData ? `${ownerData.firstName} ${ownerData.lastName ?? ""}`.trim() : "—";
    const ownerDni = ownerData?.dni ?? "—";

    // Compute typeSequenceNumber
    const allOfSameType = await db
      .select({ seq: contractAmendment.sequenceNumber })
      .from(contractAmendment)
      .where(and(
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.type, amendment.type)
      ));
    const typeSeqNumber = allOfSameType.filter(r => r.seq <= amendment.sequenceNumber).length;

    const typeLabel = AMENDMENT_TYPE_LABELS[amendment.type as AmendmentType] ?? amendment.type;
    const body = buildDocumentBody(
      amendment.type as AmendmentType,
      {
        description: amendment.description,
        effectiveDate: amendment.effectiveDate,
        fieldsChanged: (amendment.fieldsChanged ?? {}) as Record<string, { before: unknown; after: unknown }>,
      }
    );

    const startFormatted = format(new Date(currentContract.startDate + "T00:00:00"), "dd/MM/yyyy", { locale: es });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${typeLabel} N°${typeSeqNumber} — ${currentContract.contractNumber}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #111; line-height: 1.6; }
    h1 { font-size: 1.1rem; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    .subtitle { text-align: center; font-size: 0.9rem; color: #555; margin-bottom: 2rem; }
    .parties { border: 1px solid #ddd; padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px; font-size: 0.9rem; }
    .parties p { margin: 0.25rem 0; }
    .body-text { margin-bottom: 2rem; font-size: 0.9rem; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 4rem; }
    .sig-block { border-top: 1px solid #111; padding-top: 0.5rem; font-size: 0.85rem; text-align: center; }
    .sig-block .name { font-weight: bold; margin-top: 0.25rem; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${typeLabel} N°${typeSeqNumber}</h1>
  <p class="subtitle">Contrato ${currentContract.contractNumber} · Celebrado el ${startFormatted}</p>

  <div class="parties">
    <p><strong>Parte Locadora:</strong> ${ownerName} · DNI ${ownerDni}</p>
    <p><strong>Administradora:</strong> Arce Administración</p>
  </div>

  <div class="body-text">
    ${body}
  </div>

  <p style="font-size:0.85rem;color:#555;">Lugar y fecha: _________________, ___ de _________ de _____</p>

  <div class="signatures">
    <div class="sig-block">
      <br><br><br>
      <div class="name">PARTE LOCADORA</div>
      <div>${ownerName}</div>
    </div>
    <div class="sig-block">
      <br><br><br>
      <div class="name">ARCE ADMINISTRACIÓN</div>
    </div>
  </div>
</body>
</html>`;

    await db
      .update(contractAmendment)
      .set({ documentContent: html, status: "document_generated", updatedAt: new Date() })
      .where(eq(contractAmendment.id, aid));

    return NextResponse.json({ ok: true, status: "document_generated" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET: serve the stored HTML document
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new NextResponse("No autenticado", { status: 401 });

    const { id: contractId, aid } = await params;

    const [amendment] = await db
      .select({ documentContent: contractAmendment.documentContent })
      .from(contractAmendment)
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.contractId, contractId)))
      .limit(1);

    if (!amendment?.documentContent) {
      return new NextResponse("Documento no generado", { status: 404 });
    }

    return new NextResponse(amendment.documentContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Error interno", { status: 500 });
  }
}
```

- [ ] **Step 5.2 — Manual test: generate document**

Using a registered amendment from Task 3, POST to:
```
POST /api/contracts/[id]/amendments/[aid]/document
```
Expected: 200 `{ ok: true, status: "document_generated" }`.

Then GET the same URL — it should return an HTML page in the browser. Verify it shows the correct parties, amendment type, and field changes.

- [ ] **Step 5.3 — Commit**

```bash
git add src/app/api/contracts/[id]/amendments/[aid]/document/route.ts
git commit -m "feat: add amendment document generation (printable HTML)"
```

---

## Task 6: UI — Amendments Tab Component

**Files:**
- Create: `src/components/contracts/contract-tab-amendments.tsx`

- [ ] **Step 6.1 — Create the component**

`src/components/contracts/contract-tab-amendments.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle, Circle } from "lucide-react";
import { toast } from "sonner";
import {
  AMENDMENT_TYPE_LABELS,
  AMENDMENT_STATUS_LABELS,
  type AmendmentListItem,
} from "@/lib/contracts/amendments";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AmendmentCreateModal } from "./amendment-create-modal";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "registered":         return "bg-mustard-dim text-mustard border-mustard/20";
    case "document_generated": return "bg-info-dim text-info border-info/20";
    case "signed":             return "bg-green-dim text-green border-green/20";
    default:                   return "bg-surface-highest text-muted-foreground";
  }
}

export function ContractTabAmendments({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery<{ amendments: AmendmentListItem[] }>({
    queryKey: ["amendments", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/amendments`).then((r) => r.json()),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ aid, status }: { aid: string; status: string }) => {
      const res = await fetch(`/api/contracts/${contractId}/amendments/${aid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al actualizar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: async (aid: string) => {
      const res = await fetch(`/api/contracts/${contractId}/amendments/${aid}/document`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al generar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Documento generado");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (aid: string) => {
      const res = await fetch(`/api/contracts/${contractId}/amendments/${aid}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al eliminar");
      }
    },
    onSuccess: () => {
      toast.success("Instrumento eliminado y contrato revertido");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const amendments = data?.amendments ?? [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Instrumentos post-firma
          </p>
          {amendments.length > 0 && (
            <p className="text-[0.7rem] text-muted-foreground mt-0.5">
              {amendments.length} instrumento{amendments.length !== 1 ? "s" : ""} registrado{amendments.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nuevo instrumento
        </Button>
      </div>

      {/* Empty state */}
      {amendments.length === 0 && (
        <div className="rounded-[18px] border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-[0.78rem] text-muted-foreground">
            No hay instrumentos registrados para este contrato.
          </p>
          <p className="text-[0.72rem] text-muted-foreground mt-1">
            Las salvedades, modificaciones, prórrogas y otros acuerdos post-firma aparecen aquí.
          </p>
        </div>
      )}

      {/* List */}
      {amendments.map((a) => (
        <div key={a.id} className="rounded-[18px] border border-border bg-surface overflow-hidden">
          {/* Card header */}
          <div className="flex items-start justify-between px-[18px] py-[14px] border-b border-border">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.82rem] font-semibold text-on-surface">
                  {AMENDMENT_TYPE_LABELS[a.type]} N°{a.typeSequenceNumber}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${statusBadgeClass(a.status)}`}>
                  {AMENDMENT_STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
              <p className="text-[0.78rem] text-text-secondary">{a.title}</p>
              <p className="text-[0.68rem] text-muted-foreground">
                Registrado: {format(new Date(a.createdAt), "dd/MM/yyyy", { locale: es })}
                {a.effectiveDate && (
                  <> · Vigente desde: {format(new Date(a.effectiveDate + "T00:00:00"), "dd/MM/yyyy", { locale: es })}</>
                )}
                {a.signedAt && (
                  <> · Firmado: {format(new Date(a.signedAt), "dd/MM/yyyy", { locale: es })}</>
                )}
              </p>
            </div>
          </div>

          {/* Changed fields */}
          {Object.keys(a.fieldsChanged).length > 0 && (
            <div className="px-[18px] py-3 border-b border-border">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                Cambios registrados
              </p>
              <div className="space-y-1">
                {Object.entries(a.fieldsChanged).map(([field, { before, after, label }]) => (
                  <div key={field} className="flex items-center gap-2 text-[0.75rem]">
                    <span className="text-muted-foreground w-40 shrink-0">{label}</span>
                    <span className="text-error line-through opacity-60">{String(before)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-income font-medium">{String(after)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {a.description && (
            <div className="px-[18px] py-3 border-b border-border">
              <p className="text-[0.75rem] text-text-secondary">{a.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 px-[18px] py-3">
            {a.status === "registered" && !a.hasDocument && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMutation.mutate(a.id)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <FileText className="h-3 w-3 mr-1" />
                Generar documento
              </Button>
            )}

            {a.hasDocument && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/contracts/${contractId}/amendments/${a.id}/document`, "_blank")}
              >
                <FileText className="h-3 w-3 mr-1" />
                Ver documento
              </Button>
            )}

            {(a.status === "registered" || a.status === "document_generated") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => patchMutation.mutate({ aid: a.id, status: "signed" })}
                disabled={patchMutation.isPending}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Marcar como firmado
              </Button>
            )}

            {a.status === "registered" && !a.hasDocument && (
              <Button
                size="sm"
                variant="ghost"
                className="text-error hover:bg-error-dim ml-auto"
                onClick={() => {
                  if (confirm("¿Eliminar este instrumento? El contrato volverá a su estado anterior.")) {
                    deleteMutation.mutate(a.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                Eliminar
              </Button>
            )}
          </div>
        </div>
      ))}

      <AmendmentCreateModal
        contractId={contractId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 6.2 — Commit**

```bash
git add src/components/contracts/contract-tab-amendments.tsx
git commit -m "feat: add ContractTabAmendments component"
```

---

## Task 7: UI — Create Modal

**Files:**
- Create: `src/components/contracts/amendment-create-modal.tsx`

- [ ] **Step 7.1 — Create the modal**

`src/components/contracts/amendment-create-modal.tsx`:

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AMENDMENT_TYPES,
  AMENDMENT_TYPE_LABELS,
  AMENDMENT_TYPE_DESCRIPTIONS,
  ALLOWED_FIELDS,
  FIELD_LABELS,
  REQUIRES_EFFECTIVE_DATE,
  REQUIRES_DESCRIPTION,
  type AmendmentType,
} from "@/lib/contracts/amendments";

interface Props {
  contractId: string;
  open: boolean;
  onClose: () => void;
}

type FieldChange = { before: string; after: string };

export function AmendmentCreateModal({ contractId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<AmendmentType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [fieldChanges, setFieldChanges] = useState<Record<string, FieldChange>>({});

  const reset = () => {
    setStep(1);
    setSelectedType(null);
    setTitle("");
    setDescription("");
    setEffectiveDate("");
    setFieldChanges({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) return;

      const fieldsChanged: Record<string, { before: unknown; after: unknown }> = {};
      for (const [field, { before, after }] of Object.entries(fieldChanges)) {
        if (after.trim() !== "") {
          fieldsChanged[field] = { before: before || null, after };
        }
      }

      const res = await fetch(`/api/contracts/${contractId}/amendments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          title,
          description: description || undefined,
          effectiveDate: effectiveDate || undefined,
          fieldsChanged,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al registrar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Instrumento registrado. Los datos del contrato fueron actualizados.");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allowedFields = selectedType ? ALLOWED_FIELDS[selectedType] : [];
  const requiresEffectiveDate = selectedType ? REQUIRES_EFFECTIVE_DATE[selectedType] : false;
  const requiresDescription = selectedType ? REQUIRES_DESCRIPTION[selectedType] : false;
  const requiresFieldChanges = selectedType
    ? ["erratum", "modification", "extension", "index_change"].includes(selectedType)
    : false;

  const canSubmit =
    title.trim().length > 0 &&
    (!requiresEffectiveDate || effectiveDate.length > 0) &&
    (!requiresDescription || description.trim().length > 0) &&
    (!requiresFieldChanges || Object.values(fieldChanges).some((f) => f.after.trim() !== ""));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Nuevo instrumento post-firma" : `${selectedType ? AMENDMENT_TYPE_LABELS[selectedType] : ""}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Type selection */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-2 py-2">
            {AMENDMENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setStep(2); setFieldChanges({}); }}
                className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border border-border text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="text-[0.82rem] font-semibold text-on-surface">
                  {AMENDMENT_TYPE_LABELS[type]}
                </span>
                <span className="text-[0.72rem] text-muted-foreground">
                  {AMENDMENT_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Data form */}
        {step === 2 && selectedType && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Título <span className="text-error">*</span></Label>
              <Input
                placeholder={`Ej: ${selectedType === "modification" ? "Aumento días de gracia" : selectedType === "extension" ? "Prórroga 2026" : "Corrección de fecha"}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {requiresEffectiveDate && (
              <div className="space-y-1">
                <Label className="text-xs">Fecha efectiva <span className="text-error">*</span></Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
            )}

            {requiresDescription && (
              <div className="space-y-1">
                <Label className="text-xs">Descripción <span className="text-error">*</span></Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Describí el detalle del instrumento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}

            {!requiresDescription && (
              <div className="space-y-1">
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input
                  placeholder="Motivo o contexto del instrumento"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}

            {allowedFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                  Campos modificados
                </p>
                {allowedFields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{FIELD_LABELS[field] ?? field}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Valor anterior"
                        value={fieldChanges[field]?.before ?? ""}
                        onChange={(e) =>
                          setFieldChanges((prev) => ({
                            ...prev,
                            [field]: { before: e.target.value, after: prev[field]?.after ?? "" },
                          }))
                        }
                      />
                      <Input
                        placeholder="Valor nuevo"
                        value={fieldChanges[field]?.after ?? ""}
                        onChange={(e) =>
                          setFieldChanges((prev) => ({
                            ...prev,
                            [field]: { before: prev[field]?.before ?? "", after: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[0.68rem] text-muted-foreground">
                  Solo completá los campos que cambian. Los demás se ignoran.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 2 && (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Registrar instrumento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7.2 — Commit**

```bash
git add src/components/contracts/amendment-create-modal.tsx
git commit -m "feat: add AmendmentCreateModal with 2-step type selector and data form"
```

---

## Task 8: Wire Up in contract-detail.tsx

**Files:**
- Modify: `src/components/contracts/contract-detail.tsx`

- [ ] **Step 8.1 — Add import**

At the top of `contract-detail.tsx`, add this import alongside the other tab component imports:

```typescript
import { ContractTabAmendments } from "./contract-tab-amendments";
```

- [ ] **Step 8.2 — Add "instrumentos" to the tab type and list**

Find the line:
```typescript
type ContractTab = "partes" | "operativo" | "documentos" | "datos";
```
Replace with:
```typescript
type ContractTab = "partes" | "operativo" | "instrumentos" | "documentos" | "datos";
```

Find the `TabsList` mapping array:
```typescript
{(["partes", "operativo", "documentos", "datos"] as const).map((tab) => (
```
Replace with:
```typescript
{(["partes", "operativo", "instrumentos", "documentos", "datos"] as const).map((tab) => (
```

Find the tab label block inside the `TabsTrigger`:
```typescript
{tab === "partes" ? "Partes" : tab === "operativo" ? "Operativo" : tab === "documentos" ? "Documentos" : "Datos para documentos"}
```
Replace with:
```typescript
{tab === "partes" ? "Partes"
  : tab === "operativo" ? "Operativo"
  : tab === "instrumentos" ? "Instrumentos"
  : tab === "documentos" ? "Documentos"
  : "Datos para documentos"}
```

- [ ] **Step 8.3 — Add the tab panel**

After the closing `}` of the `{activeTab === "documentos" && ...}` block and before the `{activeTab === "datos" && ...}` block, add:

```typescript
{/* ── Tab: Instrumentos ────────────────────────── */}
{activeTab === "instrumentos" && (
  <ContractTabAmendments contractId={id} />
)}
```

- [ ] **Step 8.4 — Add query for amendments in the header badges**

After the `const resolved = resolvedData?.resolved ?? {};` line, add:

```typescript
const { data: amendmentsData } = useQuery<{ amendments: { type: string; status: string }[] }>({
  queryKey: ["amendments", id],
  queryFn: () => fetch(`/api/contracts/${id}/amendments`).then((r) => r.json()),
  enabled: !!id,
});
const amendments = amendmentsData?.amendments ?? [];
const errata = amendments.filter((a) => a.type === "erratum");
const modifications = amendments.filter((a) => ["modification","extension","termination","guarantee_substitution","index_change"].includes(a.type));
const hasUnsignedErrata = errata.some((a) => a.status !== "signed");
const hasUnsignedMods = modifications.some((a) => a.status !== "signed");
```

- [ ] **Step 8.5 — Add badges to the header**

Find the header badge block (the `<span>` with `statusTagClasses`):
```typescript
<span
  className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[0.67rem] font-bold tracking-[0.02em] whitespace-nowrap ${statusTagClasses(data.status)}`}
>
  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(data.status)}`} />
  {statusLabel}
</span>
```

Add these badges immediately after that `</span>`:

```typescript
{errata.length > 0 && (
  <span
    className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[0.67rem] font-bold tracking-[0.02em] whitespace-nowrap cursor-pointer
      ${hasUnsignedErrata ? "border border-dashed border-mustard/60 text-mustard bg-mustard-dim" : "border border-green/30 text-green bg-green-dim"}`}
    onClick={() => setTab("instrumentos")}
  >
    {errata.length} salvedad{errata.length !== 1 ? "es" : ""}
  </span>
)}
{modifications.length > 0 && (
  <span
    className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[0.67rem] font-bold tracking-[0.02em] whitespace-nowrap cursor-pointer
      ${hasUnsignedMods ? "border border-dashed border-mustard/60 text-mustard bg-mustard-dim" : "border border-green/30 text-green bg-green-dim"}`}
    onClick={() => setTab("instrumentos")}
  >
    {modifications.length} modificación{modifications.length !== 1 ? "es" : ""}
  </span>
)}
```

- [ ] **Step 8.6 — Manual test: full flow**

With `bun dev` running, open the contract de Matías Konstantinides (or any active contract):

1. Confirm the "Instrumentos" tab appears in the nav.
2. Open the tab — should show empty state with "+ Nuevo instrumento" button.
3. Click the button — modal step 1 shows 6 type options.
4. Select "Modificación" → step 2 shows: título, fecha efectiva, campos modificables.
5. Fill in title "Test modificación", effective date today, change `graceDays` from current value to a new value.
6. Click "Registrar instrumento".
7. Verify:
   - Toast "Instrumento registrado..."
   - The amendments list shows the new card with status "Registrado" in amber
   - In Drizzle Studio: `contract.graceDays` has the new value, `contract_amendment` has a row with the snapshot
   - In the contract header: a "1 modificación" badge appears in amber
8. Click "Generar documento" on the card → opens in a new tab with the printable HTML instrument.
9. Click "Marcar como firmado" → status changes to "Firmado" in green.
10. In the header, the badge turns green.
11. Create another amendment and delete it — verify the contract field reverts in Drizzle Studio.

- [ ] **Step 8.7 — Commit**

```bash
git add src/components/contracts/contract-detail.tsx
git commit -m "feat: wire Instrumentos tab and amendment badges into contract detail"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ 6 amendment types with correct whitelists
- ✅ 3 status states: registered → document_generated → signed
- ✅ Shortcut: registered → signed (verbal agreements)
- ✅ DELETE reverts contract via contractSnapshot
- ✅ Transaction in POST (snapshot + update + insert)
- ✅ typeSequenceNumber computed at query time
- ✅ Badges in contract header (clickable, navigate to Instrumentos tab)
- ✅ Document generation (printable HTML, no PDF library)
- ✅ canManageContracts() guard on all mutating endpoints
- ✅ Immediate effect on cuenta corriente (contract fields updated on registration)
- ✅ termination validated only on active/expiring_soon contracts
- ✅ extension validates endDate.after > endDate.before — note: this validation is in the POST body logic, but the current code applies `after` directly. The route handler should add: if type === "extension" and fieldsChanged.endDate, check after > before.

**One fix needed in Task 3 POST (add extension date validation):**

In `src/app/api/contracts/[id]/amendments/route.ts`, before the transaction block, add:

```typescript
// Validate extension: new endDate must be after current
if (type === "extension" && fieldsChanged["endDate"]) {
  const newEnd = String(fieldsChanged["endDate"].after);
  const oldEnd = String(fieldsChanged["endDate"].before);
  if (newEnd <= oldEnd) {
    return NextResponse.json({ error: "La nueva fecha de fin debe ser posterior a la actual" }, { status: 400 });
  }
}
```

Add this as the last step of Task 3 before the commit:

- [ ] **Step 3.3b — Add extension date validation** (add the block above in route.ts before re-committing if already committed, or include in 3.4 commit)
