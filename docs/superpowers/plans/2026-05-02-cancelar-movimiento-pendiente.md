# Cancelar movimiento pendiente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la capacidad de cancelar (soft cancel) movimientos pendientes desde la tabla de cuenta corriente del inquilino, con un menú contextual (`...`) por fila y un dialog de confirmación con motivo opcional.

**Architecture:** Se agrega una columna `cancellationReason` a `tenant_ledger`. El PATCH existente se extiende para aceptar ese campo y para cancelar automáticamente los punitorios hijos cuando se cancela el padre. En la UI, `LedgerTable` expone un callback `onCancelEntry` que dispara un dialog en `TenantTabCurrentAccount`, que hace el PATCH y refresca via TanStack Query.

**Tech Stack:** Drizzle ORM · PostgreSQL · Next.js Route Handlers · Zod · React · TanStack Query · shadcn/ui (DropdownMenu, Dialog, Textarea)

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/db/schema/tenant-ledger.ts` | +1 columna `cancellationReason: text` nullable |
| `src/app/api/tenants/[id]/ledger/[entryId]/route.ts` | Extender PATCH: aceptar `cancellationReason`, cancelar hijos |
| `src/components/tenants/ledger-table.tsx` | +prop `onCancelEntry`, +botón `...` con DropdownMenu |
| `src/components/tenants/tenant-tab-current-account.tsx` | +estado dialog, +mutation, +Dialog JSX, pasar prop |

---

## Task 1: Agregar columna `cancellationReason` al schema

**Files:**
- Modify: `src/db/schema/tenant-ledger.ts`

- [ ] **Step 1: Agregar la columna después de `estado`**

Abrir `src/db/schema/tenant-ledger.ts` y agregar la línea marcada con `// ← NUEVO`:

```typescript
  // "proyectado" | "pendiente_revision" | "pendiente" | "registrado" | "conciliado" | "cancelado" | "pago_parcial"
  estado: text("estado").notNull().default("proyectado"),

  cancellationReason: text("cancellationReason"), // ← NUEVO
```

El archivo completo relevante queda así (solo el bloque `estado` + línea nueva):

```typescript
  estado: text("estado").notNull().default("proyectado"),
  cancellationReason: text("cancellationReason"),

  reciboNumero: text("reciboNumero"),
```

- [ ] **Step 2: Aplicar el cambio a la base de datos**

```bash
bun run db:push
```

Esperado: `[✓] Changes applied` (o similar). Si pide confirmación, escribir `yes`.

- [ ] **Step 3: Verificar que el tipo inferido incluye la columna**

No requiere acción manual — `TenantLedger = typeof tenantLedger.$inferSelect` se actualiza automáticamente con Drizzle.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/tenant-ledger.ts
git commit -m "feat: add cancellationReason column to tenant_ledger"
```

---

## Task 2: Extender el PATCH para cancelar con motivo y cascadear a hijos

**Files:**
- Modify: `src/app/api/tenants/[id]/ledger/[entryId]/route.ts`

- [ ] **Step 1: Agregar `cancellationReason` al schema Zod**

Reemplazar el `patchSchema` actual:

```typescript
const patchSchema = z.object({
  monto: z.number().positive().optional(),
  descripcion: z.string().min(1).optional(),
  estado: z.enum(["pendiente", "registrado", "cancelado"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cancellationReason: z.string().optional(),
});
```

- [ ] **Step 2: Persistir `cancellationReason` y cancelar hijos en la lógica del PATCH**

Reemplazar el bloque que hace el `update` y el `return`:

```typescript
    const data = result.data;
    const [updated] = await db
      .update(tenantLedger)
      .set({
        ...(data.monto !== undefined && { monto: String(data.monto) }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.estado !== undefined && { estado: data.estado }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.cancellationReason !== undefined && { cancellationReason: data.cancellationReason }),
        updatedAt: new Date(),
      })
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .returning();

    if (data.estado === "cancelado") {
      await db
        .update(tenantLedger)
        .set({
          estado: "cancelado",
          cancellationReason: data.cancellationReason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(tenantLedger.installmentOf, entryId));
    }

    return NextResponse.json(updated);
```

El archivo completo del handler PATCH queda así:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: inquilinoId, entryId } = await params;
    const body = await request.json();
    const result = patchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const [existing] = await db
      .select({ estado: tenantLedger.estado })
      .from(tenantLedger)
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    if (existing.estado === "conciliado") {
      return NextResponse.json({ error: "No se puede modificar un ítem conciliado" }, { status: 422 });
    }

    const data = result.data;
    const [updated] = await db
      .update(tenantLedger)
      .set({
        ...(data.monto !== undefined && { monto: String(data.monto) }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.estado !== undefined && { estado: data.estado }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.cancellationReason !== undefined && { cancellationReason: data.cancellationReason }),
        updatedAt: new Date(),
      })
      .where(and(eq(tenantLedger.id, entryId), eq(tenantLedger.inquilinoId, inquilinoId)))
      .returning();

    if (data.estado === "cancelado") {
      await db
        .update(tenantLedger)
        .set({
          estado: "cancelado",
          cancellationReason: data.cancellationReason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(tenantLedger.installmentOf, entryId));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error PATCH /api/tenants/:id/ledger/:entryId:", error);
    return NextResponse.json({ error: "Error al actualizar el ítem" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tenants/[id]/ledger/[entryId]/route.ts
git commit -m "feat: extend PATCH ledger entry to accept cancellationReason and cascade cancel children"
```

---

## Task 3: Agregar botón `...` con DropdownMenu en LedgerTable

**Files:**
- Modify: `src/components/tenants/ledger-table.tsx`

- [ ] **Step 1: Agregar imports de DropdownMenu y MoreHorizontal**

Al inicio de `ledger-table.tsx`, agregar en las líneas de import existentes:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
```

- [ ] **Step 2: Agregar `onCancelEntry` al tipo Props**

```typescript
type Props = {
  entries: LedgerEntry[];
  montoOverrides: Record<string, string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectMonth: (period: string) => void;
  onDeselectMonth: (period: string) => void;
  onMontoChange: (id: string, value: string) => void;
  onCancelPunitorio: (id: string) => void;
  onAnularRecibo: (reciboNumero: string) => void;
  onCancelEntry: (entry: LedgerEntry) => void;  // ← NUEVO
  activeFilters: Set<string>;
};
```

- [ ] **Step 3: Agregar función `isCancelable` junto a `isSelectable`**

Después de la función `isSelectable` existente:

```typescript
const CANCELABLE_STATES = ["pendiente", "registrado", "pendiente_revision", "pago_parcial"];

function isCancelable(entry: LedgerEntry): boolean {
  return CANCELABLE_STATES.includes(entry.estado);
}
```

- [ ] **Step 4: Agregar `onCancelEntry` al destructuring del componente**

```typescript
export function LedgerTable({
  entries,
  montoOverrides,
  selectedIds,
  onToggleSelect,
  onSelectMonth,
  onDeselectMonth,
  onMontoChange,
  onCancelPunitorio,
  onAnularRecibo,
  onCancelEntry,   // ← NUEVO
  activeFilters,
}: Props) {
```

- [ ] **Step 5: Reemplazar el bloque Actions en cada fila**

Buscar el bloque `{/* Actions */}` dentro del map de entries y reemplazarlo por:

```tsx
                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {isPunitorio && entry.estado !== "conciliado" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelPunitorio(entry.id)}
                        aria-label="Cancelar punitorio"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </Button>
                    )}
                    {!isPunitorio && isCancelable(entry) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Acciones"
                          >
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onCancelEntry(entry)}
                          >
                            Cancelar movimiento
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {entry.reciboNumero && (
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/recibos/n/${entry.reciboNumero}`, "_blank", "noopener,noreferrer")}
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
                          title={`Ver recibo ${entry.reciboNumero}`}
                        >
                          {entry.reciboNumero}
                        </Button>
                        {["conciliado", "pago_parcial"].includes(entry.estado) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAnularRecibo(entry.reciboNumero!)}
                            aria-label="Anular recibo"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            title="Anular recibo"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/tenants/ledger-table.tsx
git commit -m "feat: add cancel entry dropdown menu to LedgerTable rows"
```

---

## Task 4: Agregar dialog de confirmación en TenantTabCurrentAccount

**Files:**
- Modify: `src/components/tenants/tenant-tab-current-account.tsx`

- [ ] **Step 1: Agregar estado para el dialog de cancelación**

Después de los estados existentes del void receipt dialog (`voidConfirm`, `voidError`), agregar:

```typescript
  // Cancel entry dialog
  const [cancelEntry, setCancelEntry] = useState<LedgerEntry | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelEntryError, setCancelEntryError] = useState<string | null>(null);
```

- [ ] **Step 2: Agregar mutation para cancelar**

Después de `anularReciboMutation`, agregar:

```typescript
  const cancelEntryMutation = useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason: string }) => {
      const response = await fetch(`/api/tenants/${inquilinoId}/ledger/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "cancelado",
          ...(reason.trim() && { cancellationReason: reason.trim() }),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al cancelar el movimiento");
      }
    },
    onSuccess: (_, { entryId }) => {
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(entryId); return next; });
      setMontoOverrides((prev) => { const { [entryId]: _, ...rest } = prev; return rest; });
      setCancelEntry(null);
      setCancelReason("");
      setCancelEntryError(null);
      queryClient.invalidateQueries({ queryKey: ["tenant-ledger", inquilinoId] });
    },
    onError: (error: Error) => {
      setCancelEntryError(error.message);
    },
  });
```

- [ ] **Step 3: Pasar `onCancelEntry` a `<LedgerTable>`**

Encontrar el bloque `<LedgerTable ... />` y agregar la prop nueva:

```tsx
        <LedgerTable
          entries={ledgerEntries}
          montoOverrides={montoOverrides}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectMonth={handleSelectMonth}
          onDeselectMonth={handleDeselectMonth}
          onMontoChange={handleMontoChange}
          onCancelPunitorio={(id) => cancelPunitorio.mutate(id)}
          onAnularRecibo={(reciboNumero) => { setVoidError(null); setVoidConfirm({ reciboNumero }); }}
          onCancelEntry={(entry) => { setCancelEntryError(null); setCancelReason(""); setCancelEntry(entry); }}
          activeFilters={activeFilters}
        />
```

- [ ] **Step 4: Agregar el Dialog de confirmación**

Después del `{/* ── Void receipt dialog ── */}` existente, agregar:

```tsx
      {/* ── Cancel entry dialog ── */}
      <Dialog
        open={cancelEntry !== null}
        onOpenChange={(open) => { if (!open) { setCancelEntry(null); setCancelReason(""); setCancelEntryError(null); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {cancelEntry && (
              <div className="rounded-md border border-border p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground truncate">{cancelEntry.descripcion}</p>
                {cancelEntry.monto !== null && (
                  <p className="font-mono text-sm font-semibold">
                    ${Number(cancelEntry.monto).toLocaleString("es-AR")}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: error de carga, no corresponde cobrar…"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            {cancelEntryError && <p className="text-xs text-destructive">{cancelEntryError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCancelEntry(null); setCancelReason(""); setCancelEntryError(null); }}
              disabled={cancelEntryMutation.isPending}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelEntry && cancelEntryMutation.mutate({ entryId: cancelEntry.id, reason: cancelReason })}
              disabled={cancelEntryMutation.isPending}
            >
              {cancelEntryMutation.isPending ? "Cancelando..." : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Verificar que TypeScript compila sin errores**

```bash
bun run build
```

Esperado: sin errores de tipo. Si hay errores, son de tipo y deben corregirse antes de commitear.

- [ ] **Step 6: Probar en el navegador**

1. Abrir la cuenta corriente de cualquier inquilino con movimientos pendientes
2. Verificar que las filas con estado cancelable muestran el botón `...`
3. Hacer click en `...` → "Cancelar movimiento"
4. Verificar que el dialog muestra descripción y monto del movimiento
5. Ingresar un motivo (opcional) y confirmar
6. Verificar que la fila desaparece de la vista
7. Cambiar filtros para incluir "cancelados" (si existe) o verificar en DB que el estado cambió
8. Verificar que si el alquiler tenía punitorios hijos, también se cancelaron

- [ ] **Step 7: Commit**

```bash
git add src/components/tenants/tenant-tab-current-account.tsx
git commit -m "feat: add cancel entry dialog and mutation to TenantTabCurrentAccount"
```
