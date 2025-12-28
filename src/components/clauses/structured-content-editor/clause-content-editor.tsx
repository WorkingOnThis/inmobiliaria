"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VariableChip } from "./variable-chip";
import { IterationBlock } from "./iteration-block";
import { AddVariableModal } from "./add-variable-modal";
import { AddIterationModal } from "./add-iteration-modal";
import type {
  StructuredContent,
  ContentPart,
  VariablePart,
  IterationPart,
  TextPart,
} from "@/lib/clauses/structured-content/types";
import {
  isTextPart,
  isVariablePart,
  isIterationPart,
} from "@/lib/clauses/structured-content/types";
import { Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClauseContentEditorProps {
  /** Contenido estructurado actual */
  value: StructuredContent;
  /** Callback cuando cambia el contenido */
  onChange: (content: StructuredContent) => void;
  /** Si está deshabilitado */
  disabled?: boolean;
}

/**
 * Componente principal del editor visual para contenido estructurado de cláusulas
 */
export function ClauseContentEditor({
  value,
  onChange,
  disabled = false,
}: ClauseContentEditorProps) {
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showIterationModal, setShowIterationModal] = useState(false);
  const [editingIterationIndex, setEditingIterationIndex] = useState<
    number | null
  >(null);

  // Asegurar que siempre haya al menos una parte de texto al inicio
  const parts = value.parts.length > 0 ? value.parts : [{ type: "text", content: "" }];

  const handleInsertVariable = useCallback(
    (path: string) => {
      const newParts: ContentPart[] = [...parts];
      
      // Si la última parte es texto, insertar la variable después
      // Si no, agregar una parte de texto vacía y luego la variable
      const lastPart = newParts[newParts.length - 1];
      
      if (isTextPart(lastPart)) {
        // Insertar variable después del último texto
        newParts.push({
          type: "variable",
          path,
        } as VariablePart);
        // Agregar nueva parte de texto vacía después
        newParts.push({
          type: "text",
          content: "",
        } as TextPart);
      } else {
        // Agregar texto vacío y luego variable
        newParts.push({
          type: "text",
          content: "",
        } as TextPart);
        newParts.push({
          type: "variable",
          path,
        } as VariablePart);
        newParts.push({
          type: "text",
          content: "",
        } as TextPart);
      }

      onChange({
        type: "structured",
        parts: newParts,
      });
    },
    [parts, onChange]
  );

  const handleInsertIteration = useCallback(
    (iteration: IterationPart) => {
      const newParts: ContentPart[] = [...parts];

      if (editingIterationIndex !== null) {
        // Editar iteración existente
        newParts[editingIterationIndex] = iteration;
        setEditingIterationIndex(null);
      } else {
        // Insertar nueva iteración
        // Si la última parte es texto, insertar después
        // Si no, agregar texto vacío primero
        const lastPart = newParts[newParts.length - 1];
        
        if (!isTextPart(lastPart)) {
          newParts.push({
            type: "text",
            content: "",
          } as TextPart);
        }

        newParts.push(iteration);
        // Agregar nueva parte de texto vacía después
        newParts.push({
          type: "text",
          content: "",
        } as TextPart);
      }

      onChange({
        type: "structured",
        parts: newParts,
      });
    },
    [parts, onChange, editingIterationIndex]
  );

  const handleUpdateTextPart = useCallback(
    (index: number, newContent: string) => {
      const newParts: ContentPart[] = [...parts];
      if (isTextPart(newParts[index])) {
        newParts[index] = {
          type: "text",
          content: newContent,
        } as TextPart;
        onChange({
          type: "structured",
          parts: newParts,
        });
      }
    },
    [parts, onChange]
  );

  const handleDeletePart = useCallback(
    (index: number) => {
      const newParts: ContentPart[] = [...parts];
      newParts.splice(index, 1);
      
      // Asegurar que siempre haya al menos una parte de texto
      if (newParts.length === 0 || !newParts.some(isTextPart)) {
        newParts.unshift({ type: "text", content: "" } as TextPart);
      }

      onChange({
        type: "structured",
        parts: newParts,
      });
    },
    [parts, onChange]
  );

  const handleEditIteration = useCallback(
    (index: number) => {
      setEditingIterationIndex(index);
      setShowIterationModal(true);
    },
    []
  );

  const handleDeleteVariable = useCallback(
    (index: number) => {
      handleDeletePart(index);
      // También eliminar la parte de texto vacía que sigue si existe
      if (index + 1 < parts.length && isTextPart(parts[index + 1])) {
        const textPart = parts[index + 1] as TextPart;
        if (!textPart.content.trim()) {
          handleDeletePart(index + 1);
        }
      }
    },
    [parts, handleDeletePart]
  );

  return (
    <div className="space-y-4">
      {/* Botones de acción */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowVariableModal(true)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Agregar Variable
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingIterationIndex(null);
            setShowIterationModal(true);
          }}
          disabled={disabled}
        >
          <FileText className="h-4 w-4 mr-1.5" />
          Agregar Lista
        </Button>
      </div>

      {/* Área de edición */}
      <div className="border rounded-lg p-4 min-h-[200px] space-y-3 bg-background">
        {parts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Comienza escribiendo texto o agregando una variable o lista.
          </p>
        ) : (
          parts.map((part, index) => {
            if (isTextPart(part)) {
              return (
                <Textarea
                  key={`text-${index}`}
                  value={part.content}
                  onChange={(e) => handleUpdateTextPart(index, e.target.value)}
                  disabled={disabled}
                  placeholder={
                    index === 0 && parts.length === 1
                      ? "Escribe el contenido de la cláusula..."
                      : ""
                  }
                  className="min-h-[60px] resize-y font-normal"
                />
              );
            }

            if (isVariablePart(part)) {
              return (
                <div key={`variable-${index}`} className="flex items-center gap-2">
                  <VariableChip
                    path={part.path}
                    showDelete={!disabled}
                    onDelete={() => handleDeleteVariable(index)}
                  />
                </div>
              );
            }

            if (isIterationPart(part)) {
              return (
                <IterationBlock
                  key={`iteration-${index}`}
                  iteration={part}
                  onEdit={() => handleEditIteration(index)}
                  onDelete={() => handleDeletePart(index)}
                  disabled={disabled}
                />
              );
            }

            return null;
          })
        )}

        {parts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Comienza escribiendo texto o agregando una variable o lista.
          </p>
        )}
      </div>

      {/* Modales */}
      <AddVariableModal
        open={showVariableModal}
        onOpenChange={setShowVariableModal}
        onSelect={handleInsertVariable}
      />

      <AddIterationModal
        open={showIterationModal}
        onOpenChange={(open) => {
          setShowIterationModal(open);
          if (!open) {
            setEditingIterationIndex(null);
          }
        }}
        onCreate={handleInsertIteration}
        initialData={
          editingIterationIndex !== null &&
          isIterationPart(parts[editingIterationIndex])
            ? (parts[editingIterationIndex] as IterationPart)
            : undefined
        }
      />
    </div>
  );
}

