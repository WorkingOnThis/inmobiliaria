"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Tipos ──────────────────────────────────────────────────────────────────

type Prioridad = "urgente" | "alta" | "media" | "baja";
type Estado = "pendiente" | "en_curso" | "resuelta";
type Tipo = "auto" | "manual";
type FiltroKey = "todas" | "auto" | "manual" | "alquiler" | "servicios" | "contratos";

type TareaResumen = {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad;
  estado: Estado;
  tipo: Tipo;
  categoria: string | null;
  fechaVencimiento: string | null;
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

type TareaDetalle = TareaResumen & {
  ownerId: string | null;
  ownerNombre: string | null;
  historial: {
    id: string;
    texto: string;
    tipo: Tipo;
    creadoPorNombre: string | null;
    createdAt: string;
  }[];
  comentarios: {
    id: string;
    texto: string;
    creadoPorNombre: string | null;
    createdAt: string;
  }[];
};

type ListaResponse = {
  total: number;
  saludPortfolio: number;
  items: TareaResumen[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(nombre: string | null): string {
  if (!nombre) return "??";
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function formatFecha(fecha: string | null): { label: string; colorClass: string } {
  if (!fecha) return { label: "sin fecha", colorClass: "text-text-muted opacity-60" };
  const now = new Date();
  const d = new Date(fecha);
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { label: "Vencida", colorClass: "text-destructive" };
  if (diffDays === 0) return { label: "Hoy", colorClass: "text-mustard" };
  if (diffDays <= 7) return { label: `en ${diffDays} días`, colorClass: "text-text-secondary" };
  return { label: `en ${diffDays} días`, colorClass: "text-text-muted" };
}

const PRIO: Record<Prioridad, { label: string; pill: string; border: string }> = {
  urgente: { label: "Urgente", pill: "bg-error-dim text-destructive",         border: "var(--error)" },
  alta:    { label: "Alta",    pill: "bg-mustard-dim text-mustard",            border: "var(--mustard)" },
  media:   { label: "Media",   pill: "bg-neutral-dim text-neutral",            border: "var(--neutral)" },
  baja:    { label: "Baja",    pill: "bg-surface-highest text-text-muted",     border: "transparent" },
};

const EST: Record<Estado, { label: string; badge: string }> = {
  pendiente: { label: "Pendiente", badge: "bg-muted text-muted-foreground" },
  en_curso:  { label: "En curso",  badge: "bg-neutral-dim text-neutral" },
  resuelta:  { label: "Resuelta",  badge: "bg-income-dim text-income" },
};

const TIPO_TAG: Record<Tipo, { label: string; cls: string }> = {
  auto:   { label: "Auto",   cls: "bg-neutral-dim text-neutral" },
  manual: { label: "Manual", cls: "bg-primary-dim text-primary" },
};

// ── Sub-componentes ────────────────────────────────────────────────────────

function TagBadge({ tipo }: { tipo: Tipo }) {
  const { label, cls } = TIPO_TAG[tipo];
  return (
    <Badge className={cn(cls, "px-[7px] py-[1px] text-[0.58rem] border-transparent")}>
      {label}
    </Badge>
  );
}

function EstadoBadge({ estado }: { estado: Estado }) {
  const { label, badge } = EST[estado];
  return (
    <Badge className={cn(badge, "border-transparent")}>
      {label}
    </Badge>
  );
}

function PrioridadPill({ prioridad }: { prioridad: Prioridad }) {
  const { label, pill } = PRIO[prioridad];
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
    <div className="flex items-center gap-2 mb-[10px] text-[0.58rem] font-bold uppercase tracking-[0.12em] text-text-muted">
      {children}
      <div className="flex-1 h-px bg-border" />
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
      <span className="text-[0.6rem] text-text-muted">salud del portfolio</span>
    </div>
  );
}

// ── Fila de tarea ──────────────────────────────────────────────────────────

function TareaRow({
  t,
  selected,
  onClick,
}: {
  t: TareaResumen;
  selected: boolean;
  onClick: () => void;
}) {
  const pCfg = PRIO[t.prioridad];
  const fecha = formatFecha(t.fechaVencimiento);

  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: pCfg.border }}
      className={`flex items-center gap-3 p-[11px_14px] bg-card border border-border border-l-[3px] rounded-xl cursor-pointer transition-all mb-1 hover:border-border-accent hover:bg-surface-mid ${
        selected ? "border-primary bg-primary-dim" : ""
      }`}
    >
      <div className="w-4 h-4 rounded-full border-2 border-border shrink-0 hover:border-income hover:bg-income-dim transition-all" />

      <div className="flex-1 min-w-0">
        <div className="text-[0.82rem] font-semibold text-on-surface truncate">{t.titulo}</div>
        <div className="flex items-center gap-[6px] mt-[2px] flex-wrap">
          <TagBadge tipo={t.tipo} />
          {t.categoria && (
            <>
              <span className="text-border text-[0.7rem]">·</span>
              <span className="text-[0.65rem] text-text-muted">{t.categoria}</span>
            </>
          )}
          {t.tenantNombre && (
            <>
              <span className="text-border text-[0.7rem]">·</span>
              <span className="text-[0.65rem] text-text-muted">{t.tenantNombre}</span>
            </>
          )}
        </div>
      </div>

      <EstadoBadge estado={t.estado} />
      <span className={`text-[0.65rem] font-semibold shrink-0 whitespace-nowrap ${fecha.colorClass}`}>
        {fecha.label}
      </span>
      <AvatarMini nombre={t.assignedToNombre} />
    </div>
  );
}

// ── Grupo de prioridad ─────────────────────────────────────────────────────

function GrupoPrioridad({
  prioridad,
  items,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
}: {
  prioridad: Prioridad;
  items: TareaResumen[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-[6px]">
      <div
        onClick={onToggle}
        className="flex items-center gap-[10px] p-[8px_10px] cursor-pointer rounded-lg transition-all hover:bg-surface select-none"
      >
        {collapsed
          ? <ChevronRight className="w-[10px] h-[10px] text-text-muted shrink-0" />
          : <ChevronDown  className="w-[10px] h-[10px] text-text-muted shrink-0" />
        }
        <PrioridadPill prioridad={prioridad} />
        <span className="text-[0.65rem] text-text-muted">
          {items.length} {items.length === 1 ? "tarea" : "tareas"}
        </span>
      </div>

      {!collapsed && (
        <div className="pl-1">
          {items.map(t => (
            <TareaRow
              key={t.id}
              t={t}
              selected={selectedId === t.id}
              onClick={() => onSelect(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vista Kanban ───────────────────────────────────────────────────────────

function KanbanView({ items }: { items: TareaResumen[] }) {
  const cols: { estado: Estado; label: string; labelColor: string }[] = [
    { estado: "pendiente", label: "Pendiente", labelColor: "text-text-secondary" },
    { estado: "en_curso",  label: "En curso",  labelColor: "text-neutral" },
    { estado: "resuelta",  label: "Resuelta",  labelColor: "text-green" },
  ];

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden p-[20px_28px] flex gap-4 items-start">
      {cols.map(col => {
        const colItems = items.filter(t => t.estado === col.estado);
        return (
          <div key={col.estado} className="w-[290px] shrink-0 flex flex-col gap-[10px]">
            <div className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-xl">
              <span className={`text-[0.72rem] font-bold uppercase tracking-[0.1em] ${col.labelColor}`}>
                {col.label}
              </span>
              <span className="text-[0.6rem] text-text-muted bg-muted px-[7px] py-[1px] rounded-full">
                {colItems.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {colItems.length === 0 && (
                <div className="text-[0.72rem] text-text-muted text-center py-8 border border-dashed border-border rounded-xl">
                  Sin tareas
                </div>
              )}
              {colItems.map(t => {
                const pCfg = PRIO[t.prioridad];
                const fecha = formatFecha(t.fechaVencimiento);
                return (
                  <div
                    key={t.id}
                    style={{ borderTopColor: pCfg.border }}
                    className="bg-card border border-border border-t-[3px] rounded-[18px] p-[14px] cursor-pointer transition-all hover:border-border-accent hover:bg-surface-mid"
                  >
                    <div className="text-[0.78rem] font-semibold text-on-surface mb-[6px] leading-snug">
                      {t.titulo}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.65rem] text-text-muted">
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

function PanelLateral({
  open,
  onClose,
  selectedId,
  onUpdate,
  onAddComentario,
}: {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onUpdate: (id: string, patch: { prioridad?: Prioridad; estado?: Estado }) => void;
  onAddComentario: (id: string, texto: string) => void;
}) {
  const [comentario, setComentario] = useState("");

  const { data: t, isLoading } = useQuery({
    queryKey: ["tarea", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/tareas/${selectedId}`);
      if (!res.ok) throw new Error("Error al cargar tarea");
      return res.json() as Promise<TareaDetalle>;
    },
    enabled: !!selectedId && open,
  });

  function submitComentario() {
    if (!t || !comentario.trim()) return;
    onAddComentario(t.id, comentario.trim());
    setComentario("");
  }

  return (
    <aside
      className="fixed top-14 right-0 w-[400px] h-[calc(100vh-56px)] bg-surface border-l border-border flex flex-col z-20 overflow-hidden transition-transform duration-[220ms] ease-[ease]"
      style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
    >
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !t && open && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[0.78rem] text-text-muted">No se pudo cargar la tarea</span>
        </div>
      )}

      {t && !isLoading && (
        <>
          {/* Header */}
          <div className="p-[16px_20px] border-b border-border flex items-start justify-between shrink-0 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <TagBadge tipo={t.tipo} />
                {t.categoria && (
                  <span className="text-[0.6rem] text-text-muted uppercase font-bold tracking-wide">
                    {t.categoria}
                  </span>
                )}
              </div>
              <div className="text-[0.95rem] font-bold text-on-bg font-headline leading-snug">
                {t.titulo}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-primary hover:bg-surface-high p-1 rounded-md transition-all shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* Prioridad + Estado */}
            <div className="p-[14px_20px] border-b border-border">
              <SectionTitle>Prioridad</SectionTitle>
              <div className="flex gap-1">
                {(["urgente", "alta", "media", "baja"] as Prioridad[]).map(p => (
                  <button
                    key={p}
                    onClick={() => onUpdate(t.id, { prioridad: p })}
                    className={`px-[10px] py-[3px] text-[0.6rem] font-bold rounded-full border transition-all ${
                      t.prioridad === p
                        ? PRIO[p].pill + " border-current/30"
                        : "bg-surface-high border-border text-text-muted hover:text-on-surface"
                    }`}
                  >
                    {PRIO[p].label}
                  </button>
                ))}
              </div>

              <div className="h-3" />
              <SectionTitle>Estado</SectionTitle>
              <div className="flex gap-1">
                {(["pendiente", "en_curso", "resuelta"] as Estado[]).map(e => (
                  <button
                    key={e}
                    onClick={() => onUpdate(t.id, { estado: e })}
                    className={`px-[10px] py-[3px] text-[0.6rem] font-bold rounded-full border transition-all ${
                      t.estado === e
                        ? EST[e].badge + " border-current/30"
                        : "bg-surface-high border-border text-text-muted hover:text-on-surface"
                    }`}
                  >
                    {EST[e].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Entidades vinculadas */}
            {(t.propertyAddress || t.contractNumber || t.tenantNombre) && (
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Entidades vinculadas</SectionTitle>
                {t.propertyAddress && (
                  <div className="mb-2">
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-text-muted mb-1">Propiedad</div>
                    <span className="text-primary inline-flex items-center gap-1 text-[0.78rem] font-semibold cursor-pointer hover:underline">
                      🏠 {t.propertyAddress}
                    </span>
                  </div>
                )}
                {t.contractNumber && (
                  <div className="mb-2">
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-text-muted mb-1">Contrato</div>
                    <span className="text-primary inline-flex items-center gap-1 text-[0.78rem] font-semibold cursor-pointer hover:underline">
                      {t.contractNumber}
                    </span>
                  </div>
                )}
                {t.tenantNombre && (
                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-text-muted mb-1">Inquilino</div>
                    <span className="text-primary inline-flex items-center gap-1 text-[0.78rem] font-semibold cursor-pointer hover:underline">
                      {t.tenantNombre}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Descripción */}
            {t.descripcion && (
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Descripción</SectionTitle>
                <p className="text-[0.78rem] text-text-secondary leading-relaxed">
                  {t.descripcion}
                </p>
              </div>
            )}

            {/* Responsable */}
            <div className="p-[14px_20px] border-b border-border">
              <SectionTitle>Responsables</SectionTitle>
              {t.assignedToNombre ? (
                <div className="flex items-center gap-2 py-[6px]">
                  <div className="w-7 h-7 rounded-[4px] bg-primary-dark flex items-center justify-center text-[0.55rem] font-extrabold text-primary-foreground shrink-0 font-brand">
                    {getInitials(t.assignedToNombre)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[0.78rem] font-medium text-on-surface">
                      {t.assignedToNombre}
                    </div>
                    <div className="text-[0.62rem] text-text-muted">Staff Admin</div>
                  </div>
                </div>
              ) : (
                <p className="text-[0.72rem] text-text-muted">Sin responsable asignado</p>
              )}
            </div>

            {/* Historial */}
            {t.historial.length > 0 && (
              <div className="p-[14px_20px] border-b border-border">
                <SectionTitle>Historial</SectionTitle>
                {t.historial.slice(0, 5).map(h => (
                  <div key={h.id} className="flex gap-[10px] py-2 border-b border-border last:border-b-0">
                    <div className={`w-[7px] h-[7px] rounded-full shrink-0 mt-[6px] ${
                      h.tipo === "auto" ? "bg-neutral" : "bg-primary"
                    }`} />
                    <div>
                      <div className="text-[0.72rem] text-text-secondary leading-snug">
                        {h.texto}
                      </div>
                      <div className="text-[0.6rem] text-text-muted mt-[2px]">
                        {new Date(h.createdAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                        {" · "}
                        {h.creadoPorNombre ?? "Automático"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comentarios */}
            <div className="p-[14px_20px]">
              <SectionTitle>Comentarios internos</SectionTitle>
              {t.comentarios.map(c => (
                <div key={c.id} className="mb-3 pb-3 border-b border-border last:border-b-0">
                  <div className="text-[0.72rem] text-text-secondary leading-snug">
                    {c.texto}
                  </div>
                  <div className="text-[0.6rem] text-text-muted mt-1">
                    {c.creadoPorNombre} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>
                </div>
              ))}
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Agregá una nota…"
                className="w-full bg-surface-high border border-border rounded-xl p-[8px_12px] text-[0.8rem] text-on-surface placeholder:text-text-muted outline-none focus:border-primary resize-none min-h-[60px] transition-all font-sans"
              />
              <button onClick={submitComentario} className="btn btn-secondary btn-sm w-full mt-2">
                Agregar comentario
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-[14px_20px] border-t border-border flex gap-2 shrink-0">
            <button className="btn btn-ghost btn-sm flex-1">
              Reasignar
            </button>
            <button
              onClick={() => onUpdate(t.id, { estado: "resuelta" })}
              className="btn btn-green btn-sm flex-[2]"
            >
              ✓ Marcar como resuelta
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

// ── Modal Nueva Tarea ──────────────────────────────────────────────────────

function ModalNuevaTarea({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    prioridad: "media" as Prioridad,
    categoria: "",
    fechaVencimiento: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim() || null,
          prioridad: form.prioridad,
          categoria: form.categoria || null,
          fechaVencimiento: form.fechaVencimiento || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al crear tarea");
      }
      onCreated();
      onClose();
      setForm({ titulo: "", descripcion: "", prioridad: "media", categoria: "", fechaVencimiento: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-3xl w-[520px] max-h-[90vh] overflow-y-auto"
        style={{ borderTop: "3px solid var(--primary)" }}
      >
        <div className="p-[20px_24px] border-b border-border flex items-center justify-between">
          <span className="text-[1rem] font-bold text-on-surface font-headline">Nueva tarea</span>
          <button onClick={onClose} className="text-text-muted hover:text-primary text-[1.1rem] p-1 rounded-md transition-all">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-[22px_24px] flex flex-col gap-[14px]">
          {error && (
            <div className="text-[0.78rem] text-destructive bg-error-dim rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-[5px]">
            <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Describí la tarea brevemente…"
              className="w-full bg-surface-high border border-border rounded-xl px-3 py-2 text-[0.875rem] text-on-surface placeholder:text-text-muted outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-col gap-[5px]">
            <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Contexto, pasos a seguir, notas…"
              className="w-full bg-surface-high border border-border rounded-xl px-3 py-2 text-[0.875rem] text-on-surface placeholder:text-text-muted outline-none focus:border-primary resize-y min-h-[72px] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-[14px]">
            <div className="flex flex-col gap-[5px]">
              <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                Prioridad
              </label>
              <select
                value={form.prioridad}
                onChange={e => setForm(f => ({ ...f, prioridad: e.target.value as Prioridad }))}
                className="w-full bg-surface-high border border-border rounded-xl px-3 py-2 text-[0.875rem] text-on-surface outline-none focus:border-primary transition-all"
              >
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div className="flex flex-col gap-[5px]">
              <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                Fecha límite
              </label>
              <input
                type="date"
                value={form.fechaVencimiento}
                onChange={e => setForm(f => ({ ...f, fechaVencimiento: e.target.value }))}
                className="w-full bg-surface-high border border-border rounded-xl px-3 py-2 text-[0.875rem] text-on-surface outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-[5px]">
            <label className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Categoría <span className="font-normal normal-case text-[0.6rem]">(opcional)</span>
            </label>
            <select
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full bg-surface-high border border-border rounded-xl px-3 py-2 text-[0.875rem] text-on-surface outline-none focus:border-primary transition-all"
            >
              <option value="">Sin categoría</option>
              <option value="alquiler">Alquiler</option>
              <option value="servicios">Servicios</option>
              <option value="contratos">Contratos</option>
              <option value="onboarding">Onboarding</option>
            </select>
          </div>
        </form>

        <div className="p-[14px_24px] border-t border-border flex justify-end gap-2 bg-surface-mid rounded-b-3xl">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn btn-primary btn-sm">
            {loading ? "Creando…" : "Crear tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export function TareasPanel() {
  const [vista, setVista] = useState<"lista" | "kanban">("lista");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [filtro, setFiltro] = useState<FiltroKey>("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [grupoCerrado, setGrupoCerrado] = useState<Record<Prioridad, boolean>>({
    urgente: false,
    alta: false,
    media: false,
    baja: false,
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tareas", scope, filtro],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (scope === "mine") p.set("scope", "mine");
      if (filtro === "auto" || filtro === "manual") p.set("tipo", filtro);
      else if (filtro !== "todas") p.set("categoria", filtro);
      const res = await fetch(`/api/tareas?${p}`);
      if (!res.ok) throw new Error("Error al cargar tareas");
      return res.json() as Promise<ListaResponse>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { prioridad?: Prioridad; estado?: Estado };
    }) => {
      const res = await fetch(`/api/tareas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tarea", selectedId] });
    },
  });

  const comentarioMutation = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const res = await fetch(`/api/tareas/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) throw new Error("Error al agregar comentario");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarea", selectedId] });
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
    urgente: items.filter(t => t.prioridad === "urgente"),
    alta:    items.filter(t => t.prioridad === "alta"),
    media:   items.filter(t => t.prioridad === "media"),
    baja:    items.filter(t => t.prioridad === "baja"),
  };

  const FILTROS: { key: FiltroKey; label: string; dotColor?: string }[] = [
    { key: "todas",     label: "Todas" },
    { key: "auto",      label: "Automáticas", dotColor: "var(--neutral)" },
    { key: "manual",    label: "Manuales",    dotColor: "var(--primary)" },
    { key: "alquiler",  label: "Alquiler" },
    { key: "servicios", label: "Servicios" },
    { key: "contratos", label: "Contratos" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-14 bg-surface border-b border-border flex items-center px-7 gap-[10px] shrink-0">
        <span className="text-[0.8rem] font-semibold text-on-surface">Tareas</span>

        <HealthWidget pct={data?.saludPortfolio ?? 100} />

        <div className="ml-auto flex gap-2 items-center">
          {/* Scope toggle */}
          <button
            onClick={() => setScope(s => s === "mine" ? "all" : "mine")}
            className="flex items-center gap-[6px] bg-surface-high border border-border rounded-full px-3 py-1 text-[0.68rem] font-semibold text-text-secondary hover:text-on-surface transition-all"
          >
            <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
            {scope === "mine" ? "Mis tareas" : "Todo el equipo"}
          </button>

          {/* Vista toggle */}
          <div className="flex bg-surface-high border border-border rounded-xl overflow-hidden">
            {(["lista", "kanban"] as const).map(v => (
              <button
                key={v}
                onClick={() => {
                  setVista(v);
                  if (v === "kanban") closePanel();
                }}
                className={`px-3 py-[5px] text-[0.68rem] font-semibold transition-all ${
                  vista === v ? "bg-primary-dim text-primary" : "text-text-muted"
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
          <div
            className="flex-1 overflow-y-auto p-[20px_28px] flex flex-col min-w-0 transition-[margin-right] duration-[220ms] ease-[ease]"
            style={{ marginRight: panelOpen ? "400px" : "0" }}
          >
            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap pb-4 shrink-0">
              <span className="font-headline text-[1.3rem] font-bold text-on-bg tracking-[-0.02em] mr-1">
                {data?.total ?? 0} {(data?.total ?? 0) === 1 ? "tarea" : "tareas"}
              </span>
              {FILTROS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={`flex items-center gap-[5px] px-3 py-[5px] text-[0.65rem] font-semibold rounded-full border transition-all whitespace-nowrap ${
                    filtro === f.key
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
              <button className="ml-auto px-3 py-[5px] text-[0.65rem] font-semibold bg-card border border-dashed border-border rounded-full text-text-secondary hover:text-on-surface transition-all">
                ⇅ Ordenar
              </button>
            </div>

            {/* Grupos */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
                <div className="text-4xl opacity-20">✓</div>
                <div className="text-[0.9rem] font-semibold text-text-secondary">
                  Sin tareas pendientes
                </div>
                <div className="text-[0.75rem] text-text-muted">
                  {scope === "mine"
                    ? "No tenés tareas asignadas"
                    : "No hay tareas en el sistema"}
                </div>
              </div>
            ) : (
              (["urgente", "alta", "media", "baja"] as Prioridad[]).map(prioridad => (
                <GrupoPrioridad
                  key={prioridad}
                  prioridad={prioridad}
                  items={grouped[prioridad]}
                  selectedId={selectedId}
                  onSelect={selectTask}
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
        <PanelLateral
          open={panelOpen}
          onClose={closePanel}
          selectedId={selectedId}
          onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
          onAddComentario={(id, texto) => comentarioMutation.mutate({ id, texto })}
        />
      </div>

      {/* Modal nueva tarea */}
      <ModalNuevaTarea
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["tareas"] })}
      />
    </div>
  );
}
