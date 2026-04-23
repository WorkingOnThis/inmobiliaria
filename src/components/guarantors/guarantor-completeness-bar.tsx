"use client";

import { Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GuarantorCompletenessBarProps {
  guarantor: {
    dni: string | null;
    cuit: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    birthDate: string | null;
    nationality: string | null;
    occupation: string | null;
    internalNotes: string | null;
  };
  onChipClick?: (fieldId: string) => void;
}

interface FieldDef {
  id: string;
  label: string;
  weight: number;
  value: string | null | undefined;
}

export function GuarantorCompletenessBar({
  guarantor,
  onChipClick,
}: GuarantorCompletenessBarProps) {
  const fields: FieldDef[] = [
    { id: "dni",          label: "DNI",                  weight: 2,   value: guarantor.dni },
    { id: "cuit",         label: "CUIT / CUIL",          weight: 2,   value: guarantor.cuit },
    { id: "phone",        label: "Teléfono",             weight: 1.5, value: guarantor.phone },
    { id: "email",        label: "Email",                weight: 1.5, value: guarantor.email },
    { id: "address",      label: "Domicilio",            weight: 1,   value: guarantor.address },
    { id: "birthDate",    label: "Fecha de nacimiento",  weight: 0.5, value: guarantor.birthDate },
    { id: "nationality",  label: "Nacionalidad",         weight: 0.5, value: guarantor.nationality },
    { id: "occupation",   label: "Ocupación",            weight: 0.5, value: guarantor.occupation },
    { id: "internalNotes",label: "Notas internas",       weight: 0.5, value: guarantor.internalNotes },
  ];

  const totalWeight     = fields.reduce((sum, f) => sum + f.weight, 0);
  const completedWeight = fields.reduce((sum, f) => sum + (f.value ? f.weight : 0), 0);
  const totalFields     = fields.length;
  const doneFields      = fields.filter((f) => f.value).length;
  const pct             = Math.round((completedWeight / totalWeight) * 100);
  const missing         = fields.filter((f) => !f.value);

  if (missing.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-border bg-surface p-4 flex gap-6">
      <div className="flex flex-col justify-center gap-2 min-w-[180px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Completitud de la ficha
          </span>
          <span className="font-mono font-bold text-[13px] text-on-surface">{pct}%</span>
        </div>
        <Progress value={pct} className="h-[5px]" />
        <span className="text-[11px] text-muted-foreground">
          {doneFields} de {totalFields} campos completos
        </span>
      </div>

      <div className="w-px bg-border flex-shrink-0" />

      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        <span className="text-[11px] text-muted-foreground flex-shrink-0 mr-0.5">Pendiente:</span>
        {missing.map((f) => (
          <button
            key={f.id}
            onClick={() => onChipClick?.(f.id)}
            title={f.weight < 1 ? "Peso ½" : undefined}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-text-secondary bg-surface-mid border border-dashed border-border rounded-full transition-all hover:border-solid hover:border-primary hover:bg-primary/10 hover:text-on-surface"
          >
            <Plus size={10} className="flex-shrink-0" />
            {f.label}
            {f.weight < 1 && (
              <span className="text-[9px] opacity-60 leading-none">½</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
