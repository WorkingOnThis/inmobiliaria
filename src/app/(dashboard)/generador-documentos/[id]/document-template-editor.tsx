"use client";

import "./print.css";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Printer,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  VARIABLES_CATALOG,
  type TemplateVariable,
} from "@/lib/document-templates/variables-catalog";
import {
  renderClauseBody,
  parseFreeTextVarsFromBodies,
  type FreeTextVar,
} from "@/lib/document-templates/render-segments";

// ─── Types ─────────────────────────────────────────────────────────────────

type Clause = {
  id: string;
  templateId: string;
  title: string;
  body: string;
  order: number;
  isActive: boolean;
  category: string;
  isOptional: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentTemplate = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ContractListItem = {
  id: string;
  contractNumber: string;
  propertyAddress: string;
  tenantName?: string;
};

type PopoverState = {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
};

// ─── Variable popover ────────────────────────────────────────────────────────

const POPOVER_WIDTH = 264;

function VariablePopover({
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
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const POPOVER_HEIGHT_ESTIMATE = 220;
  const spaceBelow = window.innerHeight - rect.bottom;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
  const top =
    spaceBelow >= POPOVER_HEIGHT_ESTIMATE + 6
      ? rect.bottom + 6
      : rect.top - POPOVER_HEIGHT_ESTIMATE - 6;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []); // empty — intentional: register once, read current onClose via ref

  const pathColor = hasOverride
    ? "text-amber-400"
    : resolvedValue !== null
    ? "text-emerald-500"
    : "text-destructive";

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
        <p
          className={`text-xs font-medium px-2 py-1 rounded ${
            resolvedValue !== null
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {resolvedValue ?? "Sin datos"}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          {hasOverride ? "Override activo" : "Sobreescribir para esta impresión"}
        </p>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply(path, inputValue);
          }}
          placeholder="Dejá vacío para usar el valor real"
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2 flex-1"
          onClick={onClose}
        >
          Cancelar
        </Button>
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            onClick={() => {
              onClear(path);
              onClose();
            }}
          >
            Limpiar
          </Button>
        )}
        <Button
          size="sm"
          className="h-6 text-xs px-2 flex-1"
          onClick={() => onApply(path, inputValue)}
        >
          {hasOverride ? "Actualizar" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}

// ─── Syntax highlighting for body textarea ───────────────────────────────────

function getHighlightedHTML(
  text: string,
  resolved: Record<string, string | null>,
  hasContract: boolean
): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight [[system variables]]
  const withSysVars = escaped.replace(/\[\[([^\]]*)\]\]/g, (match, inner: string) => {
    const trimmed = inner.trim();

    if (trimmed.startsWith("if:") || trimmed === "/if" || trimmed.startsWith("for:") || trimmed === "/for") {
      return `<span style="color:#94a3b8">${match}</span>`;
    }

    if (!hasContract) {
      return `<span style="color:hsl(var(--primary))">${match}</span>`;
    }

    const val = resolved[trimmed];
    const color =
      val !== null && val !== undefined
        ? "#4ade80"
        : "hsl(var(--destructive))";
    return `<span style="color:${color}">${match}</span>`;
  });

  // Highlight {{free text variables}} in amber
  return withSysVars.replace(/\{\{(\w+)(?:\s+\[[^\]]*\])?\}\}/g, (match) => {
    return `<span style="color:#fbbf24">${match}</span>`;
  });
}

// Backdrop-based textarea that highlights [[variables]] as you type
function HighlightedBodyTextarea({
  value,
  onChange,
  resolved,
  hasContract,
  placeholder,
  textareaRef: externalRef,
  onBodyBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  resolved: Record<string, string | null>;
  hasContract: boolean;
  placeholder?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onBodyBlur?: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? internalRef;

  function syncScroll() {
    if (backdropRef.current && ref.current) {
      backdropRef.current.scrollTop = ref.current.scrollTop;
    }
  }

  const highlighted = getHighlightedHTML(value, resolved, hasContract);

  const sharedStyle: React.CSSProperties = {
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.875rem",
    lineHeight: "1.5rem",
    padding: "8px 12px",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  };

  return (
    <div className="relative rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
      {/* Shadow element — grows container to match content height */}
      <div
        aria-hidden="true"
        className="invisible min-h-[240px] w-full"
        style={sharedStyle}
      >
        {value + "\n"}
      </div>

      {/* Backdrop with highlighted HTML */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ ...sharedStyle, color: "hsl(var(--foreground))" }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />

      {/* Textarea — transparent text, visible caret */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onBlur={onBodyBlur}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full resize-none bg-transparent focus:outline-none placeholder:text-muted-foreground"
        style={{
          ...sharedStyle,
          color: "transparent",
          caretColor: "hsl(var(--foreground))",
        }}
      />
    </div>
  );
}

// ─── Variable group section ──────────────────────────────────────────────────

const VARIABLE_GROUPS: {
  key: TemplateVariable["category"];
  label: string;
}[] = [
  { key: "propiedad", label: "Propiedad" },
  { key: "propietario", label: "Propietario / Locador" },
  { key: "inquilino", label: "Inquilino / Locatario" },
  { key: "contrato", label: "Contrato" },
  { key: "administradora", label: "Administradora" },
  { key: "garante", label: "Garantes / Fiadoras" },
];

const CATALOG_BY_GROUP = Object.fromEntries(
  VARIABLE_GROUPS.map((g) => [
    g.key,
    VARIABLES_CATALOG.filter((v) => v.category === g.key),
  ])
) as Record<TemplateVariable["category"], TemplateVariable[]>;

// ─── Free text variables panel ───────────────────────────────────────────────

function FreeTextVarsPanel({
  vars,
  values,
  onChange,
}: {
  vars: FreeTextVar[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="rounded-lg border-2 border-amber-400/60 bg-amber-400/5 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
        <p className="text-sm font-semibold text-amber-400">
          Variables a completar antes de imprimir
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vars.map((v) => (
          <div key={v.name} className="flex flex-col gap-1">
            <Label className="text-xs text-amber-400/80 font-medium">
              {v.name}
            </Label>
            <Input
              value={values[v.name] ?? ""}
              onChange={(e) => onChange(v.name, e.target.value)}
              placeholder={v.defaultVal || `Ingresá ${v.name}...`}
              className="h-8 text-sm border-amber-400/30 focus-visible:ring-amber-400/50"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-amber-400/60 leading-tight">
        Estos valores sólo se usan en la previsualización e impresión. No se guardan en la plantilla.
      </p>
    </div>
  );
}

// ─── Iteration entities reference panel ─────────────────────────────────────

const ITERATION_ENTITIES: { entity: string; label: string; fields: string[] }[] = [
  { entity: "ambientes", label: "Ambientes / Habitaciones", fields: ["nombre", "descripcion"] },
  { entity: "artefactos", label: "Artefactos / Amenidades", fields: ["nombre"] },
  { entity: "fiadores", label: "Fiadores personales", fields: ["apellido_fiador", "nombres_fiador", "dni_fiador", "cuil_fiador", "domicilio_fiador", "email_fiador", "telefono_fiador"] },
  { entity: "inquilinos", label: "Inquilinos", fields: ["apellido_locatario", "nombres_locatario", "dni_locatario", "cuit_locatario", "domicilio_locatario", "email_locatario", "telefono_locatario"] },
  { entity: "garantias_reales", label: "Garantías propietarias", fields: ["apellido_fiador_propietario", "nombres_fiador_propietario", "dni_fiador_propietario", "cuil_fiador_propietario", "domicilio_fiador_propietario", "matricula_inmueble_garantia", "catastro_inmueble_garantia", "domicilio_inmueble_garantia"] },
];

function IterationSection() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1 border-t border-border/40 pt-1">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-2 h-7 text-xs font-medium text-primary/80"
        >
          <span>Iteración [[for:]]</span>
          {open ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 pb-1 flex flex-col gap-2">
          <p className="text-[9px] text-muted-foreground leading-tight px-1">
            Usá bloques <span className="font-mono text-primary/80">[[for:entidad]]</span> para repetir contenido por cada ítem de una lista.
          </p>
          {ITERATION_ENTITIES.map((e) => (
            <div key={e.entity} className="rounded border border-border/60 bg-muted/20 p-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground mb-1">{e.label}</p>
              <code className="text-[8.5px] text-primary/70 block whitespace-pre leading-relaxed">
                {`[[for:${e.entity}]]\n  [[item.${e.fields[0]}]]\n[[/for]]`}
              </code>
              <p className="text-[8.5px] text-muted-foreground/60 mt-1 leading-tight">
                Campos: {e.fields.map((f) => `item.${f}`).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function VariableGroupSection({
  label,
  catalogVars,
  customPaths,
  onInsert,
  onAddCustom,
}: {
  label: string;
  catalogVars: TemplateVariable[];
  customPaths: string[];
  onInsert: (path: string) => void;
  onAddCustom: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newPath, setNewPath] = useState("");
  const total = catalogVars.length + customPaths.length;

  function handleAdd() {
    const path = newPath.trim();
    if (!path) return;
    onAddCustom(path);
    setNewPath("");
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-2 h-7 text-xs font-medium"
        >
          <span>{label}</span>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[10px]">{total}</span>
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border divide-y mb-1 overflow-hidden">
          {catalogVars.map((v) => (
            <button
              key={v.path}
              type="button"
              onClick={() => onInsert(v.path)}
              title="Insertar en el cuerpo"
              className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-muted/50 text-left gap-1"
            >
              <div className="min-w-0">
                <code className="text-primary text-[10px] block truncate">
                  [[{v.path}]]
                </code>
                <p className="text-muted-foreground text-[10px] truncate">
                  {v.label}
                </p>
              </div>
              <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          ))}
          {customPaths.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => onInsert(path)}
              title="Insertar en el cuerpo"
              className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-muted/50 text-left gap-1"
            >
              <div className="min-w-0">
                <code className="text-primary text-[10px] block truncate">
                  [[{path}]]
                </code>
                <p className="text-muted-foreground text-[10px] truncate">
                  Variable personalizada
                </p>
              </div>
              <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
        {/* Add custom variable */}
        <div className="flex gap-1 px-0.5 pb-1">
          <Input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={`${label.toLowerCase().split(" ")[0]}.campo`}
            className="h-6 text-[10px] px-2"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={handleAdd}
            disabled={!newPath.trim()}
            title="Agregar variable personalizada"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Inline clause editor (expanded card) ───────────────────────────────────

function InlineClauseEditor({
  clause,
  templateId,
  resolved,
  hasContract,
  onCollapse,
  onSaved,
}: {
  clause: Clause;
  templateId: string;
  resolved: Record<string, string | null>;
  hasContract: boolean;
  onCollapse: () => void;
  onSaved: (updated: Clause) => void;
}) {
  const [title, setTitle] = useState(clause.title);
  const [body, setBody] = useState(clause.body);
  const [category, setCategory] = useState(clause.category);
  const [isOptional, setIsOptional] = useState(clause.isOptional);
  const [notes, setNotes] = useState(clause.notes);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [customVars, setCustomVars] = useState<Record<string, string[]>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const lastCursor = useRef<number>(0);

  async function persist(fields: Partial<{
    title: string; body: string; category: string;
    isOptional: boolean; notes: string;
  }>) {
    setSaveStatus("saving");
    try {
      const res = await fetch(
        `/api/document-templates/${templateId}/clauses/${clause.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        }
      );
      const data = await res.json();
      if (res.ok) {
        onSaved(data.clause);
        setSaveStatus("saved");
      } else {
        setSaveStatus("idle");
        toast.error(data.error ?? "Error al guardar");
      }
    } catch {
      setSaveStatus("idle");
      toast.error("Error al guardar");
    }
  }

  function scheduleAutosave(fields: Parameters<typeof persist>[0]) {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(fields), 800);
  }

  function saveBodyCursor() {
    if (bodyRef.current) {
      lastCursor.current = bodyRef.current.selectionStart ?? body.length;
    }
  }

  function insertVariable(path: string) {
    const snippet = `[[${path}]]`;
    const pos = lastCursor.current;
    const newBody = body.slice(0, pos) + snippet + body.slice(pos);
    setBody(newBody);
    const newPos = pos + snippet.length;
    lastCursor.current = newPos;
    scheduleAutosave({ title, body: newBody, category, isOptional, notes });
    // Restore focus and cursor after React re-render
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  function addCustomVar(groupKey: string, path: string) {
    setCustomVars((prev) => ({
      ...prev,
      [groupKey]: [...(prev[groupKey] ?? []), path],
    }));
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground h-4">
          {saveStatus === "saving" && "Guardando..."}
          {saveStatus === "saved" && "Guardado"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onCollapse}
          title="Cerrar editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Título</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleAutosave({ title: e.target.value, body, category, isOptional, notes });
          }}
          placeholder="Ej: PRIMERA: OBJETO DEL CONTRATO"
          maxLength={300}
          autoFocus
        />
      </div>

      {/* Category + optional */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Categoría</Label>
          <Input
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              scheduleAutosave({ title, body, category: e.target.value, isOptional, notes });
            }}
            placeholder="Ej: Pago, Servicios..."
            maxLength={100}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">¿Es opcional?</Label>
          <Select
            value={isOptional ? "si" : "no"}
            onValueChange={(v) => {
              const val = v === "si";
              setIsOptional(val);
              scheduleAutosave({ title, body, category, isOptional: val, notes });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="si">Sí</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body + variables */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <Label className="text-xs">Contenido</Label>
          <HighlightedBodyTextarea
            value={body}
            onChange={(v) => {
              setBody(v);
              scheduleAutosave({ title, body: v, category, isOptional, notes });
            }}
            resolved={resolved}
            hasContract={hasContract}
            placeholder="Texto de la cláusula. Usá [[variable.path]] para datos del contrato."
            textareaRef={bodyRef}
            onBodyBlur={saveBodyCursor}
          />
        </div>

        {/* Variables panel */}
        <div className="w-52 shrink-0 flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground font-medium px-2 mb-0.5">
            Variables
          </p>
          {VARIABLE_GROUPS.map((group) => (
            <VariableGroupSection
              key={group.key}
              label={group.label}
              catalogVars={CATALOG_BY_GROUP[group.key]}
              customPaths={customVars[group.key] ?? []}
              onInsert={insertVariable}
              onAddCustom={(path) => addCustomVar(group.key, path)}
            />
          ))}
          <p className="text-[9px] text-muted-foreground px-2 pt-1 leading-tight">
            Clic en cualquier variable para insertarla en el cuerpo.
          </p>
          <p className="text-[9px] text-muted-foreground/70 px-2 pt-0.5 leading-tight border-t border-border/40 mt-1">
            <span className="font-mono text-primary/80">[[variable]]</span> → dato del contrato
            <br />
            <span className="font-mono text-amber-400/80">{"{{campo [default]}}"}</span> → input libre
          </p>
          <IterationSection />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">
          Notas internas (no se imprimen)
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            scheduleAutosave({ title, body, category, isOptional, notes: e.target.value });
          }}
          placeholder="Notas para el equipo..."
          className="min-h-[56px] resize-y text-sm"
        />
      </div>
    </div>
  );
}

// ─── Collapsed clause card ───────────────────────────────────────────────────

function SortableClauseCard({
  clause,
  isExpanded,
  templateId,
  resolved,
  hasContract,
  onExpand,
  onCollapse,
  onSaved,
  onDuplicate,
  onDelete,
  onToggleActive,
}: {
  clause: Clause;
  isExpanded: boolean;
  templateId: string;
  resolved: Record<string, string | null>;
  hasContract: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onSaved: (updated: Clause) => void;
  onDuplicate: (c: Clause) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clause.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (isExpanded) {
    return (
      <div ref={setNodeRef} style={style}>
        <InlineClauseEditor
          clause={clause}
          templateId={templateId}
          resolved={resolved}
          hasContract={hasContract}
          onCollapse={onCollapse}
          onSaved={onSaved}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card transition-opacity ${
        !clause.isActive ? "opacity-40" : ""
      }`}
    >
      <button className="w-full text-left px-3 pt-3 pb-2" onClick={onExpand}>
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label="Arrastrar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-sm leading-tight flex-1 truncate">
                {clause.title || (
                  <span className="text-muted-foreground italic font-normal">
                    Sin título
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {clause.category && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {clause.category}
                  </Badge>
                )}
                {clause.isOptional && (
                  <Badge variant="outline" className="text-xs">
                    Opcional
                  </Badge>
                )}
              </div>
            </div>
            {clause.body && (
              <p className="text-xs text-muted-foreground truncate">
                {clause.body.slice(0, 120)}
                {clause.body.length > 120 ? "…" : ""}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        </div>
      </button>

      <div className="flex items-center gap-1 px-3 pb-2 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onToggleActive(clause.id, !clause.isActive)}
        >
          {clause.isActive ? "Activa" : "Inactiva"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onDuplicate(clause)}
        >
          <Copy className="h-3 w-3 mr-1" />
          Duplicar
        </Button>
        <div className="ml-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar cláusula?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará{" "}
                  <strong>{clause.title || "esta cláusula"}</strong>. No se
                  puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(clause.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── Main editor ─────────────────────────────────────────────────────────────

export function DocumentTemplateEditor({ templateId }: { templateId: string }) {
  const queryClient = useQueryClient();
  const [localNameEdit, setLocalNameEdit] = useState<string | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [localClauses, setLocalClauses] = useState<Clause[] | null>(null);
  const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [freeTextValues, setFreeTextValues] = useState<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const { data, isLoading } = useQuery<{
    template: DocumentTemplate;
    clauses: Clause[];
  }>({
    queryKey: ["document-template", templateId],
    queryFn: () =>
      fetch(`/api/document-templates/${templateId}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  if (data && localClauses === null) {
    setLocalClauses([...data.clauses]);
  }

  const template = data?.template;
  const name = localNameEdit ?? template?.name ?? "";
  const clauses = localClauses ?? data?.clauses ?? [];

  const { data: contractsData } = useQuery<{ contracts: ContractListItem[] }>({
    queryKey: ["contracts-for-preview"],
    queryFn: () =>
      fetch("/api/contracts?limit=50").then(async (r) => {
        const json = await r.json();
        return {
          contracts: (json.contracts ?? []).map(
            (c: {
              id: string;
              contractNumber: string;
              propertyAddress?: string;
              tenants?: { name: string }[];
            }) => ({
              id: c.id,
              contractNumber: c.contractNumber,
              propertyAddress: c.propertyAddress ?? "",
              tenantName: c.tenants?.[0]?.name ?? "",
            })
          ),
        };
      }),
  });

  const { data: resolvedData } = useQuery<{
    resolved: Record<string, string | null>;
    lists: Record<string, Record<string, string | null>[]>;
  }>({
    queryKey: ["document-template-resolve", selectedContractId],
    queryFn: () =>
      fetch(
        `/api/document-templates/resolve?contractId=${selectedContractId}`
      ).then((r) => r.json()),
    enabled: !!selectedContractId,
  });

  const resolved = resolvedData?.resolved ?? {};
  const lists = resolvedData?.lists ?? {};
  const hasContract = !!selectedContractId && !!resolvedData;
  const contracts = contractsData?.contracts ?? [];

  const handleVarClick = useCallback(
    (path: string, rect: DOMRect) => {
      setPopoverState({ path, rect, resolvedValue: resolved[path] ?? null });
    },
    [resolved]
  );

  function handleOverrideApply(path: string, value: string) {
    setOverrides((prev) => {
      if (!value.trim()) {
        const next = { ...prev };
        delete next[path];
        return next;
      }
      return { ...prev, [path]: value.trim() };
    });
    setPopoverState(null);
  }

  function handleOverrideClear(path: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }

  const saveName = useCallback(
    async (newName: string) => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/document-templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    },
    [templateId]
  );

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocalNameEdit(val);
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveName(val), 1000);
  }

  const addClauseMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/document-templates/${templateId}/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", body: "", category: "general" }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.clause) {
        setLocalClauses((prev) => [...(prev ?? []), data.clause]);
        setExpandedClauseId(data.clause.id);
      }
    },
    onError: () => toast.error("Error al agregar cláusula"),
  });

  async function handleToggleActive(clauseId: string, active: boolean) {
    setLocalClauses((prev) =>
      (prev ?? []).map((c) => (c.id === clauseId ? { ...c, isActive: active } : c))
    );
    try {
      await fetch(`/api/document-templates/${templateId}/clauses/${clauseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["document-template", templateId] });
      toast.error("Error al actualizar");
    }
  }

  async function handleDuplicate(clause: Clause) {
    try {
      const res = await fetch(`/api/document-templates/${templateId}/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${clause.title} (copia)`,
          body: clause.body,
          category: clause.category,
          isOptional: clause.isOptional,
          notes: clause.notes,
        }),
      });
      const data = await res.json();
      if (data.clause) {
        setLocalClauses((prev) => [...(prev ?? []), data.clause]);
        toast.success("Cláusula duplicada");
      }
    } catch {
      toast.error("Error al duplicar");
    }
  }

  async function handleDelete(clauseId: string) {
    if (expandedClauseId === clauseId) setExpandedClauseId(null);
    setLocalClauses((prev) => (prev ?? []).filter((c) => c.id !== clauseId));
    try {
      await fetch(`/api/document-templates/${templateId}/clauses/${clauseId}`, {
        method: "DELETE",
      });
      toast.success("Cláusula eliminada");
    } catch {
      queryClient.invalidateQueries({ queryKey: ["document-template", templateId] });
      toast.error("Error al eliminar");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalClauses((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      fetch(`/api/document-templates/${templateId}/clauses/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
      }).catch(() => {
        queryClient.invalidateQueries({ queryKey: ["document-template", templateId] });
        toast.error("Error al guardar el orden");
      });

      return reordered;
    });
  }

  function handleClauseSaved(updated: Clause) {
    setLocalClauses((prev) =>
      (prev ?? []).map((c) => (c.id === updated.id ? updated : c))
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const activeClauses = clauses
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  const allFreeTextVarDefs = parseFreeTextVarsFromBodies(
    activeClauses.map((c) => c.body)
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs text-muted-foreground h-4">
          {saveStatus === "saving" && "Guardando..."}
          {saveStatus === "saved" && "Guardado"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Columna izquierda ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Nombre de la plantilla</Label>
            <Input
              id="template-name"
              value={name}
              onChange={handleNameChange}
              maxLength={200}
              placeholder="Nombre de la plantilla"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {clauses.length === 0
                ? "Sin cláusulas"
                : `${clauses.length} cláusula${clauses.length !== 1 ? "s" : ""}`}
            </p>
            <Button
              size="sm"
              onClick={() => addClauseMutation.mutate()}
              disabled={addClauseMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {addClauseMutation.isPending ? "Agregando..." : "Agregar cláusula"}
            </Button>
          </div>

          {clauses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Agregá la primera cláusula para empezar.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={clauses.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {clauses.map((clause) => (
                    <SortableClauseCard
                      key={clause.id}
                      clause={clause}
                      isExpanded={expandedClauseId === clause.id}
                      templateId={templateId}
                      resolved={resolved}
                      hasContract={hasContract}
                      onExpand={() => setExpandedClauseId(clause.id)}
                      onCollapse={() => setExpandedClauseId(null)}
                      onSaved={handleClauseSaved}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ── Columna derecha — preview ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block">Previsualizar con contrato</Label>
              <Select
                value={selectedContractId}
                onValueChange={setSelectedContractId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un contrato..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      No hay contratos
                    </SelectItem>
                  )}
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contractNumber} — {c.propertyAddress}
                      {c.tenantName ? ` · ${c.tenantName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={!selectedContractId || activeClauses.length === 0}
              className="shrink-0"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir
            </Button>
          </div>

          <Separator />

          {allFreeTextVarDefs.length > 0 && (
            <FreeTextVarsPanel
              vars={allFreeTextVarDefs}
              values={freeTextValues}
              onChange={(name, value) =>
                setFreeTextValues((prev) => ({ ...prev, [name]: value }))
              }
            />
          )}

          <div
            id="print-preview"
            className="rounded-md border bg-card p-6 min-h-[400px] text-sm leading-relaxed preview-content"
          >
            {!selectedContractId ? (
              <p className="text-muted-foreground text-center py-12 text-sm">
                Seleccioná un contrato para previsualizar
              </p>
            ) : activeClauses.length === 0 ? (
              <p className="text-muted-foreground text-center py-12 text-sm">
                No hay cláusulas activas
              </p>
            ) : (
              <div className="preview-body">
                <h1 className="preview-doc-title">{name}</h1>
                {activeClauses.map((clause, i) => (
                  <div key={clause.id} className={i > 0 ? "mt-5" : ""}>
                    {clause.title && (
                      <h3 className="preview-clause-title">{clause.title}</h3>
                    )}
                    <div className="preview-clause-body">
                      {renderClauseBody(
                        clause.body,
                        resolved,
                        hasContract,
                        freeTextValues,
                        lists,
                        overrides,
                        handleVarClick
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedContractId && (
            <p className="text-xs text-muted-foreground">
              Variables en{" "}
              <span className="text-emerald-500 font-medium">verde</span> se
              resuelven correctamente.{" "}
              <span className="text-destructive font-bold">Rojo</span> = sin
              datos.{" "}
              <span className="text-amber-400 font-medium">Naranja</span> = texto libre.
            </p>
          )}
        </div>
      </div>

      {popoverState && (
        <VariablePopover
          path={popoverState.path}
          rect={popoverState.rect}
          resolvedValue={popoverState.resolvedValue}
          currentOverride={overrides[popoverState.path]}
          onApply={handleOverrideApply}
          onClear={handleOverrideClear}
          onClose={() => setPopoverState(null)}
        />
      )}
    </>
  );
}
