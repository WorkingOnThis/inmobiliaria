# Contract Document Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the document template engine into each contract's detail page — editable, reorderable clauses with drag & drop, auto-numbering, variable override popover, and lock when the contract is signed.

**Architecture:** Two new DB tables (`contract_clause`, `contract_document_config`) store per-contract clause snapshots. Shared React components for the highlighted textarea and variable popover are extracted from the existing generator into `src/lib/document-templates/`. A new `ContractDocumentSection` renders the clause list with @dnd-kit. A `ContractClauseEditorModal` reuses those shared components for inline editing. All writes are gated by contract status (`draft` and `pending_signature` are editable; `active` onward is read-only).

**Tech Stack:** Next.js App Router · Drizzle ORM · PostgreSQL · TanStack Query v5 · @dnd-kit/core + @dnd-kit/sortable · shadcn/ui · Zod · TypeScript

**Spec:** `docs/superpowers/specs/2026-04-28-contract-document-engine-design.md`

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/db/schema/contract-clause.ts` | Drizzle schema for `contract_clause` table |
| `src/db/schema/contract-document-config.ts` | Drizzle schema for `contract_document_config` table |
| `src/lib/document-templates/highlighted-body-textarea.tsx` | Shared highlighted textarea, extracted from generator |
| `src/lib/document-templates/variable-popover.tsx` | Shared variable popover, extracted from generator |
| `src/lib/document-templates/ordinal-clause.ts` | Spanish ordinal clause heading helper |
| `src/app/api/contracts/[id]/documents/[documentType]/apply/route.ts` | POST: snapshot template clauses into contract |
| `src/app/api/contracts/[id]/documents/[documentType]/clauses/route.ts` | GET list + POST create custom clause |
| `src/app/api/contracts/[id]/documents/[documentType]/clauses/[clauseId]/route.ts` | PATCH + DELETE |
| `src/app/api/contracts/[id]/documents/[documentType]/clauses/reorder/route.ts` | PUT reorder |
| `src/components/contracts/contract-clause-editor-modal.tsx` | Modal: title + textarea + preview + popover |
| `src/components/contracts/contract-document-section.tsx` | Full clause section with DnD list |

### Modified files
| File | Change |
|------|--------|
| `src/db/schema/document-template.ts` | Add `isDefault boolean` field |
| `src/db/schema/index.ts` | Export two new schemas |
| `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx` | Import shared components from new locations |
| `src/app/api/document-templates/route.ts` | Include `isDefault` in GET response |
| `src/components/contracts/contract-detail.tsx` | Add `ContractDocumentSection` |

---

### Task 1: DB Schema

**Files:**
- Create: `src/db/schema/contract-clause.ts`
- Create: `src/db/schema/contract-document-config.ts`
- Modify: `src/db/schema/document-template.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Create `src/db/schema/contract-clause.ts`**

```ts
import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { contract } from "./contract";
import { documentTemplateClause } from "./document-template";

export const contractClause = pgTable("contract_clause", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contractId: text("contractId")
    .notNull()
    .references(() => contract.id, { onDelete: "cascade" }),
  documentType: text("documentType").notNull().default("contract"),
  sourceClauseId: text("sourceClauseId").references(
    () => documentTemplateClause.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  isActive: boolean("isActive").notNull().default(true),
  order: integer("order").notNull(),
  fieldOverrides: jsonb("fieldOverrides")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ContractClause = typeof contractClause.$inferSelect;
export type ContractClauseInsert = typeof contractClause.$inferInsert;
```

- [ ] **Step 2: Create `src/db/schema/contract-document-config.ts`**

```ts
import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { contract } from "./contract";
import { documentTemplate } from "./document-template";

export const contractDocumentConfig = pgTable(
  "contract_document_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contractId: text("contractId")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    documentType: text("documentType").notNull(),
    appliedTemplateId: text("appliedTemplateId").references(
      () => documentTemplate.id,
      { onDelete: "set null" }
    ),
    appliedAt: timestamp("appliedAt").notNull().defaultNow(),
  },
  (t) => [unique("uq_contract_doctype").on(t.contractId, t.documentType)]
);

export type ContractDocumentConfig = typeof contractDocumentConfig.$inferSelect;
```

- [ ] **Step 3: Add `isDefault` to `src/db/schema/document-template.ts`**

Add `isDefault: boolean("isDefault").notNull().default(false),` after the `source` line in `documentTemplate`. The table should look like:

```ts
export const documentTemplate = pgTable("documentTemplate", {
  id: text("id").primaryKey(),
  agencyId: text("agencyId")
    .notNull()
    .references(() => agency.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  source: text("source").notNull().default("custom"),
  isDefault: boolean("isDefault").notNull().default(false),   // ← add this
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
```

`documentTemplateClause` stays unchanged — only add to `documentTemplate`.

- [ ] **Step 4: Export new schemas in `src/db/schema/index.ts`**

Add these two lines after the existing exports:

```ts
export * from "./contract-clause";
export * from "./contract-document-config";
```

- [ ] **Step 5: Push schema to DB**

```bash
bun run db:push
```

Drizzle will prompt to create `contract_clause`, `contract_document_config` and add `isDefault` column. Confirm all three.

- [ ] **Step 6: Verify in Drizzle Studio**

```bash
bun run db:studio
```

Confirm the two new tables appear and `documentTemplate` has `isDefault`. Close with Ctrl+C.

- [ ] **Step 7: Mark one template as default**

In Drizzle Studio, find your main contract template and set `isDefault = true`. This is a one-time setup.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/contract-clause.ts src/db/schema/contract-document-config.ts src/db/schema/document-template.ts src/db/schema/index.ts
git commit -m "feat(db): contract_clause, contract_document_config schemas + isDefault on documentTemplate"
```

---

### Task 2: Shared utility — ordinalClause

**Files:**
- Create: `src/lib/document-templates/ordinal-clause.ts`

- [ ] **Step 1: Create the file**

```ts
const ORDINALES: string[] = [
  "",
  "primera", "segunda", "tercera", "cuarta", "quinta",
  "sexta", "séptima", "octava", "novena", "décima",
  "undécima", "duodécima", "decimotercera", "decimocuarta", "decimoquinta",
  "decimosexta", "decimoséptima", "decimoctava", "decimonovena", "vigésima",
  "vigésima primera", "vigésima segunda", "vigésima tercera", "vigésima cuarta",
  "vigésima quinta", "vigésima sexta", "vigésima séptima", "vigésima octava",
  "vigésima novena", "trigésima",
];

export function ordinalClause(n: number): string {
  if (n >= 1 && n < ORDINALES.length) return ORDINALES[n];
  return `${n}°`;
}

export function clauseHeading(position: number, title: string): string {
  return `CLÁUSULA ${ordinalClause(position).toUpperCase()} — ${title.toUpperCase()}`;
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/document-templates/ordinal-clause.ts
git commit -m "feat: Spanish ordinal clause heading helper"
```

---

### Task 3: Extract HighlightedBodyTextarea to shared module

**Files:**
- Create: `src/lib/document-templates/highlighted-body-textarea.tsx`
- Modify: `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx`

Context: `getHighlightedHTML` and `HighlightedBodyTextarea` currently live inside `document-template-editor.tsx`. Both are needed in the new clause editor modal too. This task moves them to a shared location.

- [ ] **Step 1: Create `src/lib/document-templates/highlighted-body-textarea.tsx`**

```tsx
"use client";

import { useRef } from "react";

export function getHighlightedHTML(
  value: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  overrides: Record<string, string> = {}
): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withSysVars = escaped.replace(/\[\[([^\]]*)\]\]/g, (match, inner: string) => {
    const trimmed = inner.trim();
    if (
      trimmed.startsWith("if:") || trimmed === "/if" ||
      trimmed.startsWith("for:") || trimmed === "/for"
    ) {
      return `<span style="color:var(--muted-foreground)">${match}</span>`;
    }
    if (!hasContract) {
      return `<span style="color:hsl(var(--primary))">${match}</span>`;
    }
    if (overrides[trimmed] !== undefined) {
      return `<span style="color:var(--mustard)">${overrides[trimmed]}</span>`;
    }
    const val = resolved[trimmed];
    const color = val !== null && val !== undefined ? "var(--green)" : "hsl(var(--destructive))";
    return `<span style="color:${color}">${match}</span>`;
  });

  return withSysVars.replace(/\{\{(\w+)(?:\s+\[[^\]]*\])?\}\}/g, (match) => {
    return `<span style="color:var(--mustard)">${match}</span>`;
  });
}

export function HighlightedBodyTextarea({
  value,
  onChange,
  resolved,
  hasContract,
  overrides = {},
  minHeight = "240px",
  placeholder,
  textareaRef: externalRef,
  onBodyBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  resolved: Record<string, string | null>;
  hasContract: boolean;
  overrides?: Record<string, string>;
  minHeight?: string;
  placeholder?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onBodyBlur?: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? internalRef;

  function syncScroll() {
    if (backdropRef.current && ref.current) {
      backdropRef.current.scrollTop = ref.current.scrollTop;
    }
  }

  const highlighted = getHighlightedHTML(value, resolved, hasContract, overrides);

  const sharedStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
    lineHeight: "1.5rem",
    padding: "8px 12px",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  };

  return (
    <div className="relative rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
      <div
        aria-hidden="true"
        className="invisible w-full"
        style={{ ...sharedStyle, minHeight }}
      >
        {value + "\n"}
      </div>
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ ...sharedStyle, color: "var(--foreground)" }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onBlur={onBodyBlur}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full resize-none bg-transparent focus:outline-none placeholder:text-muted-foreground"
        style={{ ...sharedStyle, color: "transparent", caretColor: "var(--foreground)" }}
      />
    </div>
  );
}
```

Note: the shared version adds `overrides` and `minHeight` props (both optional with defaults matching original behavior).

- [ ] **Step 2: Update `document-template-editor.tsx`**

In `document-template-editor.tsx`:
1. Delete the `getHighlightedHTML` function (lines ~249–283)
2. Delete the `HighlightedBodyTextarea` function (lines ~286–359)
3. Add this import near the top of the file:

```tsx
import {
  getHighlightedHTML,
  HighlightedBodyTextarea,
} from "@/lib/document-templates/highlighted-body-textarea";
```

All existing calls to both functions inside the editor remain unchanged.

- [ ] **Step 3: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

Expected: no errors.

- [ ] **Step 4: Manual check**

```bash
bun dev
```

Open `http://localhost:3000/generador-documentos`. Select a template and verify the body textarea still highlights `[[variables]]` in green/red and `{{free text}}` in mustard.

- [ ] **Step 5: Commit**

```bash
git add src/lib/document-templates/highlighted-body-textarea.tsx "src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx"
git commit -m "refactor: extract HighlightedBodyTextarea to shared module"
```

---

### Task 4: Extract VariablePopover to shared module

**Files:**
- Create: `src/lib/document-templates/variable-popover.tsx`
- Modify: `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx`

- [ ] **Step 1: Create `src/lib/document-templates/variable-popover.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VARIABLES_CATALOG } from "@/lib/document-templates/variables-catalog";

export const POPOVER_WIDTH = 264;
const POPOVER_HEIGHT_ESTIMATE = 220;

export type PopoverState = {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
};

export function VariablePopover({
  path,
  rect,
  resolvedValue,
  currentOverride,
  onApply,
  onClear,
  onClose,
}: {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
  currentOverride: string | undefined;
  onApply: (path: string, value: string) => void;
  onClear: (path: string) => void;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState(currentOverride ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const catalogEntry = VARIABLES_CATALOG.find((v) => v.path === path);
  const hasOverride = currentOverride !== undefined;

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const spaceBelow = viewportHeight - rect.bottom;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - POPOVER_WIDTH - 8));
  const top =
    spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 6
      ? rect.bottom + 6
      : rect.top - POPOVER_HEIGHT_ESTIMATE - 6;

  const pathColor = hasOverride ? "text-mustard" : resolvedValue !== null ? "text-green" : "text-destructive";

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5"
      style={{ left, top, width: POPOVER_WIDTH }}
    >
      <div>
        <code className={`text-xs font-mono ${pathColor}`}>[[{path}]]</code>
        {catalogEntry && (
          <p className="text-xs text-muted-foreground mt-0.5">{catalogEntry.label}</p>
        )}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          Valor del contrato
        </p>
        <p className={`text-xs font-medium px-2 py-1 rounded ${
          resolvedValue !== null ? "bg-green-dim text-green" : "bg-destructive/10 text-destructive"
        }`}>
          {resolvedValue ?? "Sin datos"}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          {hasOverride ? "Override activo" : "Sobreescribir valor"}
        </p>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Valor personalizado..."
          className="h-7 text-xs"
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onClose}>
          Cancelar
        </Button>
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            onClick={() => { onClear(path); onClose(); }}
          >
            Limpiar
          </Button>
        )}
        <Button
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => { if (inputValue.trim()) { onApply(path, inputValue.trim()); onClose(); } }}
        >
          {hasOverride ? "Actualizar" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `document-template-editor.tsx`**

1. Delete the local `VariablePopover` function (lines ~113–245), `POPOVER_WIDTH`, `POPOVER_HEIGHT_ESTIMATE`, and `PopoverState` type
2. Add import:

```tsx
import {
  VariablePopover,
  POPOVER_WIDTH,
  type PopoverState,
} from "@/lib/document-templates/variable-popover";
```

- [ ] **Step 3: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

- [ ] **Step 4: Manual check**

In the generador, Ctrl+Click a green variable. Confirm the popover opens, shows the value, and the override input works.

- [ ] **Step 5: Commit**

```bash
git add src/lib/document-templates/variable-popover.tsx "src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx"
git commit -m "refactor: extract VariablePopover to shared module"
```

---

### Task 5: API — Apply template to contract

**Files:**
- Create: `src/app/api/contracts/[id]/documents/[documentType]/apply/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { documentTemplate, documentTemplateClause } from "@/db/schema/document-template";
import { contractClause } from "@/db/schema/contract-clause";
import { contractDocumentConfig } from "@/db/schema/contract-document-config";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

async function getUserAgencyId(userId: string): Promise<string | null> {
  const [row] = await db.select({ id: agency.id }).from(agency).where(eq(agency.ownerId, userId)).limit(1);
  return row?.id ?? null;
}

const applySchema = z.object({
  templateId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;
    const agencyId = await getUserAgencyId(session.user.id);
    if (!agencyId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const [template] = await db
      .select({ id: documentTemplate.id })
      .from(documentTemplate)
      .where(and(eq(documentTemplate.id, parsed.data.templateId), eq(documentTemplate.agencyId, agencyId)))
      .limit(1);

    if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

    const templateClauses = await db
      .select()
      .from(documentTemplateClause)
      .where(eq(documentTemplateClause.templateId, template.id))
      .orderBy(documentTemplateClause.order);

    await db.transaction(async (tx) => {
      await tx
        .delete(contractClause)
        .where(and(eq(contractClause.contractId, contractId), eq(contractClause.documentType, documentType)));

      if (templateClauses.length > 0) {
        await tx.insert(contractClause).values(
          templateClauses.map((tc, i) => ({
            contractId,
            documentType,
            sourceClauseId: tc.id,
            title: tc.title,
            body: tc.body,
            isActive: tc.isActive,
            order: i,
            fieldOverrides: {},
          }))
        );
      }

      await tx
        .insert(contractDocumentConfig)
        .values({ contractId, documentType, appliedTemplateId: template.id })
        .onConflictDoUpdate({
          target: [contractDocumentConfig.contractId, contractDocumentConfig.documentType],
          set: { appliedTemplateId: template.id, appliedAt: new Date() },
        });
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/contracts/[id]/documents/[documentType]/apply/route.ts"
git commit -m "feat(api): POST apply template snapshot to contract document"
```

---

### Task 6: API — Clauses list + create

**Files:**
- Create: `src/app/api/contracts/[id]/documents/[documentType]/clauses/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { contractDocumentConfig } from "@/db/schema/contract-document-config";
import { documentTemplate } from "@/db/schema/document-template";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });

    const [config] = await db
      .select({ appliedTemplateId: contractDocumentConfig.appliedTemplateId, appliedAt: contractDocumentConfig.appliedAt })
      .from(contractDocumentConfig)
      .where(and(eq(contractDocumentConfig.contractId, contractId), eq(contractDocumentConfig.documentType, documentType)))
      .limit(1);

    const clauses = await db
      .select()
      .from(contractClause)
      .where(and(eq(contractClause.contractId, contractId), eq(contractClause.documentType, documentType)))
      .orderBy(asc(contractClause.order));

    let templateName: string | null = null;
    if (config?.appliedTemplateId) {
      const [tmpl] = await db
        .select({ name: documentTemplate.name })
        .from(documentTemplate)
        .where(eq(documentTemplate.id, config.appliedTemplateId))
        .limit(1);
      templateName = tmpl?.name ?? null;
    }

    return NextResponse.json({
      clauses,
      config: config ? { ...config, templateName } : null,
      isEditable: EDITABLE_STATUSES.includes(contractRow.status),
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const createClauseSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  body: z.string().default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createClauseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const existing = await db
      .select({ order: contractClause.order })
      .from(contractClause)
      .where(and(eq(contractClause.contractId, contractId), eq(contractClause.documentType, documentType)))
      .orderBy(asc(contractClause.order));

    const maxOrder = existing.length > 0 ? existing[existing.length - 1].order : -1;

    const [created] = await db
      .insert(contractClause)
      .values({
        contractId,
        documentType,
        sourceClauseId: null,
        title: parsed.data.title,
        body: parsed.data.body,
        isActive: true,
        order: maxOrder + 1,
        fieldOverrides: {},
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/contracts/[id]/documents/[documentType]/clauses/route.ts"
git commit -m "feat(api): GET clause list and POST create custom clause"
```

---

### Task 7: API — Clause PATCH + DELETE + reorder

**Files:**
- Create: `src/app/api/contracts/[id]/documents/[documentType]/clauses/[clauseId]/route.ts`
- Create: `src/app/api/contracts/[id]/documents/[documentType]/clauses/reorder/route.ts`

- [ ] **Step 1: Create `[clauseId]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  isActive: z.boolean().optional(),
  fieldOverrides: z.record(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, clauseId } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow || !EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const [updated] = await db
      .update(contractClause)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(contractClause.id, clauseId), eq(contractClause.contractId, contractId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string; clauseId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, clauseId } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow || !EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const [clause] = await db
      .select({ sourceClauseId: contractClause.sourceClauseId })
      .from(contractClause)
      .where(and(eq(contractClause.id, clauseId), eq(contractClause.contractId, contractId)))
      .limit(1);

    if (!clause) return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });

    if (clause.sourceClauseId !== null) {
      return NextResponse.json(
        { error: "Las cláusulas de plantilla no se pueden eliminar, solo desactivar" },
        { status: 400 }
      );
    }

    await db.delete(contractClause).where(eq(contractClause.id, clauseId));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `reorder/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractClause } from "@/db/schema/contract-clause";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const EDITABLE_STATUSES = ["draft", "pending_signature"];

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentType: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageDocumentTemplates(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: contractId, documentType } = await params;

    const [contractRow] = await db
      .select({ status: contract.status })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow || !EDITABLE_STATUSES.includes(contractRow.status)) {
      return NextResponse.json({ error: "Contrato no editable" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx
          .update(contractClause)
          .set({ order: i, updatedAt: new Date() })
          .where(
            and(
              eq(contractClause.id, parsed.data.orderedIds[i]),
              eq(contractClause.contractId, contractId),
              eq(contractClause.documentType, documentType)
            )
          );
      }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/contracts/[id]/documents/[documentType]/clauses/[clauseId]/route.ts" "src/app/api/contracts/[id]/documents/[documentType]/clauses/reorder/route.ts"
git commit -m "feat(api): PATCH+DELETE clause and PUT reorder"
```

---

### Task 8: UI — ContractClauseEditorModal

**Files:**
- Create: `src/components/contracts/contract-clause-editor-modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HighlightedBodyTextarea } from "@/lib/document-templates/highlighted-body-textarea";
import { VariablePopover, type PopoverState } from "@/lib/document-templates/variable-popover";
import { renderClauseBody } from "@/lib/document-templates/render-segments";
import type { ContractClause } from "@/db/schema/contract-clause";

type Props = {
  clause: ContractClause;
  contractId: string;
  documentType: string;
  resolved: Record<string, string | null>;
  onClose: () => void;
};

export function ContractClauseEditorModal({
  clause,
  contractId,
  documentType,
  resolved,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(clause.title);
  const [body, setBody] = useState(clause.body);
  const [overrides, setOverrides] = useState<Record<string, string>>(
    (clause.fieldOverrides as Record<string, string>) ?? {}
  );
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);

  const handleVarClick = useCallback(
    (path: string, rect: DOMRect) => {
      setPopoverState({ path, rect, resolvedValue: resolved[path] ?? null });
    },
    [resolved]
  );

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/contracts/${contractId}/documents/${documentType}/clauses/${clause.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, fieldOverrides: overrides }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] });
      toast.success("Cláusula guardada");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const preview = renderClauseBody(body, resolved, true, {}, {}, overrides, handleVarClick);

  return (
    <>
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cláusula</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Mora, Garantías..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cuerpo</Label>
              <HighlightedBodyTextarea
                value={body}
                onChange={setBody}
                resolved={resolved}
                hasContract={true}
                overrides={overrides}
                minHeight="120px"
                placeholder="Redactá el cuerpo de la cláusula..."
              />
            </div>

            <div className="border-l-2 border-green pl-3 py-2 bg-muted/30 rounded-r text-sm">
              <p className="text-[10px] text-green uppercase tracking-wide mb-1.5 font-medium">
                Preview — Ctrl+Click en una variable para sobreescribir
              </p>
              <div className="leading-relaxed text-foreground/90">{preview}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={() => save()} disabled={isPending || !title.trim()}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {popoverState && (
        <VariablePopover
          path={popoverState.path}
          rect={popoverState.rect}
          resolvedValue={popoverState.resolvedValue}
          currentOverride={overrides[popoverState.path]}
          onApply={(path, value) =>
            setOverrides((prev) => ({ ...prev, [path]: value }))
          }
          onClear={(path) =>
            setOverrides((prev) => {
              const next = { ...prev };
              delete next[path];
              return next;
            })
          }
          onClose={() => setPopoverState(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/contracts/contract-clause-editor-modal.tsx
git commit -m "feat(ui): ContractClauseEditorModal with textarea + preview + variable popover"
```

---

### Task 9: UI — ContractDocumentSection

**Files:**
- Create: `src/components/contracts/contract-document-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { GripVertical, Pencil, Eye, Plus, Trash2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ContractClauseEditorModal } from "./contract-clause-editor-modal";
import { clauseHeading } from "@/lib/document-templates/ordinal-clause";
import { renderClauseBody } from "@/lib/document-templates/render-segments";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContractClause } from "@/db/schema/contract-clause";

type ClauseListResponse = {
  clauses: ContractClause[];
  config: { appliedTemplateId: string | null; templateName: string | null; appliedAt: string } | null;
  isEditable: boolean;
};

function SortableClauseRow({
  clause, activeNumber, isEditable, onToggle, onEdit, onDelete,
}: {
  clause: ContractClause;
  activeNumber: number | null;
  isEditable: boolean;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (clause: ContractClause) => void;
  onDelete: (clause: ContractClause) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clause.id, disabled: !isEditable });

  const overrideCount = Object.keys((clause.fieldOverrides as object) ?? {}).length;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-2 rounded-md border px-3 py-2.5 ${
        clause.isActive ? "border-border bg-card" : "border-border/40 bg-muted/20"
      }`}
    >
      {isEditable && (
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0">
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <span className="text-xs text-muted-foreground w-5 shrink-0 font-mono text-right">
        {activeNumber ?? "—"}
      </span>

      <span className={`flex-1 text-sm font-medium truncate ${
        clause.isActive ? "text-foreground" : "line-through text-muted-foreground"
      }`}>
        {clause.title || "Sin título"}
      </span>

      {overrideCount > 0 && (
        <Badge variant="outline" className="text-mustard border-mustard/30 text-[10px] shrink-0">
          {overrideCount} override{overrideCount > 1 ? "s" : ""}
        </Badge>
      )}

      {!clause.sourceClauseId && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">custom</Badge>
      )}

      {isEditable && (
        <Switch
          checked={clause.isActive}
          onCheckedChange={(v) => onToggle(clause.id, v)}
          className="shrink-0"
        />
      )}

      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => onEdit(clause)}>
        {isEditable ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>

      {isEditable && !clause.sourceClauseId && (
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(clause)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

type Props = {
  contractId: string;
  documentType?: string;
  resolved: Record<string, string | null>;
  defaultTemplateId?: string;
};

export function ContractDocumentSection({
  contractId,
  documentType = "contract",
  resolved,
  defaultTemplateId,
}: Props) {
  const queryClient = useQueryClient();
  const [editingClause, setEditingClause] = useState<ContractClause | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data, isLoading } = useQuery<ClauseListResponse>({
    queryKey: ["contract-clauses", contractId, documentType],
    queryFn: () =>
      fetch(`/api/contracts/${contractId}/documents/${documentType}/clauses`).then((r) => r.json()),
  });

  const { mutate: applyTemplate, isPending: isApplying } = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/contracts/${contractId}/documents/${documentType}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] });
      setLocalOrder(null);
      toast.success("Plantilla aplicada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: toggleClause } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/contracts/${contractId}/documents/${documentType}/clauses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] }),
    onError: () => toast.error("Error al actualizar"),
  });

  const { mutate: deleteClause } = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/contracts/${contractId}/documents/${documentType}/clauses/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] });
      toast.success("Cláusula eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: reorder } = useMutation({
    mutationFn: (orderedIds: string[]) =>
      fetch(`/api/contracts/${contractId}/documents/${documentType}/clauses/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] });
      setLocalOrder(null);
    },
    onError: () => { setLocalOrder(null); toast.error("Error al reordenar"); },
  });

  const orderedClauses = (() => {
    if (!data?.clauses) return [];
    if (!localOrder) return data.clauses;
    return localOrder.map((id) => data.clauses.find((c) => c.id === id)).filter(Boolean) as ContractClause[];
  })();

  const numberMap = new Map<string, number>();
  let counter = 1;
  for (const c of orderedClauses) {
    if (c.isActive) numberMap.set(c.id, counter++);
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = orderedClauses.map((c) => c.id);
      const newOrder = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string));
      setLocalOrder(newOrder);
      reorder(newOrder);
    },
    [orderedClauses, reorder]
  );

  function handlePrint() {
    const activeClauses = orderedClauses.filter((c) => c.isActive);
    const html = activeClauses.map((clause, i) => {
      const heading = clauseHeading(i + 1, clause.title);
      const bodyNode = renderClauseBody(
        clause.body, resolved, true, {}, {},
        clause.fieldOverrides as Record<string, string>
      );
      const bodyHtml = renderToStaticMarkup(<>{bodyNode}</>);
      return `<div class="clause"><h2>${heading}</h2><div class="body">${bodyHtml}</div></div>`;
    }).join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.4;padding:2.5cm 3cm;color:#000}
  .clause{margin-bottom:1.5em}
  h2{font-size:12pt;font-weight:bold;text-transform:uppercase;margin-bottom:0.4em}
  .body{text-align:justify;white-space:pre-wrap;word-break:break-word}
  span{color:#000!important}
</style></head><body>${html}</body></html>`);
    win.document.close();
    win.print();
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Cargando cláusulas...</div>;
  }

  const isEditable = data?.isEditable ?? false;
  const hasTemplate = !!data?.config;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Cláusulas del contrato</h3>
          {data?.config?.templateName && (
            <Badge variant="outline" className="text-xs">{data.config.templateName}</Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasTemplate && orderedClauses.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Vista previa / Imprimir
            </Button>
          )}
          {isEditable && hasTemplate && defaultTemplateId && (
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => {
                if (confirm("Esto reemplazará todas las cláusulas actuales con las de la plantilla. ¿Continuar?")) {
                  applyTemplate(defaultTemplateId);
                }
              }}
              disabled={isApplying}
            >
              Cambiar plantilla
            </Button>
          )}
          {isEditable && hasTemplate && (
            <Button
              variant="outline" size="sm" className="h-7 text-xs gap-1"
              onClick={async () => {
                const t = prompt("Título de la nueva cláusula:");
                if (!t?.trim()) return;
                await fetch(`/api/contracts/${contractId}/documents/${documentType}/clauses`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: t.trim() }),
                });
                queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar cláusula
            </Button>
          )}
        </div>
      </div>

      {!hasTemplate && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">No hay cláusulas generadas aún</p>
          {isEditable && defaultTemplateId && (
            <Button size="sm" onClick={() => applyTemplate(defaultTemplateId)} disabled={isApplying}>
              {isApplying ? "Aplicando..." : "Aplicar plantilla estándar"}
            </Button>
          )}
          {isEditable && !defaultTemplateId && (
            <p className="text-xs text-muted-foreground">
              Configurá una plantilla por defecto en el Generador de documentos primero.
            </p>
          )}
        </div>
      )}

      {hasTemplate && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedClauses.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {orderedClauses.map((clause) => (
                <SortableClauseRow
                  key={clause.id}
                  clause={clause}
                  activeNumber={numberMap.get(clause.id) ?? null}
                  isEditable={isEditable}
                  onToggle={(id, isActive) => toggleClause({ id, isActive })}
                  onEdit={setEditingClause}
                  onDelete={(c) => {
                    if (confirm(`¿Eliminar la cláusula "${c.title}"? Esta acción no se puede deshacer.`)) {
                      deleteClause(c.id);
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editingClause && (
        <ContractClauseEditorModal
          clause={editingClause}
          contractId={contractId}
          documentType={documentType}
          resolved={resolved}
          onClose={() => setEditingClause(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | grep -i error | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/contracts/contract-document-section.tsx
git commit -m "feat(ui): ContractDocumentSection with DnD, toggles, auto-numbering and print"
```

---

### Task 10: Wire into contract-detail + default template API

**Files:**
- Modify: `src/app/api/document-templates/route.ts`
- Modify: `src/components/contracts/contract-detail.tsx`

- [ ] **Step 1: Add `isDefault` to GET response in `/api/document-templates/route.ts`**

In the GET handler, add `isDefault: documentTemplate.isDefault` to the `.select()` object:

```ts
const templates = await db
  .select({
    id: documentTemplate.id,
    name: documentTemplate.name,
    isDefault: documentTemplate.isDefault,   // ← add this
    createdAt: documentTemplate.createdAt,
    updatedAt: documentTemplate.updatedAt,
    clauseCount: count(documentTemplateClause.id),
  })
  // rest unchanged
```

- [ ] **Step 2: Add queries to `contract-detail.tsx`**

Inside the `ContractDetail` component (the client component, not the page), add two TanStack Query calls. Use the contract's `id` prop. Find where the component receives `id` and add after the existing queries:

```tsx
const { data: resolvedData } = useQuery<{ resolved: Record<string, string | null> }>({
  queryKey: ["contract-resolved", id],
  queryFn: () =>
    fetch(`/api/document-templates/resolve?contractId=${id}`).then((r) => r.json()),
  enabled: !!id,
});
const resolved = resolvedData?.resolved ?? {};

const { data: templatesData } = useQuery<{ templates: { id: string; name: string; isDefault: boolean }[] }>({
  queryKey: ["document-templates"],
  queryFn: () => fetch("/api/document-templates").then((r) => r.json()),
});
const defaultTemplateId = templatesData?.templates.find((t) => t.isDefault)?.id;
```

- [ ] **Step 3: Add `ContractDocumentSection` to the JSX**

In `contract-detail.tsx`, import the component and add it below the existing contract data (financial fields, parties, etc.), before the activity section:

```tsx
import { ContractDocumentSection } from "./contract-document-section";

// In the JSX, after the existing data cards:
<div className="rounded-lg border border-border p-4">
  <ContractDocumentSection
    contractId={id}
    documentType="contract"
    resolved={resolved}
    defaultTemplateId={defaultTemplateId}
  />
</div>
```

- [ ] **Step 4: Start dev server and test**

```bash
bun dev
```

Open `http://localhost:3000/contratos/[any-contract-id]`. Verify:
- The "Cláusulas del contrato" section appears
- If no template applied: empty state + "Aplicar plantilla estándar" button shows
- Click the button → clauses populate from the template
- Drag a clause to reorder → numbers update
- Toggle a clause off → it grays out and loses its number
- Click "Editar" → modal opens with title + textarea + preview
- Edit text and save → changes persist after page reload

- [ ] **Step 5: Commit**

```bash
git add src/app/api/document-templates/route.ts src/components/contracts/contract-detail.tsx
git commit -m "feat: wire ContractDocumentSection into contract detail page"
```

---

## Self-Review

### Spec coverage check
- [x] DB: `contract_clause` + `contract_document_config` tables → Task 1
- [x] `isDefault` on `documentTemplate` → Task 1
- [x] `documentType` extensibility → all API routes parameterized by `[documentType]`
- [x] Snapshot on apply → Task 5 (deletes old + inserts fresh copy)
- [x] `sourceClauseId` vínculo de origen → Task 1 schema, Task 5 insert
- [x] Editable only in draft/pending_signature → `EDITABLE_STATUSES` constant in every route
- [x] Auto-numbering (active clauses only) → Task 9 `numberMap`
- [x] Ordinal headings in print → `clauseHeading()` in Task 2
- [x] Drag & drop reorder → `DndContext` + `PUT reorder` in Tasks 7 + 9
- [x] Toggle active/inactive → `PATCH { isActive }` wired in Task 9
- [x] Delete custom clauses only → DELETE guard in Task 7
- [x] Clause editor modal (B) → Task 8
- [x] Variable popover Ctrl+Click in preview → `handleVarClick` passed to `renderClauseBody` in Task 8
- [x] `fieldOverrides` persisted → saved via `PATCH` in Task 8
- [x] Print with ordinal numbering → `handlePrint` in Task 9
- [x] Lock UI in read-only state → `isEditable` prop hides controls in Task 9
- [x] Extracted shared components → Tasks 3 + 4

### No placeholders
All steps contain actual code. No TBD, TODO, or "similar to Task N" patterns.

### Type consistency
- `ContractClause` type from `@/db/schema/contract-clause` used consistently in Tasks 8, 9
- `EDITABLE_STATUSES = ["draft", "pending_signature"]` defined locally in each route (acceptable duplication — extract to a shared constant if desired)
- `fieldOverrides` typed as `Record<string, string>` with `.$type<>()` in schema and cast with `as Record<string, string>` in components
