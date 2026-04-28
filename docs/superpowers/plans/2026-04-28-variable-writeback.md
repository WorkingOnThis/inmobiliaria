# Variable Write-back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users update real database fields from the variable popover in ContractDocumentSection, instead of only setting per-clause local overrides.

**Architecture:** A shared `writeback-map.ts` maps variable paths to their DB entity and field. A new PATCH endpoint at `/api/contracts/[id]/variable-writeback` receives `{ path, value }`, resolves the target entity from the contract, and runs the update. The `VariablePopover` gains a radio selector ("Solo esta cláusula" / "En la base de datos") and an agency link fallback. On success, the resolved query is invalidated so the chip turns green.

**Tech Stack:** Next.js Route Handlers · Drizzle ORM · TanStack Query · React · TypeScript · Zod · shadcn/ui (Radio Group)

---

## File Map

| File | Action |
|---|---|
| `src/lib/document-templates/writeback-map.ts` | CREATE — shared client+server map |
| `src/app/api/contracts/[id]/variable-writeback/route.ts` | CREATE — PATCH endpoint |
| `src/lib/document-templates/variable-popover.tsx` | MODIFY — radio UI + agency link |
| `src/components/contracts/contract-document-section.tsx` | MODIFY — patchWriteback mutation |

---

## Task 1: Create `writeback-map.ts`

**Files:**
- Create: `src/lib/document-templates/writeback-map.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/document-templates/writeback-map.ts

export type WritebackEntry =
  | {
      entity: "contract" | "property" | "owner" | "tenant_0";
      dbField: string;
      label: string;
      inputType: "text" | "number" | "integer" | "date";
    }
  | {
      entity: "agency";
      settingsPath: string;
      label: string;
    };

export const WRITEBACK_MAP: Record<string, WritebackEntry> = {
  // ── Contrato ───────────────────────────────────────────────────────────────
  precio_inicial_numero:   { entity: "contract", dbField: "monthlyAmount",       label: "Precio mensual del contrato",   inputType: "number" },
  precio_inicial_formato:  { entity: "contract", dbField: "monthlyAmount",       label: "Precio mensual del contrato",   inputType: "number" },
  precio_inicial_letras:   { entity: "contract", dbField: "monthlyAmount",       label: "Precio mensual del contrato",   inputType: "number" },
  fecha_inicio:            { entity: "contract", dbField: "startDate",           label: "Fecha de inicio del contrato",  inputType: "date" },
  fecha_fin:               { entity: "contract", dbField: "endDate",             label: "Fecha de fin del contrato",     inputType: "date" },
  dia_vencimiento:         { entity: "contract", dbField: "paymentDay",          label: "Día de vencimiento del pago",   inputType: "integer" },
  tipo_ajuste:             { entity: "contract", dbField: "adjustmentIndex",     label: "Índice de ajuste",              inputType: "text" },
  periodo_ajuste_meses:    { entity: "contract", dbField: "adjustmentFrequency", label: "Frecuencia de ajuste (meses)",  inputType: "integer" },
  dia_gracia:              { entity: "contract", dbField: "graceDays",           label: "Días de gracia",                inputType: "integer" },
  modalidad_pago:          { entity: "contract", dbField: "paymentModality",     label: "Modalidad de pago",             inputType: "text" },

  // ── Propiedad ─────────────────────────────────────────────────────────────
  domicilio_propiedad_completo:   { entity: "property", dbField: "address",       label: "Dirección de la propiedad",       inputType: "text" },
  domicilio_propiedad_calle:      { entity: "property", dbField: "addressStreet", label: "Calle de la propiedad",           inputType: "text" },
  domicilio_propiedad_numero:     { entity: "property", dbField: "addressNumber", label: "Número de la propiedad",          inputType: "text" },
  domicilio_propiedad_barrio:     { entity: "property", dbField: "zone",          label: "Barrio/zona de la propiedad",     inputType: "text" },
  domicilio_propiedad_unidad:     { entity: "property", dbField: "floorUnit",     label: "Piso/Unidad de la propiedad",     inputType: "text" },
  domicilio_propiedad_ciudad:     { entity: "property", dbField: "city",          label: "Ciudad de la propiedad",          inputType: "text" },
  domicilio_propiedad_provincia:  { entity: "property", dbField: "province",      label: "Provincia de la propiedad",       inputType: "text" },
  tipo_inmueble:                  { entity: "property", dbField: "type",          label: "Tipo de inmueble",                inputType: "text" },
  destino_propiedad:              { entity: "property", dbField: "destino",       label: "Destino del inmueble",            inputType: "text" },

  // ── Locador / Propietario ─────────────────────────────────────────────────
  nombres_locador:          { entity: "owner", dbField: "firstName",     label: "Nombres del locador",           inputType: "text" },
  apellido_locador:         { entity: "owner", dbField: "lastName",      label: "Apellido del locador",          inputType: "text" },
  dni_locador:              { entity: "owner", dbField: "dni",           label: "DNI del locador",               inputType: "text" },
  cuit_locador:             { entity: "owner", dbField: "cuit",          label: "CUIT del locador",              inputType: "text" },
  email_locador:            { entity: "owner", dbField: "email",         label: "Email del locador",             inputType: "text" },
  telefono_locador:         { entity: "owner", dbField: "phone",         label: "Teléfono del locador",          inputType: "text" },
  domicilio_locador:        { entity: "owner", dbField: "address",       label: "Domicilio del locador",         inputType: "text" },
  domicilio_locador_calle:  { entity: "owner", dbField: "addressStreet", label: "Calle del locador",             inputType: "text" },
  domicilio_locador_numero: { entity: "owner", dbField: "addressNumber", label: "Número del domicilio (locador)", inputType: "text" },
  domicilio_locador_barrio: { entity: "owner", dbField: "addressZone",   label: "Barrio del locador",            inputType: "text" },
  domicilio_locador_ciudad: { entity: "owner", dbField: "addressCity",   label: "Ciudad del locador",            inputType: "text" },
  domicilio_locador_provincia: { entity: "owner", dbField: "addressProvince", label: "Provincia del locador",   inputType: "text" },

  // ── Locatario / Inquilino ─────────────────────────────────────────────────
  nombres_locatario:          { entity: "tenant_0", dbField: "firstName",     label: "Nombres del locatario",            inputType: "text" },
  apellido_locatario:         { entity: "tenant_0", dbField: "lastName",      label: "Apellido del locatario",           inputType: "text" },
  dni_locatario:              { entity: "tenant_0", dbField: "dni",           label: "DNI del locatario",                inputType: "text" },
  cuit_locatario:             { entity: "tenant_0", dbField: "cuit",          label: "CUIT del locatario",               inputType: "text" },
  email_locatario:            { entity: "tenant_0", dbField: "email",         label: "Email del locatario",              inputType: "text" },
  telefono_locatario:         { entity: "tenant_0", dbField: "phone",         label: "Teléfono del locatario",           inputType: "text" },
  domicilio_locatario:        { entity: "tenant_0", dbField: "address",       label: "Domicilio del locatario",          inputType: "text" },
  domicilio_locatario_calle:  { entity: "tenant_0", dbField: "addressStreet", label: "Calle del locatario",              inputType: "text" },
  domicilio_locatario_numero: { entity: "tenant_0", dbField: "addressNumber", label: "Número del domicilio (locatario)", inputType: "text" },
  domicilio_locatario_barrio: { entity: "tenant_0", dbField: "addressZone",   label: "Barrio del locatario",             inputType: "text" },
  domicilio_locatario_ciudad: { entity: "tenant_0", dbField: "addressCity",   label: "Ciudad del locatario",             inputType: "text" },
  domicilio_locatario_provincia: { entity: "tenant_0", dbField: "addressProvince", label: "Provincia del locatario",    inputType: "text" },

  // ── Administradora (link only) ─────────────────────────────────────────────
  nombre_administradora:          { entity: "agency", settingsPath: "/agencia", label: "Nombre / razón social" },
  cuit_administradora:            { entity: "agency", settingsPath: "/agencia", label: "CUIT de la administradora" },
  domicilio_administradora:       { entity: "agency", settingsPath: "/agencia", label: "Domicilio fiscal" },
  domicilio_administradora_calle: { entity: "agency", settingsPath: "/agencia", label: "Calle de la administradora" },
  domicilio_administradora_numero:{ entity: "agency", settingsPath: "/agencia", label: "Número de la administradora" },
  domicilio_administradora_barrio:{ entity: "agency", settingsPath: "/agencia", label: "Barrio de la administradora" },
  domicilio_administradora_ciudad:{ entity: "agency", settingsPath: "/agencia", label: "Ciudad de la administradora" },
  domicilio_administradora_provincia: { entity: "agency", settingsPath: "/agencia", label: "Provincia de la administradora" },
  telefono_administradora:        { entity: "agency", settingsPath: "/agencia", label: "Teléfono de la administradora" },
  email_administradora:           { entity: "agency", settingsPath: "/agencia", label: "Email de la administradora" },
  matricula_administradora:       { entity: "agency", settingsPath: "/agencia", label: "Matrícula profesional" },
  firmante_administradora:        { entity: "agency", settingsPath: "/agencia", label: "Nombre del firmante" },
  cbu_administradora:             { entity: "agency", settingsPath: "/agencia", label: "CBU de la administradora" },
  alias_administradora:           { entity: "agency", settingsPath: "/agencia", label: "Alias CBU de la administradora" },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build
```

Expected: No type errors related to `writeback-map.ts`. Build may fail for other pre-existing reasons; those are fine.

- [ ] **Step 3: Commit**

```bash
git add src/lib/document-templates/writeback-map.ts
git commit -m "feat: add variable writeback-map (shared client+server)"
```

---

## Task 2: Create the write-back API endpoint

**Files:**
- Create: `src/app/api/contracts/[id]/variable-writeback/route.ts`

This endpoint receives `{ path, value }`, looks up the path in `WRITEBACK_MAP`, resolves the target entity ID from the contract row, validates the value, and writes to the DB.

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/contracts/[id]/variable-writeback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { contractTenant } from "@/db/schema/contract-tenant";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { WRITEBACK_MAP } from "@/lib/document-templates/writeback-map";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  path: z.string().min(1),
  value: z.string(),
});

function coerceValue(value: string, inputType: "text" | "number" | "integer" | "date"): string | number | null {
  const trimmed = value.trim();
  if (inputType === "text") return trimmed || null;
  if (inputType === "number") {
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n.toString();
  }
  if (inputType === "integer") {
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? null : n;
  }
  if (inputType === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }
  return null;
}

const isLegalRole = (role: string) => role === "legal" || role === "ambos";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageContracts(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { path, value } = parsed.data;

    // Validate path is writable
    const entry = WRITEBACK_MAP[path];
    if (!entry || entry.entity === "agency") {
      return NextResponse.json({ error: "Variable no escribible" }, { status: 400 });
    }

    // Validate value type
    const coerced = coerceValue(value, entry.inputType);
    if (coerced === null) {
      return NextResponse.json({ error: "Valor inválido para este campo" }, { status: 400 });
    }

    // Fetch contract (needed for all entity types)
    const [contractRow] = await db
      .select({ id: contract.id, propertyId: contract.propertyId, ownerId: contract.ownerId })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    // Update the right entity
    if (entry.entity === "contract") {
      await db
        .update(contract)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(contract.id, contractId));
    } else if (entry.entity === "property") {
      await db
        .update(property)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(property.id, contractRow.propertyId));
    } else if (entry.entity === "owner") {
      // Resolve the legal owner (same logic as document-templates/resolve)
      const [propertyRow] = await db
        .select({ ownerRole: property.ownerRole })
        .from(property)
        .where(eq(property.id, contractRow.propertyId))
        .limit(1);

      let legalOwnerId = contractRow.ownerId;
      if (propertyRow && !isLegalRole(propertyRow.ownerRole)) {
        const coOwners = await db
          .select({ clientId: propertyCoOwner.clientId, role: propertyCoOwner.role })
          .from(propertyCoOwner)
          .where(eq(propertyCoOwner.propertyId, contractRow.propertyId));
        const legal = coOwners.find((co) => isLegalRole(co.role));
        if (legal) legalOwnerId = legal.clientId;
      }

      await db
        .update(client)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(client.id, legalOwnerId));
    } else if (entry.entity === "tenant_0") {
      const [tenantRow] = await db
        .select({ clientId: contractTenant.clientId })
        .from(contractTenant)
        .where(
          and(
            eq(contractTenant.contractId, contractId),
            eq(contractTenant.role, "primary")
          )
        )
        .limit(1);

      if (!tenantRow) {
        return NextResponse.json({ error: "Inquilino principal no encontrado" }, { status: 404 });
      }

      await db
        .update(client)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ [entry.dbField]: coerced, updatedAt: new Date() } as any)
        .where(eq(client.id, tenantRow.clientId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error PATCH /api/contracts/:id/variable-writeback:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
bun run build
```

Expected: No errors in the new route file. If TypeScript complains about the `as any` casts, they are intentional — the dynamic key update is safe because we validate the path against WRITEBACK_MAP first.

- [ ] **Step 3: Manual smoke test with curl**

Start the dev server (`bun dev`), then in a separate terminal:

```bash
curl -X PATCH http://localhost:3000/api/contracts/REAL_CONTRACT_ID/variable-writeback \
  -H "Content-Type: application/json" \
  -d '{"path":"precio_inicial_numero","value":"999"}'
```

Expected without a session cookie: `{"error":"No autenticado"}` with status 401. That confirms the route is reachable and auth is working.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/contracts/[id]/variable-writeback/route.ts
git commit -m "feat: add variable-writeback PATCH endpoint"
```

---

## Task 3: Update `VariablePopover` UI

**Files:**
- Modify: `src/lib/document-templates/variable-popover.tsx`

Add: radio selector (Solo esta cláusula / En la base de datos), agency link, `onWriteback` prop.

**Note:** This project uses shadcn/ui. The `RadioGroup` and `RadioGroupItem` components may need to be installed. Check first:

```bash
ls src/components/ui/radio-group.tsx 2>/dev/null && echo "exists" || echo "missing"
```

If missing, install:

```bash
npx shadcn@latest add radio-group
```

- [ ] **Step 1: Install RadioGroup if missing** (run the check above first)

- [ ] **Step 2: Replace `variable-popover.tsx` with the updated version**

```typescript
// src/lib/document-templates/variable-popover.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";
import { VARIABLES_CATALOG } from "@/lib/document-templates/variables-catalog";
import { WRITEBACK_MAP } from "@/lib/document-templates/writeback-map";

export const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT_ESTIMATE = 300;

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
  onWriteback,
  onClose,
}: {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
  currentOverride: string | undefined;
  onApply: (path: string, value: string) => void;
  onClear: (path: string) => void;
  onWriteback?: (path: string, value: string) => void;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState(currentOverride ?? "");
  const [saveMode, setSaveMode] = useState<"local" | "db">("local");
  const ref = useRef<HTMLDivElement>(null);

  const catalogEntry = VARIABLES_CATALOG.find((v) => v.path === path);
  const writebackEntry = WRITEBACK_MAP[path];
  const hasOverride = currentOverride !== undefined;
  const isWritable = writebackEntry && writebackEntry.entity !== "agency";
  const isAgency = writebackEntry?.entity === "agency";

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

  function handleApply() {
    if (!inputValue.trim()) return;
    if (saveMode === "db" && onWriteback) {
      onWriteback(path, inputValue.trim());
      onClose();
    } else {
      onApply(path, inputValue.trim());
      onClose();
    }
  }

  const buttonLabel = saveMode === "db" ? "Guardar en DB" : hasOverride ? "Actualizar" : "Aplicar";

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5"
      style={{ left, top, width: POPOVER_WIDTH }}
    >
      {/* Variable info */}
      <div>
        <code className={`text-xs font-mono ${pathColor}`}>[[{path}]]</code>
        {catalogEntry && (
          <p className="text-xs text-muted-foreground mt-0.5">{catalogEntry.label}</p>
        )}
      </div>

      {/* Resolved value */}
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

      {/* Agency link */}
      {isAgency && writebackEntry.entity === "agency" && (
        <div className="border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
            Este dato se edita en la agencia
          </p>
          <a
            href={writebackEntry.settingsPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ir a configuración de agencia
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Radio + input (non-agency variables) */}
      {!isAgency && (
        <>
          {/* Save mode radio — only shown when write-back is available */}
          {isWritable && onWriteback && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                Guardar como
              </p>
              <RadioGroup
                value={saveMode}
                onValueChange={(v) => setSaveMode(v as "local" | "db")}
                className="gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="local" id={`${path}-local`} className="h-3 w-3" />
                  <Label htmlFor={`${path}-local`} className="text-xs font-normal cursor-pointer">
                    Solo esta cláusula
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="db" id={`${path}-db`} className="h-3 w-3" />
                  <Label htmlFor={`${path}-db`} className="text-xs font-normal cursor-pointer">
                    En la base de datos
                  </Label>
                </div>
              </RadioGroup>
              {saveMode === "db" && writebackEntry && writebackEntry.entity !== "agency" && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Actualizará: {writebackEntry.label}
                </p>
              )}
            </div>
          )}

          {/* Input */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {saveMode === "db" ? "Nuevo valor" : hasOverride ? "Override activo" : "Sobreescribir valor"}
            </p>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              placeholder={saveMode === "db" ? "Valor a guardar en DB..." : "Valor personalizado..."}
              className="h-7 text-xs"
              type={
                writebackEntry && writebackEntry.entity !== "agency" && writebackEntry.inputType === "number"
                  ? "number"
                  : writebackEntry && writebackEntry.entity !== "agency" && writebackEntry.inputType === "integer"
                  ? "number"
                  : writebackEntry && writebackEntry.entity !== "agency" && writebackEntry.inputType === "date"
                  ? "date"
                  : "text"
              }
            />
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 justify-end">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onClose}>
              Cancelar
            </Button>
            {saveMode === "local" && hasOverride && (
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
              onClick={handleApply}
              disabled={!inputValue.trim()}
            >
              {buttonLabel}
            </Button>
          </div>
        </>
      )}

      {/* Agency: just a close button */}
      {isAgency && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Start dev server and verify the popover UI**

```bash
bun dev
```

Navigate to a contract that has clauses applied. Open the preview mode (Vista previa). Click on a variable like `[[precio_inicial_numero]]`.

Expected:
- Popover opens with the radio "Solo esta cláusula / En la base de datos"
- Selecting "En la base de datos" shows helper text "Actualizará: Precio mensual del contrato"
- Clicking on an agency variable (`[[nombre_administradora]]`) shows the agency link instead of the radio

- [ ] **Step 4: Commit**

```bash
git add src/lib/document-templates/variable-popover.tsx
git add src/components/ui/radio-group.tsx  # only if it was newly installed
git commit -m "feat: add write-back radio selector to VariablePopover"
```

---

## Task 4: Wire up the mutation in `ContractDocumentSection`

**Files:**
- Modify: `src/components/contracts/contract-document-section.tsx`

Add the `patchWriteback` mutation and pass `onWriteback` to `VariablePopover`. On success: clear the local override (if any), clear the clause's fieldOverrides for this path if in preview mode, invalidate `["contract-resolved", contractId]`.

- [ ] **Step 1: Add the `patchWriteback` mutation**

Inside `ContractDocumentSection`, after the existing `patchOverride` mutation, add:

```typescript
const { mutate: patchWriteback } = useMutation({
  mutationFn: async ({
    path,
    value,
  }: {
    path: string;
    value: string;
    previewClauseId?: string;
    previewCurrentOverrides?: Record<string, string>;
  }) => {
    const res = await fetch(
      `/api/contracts/${contractId}/variable-writeback`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, value }),
      }
    );
    if (!res.ok) throw new Error((await res.json()).error ?? "Error al guardar");
  },
  onSuccess: (_, { path, previewClauseId, previewCurrentOverrides }) => {
    // Clear override in edit mode
    setEditOverrides((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    // Clear override in preview mode if this path was overridden in the clause
    if (previewClauseId && previewCurrentOverrides?.[path] !== undefined) {
      const next = { ...previewCurrentOverrides };
      delete next[path];
      patchOverride({ clauseId: previewClauseId, fieldOverrides: next });
    }
    queryClient.invalidateQueries({ queryKey: ["contract-resolved", contractId] });
    setPopoverState(null);
    toast.success("Campo actualizado");
  },
  onError: (err: Error) => toast.error(err.message),
});
```

- [ ] **Step 2: Pass `onWriteback` to `VariablePopover`**

Find the `<VariablePopover ... />` render (around line 694) and add the `onWriteback` prop:

```typescript
<VariablePopover
  path={popoverState.path}
  rect={popoverState.rect}
  resolvedValue={popoverState.resolvedValue}
  currentOverride={
    popoverState.previewClauseId
      ? popoverState.previewCurrentOverrides?.[popoverState.path]
      : editOverrides[popoverState.path]
  }
  onApply={(path, value) => {
    if (popoverState.previewClauseId) {
      patchOverride({
        clauseId: popoverState.previewClauseId,
        fieldOverrides: { ...popoverState.previewCurrentOverrides, [path]: value },
      });
    } else {
      setEditOverrides((prev) => ({ ...prev, [path]: value }));
    }
  }}
  onClear={(path) => {
    if (popoverState.previewClauseId) {
      const next = { ...(popoverState.previewCurrentOverrides ?? {}) };
      delete next[path];
      patchOverride({ clauseId: popoverState.previewClauseId, fieldOverrides: next });
    } else {
      setEditOverrides((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
  }}
  onWriteback={(path, value) => {
    patchWriteback({
      path,
      value,
      previewClauseId: popoverState.previewClauseId,
      previewCurrentOverrides: popoverState.previewCurrentOverrides,
    });
  }}
  onClose={() => setPopoverState(null)}
/>
```

- [ ] **Step 3: End-to-end test in the browser**

With `bun dev` running, navigate to a contract with clauses applied. Test the following scenarios:

**Scenario A — Write-back from preview mode:**
1. Open Vista previa
2. Click on `[[precio_inicial_numero]]`
3. Select "En la base de datos"
4. Type a new price (e.g. `200000`)
5. Click "Guardar en DB"
6. Expected: toast "Campo actualizado", chip turns green with updated value

**Scenario B — Override still works:**
1. Click on any variable
2. Keep "Solo esta cláusula" selected
3. Type a value and click "Aplicar"
4. Expected: chip turns amber (override), works as before

**Scenario C — Agency variable:**
1. Click on `[[nombre_administradora]]`
2. Expected: no radio shown, link to agency settings visible

**Scenario D — Non-writable variable (e.g. `duracion_texto`):**
1. Click on `[[duracion_texto]]`
2. Expected: no radio shown (variable is not in WRITEBACK_MAP), only override input

- [ ] **Step 4: Commit**

```bash
git add src/components/contracts/contract-document-section.tsx
git commit -m "feat: wire patchWriteback mutation in ContractDocumentSection"
```

---

## Adding new writable variables in the future

When adding a new variable to `VARIABLES_CATALOG`:
1. If it maps to a single DB column → add one entry to `WRITEBACK_MAP` in `src/lib/document-templates/writeback-map.ts`
2. If it's derived from multiple columns → leave it out of `WRITEBACK_MAP` (override only)
3. If it's for a new entity type (e.g. co-tenant, second guarantor) → add the entity type to `WritebackEntry` in `writeback-map.ts` and add the ID resolution logic in the endpoint's switch statement
