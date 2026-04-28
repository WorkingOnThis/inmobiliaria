"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VARIABLES_CATALOG } from "@/lib/document-templates/variables-catalog";

export const POPOVER_WIDTH = 264;
const POPOVER_HEIGHT_ESTIMATE = 220;

export type PopoverState = {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
};

export function VariablePopover({
  path,
  rect,
  resolvedValue,
  currentOverride,
  onApply,
  onClear,
  onClose,
}: {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
  currentOverride: string | undefined;
  onApply: (path: string, value: string) => void;
  onClear: (path: string) => void;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState(currentOverride ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const catalogEntry = VARIABLES_CATALOG.find((v) => v.path === path);
  const hasOverride = currentOverride !== undefined;

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const spaceBelow = viewportHeight - rect.bottom;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - POPOVER_WIDTH - 8));
  const top =
    spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 6
      ? rect.bottom + 6
      : rect.top - POPOVER_HEIGHT_ESTIMATE - 6;

  const pathColor = hasOverride ? "text-mustard" : resolvedValue !== null ? "text-green" : "text-destructive";

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5"
      style={{ left, top, width: POPOVER_WIDTH }}
    >
      <div>
        <code className={`text-xs font-mono ${pathColor}`}>[[{path}]]</code>
        {catalogEntry && (
          <p className="text-xs text-muted-foreground mt-0.5">{catalogEntry.label}</p>
        )}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          Valor del contrato
        </p>
        <p className={`text-xs font-medium px-2 py-1 rounded ${
          resolvedValue !== null ? "bg-green-dim text-green" : "bg-destructive/10 text-destructive"
        }`}>
          {resolvedValue ?? "Sin datos"}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          {hasOverride ? "Override activo" : "Sobreescribir valor"}
        </p>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Valor personalizado..."
          className="h-7 text-xs"
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onClose}>
          Cancelar
        </Button>
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            onClick={() => { onClear(path); onClose(); }}
          >
            Limpiar
          </Button>
        )}
        <Button
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => { if (inputValue.trim()) { onApply(path, inputValue.trim()); onClose(); } }}
        >
          {hasOverride ? "Actualizar" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
