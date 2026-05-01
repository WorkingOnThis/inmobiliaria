"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── Tipos ──────────────────────────────────────────────────────────────────

type Priority = "urgent" | "high" | "medium" | "low";
type TaskStatus = "pending" | "in_progress" | "resolved";
type TaskType = "auto" | "manual";
type FilterKey = "todas" | "auto" | "manual" | "rent" | "services" | "contracts";

type TaskPatch = {
  priority?: Priority;
  status?: TaskStatus;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
};

type TaskSummary = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  tipo: TaskType;
  categoria: string | null;
  dueDate: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  contractId: string | null;
  contractNumber: string | null;
  tenantId: string | null;
  tenantNombre: string | null;
  assignedToId: string | null;
  assignedToNombre: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskDetail = TaskSummary & {
  ownerId: string | null;
  ownerNombre: string | null;
  clientId: string | null;
  clienteNombre: string | null;
  clienteTipo: string | null;
  archivos: {
    id: string;
    name: string;
    url: string;
    tipo: string | null;
    size: number | null;
    createdAt: string;
  }[];
  historial: {
    id: string;
    text: string;
    tipo: string;
    createdByName: string | null;
    createdAt: string;
  }[];
  comentarios: {
    id: string;
    text: string;
    createdByName: string | null;
    createdAt: string;
  }[];
};

type ListResponse = {
  total: number;
  saludPortfolio: number;
  items: TaskSummary[];
};

type ClientSummary = {
  id: string;
  firstName: string;
  lastName: string | null;
  type: string;
};

type PropertySimple = {
  id: string;
  address: string;
  title: string | null;
  zone: string | null;
};

type ComboOption = {
  id: string;
  label: string;
  sublabel?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(nombre: string | null): string {
  if (!nombre) return "??";
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function formatDate(fecha: string | null): { label: string; colorClass: string } {
  if (!fecha) return { label: "sin fecha", colorClass: "text-muted-foreground opacity-60" };
  const now = new Date();
  const d = new Date(fecha);
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { label: "Vencida", colorClass: "text-destructive" };
  if (diffDays === 0) return { label: "Hoy", colorClass: "text-mustard" };
  if (diffDays <= 7) return { label: `en ${diffDays} días`, colorClass: "text-text-secondary" };
  return { label: `en ${diffDays} días`, colorClass: "text-muted-foreground" };
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; pill: string; border: string }> = {
  urgent: { label: "Urgente", pill: "bg-error-dim text-destructive",         border: "var(--error)" },
  high:   { label: "Alta",    pill: "bg-mustard-dim text-mustard",            border: "var(--mustard)" },
  medium: { label: "Media",   pill: "bg-neutral-dim text-neutral",            border: "var(--neutral)" },
  low:    { label: "Baja",    pill: "bg-surface-highest text-muted-foreground",     border: "transparent" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; badge: string }> = {
  pending:     { label: "Pendiente", badge: "bg-muted text-muted-foreground" },
  in_progress: { label: "En curso",  badge: "bg-neutral-dim text-neutral" },
  resolved:    { label: "Resuelta",  badge: "bg-income-dim text-income" },
};

const TYPE_TAG: Record<TaskType, { label: string; cls: string }> = {
  auto:   { label: "Auto",   cls: "bg-neutral-dim text-neutral" },
  manual: { label: "Manual", cls: "bg-primary-dim text-primary" },
};

function searchFilter(options: ComboOption[], query: string): ComboOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return options
    .map(o => {
      const haystack = (o.label + " " + (o.sublabel ?? "")).toLowerCase();
      const score = words.filter(w => haystack.includes(w)).length;
      return { option: o, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ option }) => option);
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  propietario: "Propietario",
  inquilino:   "Inquilino",
  garante:     "Garante",
  contacto:    "Contacto",
};

// ── Sub-componentes ────────────────────────────────────────────────────────

function TagBadge({ type }: { type: TaskType }) {
  const { label, cls } = TYPE_TAG[type];
  return (
    <Badge className={cn(cls, "px-[7px] py-[1px] text-[0.58rem] border-transparent")}>
      {label}
    </Badge>
  );
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, badge } = STATUS_CONFIG[status];
  return (
    <Badge className={cn(badge, "border-transparent")}>
      {label}
    </Badge>
  );
}

function PriorityPill({ priority }: { priority: Priority }) {
  const { label, pill } = PRIORITY_CONFIG[priority];
  return (
    <Badge className={cn(pill, "px-[10px] py-[3px] font-extrabold border-transparent")}>
      {label}
    </Badge>
  );
}

function AvatarMini({ nombre }: { nombre: string | null }) {
  return (
    <div className="w-[22px] h-[22px] rounded-[4px] bg-primary-dark flex items-center justify-center text-[0.5rem] font-extrabold text-primary-foreground shrink-0 font-brand">
      {getInitials(nombre)}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-[10px] text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function SearchCombobox({
  options,
  selectedId,
  selectedLabel,
  placeholder,
  onSelect,
  onClear,
}: {
  options: ComboOption[];
  selectedId: string | null;
  selectedLabel: string | null;
  placeholder: string;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = searchFilter(options, query);

  if (selectedId && selectedLabel) {
    return (
      <div className="flex items-center gap-2 bg-surface-high border border-border rounded-lg px-3 py-[8px]">
        <span className="flex-1 text-[0.78rem] text-on-surface truncate">{selectedLabel}</span>
        <button
          onClick={onClear}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full text-[0.78rem] bg-surface-high border border-border rounded-lg px-3 py-[8px] text-on-surface placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-[10px] text-[0.72rem] text-muted-foreground text-center">
              Sin resultados
            </div>
          ) : (
            results.map(r => (
              <button
                key={r.id}
                onMouseDown={() => { onSelect(r.id); setQuery(""); setOpen(false); }}
                className="w-full text-left px-3 py-[9px] hover:bg-surface-mid transition-colors border-b border-border last:border-b-0"
              >
                <div className="text-[0.78rem] font-medium text-on-surface truncate">{r.label}</div>
                {r.sublabel && (
                  <div className="text-[0.65rem] text-muted-foreground truncate mt-[1px]">{r.sublabel}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HealthWidget({ pct }: { pct: number }) {
  const color = pct >= 80 ? "text-green" : pct >= 50 ? "text-mustard" : "text-destructive";
  return (
    <div className="flex items-center gap-2 bg-surface-high border border-border rounded-full px-3 py-1 shrink-0 cursor-default">
      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--mustard), var(--green))",
          }}
        />
      </div>
      <span className={`text-[0.65rem] font-bold ${color}`}>{pct}%</span>
      <span className="text-[0.6rem] text-muted-foreground">salud del portfolio</span>
    </div>
  );
}

// ── Fila de tarea ──────────────────────────────────────────────────────────

function TaskRow({
  t,
  selected,
  onClick,
  onComplete,
}: {
  t: TaskSummary;
  selected: boolean;
  onClick: () => void;
  onComplete: (id: string) => void;
}) {
  const pCfg = PRIORITY_CONFIG[t.priority];
  const fecha = formatDate(t.dueDate);

  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: pCfg.border }}
      className={cn(
        "flex items-center gap-3 p-[11px_14px] bg-card border border-border border-l-[3px] rounded-xl cursor-pointer transition-all mb-1 hover:border-border-accent hover:bg-surface-mid",
        selected && "border-primary bg-primary-dim"
      )}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onComplete(t.id); }}
        className="w-4 h-4 rounded-full border-2 border-border shrink-0 hover:border-income hover:bg-income-dim transition-all cursor-pointer"
        title="Marcar como resuelta"
      />

      <div className="flex-1 min-w-0">
        <div className="text-[0.82rem] font-semibold text-on-surface truncate">{t.title}</div>
        <div className="flex items-center gap-[6px] mt-[2px] flex-wrap">
          <TagBadge type={t.tipo} />
          {t.categoria && (
            <>
              <span className="text-border text-[0.7rem]">·</span>
              <span className="text-[0.65rem] text-muted-foreground">{t.categoria}</span>
            </>
          )}
          {t.tenantNombre && (
            <>
              <span className="text-border text-[0.7rem]">·</span>
              <span className="text-[0.65rem] text-muted-foreground">{t.tenantNombre}</span>
            </>
          )}
        </div>
      </div>

      <TaskStatusBadge status={t.status} />
      <span className={`text-[0.65rem] font-semibold shrink-0 whitespace-nowrap ${fecha.colorClass}`}>
        {fecha.label}
      </span>
      <AvatarMini nombre={t.assignedToNombre} />
    </div>
  );
}

// ── Fila tarea finalizada ──────────────────────────────────────────────────

function CompletedTaskRow({ t, onClick }: { t: TaskSummary; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-[10px_14px] bg-card border border-border rounded-xl cursor-pointer transition-all mb-1 hover:border-border-accent hover:bg-surface-mid opacity-60"
    >
      <div className="w-4 h-4 rounded-full bg-income/30 border-2 border-income shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-income" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.82rem] font-semibold text-on-surface truncate line-through">
          {t.title}
        </div>
        <div className="text-[0.63rem] text-muted-foreground mt-[1px]">
          {t.categoria ?? ""}
        </div>
      </div>
      <span className="text-[0.62rem] text-muted-foreground shrink-0">
        {new Date(t.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
      </span>
    </div>
  );
}

// ── Grupo de prioridad ─────────────────────────────────────────────────────

function PriorityGroup({
  prioridad,
  items,
  selectedId,
  onSelect,
  onComplete,
  collapsed,
  onToggle,
}: {
  prioridad: Priority;
  items: TaskSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <Collapsible open={!collapsed} onOpenChange={() => onToggle()} className="mb-[6px]">
      <CollapsibleTrigger className="flex w-full items-center gap-[10px] p-[8px_10px] cursor-pointer rounded-lg transition-all hover:bg-surface select-none">
        {collapsed
          ? <ChevronRight className="w-[10px] h-[10px] text-muted-foreground shrink-0" />
          : <ChevronDown  className="w-[10px] h-[10px] text-muted-foreground shrink-0" />
        }
        <PriorityPill priority={prioridad} />
        <span className="text-[0.65rem] text-muted-foreground">
          {items.length} {items.length === 1 ? "tarea" : "tareas"}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="pl-1">
        {items.map(t => (
          <TaskRow
            key={t.id}
            t={t}
            selected={selectedId === t.id}
            onClick={() => onSelect(t.id)}
            onComplete={onComplete}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Vista Kanban ───────────────────────────────────────────────────────────

function KanbanView({ items }: { items: TaskSummary[] }) {
  const cols: { status: TaskStatus; label: string; labelColor: string }[] = [
    { status: "pending",     label: "Pendiente", labelColor: "text-text-secondary" },
    { status: "in_progress", label: "En curso",  labelColor: "text-neutral" },
    { status: "resolved",    label: "Resuelta",  labelColor: "text-green" },
  ];

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden p-[20px_28px] flex gap-4 items-start">
      {cols.map(col => {
        const colItems = items.filter(t => t.status === col.status);
        return (
          <div key={col.status} className="w-[290px] shrink-0 flex flex-col gap-[10px]">
            <div className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-xl">
              <span className={`text-[0.72rem] font-bold uppercase tracking-[0.1em] ${col.labelColor}`}>
                {col.label}
              </span>
              <span className="text-[0.6rem] text-muted-foreground bg-muted px-[7px] py-[1px] rounded-full">
                {colItems.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {colItems.length === 0 && (
                <div className="text-[0.72rem] text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
                  Sin tareas
                </div>
              )}
              {colItems.map(t => {
                const pCfg = PRIORITY_CONFIG[t.priority];
                const fecha = formatDate(t.dueDate);
                return (
                  <div
                    key={t.id}
                    style={{ borderTopColor: pCfg.border }}
                    className="bg-card border border-border border-t-[3px] rounded-[18px] p-[14px] cursor-pointer transition-all hover:border-border-accent hover:bg-surface-mid"
                  >
                    <div className="text-[0.78rem] font-semibold text-on-surface mb-[6px] leading-snug">
                      {t.title}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.65rem] text-muted-foreground">
                        {t.categoria ?? t.propertyAddress ?? ""}
                      </span>
                      <span className={`text-[0.6rem] font-semibold ${fecha.colorClass}`}>
                        {fecha.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Panel lateral ──────────────────────────────────────────────────────────

function SidePanel({
  open,
  onClose,
  selectedId,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onUpdate: (id: string, patch: TaskPatch) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingTitulo, setEditingTitulo] = useState(false);
  const [tituloDraft, setTituloDraft] = useState("");
  const [notaDraft, setNotaDraft] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const { data: t, isLoading } = useQuery({
    queryKey: ["tarea", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${selectedId}`);
      if (!res.ok) throw new Error("Error al cargar tarea");
      return res.json() as Promise<TaskDetail>;
    },
    enabled: !!selectedId && open,
  });

  const { data: clientesData } = useQuery({
    queryKey: ["clientes-lista"],
    queryFn: async () => {
      const res = await fetch("/api/clients?limit=200");
      if (!res.ok) return { clients: [] };
      return res.json() as Promise<{ clients: ClientSummary[] }>;
    },
    enabled: open,
  });
  const clientes = clientesData?.clients ?? [];

  const { data: propiedadesData } = useQuery({
    queryKey: ["propiedades-lista"],
    queryFn: async () => {
      const res = await fetch("/api/properties?limit=200&isManaged=true");
      if (!res.ok) return { properties: [] };
      const json = await res.json();
      return json as { properties: PropertySimple[] };
    },
    enabled: open,
  });
  const propiedades = propiedadesData?.properties ?? [];

  const clienteOptions: ComboOption[] = clientes.map(c => ({
    id: c.id,
    label: [c.firstName, c.lastName].filter(Boolean).join(" "),
    sublabel: CLIENT_TYPE_LABELS[c.type] ?? c.type,
  }));

  const propiedadOptions: ComboOption[] = propiedades.map(p => ({
    id: p.id,
    label: p.address,
    sublabel: [p.title, p.zone].filter(Boolean).join(" · ") || undefined,
  }));

  useEffect(() => {
    if (t) {
      setTituloDraft(t.title);
      setNotaDraft(t.description ?? "");
      setHistorialOpen(false);
    }
  }, [t?.id]);

  function saveTitulo() {
    if (!t || !tituloDraft.trim() || tituloDraft.trim() === t.title) {
      setEditingTitulo(false);
      return;
    }
    onUpdate(t.id, { title: tituloDraft.trim() });
    setEditingTitulo(false);
  }

  function saveNota() {
    if (!t) return;
    const val = notaDraft.trim() || null;
    if (val === t.description) return;
    onUpdate(t.id, { description: val });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !t) return;
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/tasks/${t.id}/archivos`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Error al subir");
      queryClient.invalidateQueries({ queryKey: ["tarea", t.id] });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteArchivo(archivoId: string) {
    if (!t) return;
    await fetch(`/api/tasks/${t.id}/archivos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivoId }),
    });
    queryClient.invalidateQueries({ queryKey: ["tarea", t.id] });
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="right"
        className="top-14 w-[420px] sm:max-w-[420px] p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t?.title ?? "Detalle de tarea"}</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !t && open && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[0.78rem] text-muted-foreground">No se pudo cargar la tarea</span>
          </div>
        )}

        {t && !isLoading && (
          <>
            {/* Header — título editable */}
            <div className="p-[16px_20px] pr-12 border-b border-border shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <TagBadge type={t.tipo} />
                {t.categoria && (
                  <span className="text-[0.6rem] text-muted-foreground uppercase font-bold tracking-wide">
                    {t.categoria}
                  </span>
                )}
              </div>
              {editingTitulo ? (
                <input
                  autoFocus
                  value={tituloDraft}
                  onChange={e => setTituloDraft(e.target.value)}
                  onBlur={saveTitulo}
                  onKeyDown={e => { if (e.key === "Enter") saveTitulo(); if (e.key === "Escape") setEditingTitulo(false); }}
                  className="w-full text-[0.95rem] font-bold text-on-bg font-headline leading-snug bg-transparent border-b border-primary outline-none pb-[2px]"
                />
              ) : (
                <div
                  onClick={() => { setEditingTitulo(true); setTituloDraft(t.title); }}
                  className="text-[0.95rem] font-bold text-on-bg font-headline leading-snug cursor-text hover:text-primary transition-colors"
                  title="Clic para editar título"
                >
                  {t.title}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* Nota / cuerpo */}
              <div className="p-[14px_20px] border-b border-border">
                <Textarea
                  value={notaDraft}
                  onChange={e => setNotaDraft(e.target.value)}
                  onBlur={saveNota}
                  placeholder="Escribí una nota, contexto o pasos a seguir…"
                  className="resize-none min-h-[90px] bg-transparent border-border/50 text-[0.8rem] text-text-secondary leading-relaxed focus:border-border"
                />
              </div>

              {/* Fecha */}
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Fecha límite</SectionTitle>
                <DatePicker
                  value={t.dueDate ? t.dueDate.substring(0, 10) : ""}
                  onChange={(v) => onUpdate(t.id, { dueDate: v || null })}
                />
                {t.dueDate && (
                  <p className={`text-[0.65rem] mt-[5px] font-semibold ${formatDate(t.dueDate).colorClass}`}>
                    {formatDate(t.dueDate).label}
                  </p>
                )}
              </div>

              {/* Prioridad + Estado */}
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Prioridad</SectionTitle>
                <div className="flex gap-1">
                  {(["urgent", "high", "medium", "low"] as Priority[]).map(p => (
                    <button
                      key={p}
                      onClick={() => onUpdate(t.id, { priority: p })}
                      className={`px-[10px] py-[3px] text-[0.6rem] font-bold rounded-full border transition-all ${
                        t.priority === p
                          ? PRIORITY_CONFIG[p].pill + " border-current/30"
                          : "bg-surface-high border-border text-muted-foreground hover:text-on-surface"
                      }`}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>

                <div className="h-3" />
                <SectionTitle>Estado</SectionTitle>
                <div className="flex gap-1">
                  {(["pending", "in_progress", "resolved"] as TaskStatus[]).map(e => (
                    <button
                      key={e}
                      onClick={() => onUpdate(t.id, { status: e })}
                      className={`px-[10px] py-[3px] text-[0.6rem] font-bold rounded-full border transition-all ${
                        t.status === e
                          ? STATUS_CONFIG[e].badge + " border-current/30"
                          : "bg-surface-high border-border text-muted-foreground hover:text-on-surface"
                      }`}
                    >
                      {STATUS_CONFIG[e].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona vinculada */}
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Persona vinculada</SectionTitle>
                <SearchCombobox
                  options={clienteOptions}
                  selectedId={t.clientId ?? null}
                  selectedLabel={
                    t.clienteNombre
                      ? `${t.clienteNombre}${t.clienteTipo ? ` · ${CLIENT_TYPE_LABELS[t.clienteTipo] ?? t.clienteTipo}` : ""}`
                      : null
                  }
                  placeholder="Buscar persona…"
                  onSelect={id => onUpdate(t.id, { clientId: id })}
                  onClear={() => onUpdate(t.id, { clientId: null })}
                />
              </div>

              {/* Propiedad vinculada */}
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Propiedad vinculada</SectionTitle>
                <SearchCombobox
                  options={propiedadOptions}
                  selectedId={t.propertyId ?? null}
                  selectedLabel={t.propertyAddress ?? null}
                  placeholder="Buscar propiedad…"
                  onSelect={id => onUpdate(t.id, { propertyId: id })}
                  onClear={() => onUpdate(t.id, { propertyId: null })}
                />
              </div>

              {/* Entidades vinculadas */}
              {(t.propertyAddress || t.contractNumber || t.tenantNombre) && (
                <div className="p-[14px_20px] border-b border-border">
                  <SectionTitle>Entidades vinculadas</SectionTitle>
                  {t.propertyAddress && (
                    <div className="mb-2">
                      <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1">Propiedad</div>
                      <span className="text-primary inline-flex items-center gap-1 text-[0.78rem] font-semibold cursor-pointer hover:underline">
                        🏠 {t.propertyAddress}
                      </span>
                    </div>
                  )}
                  {t.contractNumber && (
                    <div className="mb-2">
                      <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1">Contrato</div>
                      <span className="text-primary inline-flex items-center gap-1 text-[0.78rem] font-semibold cursor-pointer hover:underline">
                        {t.contractNumber}
                      </span>
                    </div>
                  )}
                  {t.tenantNombre && (
                    <div>
                      <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1">Inquilino</div>
                      <span className="text-primary inline-flex items-center gap-1 text-[0.78rem] font-semibold cursor-pointer hover:underline">
                        {t.tenantNombre}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Responsable */}
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Responsable</SectionTitle>
                {t.assignedToNombre ? (
                  <div className="flex items-center gap-2 py-[6px]">
                    <div className="w-7 h-7 rounded-[4px] bg-primary-dark flex items-center justify-center text-[0.55rem] font-extrabold text-primary-foreground shrink-0 font-brand">
                      {getInitials(t.assignedToNombre)}
                    </div>
                    <div className="flex-1">
                      <div className="text-[0.78rem] font-medium text-on-surface">
                        {t.assignedToNombre}
                      </div>
                      <div className="text-[0.62rem] text-muted-foreground">Staff Admin</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[0.72rem] text-muted-foreground">Sin responsable asignado</p>
                )}
              </div>

              {/* Archivos adjuntos */}
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Archivos adjuntos</SectionTitle>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {(t.archivos ?? []).length > 0 && (
                  <div className="flex flex-col gap-[6px] mb-[10px]">
                    {(t.archivos ?? []).map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 bg-surface-high border border-border rounded-lg px-3 py-[8px] group"
                      >
                        <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-[0.75rem] text-primary hover:underline truncate"
                        >
                          {a.name}
                        </a>
                        {a.size && (
                          <span className="text-[0.6rem] text-muted-foreground shrink-0">
                            {formatBytes(a.size)}
                          </span>
                        )}
                        <button
                          onClick={() => deleteArchivo(a.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-2 text-[0.72rem] text-text-secondary hover:text-primary border border-dashed border-border hover:border-primary rounded-lg px-3 py-[7px] w-full transition-all disabled:opacity-50"
                >
                  {uploadingFile ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Paperclip className="w-3 h-3" />
                  )}
                  {uploadingFile ? "Subiendo…" : "Adjuntar archivo"}
                </button>
              </div>

              {/* Historial desplegable */}
              {(t.historial ?? []).length > 0 && (
                <div className="p-[14px_20px]">
                  <Collapsible open={historialOpen} onOpenChange={setHistorialOpen}>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 select-none cursor-pointer">
                      <div className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Historial
                      </div>
                      <span className="text-[0.58rem] text-muted-foreground bg-muted px-[6px] py-[1px] rounded-full">
                        {(t.historial ?? []).length}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                      {historialOpen
                        ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      }
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-[10px]">
                        {(t.historial ?? []).map(h => (
                          <div key={h.id} className="flex gap-[10px] py-2 border-b border-border last:border-b-0">
                            <div className={`w-[7px] h-[7px] rounded-full shrink-0 mt-[6px] ${
                              h.tipo === "auto" ? "bg-neutral" : "bg-primary"
                            }`} />
                            <div>
                              <div className="text-[0.72rem] text-text-secondary leading-snug">
                                {h.text}
                              </div>
                              <div className="text-[0.6rem] text-muted-foreground mt-[2px]">
                                {new Date(h.createdAt).toLocaleDateString("es-AR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                                {" · "}
                                {h.createdByName ?? "Automático"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-[14px_20px] border-t border-border flex gap-2 shrink-0">
              {t.status !== "resolved" ? (
                <Button
                  size="sm"
                  className="flex-1 bg-income text-income-foreground hover:bg-income/90"
                  onClick={() => onUpdate(t.id, { status: "resolved" })}
                >
                  ✓ Marcar como resuelta
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => onUpdate(t.id, { status: "pending" })}
                >
                  ↩ Reabrir tarea
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Modal Nueva Tarea ──────────────────────────────────────────────────────

function NewTaskModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as Priority,
    categoria: "",
    dueDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          categoria: form.categoria || null,
          dueDate: form.dueDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al crear tarea");
      }
      onCreated();
      onClose();
      setForm({ title: "", description: "", priority: "medium", categoria: "", dueDate: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="p-[20px_24px] border-b border-border">
          <DialogTitle className="text-[1rem] font-bold text-on-surface font-headline">
            Nueva tarea
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
        <div className="p-[22px_24px] flex flex-col gap-[14px]">
          {error && (
            <div className="text-[0.78rem] text-destructive bg-error-dim rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-[5px]">
            <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Título <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Describí la tarea brevemente…"
            />
          </div>

          <div className="flex flex-col gap-[5px]">
            <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Nota <span className="font-normal normal-case text-[0.6rem]">(opcional)</span>
            </label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Contexto, pasos a seguir, notas…"
              className="resize-y min-h-[72px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-[14px]">
            <div className="flex flex-col gap-[5px]">
              <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Prioridad
              </label>
              <Select
                value={form.priority}
                onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-[5px]">
              <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Fecha límite
              </label>
              <DatePicker
                value={form.dueDate}
                onChange={(v) => setForm(f => ({ ...f, dueDate: v }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[5px]">
            <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Categoría <span className="font-normal normal-case text-[0.6rem]">(opcional)</span>
            </label>
            <Select
              value={form.categoria || "__none__"}
              onValueChange={v => setForm(f => ({ ...f, categoria: v === "__none__" ? "" : v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  <SelectItem value="rent">Alquiler</SelectItem>
                  <SelectItem value="services">Servicios</SelectItem>
                  <SelectItem value="contracts">Contratos</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="p-[14px_24px] border-t border-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Creando…" : "Crear tarea"}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export function TasksPanel() {
  const [vista, setVista] = useState<"lista" | "kanban">("lista");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [filtro, setFiltro] = useState<FilterKey>("todas");
  const [verFinalizadas, setVerFinalizadas] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [grupoCerrado, setGrupoCerrado] = useState<Record<Priority, boolean>>({
    urgent: false,
    high: false,
    medium: false,
    low: false,
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tareas", scope, filtro, verFinalizadas],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (scope === "mine") p.set("scope", "mine");
      if (filtro === "auto" || filtro === "manual") p.set("tipo", filtro);
      else if (filtro !== "todas") p.set("categoria", filtro);
      if (verFinalizadas) {
        p.set("estado", "resolved");
      } else {
        p.set("excluirResuelta", "true");
      }
      const res = await fetch(`/api/tasks?${p}`);
      if (!res.ok) throw new Error("Error al cargar tareas");
      return res.json() as Promise<ListResponse>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: TaskPatch;
    }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: (_, { patch }) => {
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tarea", selectedId] });
      if (patch.status === "resolved") {
        closePanel();
      }
    },
  });

  const completarMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (!res.ok) throw new Error("Error al completar");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      if (selectedId === id && panelOpen) closePanel();
    },
  });

  function selectTask(id: string) {
    setSelectedId(id);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelectedId(null);
  }

  const items = data?.items ?? [];
  const grouped = {
    urgent: items.filter(t => t.priority === "urgent"),
    high:   items.filter(t => t.priority === "high"),
    medium: items.filter(t => t.priority === "medium"),
    low:    items.filter(t => t.priority === "low"),
  };

  const FILTROS: { key: FilterKey; label: string; dotColor?: string }[] = [
    { key: "todas",     label: "Todas" },
    { key: "auto",      label: "Automáticas", dotColor: "var(--neutral)" },
    { key: "manual",    label: "Manuales",    dotColor: "var(--primary)" },
    { key: "rent",      label: "Alquiler" },
    { key: "services",  label: "Servicios" },
    { key: "contracts", label: "Contratos" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-14 bg-surface border-b border-border flex items-center px-7 gap-[10px] shrink-0">
        <span className="text-[0.8rem] font-semibold text-on-surface">Tareas</span>

        <HealthWidget pct={data?.saludPortfolio ?? 100} />

        <div className="ml-auto flex gap-2 items-center">
          <button
            onClick={() => setScope(s => s === "mine" ? "all" : "mine")}
            className="flex items-center gap-[6px] bg-surface-high border border-border rounded-full px-3 py-1 text-[0.68rem] font-semibold text-text-secondary hover:text-on-surface transition-all"
          >
            <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
            {scope === "mine" ? "Mis tareas" : "Todo el equipo"}
          </button>

          <div className="flex bg-surface-high border border-border rounded-xl overflow-hidden">
            {(["lista", "kanban"] as const).map(v => (
              <button
                key={v}
                onClick={() => {
                  setVista(v);
                  if (v === "kanban") closePanel();
                }}
                className={`px-3 py-[5px] text-[0.68rem] font-semibold transition-all ${
                  vista === v ? "bg-primary-dim text-primary" : "text-muted-foreground"
                }`}
              >
                {v === "lista" ? "≡ Lista" : "⊞ Kanban"}
              </button>
            ))}
          </div>

          <button onClick={() => setModalOpen(true)} className="btn btn-primary btn-sm">
            + Nueva tarea
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Vista Lista */}
        {!isLoading && vista === "lista" && (
          <div className="flex-1 overflow-y-auto p-[20px_28px] flex flex-col min-w-0">
            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap pb-4 shrink-0">
              <span className="font-headline text-[1.3rem] font-bold text-on-bg tracking-[-0.02em] mr-1">
                {data?.total ?? 0} {(data?.total ?? 0) === 1 ? "tarea" : "tareas"}
              </span>
              {FILTROS.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFiltro(f.key); setVerFinalizadas(false); }}
                  className={`flex items-center gap-[5px] px-3 py-[5px] text-[0.65rem] font-semibold rounded-full border transition-all whitespace-nowrap ${
                    filtro === f.key && !verFinalizadas
                      ? "bg-primary-dim text-primary border-border-accent"
                      : "bg-surface border-border text-text-secondary hover:text-on-surface hover:border-border-accent"
                  }`}
                >
                  {f.dotColor && (
                    <span
                      className="w-[6px] h-[6px] rounded-full shrink-0"
                      style={{ background: f.dotColor }}
                    />
                  )}
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setVerFinalizadas(v => !v)}
                className={`flex items-center gap-[5px] px-3 py-[5px] text-[0.65rem] font-semibold rounded-full border transition-all whitespace-nowrap ${
                  verFinalizadas
                    ? "bg-income-dim text-income border-income/30"
                    : "bg-surface border-border text-text-secondary hover:text-on-surface hover:border-border-accent"
                }`}
              >
                <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-income" />
                Finalizadas
              </button>
              <button className="ml-auto px-3 py-[5px] text-[0.65rem] font-semibold bg-card border border-dashed border-border rounded-full text-text-secondary hover:text-on-surface transition-all">
                ⇅ Ordenar
              </button>
            </div>

            {/* Lista de tareas */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
                <div className="text-4xl opacity-20">{verFinalizadas ? "✓" : "✓"}</div>
                <div className="text-[0.9rem] font-semibold text-text-secondary">
                  {verFinalizadas ? "Sin tareas finalizadas" : "Sin tareas pendientes"}
                </div>
                <div className="text-[0.75rem] text-muted-foreground">
                  {verFinalizadas
                    ? "Las tareas resueltas aparecen acá"
                    : scope === "mine"
                      ? "No tenés tareas asignadas"
                      : "No hay tareas en el sistema"}
                </div>
              </div>
            ) : verFinalizadas ? (
              <div className="flex flex-col">
                {items.map(t => (
                  <CompletedTaskRow
                    key={t.id}
                    t={t}
                    onClick={() => selectTask(t.id)}
                  />
                ))}
              </div>
            ) : (
              (["urgent", "high", "medium", "low"] as Priority[]).map(prioridad => (
                <PriorityGroup
                  key={prioridad}
                  prioridad={prioridad}
                  items={grouped[prioridad]}
                  selectedId={selectedId}
                  onSelect={selectTask}
                  onComplete={id => completarMutation.mutate(id)}
                  collapsed={grupoCerrado[prioridad]}
                  onToggle={() =>
                    setGrupoCerrado(prev => ({
                      ...prev,
                      [prioridad]: !prev[prioridad],
                    }))
                  }
                />
              ))
            )}
          </div>
        )}

        {/* Vista Kanban */}
        {!isLoading && vista === "kanban" && <KanbanView items={items} />}

        {/* Panel lateral */}
        <SidePanel
          open={panelOpen}
          onClose={closePanel}
          selectedId={selectedId}
          onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
        />
      </div>

      {/* Modal nueva tarea */}
      <NewTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["tareas"] })}
      />
    </div>
  );
}
