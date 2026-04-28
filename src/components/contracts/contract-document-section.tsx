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
