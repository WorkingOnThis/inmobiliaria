"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PropertyAutocomplete } from "./property-autocomplete";
import type { IterationPart } from "@/lib/clauses/structured-content/types";
import { AVAILABLE_ENTITIES } from "@/lib/clauses/constants";
import { getAvailableEntitiesWithLabels } from "@/lib/clauses/entity-definitions";

interface AddIterationModalProps {
  /** Si el modal está abierto */
  open: boolean;
  /** Callback cuando cambia el estado de apertura */
  onOpenChange: (open: boolean) => void;
  /** Callback cuando se crea una iteración */
  onCreate: (iteration: IterationPart) => void;
  /** Datos iniciales para edición */
  initialData?: IterationPart;
}

/**
 * Modal para crear o editar un bloque de iteración
 */
export function AddIterationModal({
  open,
  onOpenChange,
  onCreate,
  initialData,
}: AddIterationModalProps) {
  const [entity, setEntity] = useState<"propietarios" | "inquilinos">(
    initialData?.entity || "propietarios"
  );
  const [template, setTemplate] = useState(initialData?.template || "");
  const [separator, setSeparator] = useState(
    initialData?.separator || ", "
  );
  const [lastSeparator, setLastSeparator] = useState(
    initialData?.lastSeparator || " y "
  );
  const [addPeriod, setAddPeriod] = useState(
    initialData?.addPeriod ?? true
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const entityLabels = getAvailableEntitiesWithLabels();
  const isEditMode = !!initialData;

  // Resetear formulario cuando se abre el modal
  useEffect(() => {
    if (open) {
      if (initialData) {
        setEntity(initialData.entity);
        setTemplate(initialData.template);
        setSeparator(initialData.separator);
        setLastSeparator(initialData.lastSeparator);
        setAddPeriod(initialData.addPeriod);
      } else {
        setEntity("propietarios");
        setTemplate("");
        setSeparator(", ");
        setLastSeparator(" y ");
        setAddPeriod(true);
      }
      setErrors({});
    }
  }, [open, initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!entity) {
      newErrors.entity = "La entidad es requerida";
    }

    if (!template.trim()) {
      newErrors.template = "El template es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) {
      return;
    }

    const iteration: IterationPart = {
      type: "iteration",
      entity,
      template: template.trim(),
      separator: separator.trim() || ", ",
      lastSeparator: lastSeparator.trim() || " y ",
      addPeriod,
    };

    onCreate(iteration);
    onOpenChange(false);
  };

  // Obtener la entidad singular para el autocomplete
  const singularEntity = entity.replace(/s$/, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Iteración" : "Agregar Iteración"}
          </DialogTitle>
          <DialogDescription>
            Crea un bloque que itera sobre múltiples elementos (ej:
            propietarios, inquilinos) y genera texto para cada uno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Select */}
          <div className="space-y-2">
            <Label htmlFor="entity">
              Entidad <span className="text-destructive">*</span>
            </Label>
            <Select
              value={entity}
              onValueChange={(value) => {
                setEntity(value as "propietarios" | "inquilinos");
                if (errors.entity) {
                  setErrors({ ...errors, entity: "" });
                }
              }}
              disabled={isEditMode} // No permitir cambiar entidad al editar
            >
              <SelectTrigger id="entity" aria-invalid={!!errors.entity}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ENTITIES.map((ent) => (
                  <SelectItem key={ent} value={ent}>
                    {entityLabels[ent]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.entity && (
              <p className="text-sm text-destructive">{errors.entity}</p>
            )}
          </div>

          {/* Template */}
          <div className="space-y-2">
            <Label htmlFor="template">
              Template <span className="text-destructive">*</span>
            </Label>
            <PropertyAutocomplete
              entity={singularEntity}
              value={template}
              onChange={(value) => {
                setTemplate(value);
                if (errors.template) {
                  setErrors({ ...errors, template: "" });
                }
              }}
              placeholder='Ej: {{nombre}} (DNI: {{dni}}), domiciliado en {{domicilio}}'
            />
            {errors.template && (
              <p className="text-sm text-destructive">{errors.template}</p>
            )}
          </div>

          {/* Separator */}
          <div className="space-y-2">
            <Label htmlFor="separator">Separador entre items</Label>
            <Input
              id="separator"
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              placeholder=", "
            />
            <p className="text-xs text-muted-foreground">
              Texto que se inserta entre cada item (ej: ", ", " - ")
            </p>
          </div>

          {/* Last Separator */}
          <div className="space-y-2">
            <Label htmlFor="lastSeparator">Separador antes del último item</Label>
            <Input
              id="lastSeparator"
              value={lastSeparator}
              onChange={(e) => setLastSeparator(e.target.value)}
              placeholder=" y "
            />
            <p className="text-xs text-muted-foreground">
              Texto que se inserta antes del último item (ej: " y ", " y finalmente ")
            </p>
          </div>

          {/* Add Period */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="addPeriod"
              checked={addPeriod}
              onCheckedChange={(checked) =>
                setAddPeriod(checked === true)
              }
            />
            <Label
              htmlFor="addPeriod"
              className="text-sm font-normal cursor-pointer"
            >
              Agregar punto final después de la iteración
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleCreate}>
            {isEditMode ? "Aplicar Cambios" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





