"use client";

import { Textarea } from "@/components/ui/textarea";

type Props = { value: string; onChange: (v: string) => void; disabled?: boolean };

export function SideObservations({ value, onChange, disabled }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Observaciones (opcional)</h3>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={500}
        rows={3}
        placeholder="Ej: pago parcial, acuerdo de fecha, seña…"
        className="text-[12.5px] resize-none"
      />
      <div className="text-[10.5px] text-muted-foreground mt-1 text-right">{value.length}/500</div>
    </div>
  );
}
