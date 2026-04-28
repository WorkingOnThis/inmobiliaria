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
