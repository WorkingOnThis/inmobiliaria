"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getEntityProperties,
  getAvailableEntitiesWithLabels,
} from "@/lib/clauses/entity-definitions";
import { AVAILABLE_ENTITIES } from "@/lib/clauses/constants";

interface AddVariableModalProps {
  /** Si el modal está abierto */
  open: boolean;
  /** Callback cuando cambia el estado de apertura */
  onOpenChange: (open: boolean) => void;
  /** Callback cuando se selecciona una variable */
  onSelect: (path: string) => void;
}

/**
 * Modal para seleccionar e insertar una variable simple
 */
export function AddVariableModal({
  open,
  onOpenChange,
  onSelect,
}: AddVariableModalProps) {
  const entityLabels = getAvailableEntitiesWithLabels();

  const handleSelect = (entity: string, property: string) => {
    const path = `${entity}.${property}`;
    onSelect(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar Variable</DialogTitle>
          <DialogDescription>
            Selecciona una propiedad para insertar como variable en el contenido
            de la cláusula.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Propiedad (entity singular) */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Propiedad</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(() => {
                const propiedadProps = getEntityProperties("propiedad");
                if (!propiedadProps) return null;
                return Object.entries(propiedadProps).map(
                  ([property, label]) => (
                    <Button
                      key={`propiedad.${property}`}
                      type="button"
                      variant="outline"
                      className="justify-start h-auto py-3 px-4"
                      onClick={() => handleSelect("propiedad", property)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          propiedad.{property}
                        </span>
                      </div>
                    </Button>
                  )
                );
              })()}
            </div>
          </div>

          {/* Entidades disponibles (propietarios, inquilinos) */}
          {AVAILABLE_ENTITIES.map((entity) => {
            const entityProps = getEntityProperties(entity);
            if (!entityProps) return null;

            const entityLabel = entityLabels[entity];

            return (
              <div key={entity}>
                <h3 className="text-sm font-semibold mb-3">{entityLabel}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(entityProps).map(([property, label]) => (
                    <Button
                      key={`${entity}.${property}`}
                      type="button"
                      variant="outline"
                      className="justify-start h-auto py-3 px-4"
                      onClick={() => handleSelect(entity.replace(/s$/, ""), property)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {entity.replace(/s$/, "")}.{property}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}




