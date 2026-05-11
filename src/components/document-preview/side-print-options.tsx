"use client";

import { cn } from "@/lib/utils";

export type PrintOption = { key: string; label: string; desc: string; on: boolean; disabled?: boolean };

type Props = { options: PrintOption[]; onToggle: (key: string) => void };

export function SidePrintOptions({ options, onToggle }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Opciones de impresión</h3>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={o.disabled}
            onClick={() => onToggle(o.key)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-[9px] rounded-[8px] bg-surface-mid border border-border text-left",
              "hover:border-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <span className={cn(
              "w-[30px] h-[16px] rounded-full relative flex-none transition-colors",
              o.on ? "bg-primary/20" : "bg-border"
            )}>
              <span className={cn(
                "absolute top-[2px] size-3 rounded-full transition-all",
                o.on ? "left-[16px] bg-primary" : "left-[2px] bg-muted-foreground"
              )} />
            </span>
            <span className="flex-1">
              <span className="block text-[12.5px]">{o.label}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
