"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AMENDMENT_TYPES,
  AMENDMENT_TYPE_LABELS,
  AMENDMENT_TYPE_DESCRIPTIONS,
  ALLOWED_FIELDS,
  FIELD_LABELS,
  REQUIRES_EFFECTIVE_DATE,
  REQUIRES_DESCRIPTION,
  type AmendmentType,
} from "@/lib/contracts/amendments";

interface Props {
  contractId: string;
  open: boolean;
  onClose: () => void;
}

type FieldChange = { before: string; after: string };

export function AmendmentCreateModal({ contractId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<AmendmentType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [fieldChanges, setFieldChanges] = useState<Record<string, FieldChange>>({});

  const reset = () => {
    setStep(1);
    setSelectedType(null);
    setTitle("");
    setDescription("");
    setEffectiveDate("");
    setFieldChanges({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) return;

      const fieldsChanged: Record<string, { before: unknown; after: unknown }> = {};
      for (const [field, { before, after }] of Object.entries(fieldChanges)) {
        if (after.trim() !== "") {
          fieldsChanged[field] = { before: before || null, after };
        }
      }

      const res = await fetch(`/api/contracts/${contractId}/amendments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          title,
          description: description || undefined,
          effectiveDate: effectiveDate || undefined,
          fieldsChanged,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al registrar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Instrumento registrado. Los datos del contrato fueron actualizados.");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allowedFields = selectedType ? ALLOWED_FIELDS[selectedType] : [];
  const requiresEffectiveDate = selectedType ? REQUIRES_EFFECTIVE_DATE[selectedType] : false;
  const requiresDescription = selectedType ? REQUIRES_DESCRIPTION[selectedType] : false;
  const requiresFieldChanges = selectedType
    ? ["erratum", "modification", "extension", "index_change"].includes(selectedType)
    : false;

  const canSubmit =
    title.trim().length > 0 &&
    (!requiresEffectiveDate || effectiveDate.length > 0) &&
    (!requiresDescription || description.trim().length > 0) &&
    (!requiresFieldChanges || Object.values(fieldChanges).some((f) => f.after.trim() !== ""));

  const titlePlaceholders: Partial<Record<AmendmentType, string>> = {
    modification:           "Ej: Aumento días de gracia",
    extension:              "Ej: Prórroga 2026",
    erratum:                "Ej: Corrección de fecha de inicio",
    termination:            "Ej: Rescisión anticipada por acuerdo",
    guarantee_substitution: "Ej: Cambio de garante",
    index_change:           "Ej: Cambio de ICL a IPC",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? "Nuevo instrumento post-firma"
              : selectedType ? AMENDMENT_TYPE_LABELS[selectedType] : ""}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Type selection */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-2 py-2">
            {AMENDMENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setStep(2); setFieldChanges({}); }}
                className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border border-border text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="text-[0.82rem] font-semibold text-on-surface">
                  {AMENDMENT_TYPE_LABELS[type]}
                </span>
                <span className="text-[0.72rem] text-muted-foreground">
                  {AMENDMENT_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Data form */}
        {step === 2 && selectedType && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">
                Título <span className="text-error">*</span>
              </Label>
              <Input
                placeholder={titlePlaceholders[selectedType] ?? "Título del instrumento"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {requiresEffectiveDate && (
              <div className="space-y-1">
                <Label className="text-xs">
                  Fecha efectiva <span className="text-error">*</span>
                </Label>
                <DatePicker
                  value={effectiveDate}
                  onChange={setEffectiveDate}
                />
              </div>
            )}

            {requiresDescription ? (
              <div className="space-y-1">
                <Label className="text-xs">
                  Descripción <span className="text-error">*</span>
                </Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Describí el detalle del instrumento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input
                  placeholder="Motivo o contexto del instrumento"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}

            {allowedFields.length > 0 && (
              <div className="space-y-3">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                    Campos modificados
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">
                    Completá solo los campos que cambian.
                  </p>
                </div>
                {allowedFields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs text-text-secondary">{FIELD_LABELS[field] ?? field}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Valor anterior"
                        value={fieldChanges[field]?.before ?? ""}
                        onChange={(e) =>
                          setFieldChanges((prev) => ({
                            ...prev,
                            [field]: { before: e.target.value, after: prev[field]?.after ?? "" },
                          }))
                        }
                      />
                      <Input
                        placeholder="Valor nuevo"
                        value={fieldChanges[field]?.after ?? ""}
                        onChange={(e) =>
                          setFieldChanges((prev) => ({
                            ...prev,
                            [field]: { before: prev[field]?.before ?? "", after: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 2 && (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Registrar instrumento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
