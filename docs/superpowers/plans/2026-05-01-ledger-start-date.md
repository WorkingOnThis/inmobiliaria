# Ledger Start Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir elegir desde qué mes se generan los cobros al crear un contrato que ya estaba en curso, y poder regenerarlo después desde la ficha si se olvidó al crearlo.

**Architecture:** Se agrega `ledgerStartDate` (optional) al schema del contrato. El formulario de creación lo muestra automáticamente cuando `startDate` tiene más de 30 días en el pasado. La ficha del contrato expone el campo editable + botón "Generar cobros" que crea el ledger (o lo regenera borrando solo entradas no cobradas).

**Tech Stack:** Next.js 15 App Router · Drizzle ORM · PostgreSQL · React 19 · TanStack Query · shadcn/ui · Zod

---

## Archivos involucrados

| Acción | Archivo |
|--------|---------|
| Modificar | `src/db/schema/contract.ts` |
| Modificar | `src/app/api/contracts/route.ts` |
| Modificar | `src/app/api/contracts/[id]/route.ts` |
| Modificar | `src/app/api/contracts/[id]/generate-ledger/route.ts` |
| Modificar | `src/lib/ledger/generate-contract-ledger.ts` |
| Modificar | `src/components/contracts/contract-form.tsx` |
| Modificar | `src/components/contracts/contract-detail.tsx` |

---

## Task 1: Agregar `ledgerStartDate` al schema

**Files:**
- Modify: `src/db/schema/contract.ts`

- [ ] **Step 1: Agregar columna al schema**

En `src/db/schema/contract.ts`, agregar después de `endDate`:

```ts
ledgerStartDate: text("ledgerStartDate"), // "YYYY-MM-DD" — overrides startDate for ledger generation
```

El bloque `pgTable` queda así en esa zona:
```ts
startDate: text("startDate").notNull(),
endDate: text("endDate").notNull(),
ledgerStartDate: text("ledgerStartDate"),
```

- [ ] **Step 2: Aplicar al schema de la DB**

```bash
bun run db:push
```

Responder `Yes` cuando pregunte si continuar.

- [ ] **Step 3: Verificar en Drizzle Studio**

```bash
bun run db:studio
```

Confirmar que la columna `ledgerStartDate` aparece en la tabla `contract` (nullable).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/contract.ts
git commit -m "feat: add ledgerStartDate column to contract schema"
```

---

## Task 2: Actualizar API — crear y editar contrato

**Files:**
- Modify: `src/app/api/contracts/route.ts`
- Modify: `src/app/api/contracts/[id]/route.ts`

- [ ] **Step 1: Agregar `ledgerStartDate` al schema de creación**

En `src/app/api/contracts/route.ts`, en `createContractSchema` (línea ~14), agregar al final del objeto:

```ts
ledgerStartDate: z.string().optional().nullable(),
```

- [ ] **Step 2: Guardar `ledgerStartDate` al crear contrato**

En el mismo archivo, dentro del `tx.insert(contract).values({...})` (línea ~244), agregar después de `adjustmentFrequency`:

```ts
ledgerStartDate: data.ledgerStartDate ?? null,
```

- [ ] **Step 3: Agregar `ledgerStartDate` al GET del contrato**

En `src/app/api/contracts/[id]/route.ts`, en el `db.select({...})` del GET (línea ~54), agregar:

```ts
ledgerStartDate: contract.ledgerStartDate,
```

- [ ] **Step 4: Agregar `ledgerStartDate` al schema de edición**

En `src/app/api/contracts/[id]/route.ts`, en `patchContractSchema` (línea ~18), agregar:

```ts
ledgerStartDate: z.string().optional().nullable(),
```

- [ ] **Step 5: Aplicar el update en PATCH**

En el mismo archivo, en el bloque de `updates` del PATCH (línea ~386), agregar antes del `db.update(...)`:

```ts
if (data.ledgerStartDate !== undefined) updates.ledgerStartDate = data.ledgerStartDate;
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/contracts/route.ts src/app/api/contracts/[id]/route.ts
git commit -m "feat: accept ledgerStartDate in contract create and update APIs"
```

---

## Task 3: Actualizar `buildLedgerEntries` y la API de generación

**Files:**
- Modify: `src/lib/ledger/generate-contract-ledger.ts`
- Modify: `src/app/api/contracts/[id]/generate-ledger/route.ts`

- [ ] **Step 1: Agregar `ledgerStartDate` a `ContractData`**

En `src/lib/ledger/generate-contract-ledger.ts`, en el tipo `ContractData` (línea ~4), agregar:

```ts
ledgerStartDate: string | null;
```

- [ ] **Step 2: Usar `ledgerStartDate` en la iteración**

En la misma función `buildLedgerEntries`, línea ~74, reemplazar:

```ts
const start = new Date(contract.startDate + "T00:00:00");
```

por:

```ts
const start = new Date((contract.ledgerStartDate ?? contract.startDate) + "T00:00:00");
```

- [ ] **Step 3: Soportar regeneración forzada en la API**

En `src/app/api/contracts/[id]/generate-ledger/route.ts`, reemplazar el bloque completo del archivo con esta versión que acepta `force=true` por query param para borrar entradas no cobradas y regenerar:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { servicio } from "@/db/schema/servicio";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { buildLedgerEntries } from "@/lib/ledger/generate-contract-ledger";
import { eq, and, inArray } from "drizzle-orm";

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

    const { id: contractId } = await params;
    const force = request.nextUrl.searchParams.get("force") === "true";

    const [contractRow] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    // Check existing entries
    const existingEntries = await db
      .select({ id: tenantLedger.id, estado: tenantLedger.estado })
      .from(tenantLedger)
      .where(eq(tenantLedger.contratoId, contractId));

    if (existingEntries.length > 0) {
      if (!force) {
        return NextResponse.json(
          { error: "Este contrato ya tiene entradas generadas. Usá force=true para regenerar." },
          { status: 409 }
        );
      }

      // Only delete non-paid entries
      const deletableIds = existingEntries
        .filter((e) => e.estado !== "cobrado")
        .map((e) => e.id);

      if (deletableIds.length > 0) {
        await db
          .delete(tenantLedger)
          .where(inArray(tenantLedger.id, deletableIds));
      }
    }

    const [primaryTenant] = await db
      .select({ clientId: contractTenant.clientId })
      .from(contractTenant)
      .where(
        and(
          eq(contractTenant.contractId, contractId),
          eq(contractTenant.role, "primary")
        )
      )
      .limit(1);

    if (!primaryTenant) {
      return NextResponse.json({ error: "El contrato no tiene inquilino principal" }, { status: 422 });
    }

    const services = await db
      .select({
        id: servicio.id,
        tipo: servicio.tipo,
        company: servicio.company,
        tipoGestion: servicio.tipoGestion,
        propietarioResponsable: servicio.propietarioResponsable,
      })
      .from(servicio)
      .where(eq(servicio.propertyId, contractRow.propertyId));

    const entries = buildLedgerEntries(
      {
        id: contractRow.id,
        propertyId: contractRow.propertyId,
        ownerId: contractRow.ownerId,
        startDate: contractRow.startDate,
        endDate: contractRow.endDate,
        ledgerStartDate: contractRow.ledgerStartDate,
        monthlyAmount: contractRow.monthlyAmount,
        paymentDay: contractRow.paymentDay,
        adjustmentIndex: contractRow.adjustmentIndex,
        adjustmentFrequency: contractRow.adjustmentFrequency,
      },
      primaryTenant.clientId,
      services,
    );

    if (entries.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      await db.insert(tenantLedger).values(batch);
      inserted += batch.length;
    }

    return NextResponse.json({ inserted }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/contracts/:id/generate-ledger:", error);
    return NextResponse.json({ error: "Error al generar el ledger" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ledger/generate-contract-ledger.ts src/app/api/contracts/[id]/generate-ledger/route.ts
git commit -m "feat: use ledgerStartDate in buildLedgerEntries, support force regeneration"
```

---

## Task 4: UI — formulario de creación

**Files:**
- Modify: `src/components/contracts/contract-form.tsx`

- [ ] **Step 1: Agregar estado para `ledgerStartDate`**

En `src/components/contracts/contract-form.tsx`, cerca de la línea 70 donde está `const [isImported, setIsImported] = useState(false)`, agregar:

```ts
const [ledgerStartDate, setLedgerStartDate] = useState<string>("");
```

- [ ] **Step 2: Calcular si `startDate` es "vieja" (> 30 días en el pasado)**

Justo debajo del estado, agregar:

```ts
const startDateIsOld = (() => {
  if (!step2.startDate) return false;
  const start = new Date(step2.startDate + "T00:00:00");
  const diffDays = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 30;
})();
```

- [ ] **Step 3: Sincronizar `ledgerStartDate` cuando cambia `startDate`**

En el handler `onChange` del `DatePicker` de `startDate` (línea ~750), después de cada `setStep2(...)`, agregar:

```ts
setLedgerStartDate(""); // reset so it defaults to new startDate
```

- [ ] **Step 4: Mostrar el campo `ledgerStartDate` en el paso 2**

En el paso 2 del formulario, después del bloque de "Período" (después del campo `endDate`, línea ~800 aprox), agregar:

```tsx
{startDateIsOld && (
  <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
    <div>
      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
        El contrato empieza en el pasado
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        ¿Desde qué mes generamos los cobros? Por defecto arranca desde la fecha de inicio.
      </p>
    </div>
    <div className="space-y-2">
      <Label>Primer mes a cobrar</Label>
      <DatePicker
        value={ledgerStartDate || step2.startDate}
        onChange={(v) => setLedgerStartDate(v)}
      />
    </div>
  </div>
)}
```

- [ ] **Step 5: Incluir `ledgerStartDate` en el payload de creación**

En la función de submit (línea ~276), dentro del objeto que se envía al POST, agregar:

```ts
ledgerStartDate: startDateIsOld && ledgerStartDate ? ledgerStartDate : null,
```

- [ ] **Step 6: Probar manualmente**

Ir a `/contratos/nuevo`, poner una fecha de inicio de hace más de 30 días (ej: hace 3 meses), avanzar al paso 2. Verificar que aparece el bloque ámbar con el campo "Primer mes a cobrar". Crear el contrato y verificar en Drizzle Studio que `ledgerStartDate` quedó guardado.

- [ ] **Step 7: Commit**

```bash
git add src/components/contracts/contract-form.tsx
git commit -m "feat: show ledgerStartDate picker in contract form when startDate is in the past"
```

---

## Task 5: UI — ficha del contrato (generar/regenerar cobros)

**Files:**
- Modify: `src/components/contracts/contract-detail.tsx`

- [ ] **Step 1: Agregar `ledgerStartDate` al tipo del contrato**

En `src/components/contracts/contract-detail.tsx`, buscar el tipo `ContractDetail` (o el interface que define los campos del contrato en el componente). Agregar:

```ts
ledgerStartDate: string | null;
```

- [ ] **Step 2: Agregar estado para el campo editable y para el recuento del ledger**

Dentro del componente `ContractDetail`, agregar estados:

```ts
const [ledgerStartDateEdit, setLedgerStartDateEdit] = useState<string>("");
const [ledgerCount, setLedgerCount] = useState<number | null>(null);
```

- [ ] **Step 3: Consultar cuántas entradas de ledger existen**

Agregar un `useQuery` para saber si el ledger ya fue generado:

```ts
const { data: ledgerData, refetch: refetchLedger } = useQuery<{ count: number }>({
  queryKey: ["ledger-count", id],
  queryFn: () =>
    fetch(`/api/contracts/${id}/generate-ledger/count`)
      .then((r) => r.json()),
});
const hasLedger = (ledgerData?.count ?? 0) > 0;
```

**Nota:** Este endpoint GET no existe todavía — se crea en el siguiente step.

- [ ] **Step 4: Crear endpoint GET para contar entradas del ledger**

Crear `src/app/api/contracts/[id]/generate-ledger/count/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { count } from "drizzle-orm";

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

    const { id: contractId } = await params;

    const [result] = await db
      .select({ count: count() })
      .from(tenantLedger)
      .where(eq(tenantLedger.contratoId, contractId));

    return NextResponse.json({ count: result?.count ?? 0 });
  } catch (error) {
    console.error("Error GET generate-ledger/count:", error);
    return NextResponse.json({ error: "Error al contar entradas" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Agregar mutación para generar/regenerar ledger**

En `contract-detail.tsx`, agregar la mutación:

```ts
const generateLedger = useMutation({
  mutationFn: ({ force }: { force: boolean }) =>
    fetch(`/api/contracts/${id}/generate-ledger${force ? "?force=true" : ""}`, {
      method: "POST",
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Error al generar");
      }
      return r.json();
    }),
  onSuccess: (data, { force }) => {
    toast.success(`${force ? "Regenerado" : "Generado"}: ${data.inserted} entradas`);
    refetchLedger();
    queryClient.invalidateQueries({ queryKey: ["tenant-ledger"] });
  },
  onError: (err: Error) => toast.error(err.message),
});
```

- [ ] **Step 6: Agregar mutación para guardar `ledgerStartDate`**

```ts
const saveLedgerStartDate = useMutation({
  mutationFn: (date: string | null) =>
    fetch(`/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledgerStartDate: date }),
    }).then((r) => r.json()),
  onSuccess: () => {
    toast.success("Fecha de inicio actualizada");
    queryClient.invalidateQueries({ queryKey: ["contract", id] });
  },
  onError: () => toast.error("Error al guardar"),
});
```

- [ ] **Step 7: Inicializar `ledgerStartDateEdit` con el valor del contrato**

En el `useEffect` que carga los datos del contrato (o en el `useQuery` onSuccess), agregar:

```ts
setLedgerStartDateEdit(contract.ledgerStartDate ?? "");
```

Si no hay un effect dedicado, hacerlo con un efecto que dependa de `contractData`:

```ts
useEffect(() => {
  if (contractData?.contract) {
    setLedgerStartDateEdit(contractData.contract.ledgerStartDate ?? "");
  }
}, [contractData]);
```

- [ ] **Step 8: Agregar sección "Cobros" al final de la ficha**

En el render de `contract-detail.tsx`, al final del contenido (antes del cierre del componente principal), agregar esta sección. Debe aparecer solo cuando el contrato está en estado `active` o `draft`:

```tsx
{(contract.status === "active" || contract.status === "draft") && (
  <div className="rounded-xl border border-border p-5 space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold">Cobros del contrato</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasLedger
            ? `${ledgerData?.count} entradas generadas`
            : "El ledger no fue generado todavía"}
        </p>
      </div>
      {hasLedger ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateLedger.mutate({ force: true })}
          disabled={generateLedger.isPending}
        >
          {generateLedger.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Regenerar cobros
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => generateLedger.mutate({ force: false })}
          disabled={generateLedger.isPending}
        >
          {generateLedger.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Generar cobros
        </Button>
      )}
    </div>

    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Primer mes a cobrar</Label>
      <div className="flex items-center gap-2">
        <DatePicker
          value={ledgerStartDateEdit || contract.startDate}
          onChange={(v) => setLedgerStartDateEdit(v)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveLedgerStartDate.mutate(ledgerStartDateEdit || null)}
          disabled={saveLedgerStartDate.isPending}
        >
          Guardar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Si está en blanco, arranca desde la fecha de inicio del contrato.
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 9: Probar manualmente**

1. Abrir la ficha del contrato de Eufrasio Loza
2. Verificar que aparece la sección "Cobros del contrato" con el botón "Generar cobros"
3. Setear el "Primer mes a cobrar", guardar, luego presionar "Generar cobros"
4. Verificar que la cuenta corriente muestra los meses generados desde el mes elegido

- [ ] **Step 10: Commit**

```bash
git add src/components/contracts/contract-detail.tsx src/app/api/contracts/[id]/generate-ledger/count/route.ts
git commit -m "feat: add generate/regenerate ledger section to contract detail"
```

---

## Checklist final

- [ ] `ledgerStartDate` guardado en DB al crear contrato con fecha vieja
- [ ] `ledgerStartDate` editable desde la ficha antes de generar
- [ ] Botón "Generar cobros" crea entradas desde `ledgerStartDate` (o `startDate` si no hay)
- [ ] Botón "Regenerar cobros" borra pendientes/proyectados y regenera (no toca cobrados)
- [ ] El formulario muestra el aviso ámbar solo cuando `startDate` > 30 días en el pasado
- [ ] `bun run build` sin errores TypeScript
