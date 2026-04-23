"use client";

import "./print.css";
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Check,
  Printer,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { VARIABLES_CATALOG } from "@/lib/document-templates/variables-catalog";

// ─── Types ─────────────────────────────────────────────────────────────────

type Clause = {
  id: string;
  templateId: string;
  title: string;
  body: string;
  order: number;
  isActive: boolean;
  category: string;
  isOptional: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentTemplate = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ContractListItem = {
  id: string;
  contractNumber: string;
  propertyAddress: string;
  tenantName?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const VAR_RE = /\[\[([^\]]+)\]\]/g;

function renderPreviewSegments(
  text: string,
  resolved: Record<string, string | null>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  VAR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = VAR_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={`t-${last}`}>{text.slice(last, match.index)}</span>);
    }
    const path = match[1].trim();
    const value = resolved[path];
    if (value !== null && value !== undefined) {
      parts.push(<span key={`v-${match.index}`}>{value}</span>);
    } else {
      parts.push(
        <span key={`m-${match.index}`} className="text-destructive font-bold">
          {match[0]}
        </span>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(<span key="t-end">{text.slice(last)}</span>);
  }
  return parts;
}

// ─── Inline clause editor (expanded card) ───────────────────────────────────

function InlineClauseEditor({
  clause,
  templateId,
  onCollapse,
  onSaved,
}: {
  clause: Clause;
  templateId: string;
  onCollapse: () => void;
  onSaved: (updated: Clause) => void;
}) {
  const [title, setTitle] = useState(clause.title);
  const [body, setBody] = useState(clause.body);
  const [category, setCategory] = useState(clause.category);
  const [isOptional, setIsOptional] = useState(clause.isOptional);
  const [notes, setNotes] = useState(clause.notes);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [varListOpen, setVarListOpen] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function persist(fields: Partial<{
    title: string; body: string; category: string;
    isOptional: boolean; notes: string;
  }>) {
    setSaveStatus("saving");
    try {
      const res = await fetch(
        `/api/document-templates/${templateId}/clauses/${clause.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        }
      );
      const data = await res.json();
      if (res.ok) {
        onSaved(data.clause);
        setSaveStatus("saved");
      } else {
        setSaveStatus("idle");
        toast.error(data.error ?? "Error al guardar");
      }
    } catch {
      setSaveStatus("idle");
      toast.error("Error al guardar");
    }
  }

  function scheduleAutosave(fields: Parameters<typeof persist>[0]) {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(fields), 800);
  }

  async function copyPath(path: string) {
    await navigator.clipboard.writeText(`[[${path}]]`);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground h-4">
          {saveStatus === "saving" && "Guardando..."}
          {saveStatus === "saved" && "Guardado"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onCollapse}
          title="Cerrar editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Título</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleAutosave({ title: e.target.value, body, category, isOptional, notes });
          }}
          placeholder="Ej: PRIMERA: OBJETO DEL CONTRATO"
          maxLength={300}
          autoFocus
        />
      </div>

      {/* Category + optional */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Categoría</Label>
          <Input
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              scheduleAutosave({ title, body, category: e.target.value, isOptional, notes });
            }}
            placeholder="Ej: Pago, Servicios..."
            maxLength={100}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">¿Es opcional?</Label>
          <Select
            value={isOptional ? "si" : "no"}
            onValueChange={(v) => {
              const val = v === "si";
              setIsOptional(val);
              scheduleAutosave({ title, body, category, isOptional: val, notes });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="si">Sí</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body + variables side by side */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <Label className="text-xs">Contenido</Label>
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              scheduleAutosave({ title, body: e.target.value, category, isOptional, notes });
            }}
            placeholder="Texto de la cláusula. Usá [[variable.path]] para datos del contrato."
            className="min-h-[240px] resize-y font-mono text-sm"
          />
        </div>

        {/* Variables */}
        <div className="w-48 shrink-0">
          <Collapsible open={varListOpen} onOpenChange={setVarListOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-1 h-7 w-full justify-start text-xs mb-1">
                {varListOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Variables ({VARIABLES_CATALOG.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-md border divide-y max-h-[260px] overflow-y-auto">
                {VARIABLES_CATALOG.map((v) => (
                  <button
                    key={v.path}
                    type="button"
                    onClick={() => copyPath(v.path)}
                    className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-muted/50 text-left gap-1"
                  >
                    <div className="min-w-0">
                      <code className="text-primary text-[10px] block truncate">[[{v.path}]]</code>
                      <p className="text-muted-foreground text-[10px] truncate">{v.label}</p>
                    </div>
                    {copiedPath === v.path ? (
                      <Check className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Notas internas (no se imprimen)</Label>
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            scheduleAutosave({ title, body, category, isOptional, notes: e.target.value });
          }}
          placeholder="Notas para el equipo..."
          className="min-h-[56px] resize-y text-sm"
        />
      </div>
    </div>
  );
}

// ─── Collapsed clause card ───────────────────────────────────────────────────

function SortableClauseCard({
  clause,
  isExpanded,
  templateId,
  onExpand,
  onCollapse,
  onSaved,
  onDuplicate,
  onDelete,
  onToggleActive,
}: {
  clause: Clause;
  isExpanded: boolean;
  templateId: string;
  onExpand: () => void;
  onCollapse: () => void;
  onSaved: (updated: Clause) => void;
  onDuplicate: (c: Clause) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clause.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (isExpanded) {
    return (
      <div ref={setNodeRef} style={style}>
        <InlineClauseEditor
          clause={clause}
          templateId={templateId}
          onCollapse={onCollapse}
          onSaved={onSaved}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card transition-opacity ${
        !clause.isActive ? "opacity-40" : ""
      }`}
    >
      {/* Clickable header area */}
      <button
        className="w-full text-left px-3 pt-3 pb-2"
        onClick={onExpand}
      >
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label="Arrastrar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-sm leading-tight flex-1 truncate">
                {clause.title || (
                  <span className="text-muted-foreground italic font-normal">Sin título</span>
                )}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {clause.category && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {clause.category}
                  </Badge>
                )}
                {clause.isOptional && (
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                )}
              </div>
            </div>
            {clause.body && (
              <p className="text-xs text-muted-foreground truncate">
                {clause.body.slice(0, 120)}{clause.body.length > 120 ? "…" : ""}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        </div>
      </button>

      {/* Actions bar */}
      <div className="flex items-center gap-1 px-3 pb-2 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onToggleActive(clause.id, !clause.isActive)}
        >
          {clause.isActive ? "Activa" : "Inactiva"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onDuplicate(clause)}
        >
          <Copy className="h-3 w-3 mr-1" />
          Duplicar
        </Button>
        <div className="ml-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar cláusula?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará{" "}
                  <strong>{clause.title || "esta cláusula"}</strong>. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(clause.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── Main editor ─────────────────────────────────────────────────────────────

export function DocumentTemplateEditor({ templateId }: { templateId: string }) {
  const queryClient = useQueryClient();
  const [localNameEdit, setLocalNameEdit] = useState<string | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [localClauses, setLocalClauses] = useState<Clause[] | null>(null);
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  // ── Fetch template + clauses ─────────────────────────────────────────────

  const { data, isLoading } = useQuery<{
    template: DocumentTemplate;
    clauses: Clause[];
  }>({
    queryKey: ["document-template", templateId],
    queryFn: () =>
      fetch(`/api/document-templates/${templateId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  if (data && localClauses === null) {
    setLocalClauses([...data.clauses]);
  }

  const template = data?.template;
  const name = localNameEdit ?? template?.name ?? "";
  const clauses = localClauses ?? data?.clauses ?? [];

  // ── Fetch contracts for preview ──────────────────────────────────────────

  const { data: contractsData } = useQuery<{ contracts: ContractListItem[] }>({
    queryKey: ["contracts-for-preview"],
    queryFn: () =>
      fetch("/api/contracts?limit=50").then(async (r) => {
        const json = await r.json();
        return {
          contracts: (json.contracts ?? []).map(
            (c: {
              id: string;
              contractNumber: string;
              propertyAddress?: string;
              tenants?: { name: string }[];
            }) => ({
              id: c.id,
              contractNumber: c.contractNumber,
              propertyAddress: c.propertyAddress ?? "",
              tenantName: c.tenants?.[0]?.name ?? "",
            })
          ),
        };
      }),
  });

  // ── Fetch resolved variables ─────────────────────────────────────────────

  const { data: resolvedData } = useQuery<{
    resolved: Record<string, string | null>;
  }>({
    queryKey: ["document-template-resolve", selectedContractId],
    queryFn: () =>
      fetch(
        `/api/document-templates/resolve?contractId=${selectedContractId}`
      ).then((r) => r.json()),
    enabled: !!selectedContractId,
  });

  const resolved = resolvedData?.resolved ?? {};
  const contracts = contractsData?.contracts ?? [];

  // ── Autosave name ────────────────────────────────────────────────────────

  const saveName = useCallback(
    async (newName: string) => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/document-templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    },
    [templateId]
  );

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocalNameEdit(val);
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveName(val), 1000);
  }

  // ── Add clause ───────────────────────────────────────────────────────────

  const addClauseMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/document-templates/${templateId}/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", body: "", category: "general" }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.clause) {
        setLocalClauses((prev) => [...(prev ?? []), data.clause]);
        setExpandedClauseId(data.clause.id);
      }
    },
    onError: () => toast.error("Error al agregar cláusula"),
  });

  // ── Toggle active ────────────────────────────────────────────────────────

  async function handleToggleActive(clauseId: string, active: boolean) {
    setLocalClauses((prev) =>
      (prev ?? []).map((c) => (c.id === clauseId ? { ...c, isActive: active } : c))
    );
    try {
      await fetch(`/api/document-templates/${templateId}/clauses/${clauseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["document-template", templateId] });
      toast.error("Error al actualizar");
    }
  }

  // ── Duplicate ────────────────────────────────────────────────────────────

  async function handleDuplicate(clause: Clause) {
    try {
      const res = await fetch(`/api/document-templates/${templateId}/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${clause.title} (copia)`,
          body: clause.body,
          category: clause.category,
          isOptional: clause.isOptional,
          notes: clause.notes,
        }),
      });
      const data = await res.json();
      if (data.clause) {
        setLocalClauses((prev) => [...(prev ?? []), data.clause]);
        toast.success("Cláusula duplicada");
      }
    } catch {
      toast.error("Error al duplicar");
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(clauseId: string) {
    if (expandedClauseId === clauseId) setExpandedClauseId(null);
    setLocalClauses((prev) => (prev ?? []).filter((c) => c.id !== clauseId));
    try {
      await fetch(`/api/document-templates/${templateId}/clauses/${clauseId}`, {
        method: "DELETE",
      });
      toast.success("Cláusula eliminada");
    } catch {
      queryClient.invalidateQueries({ queryKey: ["document-template", templateId] });
      toast.error("Error al eliminar");
    }
  }

  // ── Drag and drop reorder ────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalClauses((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      fetch(`/api/document-templates/${templateId}/clauses/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
      }).catch(() => {
        queryClient.invalidateQueries({ queryKey: ["document-template", templateId] });
        toast.error("Error al guardar el orden");
      });

      return reordered;
    });
  }

  // ── Clause saved callback ────────────────────────────────────────────────

  function handleClauseSaved(updated: Clause) {
    setLocalClauses((prev) =>
      (prev ?? []).map((c) => (c.id === updated.id ? updated : c))
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const activeClauses = clauses
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs text-muted-foreground h-4">
          {saveStatus === "saving" && "Guardando..."}
          {saveStatus === "saved" && "Guardado"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Columna izquierda ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Nombre de la plantilla</Label>
            <Input
              id="template-name"
              value={name}
              onChange={handleNameChange}
              maxLength={200}
              placeholder="Nombre de la plantilla"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {clauses.length === 0
                ? "Sin cláusulas"
                : `${clauses.length} cláusula${clauses.length !== 1 ? "s" : ""}`}
            </p>
            <Button
              size="sm"
              onClick={() => addClauseMutation.mutate()}
              disabled={addClauseMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {addClauseMutation.isPending ? "Agregando..." : "Agregar cláusula"}
            </Button>
          </div>

          {clauses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Agregá la primera cláusula para empezar.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={clauses.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {clauses.map((clause) => (
                    <SortableClauseCard
                      key={clause.id}
                      clause={clause}
                      isExpanded={expandedClauseId === clause.id}
                      templateId={templateId}
                      onExpand={() => setExpandedClauseId(clause.id)}
                      onCollapse={() => setExpandedClauseId(null)}
                      onSaved={handleClauseSaved}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ── Columna derecha — preview ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block">Previsualizar con contrato</Label>
              <Select
                value={selectedContractId}
                onValueChange={setSelectedContractId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un contrato..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      No hay contratos
                    </SelectItem>
                  )}
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contractNumber} — {c.propertyAddress}
                      {c.tenantName ? ` · ${c.tenantName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={!selectedContractId || activeClauses.length === 0}
              className="shrink-0"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir
            </Button>
          </div>

          <Separator />

          <div
            id="print-preview"
            className="rounded-md border bg-card p-6 min-h-[400px] text-sm leading-relaxed preview-content"
          >
            {!selectedContractId ? (
              <p className="text-muted-foreground text-center py-12 text-sm">
                Seleccioná un contrato para previsualizar
              </p>
            ) : activeClauses.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">
                No hay cláusulas activas
              </p>
            ) : (
              <div className="preview-body">
                <h1 className="preview-doc-title">{name}</h1>
                {activeClauses.map((clause, i) => (
                  <div key={clause.id} className={i > 0 ? "mt-5" : ""}>
                    {clause.title && (
                      <h3 className="preview-clause-title">{clause.title}</h3>
                    )}
                    <p className="preview-clause-body">
                      {renderPreviewSegments(clause.body, resolved)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedContractId && (
            <p className="text-xs text-muted-foreground">
              Variables en{" "}
              <span className="text-destructive font-bold">rojo</span> no tienen
              datos en el contrato seleccionado.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
