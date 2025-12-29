"use client";

import { Badge } from "@/components/ui/badge";
import { getPropertyLabel } from "@/lib/clauses/entity-definitions";
import { cn } from "@/lib/utils";
import type { VariablePart } from "@/lib/clauses/structured-content/types";
import { X } from "lucide-react";

interface VariableChipProps {
  /** Path de la variable en formato "entity.property" */
  path: string;
  /** Callback cuando se hace click en el chip (para editar/eliminar) */
  onClick?: () => void;
  /** Si se muestra el botón de eliminar */
  showDelete?: boolean;
  /** Callback cuando se hace click en eliminar */
  onDelete?: () => void;
  /** Si está deshabilitado */
  disabled?: boolean;
}

/**
 * Componente que muestra una variable como chip/badge
 */
export function VariableChip({
  path,
  onClick,
  showDelete = false,
  onDelete,
  disabled = false,
}: VariableChipProps) {
  // Parsear path para obtener entity y property
  const [entity, property] = path.split(".");
  const propertyLabel = getPropertyLabel(entity, property);
  const entityLabel =
    entity === "propiedad"
      ? "Propiedad"
      : entity === "propietario"
        ? "Propietario"
        : entity === "inquilino"
          ? "Inquilino"
          : entity;

  const displayText = propertyLabel
    ? `${entityLabel}: ${propertyLabel}`
    : path;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-secondary/80 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        onClick && !disabled && "cursor-pointer"
      )}
      onClick={disabled ? undefined : onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
    >
      <span className="text-xs font-medium">{displayText}</span>
      {showDelete && onDelete && !disabled && (
        <button
          type="button"
          onClick={handleDelete}
          className="ml-0.5 hover:bg-secondary-foreground/20 rounded-full p-0.5 transition-colors"
          aria-label={`Eliminar variable ${path}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}





