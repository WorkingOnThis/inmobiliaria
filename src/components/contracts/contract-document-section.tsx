"use client";

import { useState, useCallback, useRef } from "react";
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
import { GripVertical, Plus, Printer, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HighlightedBodyTextarea } from "@/lib/document-templates/highlighted-body-textarea";
import { VariablePopover, type PopoverState } from "@/lib/document-templates/variable-popover";
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
  clause,
  activeNumber,
  isEditable,
  isExpanded,
  editTitle,
  editBody,
  editOverrides,
  resolved,
  isSaving,
  onExpand,
  onCollapse,
  onEditTitleChange,
  onEditBodyChange,
  onSave,
  onToggle,
  onDelete,
  onPopoverOpen,
}: {
  clause: ContractClause;
  activeNumber: number | null;
  isEditable: boolean;
  isExpanded: boolean;
  editTitle: string;
  editBody: string;
  editOverrides: Record<string, string>;
  resolved: Record<string, string | null>;
  isSaving: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onEditTitleChange: (v: string) => void;
  onEditBodyChange: (v: string) => void;
  onSave: () => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (clause: ContractClause) => void;
  onPopoverOpen: (path: string, rect: DOMRect) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clause.id, disabled: !isEditable || isExpanded });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`rounded-md border overflow-hidden ${
        isExpanded
          ? "border-primary/40 bg-primary/5"
          : clause.isActive
          ? "border-border bg-card"
          : "border-border/40 bg-muted/20"
      }`}
    >
      {/* Row header — always visible, click to expand/collapse */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => (isExpanded ? onCollapse() : onExpand())}
      >
        {isEditable && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs text-muted-foreground w-5 shrink-0 font-mono text-right">
          {activeNumber ?? "—"}
        </span>
        <span
          className={`flex-1 text-sm font-medium truncate ${
            clause.isActive
              ? isExpanded
                ? "text-primary"
                : "text-foreground"
              : "line-through text-muted-foreground"
          }`}
        >
          {clause.title || "Sin título"}
        </span>
        {isEditable && (
          <Switch
            checked={clause.isActive}
            onCheckedChange={(v) => onToggle(clause.id, v)}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        )}
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Inline editor — only when expanded */}
      {isExpanded && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-border/50">
          <div className="flex flex-col gap-1.5 pt-3">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Título</Label>
            <Input
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              placeholder="Título de la cláusula"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Cuerpo</Label>
            <HighlightedBodyTextarea
              value={editBody}
              onChange={onEditBodyChange}
              resolved={resolved}
              hasContract={true}
              overrides={editOverrides}
              minHeight="100px"
              placeholder="Redactá el cuerpo de la cláusula..."
            />
          </div>

          {/* Compact preview for variable override via Ctrl+Click */}
          <div className="rounded border border-border/50 bg-muted/20 p-3 text-xs leading-relaxed">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
              Preview — Ctrl+Click en una variable para sobreescribir
            </p>
            <div className="text-foreground/80">
              {renderClauseBody(editBody, resolved, true, {}, {}, editOverrides, onPopoverOpen)}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            {isEditable && !clause.sourceClauseId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive px-2"
                onClick={() => {
                  if (
                    confirm(
                      `¿Eliminar la cláusula "${clause.title}"? Esta acción no se puede deshacer.`
                    )
                  ) {
                    onDelete(clause);
                  }
                }}
              >
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onCollapse}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={onSave}
                disabled={isSaving || !editTitle.trim()}
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
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
  const previewRef = useRef<HTMLDivElement>(null);

  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editOverrides, setEditOverrides] = useState<Record<string, string>>({});
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFocusId, setPreviewFocusId] = useState<string | null>(null);
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
      collapseClause();
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
    onError: () => {
      setLocalOrder(null);
      toast.error("Error al reordenar");
    },
  });

  const { mutate: saveClause, isPending: isSaving } = useMutation({
    mutationFn: async ({
      id,
      title,
      body,
      fieldOverrides,
    }: {
      id: string;
      title: string;
      body: string;
      fieldOverrides: Record<string, string>;
    }) => {
      const res = await fetch(
        `/api/contracts/${contractId}/documents/${documentType}/clauses/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, fieldOverrides }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al guardar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId, documentType] });
      collapseClause();
      toast.success("Cláusula guardada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const orderedClauses = (() => {
    if (!data?.clauses) return [];
    if (!localOrder) return data.clauses;
    return localOrder
      .map((id) => data.clauses.find((c) => c.id === id))
      .filter(Boolean) as ContractClause[];
  })();

  const numberMap = new Map<string, number>();
  let counter = 1;
  for (const c of orderedClauses) {
    if (c.isActive) numberMap.set(c.id, counter++);
  }

  function expandClause(clause: ContractClause) {
    setExpandedClauseId(clause.id);
    setEditTitle(clause.title);
    setEditBody(clause.body);
    setEditOverrides((clause.fieldOverrides as Record<string, string>) ?? {});
    setPopoverState(null);
  }

  function collapseClause() {
    setExpandedClauseId(null);
    setEditTitle("");
    setEditBody("");
    setEditOverrides({});
    setPopoverState(null);
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = orderedClauses.map((c) => c.id);
      const newOrder = arrayMove(
        ids,
        ids.indexOf(active.id as string),
        ids.indexOf(over.id as string)
      );
      setLocalOrder(newOrder);
      reorder(newOrder);
    },
    [orderedClauses, reorder]
  );

  function handlePrint() {
    const activeClauses = orderedClauses.filter((c) => c.isActive);
    const html = activeClauses
      .map((clause, i) => {
        const heading = clauseHeading(i + 1, clause.title);
        const bodyNode = renderClauseBody(
          clause.body,
          resolved,
          true,
          {},
          {},
          clause.fieldOverrides as Record<string, string>
        );
        const bodyHtml = renderToStaticMarkup(<>{bodyNode}</>);
        return `<div class="clause"><h2>${heading}</h2><div class="body">${bodyHtml}</div></div>`;
      })
      .join("");

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

  function openPreview() {
    collapseClause();
    const firstActive = orderedClauses.find((c) => c.isActive);
    setPreviewFocusId(firstActive?.id ?? null);
    setPreviewOpen(true);
  }

  function scrollToClause(clauseId: string) {
    setPreviewFocusId(clauseId);
    document
      .getElementById(`clause-preview-${clauseId}`)
      ?.scrollIntoView({ behavior: "smooth" });
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Cargando cláusulas...</div>;
  }

  const isEditable = data?.isEditable ?? false;
  const hasTemplate = !!data?.config;
  const activeClauses = orderedClauses.filter((c) => c.isActive);

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Section header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Cláusulas del contrato</h3>
            {data?.config?.templateName && (
              <Badge variant="outline" className="text-xs">
                {data.config.templateName}
              </Badge>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {hasTemplate && activeClauses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
            )}
            {hasTemplate && activeClauses.length > 0 && (
              <Button
                variant={previewOpen ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => (previewOpen ? setPreviewOpen(false) : openPreview())}
              >
                {previewOpen ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {previewOpen ? "Cerrar preview" : "Vista previa"}
              </Button>
            )}
            {isEditable && hasTemplate && defaultTemplateId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  if (
                    confirm(
                      "Esto reemplazará todas las cláusulas actuales con las de la plantilla. ¿Continuar?"
                    )
                  ) {
                    applyTemplate(defaultTemplateId);
                  }
                }}
                disabled={isApplying}
              >
                Cambiar plantilla
              </Button>
            )}
            {isEditable && hasTemplate && !previewOpen && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={async () => {
                  const t = prompt("Título de la nueva cláusula:");
                  if (!t?.trim()) return;
                  await fetch(
                    `/api/contracts/${contractId}/documents/${documentType}/clauses`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: t.trim() }),
                    }
                  );
                  queryClient.invalidateQueries({
                    queryKey: ["contract-clauses", contractId, documentType],
                  });
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!hasTemplate && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">No hay cláusulas generadas aún</p>
            {isEditable && defaultTemplateId && (
              <Button
                size="sm"
                onClick={() => applyTemplate(defaultTemplateId)}
                disabled={isApplying}
              >
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

        {/* Preview mode: compact sidebar + rendered document */}
        {hasTemplate && previewOpen && (
          <div className="flex gap-4 items-start">
            <div className="w-40 flex-shrink-0 bg-muted/30 rounded-lg border border-border p-2 flex flex-col gap-1 sticky top-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 mb-1">
                Cláusulas
              </p>
              {orderedClauses.map((clause) => (
                <button
                  key={clause.id}
                  disabled={!clause.isActive}
                  className={`text-left text-xs px-2 py-1.5 rounded truncate transition-colors ${
                    clause.isActive
                      ? previewFocusId === clause.id
                        ? "bg-primary/20 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      : "text-muted-foreground/40 line-through cursor-default"
                  }`}
                  onClick={() => clause.isActive && scrollToClause(clause.id)}
                >
                  {clause.isActive ? `${numberMap.get(clause.id)}. ` : "— "}
                  {clause.title || "Sin título"}
                </button>
              ))}
            </div>

            <div
              ref={previewRef}
              className="flex-1 rounded-lg border border-border bg-card p-6 text-sm leading-relaxed overflow-y-auto max-h-[70vh]"
            >
              {activeClauses.map((clause, i) => (
                <div key={clause.id} id={`clause-preview-${clause.id}`} className="mb-6">
                  <p className="font-bold text-foreground uppercase text-xs tracking-wide mb-2">
                    {clauseHeading(i + 1, clause.title)}
                  </p>
                  <div className="text-foreground/80 text-justify">
                    {renderClauseBody(
                      clause.body,
                      resolved,
                      true,
                      {},
                      {},
                      clause.fieldOverrides as Record<string, string>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor mode: accordion list with DnD */}
        {hasTemplate && !previewOpen && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedClauses.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-1.5">
                {orderedClauses.map((clause) => (
                  <SortableClauseRow
                    key={clause.id}
                    clause={clause}
                    activeNumber={numberMap.get(clause.id) ?? null}
                    isEditable={isEditable}
                    isExpanded={expandedClauseId === clause.id}
                    editTitle={editTitle}
                    editBody={editBody}
                    editOverrides={editOverrides}
                    resolved={resolved}
                    isSaving={isSaving}
                    onExpand={() => expandClause(clause)}
                    onCollapse={collapseClause}
                    onEditTitleChange={setEditTitle}
                    onEditBodyChange={setEditBody}
                    onSave={() => {
                      if (expandedClauseId) {
                        saveClause({
                          id: expandedClauseId,
                          title: editTitle,
                          body: editBody,
                          fieldOverrides: editOverrides,
                        });
                      }
                    }}
                    onToggle={(id, isActive) => toggleClause({ id, isActive })}
                    onDelete={(c) => deleteClause(c.id)}
                    onPopoverOpen={(path, rect) =>
                      setPopoverState({ path, rect, resolvedValue: resolved[path] ?? null })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Variable popover — fixed-positioned, outside normal flow */}
      {popoverState && (
        <VariablePopover
          path={popoverState.path}
          rect={popoverState.rect}
          resolvedValue={popoverState.resolvedValue}
          currentOverride={editOverrides[popoverState.path]}
          onApply={(path, value) =>
            setEditOverrides((prev) => ({ ...prev, [path]: value }))
          }
          onClear={(path) =>
            setEditOverrides((prev) => {
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
