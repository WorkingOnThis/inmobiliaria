"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";
import { VARIABLES_CATALOG } from "@/lib/document-templates/variables-catalog";
import { WRITEBACK_MAP } from "@/lib/document-templates/writeback-map";

export const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT_ESTIMATE = 300;

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
  onWriteback,
  onClose,
}: {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
  currentOverride: string | undefined;
  onApply: (path: string, value: string) => void;
  onClear: (path: string) => void;
  onWriteback?: (path: string, value: string) => void;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState(currentOverride ?? "");
  const [saveMode, setSaveMode] = useState<"local" | "db">("local");
  const ref = useRef<HTMLDivElement>(null);

  const catalogEntry = VARIABLES_CATALOG.find((v) => v.path === path);
  const writebackEntry = WRITEBACK_MAP[path];
  const hasOverride = currentOverride !== undefined;
  const isWritable = writebackEntry && writebackEntry.entity !== "agency";
  const isAgency = writebackEntry?.entity === "agency";

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    setSaveMode("local");
  }, [path]);

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

  function handleApply() {
    if (!inputValue.trim()) return;
    if (saveMode === "db" && onWriteback) {
      onWriteback(path, inputValue.trim());
      // popover is closed by the mutation's onSuccess in ContractDocumentSection
    } else {
      onApply(path, inputValue.trim());
      onClose();
    }
  }

  const buttonLabel = saveMode === "db" ? "Guardar en DB" : hasOverride ? "Actualizar" : "Aplicar";

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5"
      style={{ left, top, width: POPOVER_WIDTH }}
    >
      {/* Variable info */}
      <div>
        <code className={`text-xs font-mono ${pathColor}`}>[[{path}]]</code>
        {catalogEntry && (
          <p className="text-xs text-muted-foreground mt-0.5">{catalogEntry.label}</p>
        )}
      </div>

      {/* Resolved value */}
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

      {/* Agency link */}
      {isAgency && (
        <div className="border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
            Este dato se edita en la agencia
          </p>
          <a
            href={writebackEntry.settingsPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ir a configuración de agencia
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Radio + input (non-agency variables) */}
      {!isAgency && (
        <>
          {/* Save mode radio — only shown when write-back is available */}
          {isWritable && onWriteback && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                Guardar como
              </p>
              <RadioGroup
                value={saveMode}
                onValueChange={(v) => setSaveMode(v as "local" | "db")}
                className="gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="local" id={`${path}-local`} className="h-3 w-3" />
                  <Label htmlFor={`${path}-local`} className="text-xs font-normal cursor-pointer">
                    Solo esta cláusula
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="db" id={`${path}-db`} className="h-3 w-3" />
                  <Label htmlFor={`${path}-db`} className="text-xs font-normal cursor-pointer">
                    En la base de datos
                  </Label>
                </div>
              </RadioGroup>
              {saveMode === "db" && isWritable && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Actualizará: {writebackEntry.label}
                </p>
              )}
            </div>
          )}

          {/* Input */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {saveMode === "db" ? "Nuevo valor" : hasOverride ? "Override activo" : "Sobreescribir valor"}
            </p>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              placeholder={saveMode === "db" ? "Valor a guardar en DB..." : "Valor personalizado..."}
              className="h-7 text-xs"
              type={
                isWritable && writebackEntry.inputType === "number"
                  ? "number"
                  : isWritable && writebackEntry.inputType === "integer"
                  ? "number"
                  : isWritable && writebackEntry.inputType === "date"
                  ? "date"
                  : "text"
              }
            />
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 justify-end">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onClose}>
              Cancelar
            </Button>
            {saveMode === "local" && hasOverride && (
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
              onClick={handleApply}
              disabled={!inputValue.trim()}
            >
              {buttonLabel}
            </Button>
          </div>
        </>
      )}

      {/* Agency: just a close button */}
      {isAgency && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}
