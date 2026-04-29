"use client";

import { useState, useRef } from "react";
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

  const handleMouseUp = () => {
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
  };

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
    if (saveConfirm) return;
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
            {bubbleVisible && canAdd && (
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
