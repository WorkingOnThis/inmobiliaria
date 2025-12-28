"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IterationPart } from "@/lib/clauses/structured-content/types";
import { Edit2, Trash2 } from "lucide-react";

interface IterationBlockProps {
  /** Parte de iteración a mostrar */
  iteration: IterationPart;
  /** Callback cuando se hace click en editar */
  onEdit: () => void;
  /** Callback cuando se hace click en eliminar */
  onDelete: () => void;
  /** Si está deshabilitado */
  disabled?: boolean;
}

/**
 * Componente que muestra un bloque de iteración como card/box
 */
export function IterationBlock({
  iteration,
  onEdit,
  onDelete,
  disabled = false,
}: IterationBlockProps) {
  const entityLabel =
    iteration.entity === "propietarios"
      ? "Propietarios"
      : iteration.entity === "inquilinos"
        ? "Inquilinos"
        : iteration.entity;

  // Truncar template si es muy largo para preview
  const previewTemplate =
    iteration.template.length > 100
      ? `${iteration.template.substring(0, 100)}...`
      : iteration.template;

  return (
    <Card
      className={cn(
        "border-2 relative bg-muted/30",
        disabled && "opacity-50"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            Iteración sobre {entityLabel}
          </CardTitle>
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              disabled={disabled}
              aria-label="Editar iteración"
              className="h-7 w-7"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              disabled={disabled}
              aria-label="Eliminar iteración"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Template:
            </p>
            <p className="text-sm bg-background border rounded px-2 py-1.5 font-mono">
              {previewTemplate}
            </p>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Separador: <code className="bg-background px-1 rounded">"{iteration.separator}"</code>
            </span>
            <span>
              Final: <code className="bg-background px-1 rounded">"{iteration.lastSeparator}"</code>
            </span>
            {iteration.addPeriod && (
              <span className="text-primary">Punto final</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




