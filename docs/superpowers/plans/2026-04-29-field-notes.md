# Field Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar anotaciones por campo en la ficha de propiedades — los agentes seleccionan texto en un campo, clickean "Comentar este campo", y dejan una nota visible para toda la agencia via Popover estilo Discord.

**Architecture:** Nueva tabla `field_note` en Postgres con restricción única por `(agencyId, entityType, entityId, fieldName, authorId)`. API REST bajo `/api/field-notes`. Componente `AnnotatableField` que reemplaza `DatoItem` en el tab Datos, usando `PopoverPrimitive.Root` con anchor en el card y `PopoverContent` de shadcn para el panel interactivo.

**Tech Stack:** Next.js App Router · Drizzle ORM · React Query · shadcn/ui (Popover, AlertDialog, Tooltip) · `@radix-ui/react-popover` (directo para `Anchor`) · date-fns · Better Auth

---

## File Map

| acción | archivo |
|---|---|
| CREAR | `src/db/schema/field-note.ts` |
| MODIFICAR | `src/db/schema/index.ts` |
| CREAR | `src/app/api/field-notes/route.ts` |
| CREAR | `src/app/api/field-notes/[id]/route.ts` |
| CREAR | `src/components/ui/annotatable-field.tsx` |
| MODIFICAR | `src/app/(dashboard)/propiedades/[id]/page.tsx` |

---

## Task 1: Schema de base de datos + migración

**Files:**
- Create: `src/db/schema/field-note.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Crear el schema**

Crear `src/db/schema/field-note.ts` con este contenido exacto:

```typescript
import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { agency } from "./agency";
import { user } from "./better-auth";

export const fieldNote = pgTable(
  "field_note",
  {
    id: text("id").primaryKey(),
    agencyId: text("agencyId")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    entityType: text("entityType").notNull(),
    entityId: text("entityId").notNull(),
    fieldName: text("fieldName").notNull(),
    comment: text("comment").notNull(),
    authorId: text("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    unique("field_note_unique").on(
      t.agencyId,
      t.entityType,
      t.entityId,
      t.fieldName,
      t.authorId
    ),
  ]
);
```

- [ ] **Step 2: Agregar export en el índice**

En `src/db/schema/index.ts`, agregar esta línea al final de la lista de exports:

```typescript
export * from "./field-note";
```

- [ ] **Step 3: Generar la migración**

```bash
bun run db:generate
```

Esperado: aparece un nuevo archivo en `drizzle/` con `CREATE TABLE field_note (...)` y el `CREATE UNIQUE INDEX`.

- [ ] **Step 4: Aplicar la migración**

```bash
bun run db:migrate
```

Esperado: `✓ Applied X migrations` sin errores.

- [ ] **Step 5: Verificar en Drizzle Studio**

```bash
bun run db:studio
```

Abrir en el browser y confirmar que existe la tabla `field_note` con las columnas correctas y el índice único.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/field-note.ts src/db/schema/index.ts drizzle/
git commit -m "feat: add field_note schema and migration"
```

---

## Task 2: API GET + POST `/api/field-notes`

**Files:**
- Create: `src/app/api/field-notes/route.ts`

- [ ] **Step 1: Crear el archivo de ruta**

Crear `src/app/api/field-notes/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { fieldNote } from "@/db/schema/field-note";
import { user } from "@/db/schema/better-auth";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

async function getAgencyId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const agencyId = await getAgencyId(session.user.id);
  if (!agencyId) return NextResponse.json([], { status: 200 });

  const entityType = request.nextUrl.searchParams.get("entityType") ?? "";
  const entityId = request.nextUrl.searchParams.get("entityId") ?? "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Parámetros entityType y entityId son requeridos" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: fieldNote.id,
      fieldName: fieldNote.fieldName,
      comment: fieldNote.comment,
      authorId: fieldNote.authorId,
      authorName: user.name,
      createdAt: fieldNote.createdAt,
      updatedAt: fieldNote.updatedAt,
    })
    .from(fieldNote)
    .innerJoin(user, eq(user.id, fieldNote.authorId))
    .where(
      and(
        eq(fieldNote.agencyId, agencyId),
        eq(fieldNote.entityType, entityType),
        eq(fieldNote.entityId, entityId)
      )
    );

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const role = session.user.role as string;
  if (role !== "agent" && role !== "account_admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const agencyId = await getAgencyId(session.user.id);
  if (!agencyId) return NextResponse.json({ error: "Agencia no encontrada" }, { status: 400 });

  const body = await request.json();
  const { entityType, entityId, fieldName, comment } = body;

  if (!entityType || !entityId || !fieldName || !comment?.trim()) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: fieldNote.id })
    .from(fieldNote)
    .where(
      and(
        eq(fieldNote.agencyId, agencyId),
        eq(fieldNote.entityType, entityType),
        eq(fieldNote.entityId, entityId),
        eq(fieldNote.fieldName, fieldName),
        eq(fieldNote.authorId, session.user.id)
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Ya existe una nota tuya para este campo" }, { status: 409 });
  }

  const [created] = await db
    .insert(fieldNote)
    .values({
      id: crypto.randomUUID(),
      agencyId,
      entityType,
      entityId,
      fieldName,
      comment: comment.trim(),
      authorId: session.user.id,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: Verificar que compila**

```bash
bun run build
```

Esperado: sin errores de TypeScript en los nuevos archivos.

- [ ] **Step 3: Probar GET en el browser**

Con el servidor corriendo (`bun dev`), abrir en el browser:

```
http://localhost:3000/api/field-notes?entityType=property&entityId=CUALQUIER_ID_VALIDO
```

Esperado: respuesta `[]` (array vacío, sin errores 500).

- [ ] **Step 4: Probar POST con curl**

```bash
curl -X POST http://localhost:3000/api/field-notes \
  -H "Content-Type: application/json" \
  -d '{"entityType":"property","entityId":"TEST","fieldName":"address","comment":"Prueba"}' \
  -b "tu-cookie-de-sesion"
```

Esperado: 201 con el objeto creado, o 401 si la cookie no es válida (lo cual es correcto — probar desde el browser con sesión activa usando Fetch en la consola es más fácil).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/field-notes/route.ts
git commit -m "feat: add field-notes GET and POST endpoints"
```

---

## Task 3: API PATCH + DELETE `/api/field-notes/[id]`

**Files:**
- Create: `src/app/api/field-notes/[id]/route.ts`

- [ ] **Step 1: Crear el archivo de ruta**

Crear `src/app/api/field-notes/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { fieldNote } from "@/db/schema/field-note";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const role = session.user.role as string;
  if (role !== "agent" && role !== "account_admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const comment = body.comment?.trim();

  if (!comment) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
  }

  const [existing] = await db
    .select({ authorId: fieldNote.authorId })
    .from(fieldNote)
    .where(eq(fieldNote.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Solo podés editar tus propias notas" }, { status: 403 });
  }

  const [updated] = await db
    .update(fieldNote)
    .set({ comment, updatedAt: new Date() })
    .where(eq(fieldNote.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const role = session.user.role as string;
  if (role !== "agent" && role !== "account_admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select({ authorId: fieldNote.authorId })
    .from(fieldNote)
    .where(eq(fieldNote.id, id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Solo podés eliminar tus propias notas" }, { status: 403 });
  }

  await db.delete(fieldNote).where(eq(fieldNote.id, id));
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Verificar que compila**

```bash
bun run build
```

Esperado: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/field-notes/[id]/route.ts
git commit -m "feat: add field-notes PATCH and DELETE endpoints"
```

---

## Task 4: Componente `AnnotatableField`

**Files:**
- Create: `src/components/ui/annotatable-field.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/ui/annotatable-field.tsx`:

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface FieldNote {
  id: string;
  fieldName: string;
  comment: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

interface AnnotatableFieldProps {
  label: string;
  value?: string | number | null;
  highlight?: boolean;
  fieldName: string;
  entityType: "property" | "client";
  entityId: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function AnnotatableField({
  label,
  value,
  highlight,
  fieldName,
  entityType,
  entityId,
}: AnnotatableFieldProps) {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const role = session?.user?.role as string | undefined;
  const canWrite = role === "agent" || role === "account_admin";

  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saveConfirm, setSaveConfirm] = useState<{
    id: string;
    text: string;
  } | null>(null);

  const queryKey = ["field-notes", entityType, entityId];

  const { data: allNotes = [] } = useQuery<FieldNote[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/field-notes?entityType=${entityType}&entityId=${entityId}`
      );
      if (!res.ok) throw new Error("Error cargando notas");
      return res.json();
    },
  });

  const fieldNotes = allNotes.filter((n) => n.fieldName === fieldName);
  const hasNotes = fieldNotes.length > 0;
  const myNote = fieldNotes.find((n) => n.authorId === currentUserId);
  const canAdd = canWrite && !myNote;

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createNote = useMutation({
    mutationFn: async (comment: string) => {
      const res = await fetch("/api/field-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, fieldName, comment }),
      });
      if (!res.ok) throw new Error("Error creando nota");
    },
    onSuccess: () => {
      invalidate();
      setNewNoteText("");
      setAddingNote(false);
      setBubbleVisible(false);
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const res = await fetch(`/api/field-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error("Error actualizando nota");
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setSaveConfirm(null);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/field-notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando nota");
    },
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      if (fieldNotes.length === 1) setPopoverOpen(false);
    },
  });

  const handleMouseUp = useCallback(() => {
    if (!canAdd) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setBubbleVisible(false);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!cardRef.current?.contains(range.commonAncestorContainer)) {
      setBubbleVisible(false);
      return;
    }
    setBubbleVisible(true);
  }, [canAdd]);

  const openPopover = (withAdd = false) => {
    window.getSelection()?.removeAllRanges();
    setBubbleVisible(false);
    if (withAdd) setAddingNote(true);
    setPopoverOpen(true);
  };

  const closePopover = () => {
    setPopoverOpen(false);
    setAddingNote(false);
    setEditingId(null);
    setNewNoteText("");
    setEditText("");
  };

  const startEdit = (note: FieldNote) => {
    setEditingId(note.id);
    setEditText(note.comment);
  };

  const handleEditBlur = (id: string, original: string) => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== original) {
      setSaveConfirm({ id, text: trimmed });
    } else {
      setEditingId(null);
    }
  };

  return (
    <>
      <PopoverPrimitive.Root
        open={popoverOpen}
        onOpenChange={(open) => {
          if (!open) closePopover();
        }}
      >
        <PopoverPrimitive.Anchor asChild>
          <div
            ref={cardRef}
            className="relative rounded-md border border-border bg-card px-3.5 py-3"
            onMouseUp={handleMouseUp}
          >
            {/* Label */}
            {hasNotes ? (
              <div
                className="mb-1 inline-flex cursor-pointer select-none items-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.09em]"
                style={{
                  color: "var(--mustard)",
                  borderBottom: "1.5px solid var(--mustard)",
                  paddingBottom: "1px",
                }}
                onClick={() => openPopover()}
              >
                {label} <span className="text-[8px]">✦</span>
              </div>
            ) : (
              <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                {label}
              </div>
            )}

            {/* Value */}
            <div
              className="text-[0.82rem] font-semibold"
              style={{
                color: highlight
                  ? "var(--mustard)"
                  : value
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
              }}
            >
              {value ?? "—"}
            </div>

            {/* Bubble flotante */}
            {bubbleVisible && (
              <div
                className="absolute -top-8 left-3 z-50 flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 shadow-lg transition-colors hover:border-[var(--mustard)]"
                onClick={() => openPopover(true)}
              >
                <MessageSquarePlus size={10} style={{ color: "var(--mustard)" }} />
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "var(--mustard)" }}
                >
                  Comentar este campo
                </span>
              </div>
            )}
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverContent
          side="right"
          align="start"
          className="w-72 space-y-3 p-3"
        >
          {/* Notas existentes */}
          {fieldNotes.map((note) => (
            <div
              key={note.id}
              className="relative"
              onMouseEnter={() => setHoveredId(note.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Botones de acción (solo nota propia y no en edición) */}
              {hoveredId === note.id &&
                note.authorId === currentUserId &&
                editingId !== note.id && (
                  <TooltipProvider>
                    <div className="absolute -top-1.5 right-0 z-10 flex gap-1 rounded-md border border-border bg-card px-1.5 py-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-muted"
                            onClick={() => startEdit(note)}
                          >
                            <Pencil size={10} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-destructive/20"
                            onClick={() => setDeleteId(note.id)}
                          >
                            <Trash2 size={10} className="text-destructive" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                )}

              {/* Contenido de la nota */}
              <div className="flex gap-2">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-black">
                  {initials(note.authorName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-foreground">
                      {note.authorName}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {formatDistanceToNow(new Date(note.updatedAt), {
                        locale: es,
                        addSuffix: false,
                      })}
                    </span>
                  </div>
                  <div
                    className="mb-1 border-l-2 pl-2 text-[9px] italic text-muted-foreground"
                    style={{ borderColor: "var(--mustard)" }}
                  >
                    {label.toLowerCase()}
                  </div>
                  {editingId === note.id ? (
                    <textarea
                      autoFocus
                      className="w-full resize-none rounded border border-border bg-muted p-1.5 text-[11px] text-foreground outline-none focus:border-[var(--mustard)]"
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleEditBlur(note.id, note.comment);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => handleEditBlur(note.id, note.comment)}
                    />
                  ) : (
                    <p className="text-[11px] leading-relaxed text-foreground">
                      {note.comment}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Agregar nota */}
          {canAdd &&
            (addingNote ? (
              <div
                className={cn(
                  "flex gap-2",
                  hasNotes && "border-t border-border pt-2"
                )}
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-black">
                  {initials(session?.user?.name ?? "?")}
                </div>
                <div className="flex-1">
                  <textarea
                    autoFocus
                    className="w-full resize-none rounded border border-border bg-muted p-1.5 text-[11px] text-foreground outline-none focus:border-[var(--mustard)]"
                    rows={2}
                    value={newNoteText}
                    placeholder="Escribí tu aclaración..."
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        newNoteText.trim()
                      ) {
                        e.preventDefault();
                        createNote.mutate(newNoteText.trim());
                      }
                      if (e.key === "Escape") {
                        setAddingNote(false);
                        setNewNoteText("");
                      }
                    }}
                  />
                  <div className="mt-1.5 flex justify-end gap-3">
                    <button
                      className="text-[9px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setAddingNote(false);
                        setNewNoteText("");
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="text-[9px] font-bold disabled:opacity-40"
                      style={{ color: "var(--mustard)" }}
                      disabled={
                        !newNoteText.trim() || createNote.isPending
                      }
                      onClick={() => createNote.mutate(newNoteText.trim())}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-2",
                  hasNotes && "border-t border-border pt-2"
                )}
                onClick={() => setAddingNote(true)}
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[8px] text-muted-foreground">
                  {(session?.user?.name?.[0] ?? "+").toUpperCase()}
                </div>
                <span className="text-[11px] italic text-muted-foreground transition-colors hover:text-foreground">
                  Agregar un comentario...
                </span>
              </div>
            ))}
        </PopoverContent>
      </PopoverPrimitive.Root>

      {/* AlertDialog: confirmar eliminar */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comentario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteNote.mutate(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
            <AlertDialogCancel className="mt-0 w-full">
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: confirmar guardar edición */}
      <AlertDialog
        open={!!saveConfirm}
        onOpenChange={(open) => !open && setSaveConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setEditingId(null);
                setSaveConfirm(null);
              }}
            >
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                saveConfirm &&
                updateNote.mutate({
                  id: saveConfirm.id,
                  comment: saveConfirm.text,
                })
              }
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
bun run build
```

Esperado: sin errores de TypeScript en `annotatable-field.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/annotatable-field.tsx
git commit -m "feat: add AnnotatableField component"
```

---

## Task 5: Integrar en la página de propiedades

**Files:**
- Modify: `src/app/(dashboard)/propiedades/[id]/page.tsx`

- [ ] **Step 1: Agregar el import**

Al inicio del archivo `src/app/(dashboard)/propiedades/[id]/page.tsx`, agregar este import junto a los otros imports de componentes UI:

```typescript
import { AnnotatableField } from "@/components/ui/annotatable-field";
```

- [ ] **Step 2: Reemplazar DatoItem en "Identificación y ubicación"**

Buscar el bloque de Identificación y ubicación en el modo vista (aproximadamente línea 1908). Reemplazar todos sus `DatoItem` por `AnnotatableField`. El patrón de cambio es: `<DatoItem label="X" value={...} />` → `<AnnotatableField label="X" value={...} fieldName="fieldKey" entityType="property" entityId={prop.id} />`.

Reemplazos exactos para esta sección:

```tsx
{/* Antes */}
<DatoItem label="Dirección" value={prop.address} />
{/* Después */}
<AnnotatableField label="Dirección" value={prop.address} fieldName="address" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Piso / Unidad" value={prop.floorUnit} />
{/* Después */}
<AnnotatableField label="Piso / Unidad" value={prop.floorUnit} fieldName="floorUnit" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Calle" value={prop.addressStreet} />
{/* Después */}
<AnnotatableField label="Calle" value={prop.addressStreet} fieldName="addressStreet" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Número" value={prop.addressNumber} />
{/* Después */}
<AnnotatableField label="Número" value={prop.addressNumber} fieldName="addressNumber" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Barrio / Zona" value={prop.zone} />
{/* Después */}
<AnnotatableField label="Barrio / Zona" value={prop.zone} fieldName="zone" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Ciudad" value={prop.city} />
{/* Después */}
<AnnotatableField label="Ciudad" value={prop.city} fieldName="city" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Provincia" value={prop.province} />
{/* Después */}
<AnnotatableField label="Provincia" value={prop.province} fieldName="province" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Tipo" value={TYPE_LABEL[prop.type] ?? prop.type} />
{/* Después */}
<AnnotatableField label="Tipo" value={TYPE_LABEL[prop.type] ?? prop.type} fieldName="type" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Destino" value={prop.destino ?? null} />
{/* Después */}
<AnnotatableField label="Destino" value={prop.destino ?? null} fieldName="destino" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Estado alquiler" value={RENTAL_STATUS_LABELS[prop.rentalStatus as keyof typeof RENTAL_STATUS_LABELS] ?? prop.rentalStatus} />
{/* Después */}
<AnnotatableField label="Estado alquiler" value={RENTAL_STATUS_LABELS[prop.rentalStatus as keyof typeof RENTAL_STATUS_LABELS] ?? prop.rentalStatus} fieldName="rentalStatus" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Estado venta" value={prop.saleStatus ? (SALE_STATUS_LABELS[prop.saleStatus as keyof typeof SALE_STATUS_LABELS] ?? prop.saleStatus) : null} />
{/* Después */}
<AnnotatableField label="Estado venta" value={prop.saleStatus ? (SALE_STATUS_LABELS[prop.saleStatus as keyof typeof SALE_STATUS_LABELS] ?? prop.saleStatus) : null} fieldName="saleStatus" entityType="property" entityId={prop.id} />

{/* Antes (precio alquiler, con highlight) */}
<DatoItem
  label="Precio alquiler"
  value={prop.rentalPrice ? `${prop.rentalPriceCurrency === "USD" ? "US$ " : "$ "}${Number(prop.rentalPrice).toLocaleString("es-AR")}` : null}
  highlight={!!prop.rentalPrice}
/>
{/* Después */}
<AnnotatableField
  label="Precio alquiler"
  value={prop.rentalPrice ? `${prop.rentalPriceCurrency === "USD" ? "US$ " : "$ "}${Number(prop.rentalPrice).toLocaleString("es-AR")}` : null}
  highlight={!!prop.rentalPrice}
  fieldName="rentalPrice"
  entityType="property"
  entityId={prop.id}
/>

{/* Antes (precio venta, con highlight) */}
<DatoItem
  label="Precio venta"
  value={prop.salePrice ? `${prop.salePriceCurrency === "USD" ? "US$ " : "$ "}${Number(prop.salePrice).toLocaleString("es-AR")}` : null}
  highlight={!!prop.salePrice}
/>
{/* Después */}
<AnnotatableField
  label="Precio venta"
  value={prop.salePrice ? `${prop.salePriceCurrency === "USD" ? "US$ " : "$ "}${Number(prop.salePrice).toLocaleString("es-AR")}` : null}
  highlight={!!prop.salePrice}
  fieldName="salePrice"
  entityType="property"
  entityId={prop.id}
/>
```

- [ ] **Step 3: Reemplazar DatoItem en "Características físicas"**

```tsx
{/* Antes */}
<DatoItem label="Superficie total" value={formatSurface(prop.surface)} />
{/* Después */}
<AnnotatableField label="Superficie total" value={formatSurface(prop.surface)} fieldName="surface" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="M² construidos" value={formatSurface(prop.surfaceBuilt)} />
{/* Después */}
<AnnotatableField label="M² construidos" value={formatSurface(prop.surfaceBuilt)} fieldName="surfaceBuilt" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="M² terreno" value={formatSurface(prop.surfaceLand)} />
{/* Después */}
<AnnotatableField label="M² terreno" value={formatSurface(prop.surfaceLand)} fieldName="surfaceLand" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Ambientes" value={prop.rooms} />
{/* Después */}
<AnnotatableField label="Ambientes" value={prop.rooms} fieldName="rooms" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Dormitorios" value={prop.bedrooms} />
{/* Después */}
<AnnotatableField label="Dormitorios" value={prop.bedrooms} fieldName="bedrooms" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Baños" value={prop.bathrooms} />
{/* Después */}
<AnnotatableField label="Baños" value={prop.bathrooms} fieldName="bathrooms" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Año construcción" value={prop.yearBuilt} />
{/* Después */}
<AnnotatableField label="Año construcción" value={prop.yearBuilt} fieldName="yearBuilt" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Condición" value={prop.condition ? CONDITION_LABEL[prop.condition] : null} />
{/* Después */}
<AnnotatableField label="Condición" value={prop.condition ? CONDITION_LABEL[prop.condition] : null} fieldName="condition" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Llaves" value={prop.keys ? KEYS_LABEL[prop.keys] : null} />
{/* Después */}
<AnnotatableField label="Llaves" value={prop.keys ? KEYS_LABEL[prop.keys] : null} fieldName="keys" entityType="property" entityId={prop.id} />
```

- [ ] **Step 4: Reemplazar DatoItem en "Responsabilidad de servicios"**

```tsx
{/* Antes */}
<DatoItem label="Luz" value={SERVICIO_LABEL[prop.serviceElectricity]} />
{/* Después */}
<AnnotatableField label="Luz" value={SERVICIO_LABEL[prop.serviceElectricity]} fieldName="serviceElectricity" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Gas" value={SERVICIO_LABEL[prop.serviceGas]} />
{/* Después */}
<AnnotatableField label="Gas" value={SERVICIO_LABEL[prop.serviceGas]} fieldName="serviceGas" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Agua" value={SERVICIO_LABEL[prop.serviceWater]} />
{/* Después */}
<AnnotatableField label="Agua" value={SERVICIO_LABEL[prop.serviceWater]} fieldName="serviceWater" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Municipalidad" value={SERVICIO_LABEL[prop.serviceCouncil]} />
{/* Después */}
<AnnotatableField label="Municipalidad" value={SERVICIO_LABEL[prop.serviceCouncil]} fieldName="serviceCouncil" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Rentas" value={SERVICIO_LABEL[prop.serviceStateTax]} />
{/* Después */}
<AnnotatableField label="Rentas" value={SERVICIO_LABEL[prop.serviceStateTax]} fieldName="serviceStateTax" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Expensas (responsable)" value={SERVICIO_LABEL[prop.serviceHoa]} />
{/* Después */}
<AnnotatableField label="Expensas (responsable)" value={SERVICIO_LABEL[prop.serviceHoa]} fieldName="serviceHoa" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Tiene expensas" value={prop.tieneExpensas ? "Sí" : "No"} />
{/* Después */}
<AnnotatableField label="Tiene expensas" value={prop.tieneExpensas ? "Sí" : "No"} fieldName="tieneExpensas" entityType="property" entityId={prop.id} />
```

- [ ] **Step 5: Reemplazar DatoItem en "Confección" y "Datos registrales"**

```tsx
{/* Confección */}
{/* Antes */}
{prop.floors > 1 && <DatoItem label="Número de plantas" value={String(prop.floors)} />}
{/* Después */}
{prop.floors > 1 && <AnnotatableField label="Número de plantas" value={String(prop.floors)} fieldName="floors" entityType="property" entityId={prop.id} />}

{/* Antes */}
{prop.plantaPB && <DatoItem label="Planta baja" value={prop.plantaPB} />}
{/* Después */}
{prop.plantaPB && <AnnotatableField label="Planta baja" value={prop.plantaPB} fieldName="plantaPB" entityType="property" entityId={prop.id} />}

{/* Antes */}
{prop.plantaPA && <DatoItem label="Planta alta" value={prop.plantaPA} />}
{/* Después */}
{prop.plantaPA && <AnnotatableField label="Planta alta" value={prop.plantaPA} fieldName="plantaPA" entityType="property" entityId={prop.id} />}

{/* Antes */}
{prop.observacionesConfeccion && <DatoItem label="Observaciones" value={prop.observacionesConfeccion} />}
{/* Después */}
{prop.observacionesConfeccion && <AnnotatableField label="Observaciones" value={prop.observacionesConfeccion} fieldName="observacionesConfeccion" entityType="property" entityId={prop.id} />}

{/* Datos registrales */}
{/* Antes */}
<DatoItem label="Matrícula" value={prop.registryNumber} />
{/* Después */}
<AnnotatableField label="Matrícula" value={prop.registryNumber} fieldName="registryNumber" entityType="property" entityId={prop.id} />

{/* Antes */}
<DatoItem label="Catastro" value={prop.cadastralRef} />
{/* Después */}
<AnnotatableField label="Catastro" value={prop.cadastralRef} fieldName="cadastralRef" entityType="property" entityId={prop.id} />
```

- [ ] **Step 6: Verificar que compila**

```bash
bun run build
```

Esperado: sin errores de TypeScript.

- [ ] **Step 7: Prueba manual en el browser**

1. Correr `bun dev`
2. Abrir una propiedad existente y navegar al tab "Datos"
3. Verificar que todos los campos se ven igual que antes (sin nota: aspecto idéntico a DatoItem)
4. Seleccionar texto en un campo → soltar el click → verificar que aparece la burbuja "Comentar este campo"
5. Clickear la burbuja → verificar que se abre el Popover con el textarea
6. Escribir una nota → Enter → verificar que el label cambia a ámbar con ✦
7. Clickear el label ámbar → verificar que el Popover se abre con la nota y los íconos de acción al hacer hover
8. Probar editar: hover → ícono ✏️ → editar → Enter → confirmar guardar
9. Probar eliminar: hover → ícono 🗑️ → confirmar → verificar que el label vuelve a gris

- [ ] **Step 8: Commit final**

```bash
git add src/app/(dashboard)/propiedades/[id]/page.tsx
git commit -m "feat: wire AnnotatableField into property detail view"
```
