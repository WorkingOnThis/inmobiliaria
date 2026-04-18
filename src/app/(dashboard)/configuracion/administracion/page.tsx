"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Loader2, Eye, Check, Settings, Upload, X, Plus, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/agency/signature-pad";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ────────────────────────────────────────────────────────────────────

interface AgencyData {
  id?: string;
  razonSocial?: string | null;
  nombreFantasia?: string | null;
  cuit?: string | null;
  condicionIVA?: string | null;
  ingresosBrutos?: string | null;
  inicioActividades?: string | null;
  logoUrl?: string | null;
  domicilioFiscal?: string | null;
  localidad?: string | null;
  codigoPostal?: string | null;
  provincia?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  sitioWeb?: string | null;
  colegio?: string | null;
  matricula?: string | null;
  firmante?: string | null;
  firmanteCargo?: string | null;
  firmaUrl?: string | null;
  puntoVenta?: string | null;
  proximoNumero?: string | null;
  tipoComprobante?: string | null;
  prefijoLiquidacion?: string | null;
  moneda?: string | null;
  decimales?: number | null;
  bancoNombre?: string | null;
  bancoTitular?: string | null;
  bancoCBU?: string | null;
  bancoAlias?: string | null;
  clausulas?: string | null;
  prefShowQR?: boolean | null;
  prefShowDetalle?: boolean | null;
  prefEmailAuto?: boolean | null;
  prefFirma?: boolean | null;
  prefBorrador?: boolean | null;
}

interface Clausula { id: string; texto: string; }

function parseClausulas(raw: string | null | undefined): Clausula[] {
  if (!raw) return DEFAULT_CLAUSULAS;
  try { return JSON.parse(raw); } catch { return DEFAULT_CLAUSULAS; }
}

const DEFAULT_CLAUSULAS: Clausula[] = [
  { id: "c1", texto: "El presente recibo no constituye factura. Válido como constancia de percepción de alquiler y expensas según contrato vigente." },
  { id: "c2", texto: "Los honorarios por administración se calculan sobre el monto bruto percibido, según Ley 27.551 y modificatorias." },
  { id: "c3", texto: "Ante discrepancias comunicarse dentro de los 15 días hábiles desde la emisión." },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resizeImage(file: File, maxSize = 512): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-bg border border-border rounded-[7px] text-on-surface text-[13px] px-[11px] py-[9px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted font-[inherit]";
const labelCls =
  "text-[11px] text-text-muted uppercase tracking-[.05em] flex items-center gap-1.5";

function Field({
  label, req, hint, children, span2,
}: {
  label: string; req?: boolean; hint?: string; children: React.ReactNode; span2?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-[5px]", span2 && "col-span-2")}>
      <label className={labelCls}>
        {label}
        {req && <span className="text-primary">*</span>}
        {hint && <span className="text-text-muted normal-case tracking-normal text-[11px]">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SectionCard({
  num, title, desc, state, children,
}: {
  num: number; title: string; desc: string;
  state?: { label: string; ok: boolean };
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-mid border border-border rounded-[10px] overflow-hidden mb-4">
      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border/60">
        <div className="size-[22px] rounded-[6px] bg-primary/14 text-primary flex items-center justify-center text-[12px] font-semibold font-mono flex-shrink-0 mt-0.5">
          {num}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-on-surface m-0">{title}</h3>
          <div className="text-[12px] text-text-muted mt-0.5">{desc}</div>
        </div>
        {state && (
          <span className={cn(
            "flex items-center gap-1.5 text-[11px] px-2.5 py-[3px] rounded-full border flex-shrink-0",
            state.ok
              ? "bg-success/14 text-success border-success/25"
              : "bg-warning/14 text-warning border-warning/25",
          )}>
            <span className="size-1.5 rounded-full bg-current" />{state.label}
          </span>
        )}
      </div>
      <div className="px-[18px] py-4">{children}</div>
    </section>
  );
}

function PrefToggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex-1">
        <div className="text-[13px] font-medium text-on-surface">{label}</div>
        <div className="text-[12px] text-text-muted mt-[2px]">{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-[34px] h-[18px] rounded-full relative transition-all flex-shrink-0 cursor-pointer",
          value ? "bg-primary/20" : "bg-border",
        )}
      >
        <span className={cn(
          "absolute top-[2px] size-[14px] rounded-full transition-all",
          value ? "left-[18px] bg-primary" : "left-[2px] bg-text-muted",
        )} />
      </button>
    </div>
  );
}

function SortableClause({ clausula, onChange, onDelete }: {
  clausula: Clausula;
  onChange: (texto: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clausula.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-2.5 items-start px-3 py-2.5 bg-bg border border-border rounded-[8px]"
    >
      <button
        type="button"
        className="text-text-muted cursor-grab pt-[3px] flex-shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <textarea
        value={clausula.texto}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent border-0 outline-none text-[13px] text-on-surface resize-none min-h-[40px] font-[inherit] p-0"
        rows={2}
      />
      <button
        type="button"
        onClick={onDelete}
        className="text-text-muted hover:text-error transition-colors flex-shrink-0 pt-[2px]"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Logo Upload ───────────────────────────────────────────────────────────────

function LogoUpload({ value, onChange }: { value: string | null | undefined; onChange: (url: string | null) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("El archivo supera los 2 MB"); return; }
    const dataUrl = await resizeImage(file);
    onChange(dataUrl);
    e.target.value = "";
  };

  const initial = value
    ? null
    : null;

  return (
    <div className="flex items-center gap-3.5 mb-5">
      <div
        onClick={() => !value && fileRef.current?.click()}
        className={cn(
          "size-24 rounded-[10px] border flex items-center justify-center flex-shrink-0 overflow-hidden",
          value
            ? "border-transparent"
            : "border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors",
        )}
        style={value ? { background: "linear-gradient(135deg, var(--primary), oklch(0.55 0.15 30))" } : { background: "var(--bg)" }}
      >
        {value ? (
          <img src={value} alt="Logo" className="w-full h-full object-contain p-1" />
        ) : (
          <div className="text-center text-[11px] text-text-muted leading-tight px-2">
            <Upload size={16} className="mx-auto mb-1" />
            Logo
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="text-[12px] text-text-muted mb-2">
          PNG, SVG o JPG transparente · recomendado 512×512 px · máx. 2 MB
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleFile} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload size={13} /> Subir logo
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="text-text-muted">
              Quitar
            </Button>
          )}
        </div>
      </div>
      <div style={{ display: "none" }}>{initial}</div>
    </div>
  );
}

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ form, clausulas }: { form: FormState; clausulas: Clausula[] }) {
  const P = {
    bg: "#f7f5ef", text: "#1a1614", muted: "#5a514c", border: "#d9d1c3",
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };
  const pv = form.puntoVenta || "0001";
  const num = form.proximoNumero || "00000001";
  const tipo = form.tipoComprobante || "Recibo C";

  return (
    <div
      style={{
        background: P.bg, color: P.text,
        fontFamily: "Inter, -apple-system, sans-serif",
        padding: "22px 20px", borderRadius: "6px",
        fontSize: "11px", lineHeight: 1.45,
        boxShadow: "0 8px 24px rgba(0,0,0,.3)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", paddingBottom: "12px", borderBottom: `1.5px solid ${P.text}` }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "8px", flexShrink: 0,
          display: "grid", placeItems: "center", overflow: "hidden",
          ...(form.logoUrl
            ? {}
            : { background: "linear-gradient(135deg, #e85a3c, #c03c1f)", color: "#fff", fontWeight: 700, fontSize: "18px" }),
        }}>
          {form.logoUrl
            ? <img src={form.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : (form.razonSocial?.[0] ?? "A")
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-.01em" }}>
            {form.razonSocial || "Razón Social"}
          </div>
          <div style={{ fontSize: "10px", color: P.muted }}>
            CUIT {form.cuit || "00-00000000-0"} · {form.condicionIVA || "Monotributo"}
          </div>
          <div style={{ fontSize: "10px", color: P.muted }}>
            {form.domicilioFiscal || "Domicilio"}
            {form.localidad ? `, ${form.localidad}` : ""}
          </div>
          <div style={{ fontSize: "10px", color: P.muted }}>
            {form.telefono ? `Tel. ${form.telefono}` : ""}
            {form.telefono && form.emailContacto ? " · " : ""}
            {form.emailContacto || ""}
          </div>
        </div>
        <div style={{ textAlign: "right", fontFamily: P.mono }}>
          <div style={{ fontSize: "9px", color: P.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{tipo}</div>
          <div style={{ fontSize: "12px", fontWeight: 600 }}>{pv}-{num}</div>
          {form.matricula && (
            <div style={{ fontSize: "9px", color: P.muted, marginTop: "4px" }}>Mat. {form.matricula}</div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ marginTop: "14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          <div>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: ".08em", color: P.muted, marginBottom: "2px" }}>Recibí de</div>
            <div style={{ fontSize: "11.5px", fontWeight: 500 }}>Propietario Ejemplo</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: ".08em", color: P.muted, marginBottom: "2px" }}>Período</div>
            <div style={{ fontSize: "11.5px", fontWeight: 500 }}>Abril 2026</div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 4px", borderBottom: `1px solid ${P.text}`, fontSize: "9px", textTransform: "uppercase", letterSpacing: ".05em", color: P.muted }}>Concepto</th>
              <th style={{ textAlign: "right", padding: "6px 4px", borderBottom: `1px solid ${P.text}`, fontSize: "9px", textTransform: "uppercase", letterSpacing: ".05em", color: P.muted }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Alquiler · Rivadavia 4210 3ºB", "+$ 150.000"],
              ["Plomería urgente", "−$ 32.400"],
              ["Honorarios (7%)", "−$ 8.223"],
            ].map(([c, v]) => (
              <tr key={c}>
                <td style={{ padding: "5px 4px", borderBottom: `1px dashed ${P.border}`, fontFamily: P.mono }}>{c}</td>
                <td style={{ padding: "5px 4px", borderBottom: `1px dashed ${P.border}`, textAlign: "right", fontFamily: P.mono }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "12px", textAlign: "right", fontSize: "12px", fontWeight: 700, paddingTop: "8px", borderTop: `1.5px solid ${P.text}`, fontFamily: P.mono }}>
          Total transferido: $ 109.377,00
        </div>

        {clausulas.length > 0 && (
          <div style={{ marginTop: "18px", fontSize: "9.5px", color: P.muted, borderTop: `1px solid ${P.border}`, paddingTop: "10px" }}>
            {clausulas[0].texto}
          </div>
        )}

        {(form.bancoCBU || form.bancoAlias) && (
          <div style={{ marginTop: "8px", fontSize: "9.5px", color: P.muted }}>
            {form.bancoCBU && <>CBU: <span style={{ fontFamily: P.mono }}>{form.bancoCBU}</span></>}
            {form.bancoCBU && form.bancoAlias && " · "}
            {form.bancoAlias && <>Alias: <span style={{ fontFamily: P.mono }}>{form.bancoAlias}</span></>}
          </div>
        )}

        {(form.firmante || form.firmaUrl) && (
          <div style={{ marginTop: "30px", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "160px", textAlign: "center" }}>
              {form.firmaUrl ? (
                <img src={form.firmaUrl} alt="Firma" style={{ height: "40px", objectFit: "contain", margin: "0 auto 4px" }} />
              ) : (
                <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: "18px", transform: "rotate(-3deg)", marginBottom: "4px" }}>
                  {form.firmante}
                </div>
              )}
              <div style={{ borderTop: `1px solid ${P.text}`, paddingTop: "4px", fontSize: "9px", color: P.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>
                {form.firmante} · {form.firmanteCargo || "Administrador"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  razonSocial: string; nombreFantasia: string; cuit: string;
  condicionIVA: string; ingresosBrutos: string; inicioActividades: string;
  logoUrl: string | null;
  domicilioFiscal: string; localidad: string; codigoPostal: string;
  provincia: string; pais: string; telefono: string;
  emailContacto: string; sitioWeb: string;
  colegio: string; matricula: string; firmante: string;
  firmanteCargo: string; firmaUrl: string | null;
  puntoVenta: string; proximoNumero: string; tipoComprobante: string;
  prefijoLiquidacion: string; moneda: string; decimales: string;
  bancoNombre: string; bancoTitular: string; bancoCBU: string; bancoAlias: string;
  prefShowQR: boolean; prefShowDetalle: boolean;
  prefEmailAuto: boolean; prefFirma: boolean; prefBorrador: boolean;
};

function toFormState(d: AgencyData | null): FormState {
  return {
    razonSocial:        d?.razonSocial        ?? "",
    nombreFantasia:     d?.nombreFantasia     ?? "",
    cuit:               d?.cuit               ?? "",
    condicionIVA:       d?.condicionIVA       ?? "Monotributo",
    ingresosBrutos:     d?.ingresosBrutos     ?? "",
    inicioActividades:  d?.inicioActividades  ?? "",
    logoUrl:            d?.logoUrl            ?? null,
    domicilioFiscal:    d?.domicilioFiscal    ?? "",
    localidad:          d?.localidad          ?? "",
    codigoPostal:       d?.codigoPostal       ?? "",
    provincia:          d?.provincia          ?? "",
    pais:               d?.pais               ?? "",
    telefono:           d?.telefono           ?? "",
    emailContacto:      d?.emailContacto      ?? "",
    sitioWeb:           d?.sitioWeb           ?? "",
    colegio:            d?.colegio            ?? "",
    matricula:          d?.matricula          ?? "",
    firmante:           d?.firmante           ?? "",
    firmanteCargo:      d?.firmanteCargo      ?? "",
    firmaUrl:           d?.firmaUrl           ?? null,
    puntoVenta:         d?.puntoVenta         ?? "0001",
    proximoNumero:      d?.proximoNumero      ?? "00000001",
    tipoComprobante:    d?.tipoComprobante    ?? "Recibo C",
    prefijoLiquidacion: d?.prefijoLiquidacion ?? "LIQ-",
    moneda:             d?.moneda             ?? "ARS",
    decimales:          d?.decimales != null  ? String(d.decimales) : "2",
    bancoNombre:        d?.bancoNombre        ?? "",
    bancoTitular:       d?.bancoTitular       ?? "",
    bancoCBU:           d?.bancoCBU           ?? "",
    bancoAlias:         d?.bancoAlias         ?? "",
    prefShowQR:         d?.prefShowQR         ?? true,
    prefShowDetalle:    d?.prefShowDetalle    ?? true,
    prefEmailAuto:      d?.prefEmailAuto      ?? true,
    prefFirma:          d?.prefFirma          ?? true,
    prefBorrador:       d?.prefBorrador       ?? false,
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdministracionPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ agency: AgencyData | null }>({
    queryKey: ["agency"],
    queryFn: async () => {
      const res = await fetch("/api/agency");
      if (!res.ok) throw new Error("Error al cargar datos");
      return res.json();
    },
  });

  const [form, setForm] = useState<FormState>(toFormState(null));
  const [savedForm, setSavedForm] = useState<FormState>(toFormState(null));
  const [clausulas, setClausulas] = useState<Clausula[]>(DEFAULT_CLAUSULAS);
  const [savedClausulas, setSavedClausulas] = useState<Clausula[]>(DEFAULT_CLAUSULAS);
  const [isSaving, setIsSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true;
      const fs = toFormState(data.agency);
      setForm(fs);
      setSavedForm(fs);
      const cl = parseClausulas(data.agency?.clausulas);
      setClausulas(cl);
      setSavedClausulas(cl);
    }
  }, [data]);

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(savedForm) ||
    JSON.stringify(clausulas) !== JSON.stringify(savedClausulas);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setClausulas((items) => {
        const from = items.findIndex((i) => i.id === active.id);
        const to   = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, from, to);
      });
    }
  };

  const addClausula = () => {
    setClausulas((prev) => [...prev, { id: nanoid(), texto: "" }]);
  };

  const updateClausula = (id: string, texto: string) => {
    setClausulas((prev) => prev.map((c) => c.id === id ? { ...c, texto } : c));
  };

  const deleteClausula = (id: string) => {
    setClausulas((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          decimales: form.decimales ? parseInt(form.decimales) : null,
          clausulas: JSON.stringify(clausulas),
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      const fs = toFormState(updated.agency);
      setSavedForm(fs);
      const cl = parseClausulas(updated.agency?.clausulas);
      setSavedClausulas(cl);
      queryClient.invalidateQueries({ queryKey: ["agency"] });
      toast.success("Datos de la administración guardados");
    } catch {
      toast.error("Error al guardar. Intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(savedForm);
    setClausulas(savedClausulas);
  };

  // Completeness hints
  const sec1Ok = !!(form.razonSocial && form.cuit && form.condicionIVA);
  const sec2Ok = !!(form.domicilioFiscal && form.localidad);
  const sec3Ok = !!(form.matricula && form.firmante);
  const sec4Ok = !!(form.puntoVenta && form.proximoNumero);
  const sec5Ok = !!(form.bancoCBU);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Topbar */}
      <div className="h-12 bg-surface border-b border-border flex items-center px-6 gap-2 flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-[13px] text-text-muted">
          <Settings size={14} />
          <span>Configuración</span>
          <span className="text-text-muted/50">/</span>
          <span className="text-on-surface font-medium">Datos de la Administración</span>
        </div>
        <div className="ml-auto">
          <Link href="/propietarios">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Eye size={13} /> Ver propietarios
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-bg">
        <div className="px-6 py-5 max-w-[1200px]">
          {/* Page header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-[22px] font-bold text-on-bg tracking-tight m-0">Datos de la Administración</h1>
              <p className="text-[13px] text-text-muted mt-1">
                Información fija que aparece en recibos, liquidaciones y comprobantes que emitís a propietarios e inquilinos.
              </p>
            </div>
            <Link href="/propietarios/preview">
              <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0">
                <Eye size={13} /> Ver vista previa
              </Button>
            </Link>
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-[1fr_360px] gap-5 items-start">
            {/* LEFT: form sections */}
            <div>
              {/* 1. Identidad */}
              <SectionCard num={1} title="Identidad y marca" desc="Nombre, logo y datos de contacto que encabezan el documento." state={{ label: sec1Ok ? "Completo" : "Incompleto", ok: sec1Ok }}>
                <LogoUpload value={form.logoUrl} onChange={(v) => setField("logoUrl", v)} />
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Razón social" req>
                    <input type="text" value={form.razonSocial} onChange={(e) => setField("razonSocial", e.target.value)} placeholder="Ej: Arce Administración" className={inputCls} />
                  </Field>
                  <Field label="Nombre de fantasía" hint="(opcional)">
                    <input type="text" value={form.nombreFantasia} onChange={(e) => setField("nombreFantasia", e.target.value)} placeholder="Ej: Arce" className={inputCls} />
                  </Field>
                  <Field label="CUIT" req>
                    <input type="text" value={form.cuit} onChange={(e) => setField("cuit", e.target.value)} placeholder="30-00000000-0" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Condición IVA" req>
                    <select value={form.condicionIVA} onChange={(e) => setField("condicionIVA", e.target.value)} className={inputCls}>
                      <option>Responsable Inscripto</option>
                      <option>Monotributo</option>
                      <option>Exento</option>
                    </select>
                  </Field>
                  <Field label="Ingresos Brutos">
                    <input type="text" value={form.ingresosBrutos} onChange={(e) => setField("ingresosBrutos", e.target.value)} placeholder="901-123456-7" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Inicio de actividades">
                    <input type="date" value={form.inicioActividades} onChange={(e) => setField("inicioActividades", e.target.value)} className={inputCls} />
                  </Field>
                </div>
              </SectionCard>

              {/* 2. Domicilio y contacto */}
              <SectionCard num={2} title="Domicilio y contacto" desc="Se imprimen en el pie del recibo." state={{ label: sec2Ok ? "Completo" : "Incompleto", ok: sec2Ok }}>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Domicilio fiscal" req span2>
                    <input type="text" value={form.domicilioFiscal} onChange={(e) => setField("domicilioFiscal", e.target.value)} placeholder="Av. Callao 1280, Piso 4º B" className={inputCls} />
                  </Field>
                  <Field label="Localidad">
                    <input type="text" value={form.localidad} onChange={(e) => setField("localidad", e.target.value)} placeholder="C.A.B.A." className={inputCls} />
                  </Field>
                  <Field label="Código postal">
                    <input type="text" value={form.codigoPostal} onChange={(e) => setField("codigoPostal", e.target.value)} placeholder="C1000AAA" className={inputCls} />
                  </Field>
                  <Field label="Provincia">
                    <input type="text" value={form.provincia} onChange={(e) => setField("provincia", e.target.value)} placeholder="Buenos Aires" className={inputCls} />
                  </Field>
                  <Field label="País">
                    <input type="text" value={form.pais} onChange={(e) => setField("pais", e.target.value)} placeholder="Argentina" className={inputCls} />
                  </Field>
                  <Field label="Teléfono">
                    <input type="text" value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} placeholder="+54 11 0000-0000" className={inputCls} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.emailContacto} onChange={(e) => setField("emailContacto", e.target.value)} placeholder="hola@tuinmobiliaria.com.ar" className={inputCls} />
                  </Field>
                  <Field label="Sitio web" span2>
                    <input type="url" value={form.sitioWeb} onChange={(e) => setField("sitioWeb", e.target.value)} placeholder="tuinmobiliaria.com.ar" className={inputCls} />
                  </Field>
                </div>
              </SectionCard>

              {/* 3. Matrícula */}
              <SectionCard num={3} title="Matrícula profesional" desc="Colegio, número de matrícula y firmante que aparece al pie." state={{ label: sec3Ok ? "Completo" : "Incompleto", ok: sec3Ok }}>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Colegio / Registro">
                    <input type="text" value={form.colegio} onChange={(e) => setField("colegio", e.target.value)} placeholder="Ej: CUCICBA, CMCPSI…" className={inputCls} />
                  </Field>
                  <Field label="N.º de matrícula" req>
                    <input type="text" value={form.matricula} onChange={(e) => setField("matricula", e.target.value)} placeholder="MAT-0000" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Firmante" req>
                    <input type="text" value={form.firmante} onChange={(e) => setField("firmante", e.target.value)} placeholder="Nombre del firmante" className={inputCls} />
                  </Field>
                  <Field label="Cargo">
                    <input type="text" value={form.firmanteCargo} onChange={(e) => setField("firmanteCargo", e.target.value)} placeholder="Administrador" className={inputCls} />
                  </Field>
                  <Field label="Firma digital" span2>
                    <SignaturePad
                      value={form.firmaUrl}
                      onChange={(v) => setField("firmaUrl", v)}
                    />
                  </Field>
                </div>
              </SectionCard>

              {/* 4. Numeración */}
              <SectionCard num={4} title="Numeración y formato del recibo" desc="Cómo se nombran y numeran los documentos que emitís." state={{ label: sec4Ok ? "Completo" : "Incompleto", ok: sec4Ok }}>
                <div className="grid grid-cols-3 gap-3.5">
                  <Field label="Punto de venta">
                    <input type="text" value={form.puntoVenta} onChange={(e) => setField("puntoVenta", e.target.value)} placeholder="0001" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Próximo número">
                    <input type="text" value={form.proximoNumero} onChange={(e) => setField("proximoNumero", e.target.value)} placeholder="00000001" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Tipo">
                    <select value={form.tipoComprobante} onChange={(e) => setField("tipoComprobante", e.target.value)} className={inputCls}>
                      <option>Recibo X</option>
                      <option>Recibo C</option>
                      <option>Factura C</option>
                    </select>
                  </Field>
                  <Field label="Prefijo liquidación">
                    <input type="text" value={form.prefijoLiquidacion} onChange={(e) => setField("prefijoLiquidacion", e.target.value)} placeholder="LIQ-" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Moneda">
                    <select value={form.moneda} onChange={(e) => setField("moneda", e.target.value)} className={inputCls}>
                      <option value="ARS">ARS · Peso argentino</option>
                      <option value="USD">USD · Dólar</option>
                    </select>
                  </Field>
                  <Field label="Decimales">
                    <select value={form.decimales} onChange={(e) => setField("decimales", e.target.value)} className={inputCls}>
                      <option value="0">0 (enteros)</option>
                      <option value="2">2 decimales</option>
                    </select>
                  </Field>
                </div>
              </SectionCard>

              {/* 5. Bancarios */}
              <SectionCard num={5} title="Datos bancarios" desc="CBU / alias de la administración para recibir transferencias de inquilinos." state={{ label: sec5Ok ? "Completo" : "Incompleto", ok: sec5Ok }}>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Banco">
                    <input type="text" value={form.bancoNombre} onChange={(e) => setField("bancoNombre", e.target.value)} placeholder="Banco Galicia" className={inputCls} />
                  </Field>
                  <Field label="Titular">
                    <input type="text" value={form.bancoTitular} onChange={(e) => setField("bancoTitular", e.target.value)} placeholder="Razón social de la cuenta" className={inputCls} />
                  </Field>
                  <Field label="CBU">
                    <input type="text" value={form.bancoCBU} onChange={(e) => setField("bancoCBU", e.target.value)} placeholder="0000000000000000000000" className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Alias">
                    <input type="text" value={form.bancoAlias} onChange={(e) => setField("bancoAlias", e.target.value)} placeholder="tu.alias.aqui" className={cn(inputCls, "font-mono")} />
                  </Field>
                </div>
              </SectionCard>

              {/* 6. Cláusulas */}
              <SectionCard
                num={6}
                title="Cláusulas y notas legales"
                desc="Texto libre al pie del recibo. Podés reordenarlas arrastrando."
                state={{ label: `${clausulas.length} cláusula${clausulas.length !== 1 ? "s" : ""}`, ok: clausulas.length > 0 }}
              >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={clausulas.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2.5 mb-3">
                      {clausulas.map((c) => (
                        <SortableClause
                          key={c.id}
                          clausula={c}
                          onChange={(t) => updateClausula(c.id, t)}
                          onDelete={() => deleteClausula(c.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <button
                  type="button"
                  onClick={addClausula}
                  className="inline-flex items-center gap-1.5 px-2.5 py-[7px] rounded-[6px] border border-dashed border-border text-text-muted hover:text-on-surface hover:border-border/80 hover:bg-surface text-[12.5px] transition-colors"
                >
                  <Plus size={12} /> Agregar cláusula
                </button>
              </SectionCard>

              {/* 7. Preferencias */}
              <SectionCard num={7} title="Preferencias de emisión" desc="Qué incluir por defecto en cada liquidación.">
                <div style={{ paddingTop: "4px", paddingBottom: "4px" }}>
                  <PrefToggle
                    label="Mostrar QR para transferencia"
                    desc="Genera un QR automático con CBU/alias al pie del recibo."
                    value={form.prefShowQR}
                    onChange={(v) => setField("prefShowQR", v)}
                  />
                  <PrefToggle
                    label="Incluir detalle de movimientos"
                    desc="Listado completo de ingresos/egresos del período."
                    value={form.prefShowDetalle}
                    onChange={(v) => setField("prefShowDetalle", v)}
                  />
                  <PrefToggle
                    label="Enviar copia al propietario por email automáticamente"
                    desc="Al generar la liquidación, se envía el PDF al email registrado."
                    value={form.prefEmailAuto}
                    onChange={(v) => setField("prefEmailAuto", v)}
                  />
                  <PrefToggle
                    label="Firma digital al pie"
                    desc="Usar la firma cargada en la sección 3."
                    value={form.prefFirma}
                    onChange={(v) => setField("prefFirma", v)}
                  />
                  <PrefToggle
                    label='Marca de agua "BORRADOR"'
                    desc="Aparece en previsualización antes de confirmar."
                    value={form.prefBorrador}
                    onChange={(v) => setField("prefBorrador", v)}
                  />
                </div>
              </SectionCard>
            </div>

            {/* RIGHT: live preview */}
            <div className="sticky top-[70px]">
              <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
                <div className="flex items-center gap-2 text-[11px] text-text-muted uppercase tracking-[.06em] mb-3">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Vista previa en vivo
                </div>
                <LivePreview form={form} clausulas={clausulas} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save bar (sticky at bottom) */}
      <div className="sticky bottom-0 z-10 bg-surface/92 backdrop-blur-[8px] border-t border-border px-6 py-3 flex items-center gap-3">
        <div className={cn("flex items-center gap-2 text-[12.5px]", isDirty ? "text-warning" : "text-text-muted")}>
          <span className={cn("size-1.5 rounded-full", isDirty ? "bg-warning" : "bg-success")} />
          {isDirty ? "Cambios sin guardar" : "Guardado"}
        </div>
        <div className="flex-1" />
        {isDirty && (
          <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={isSaving}>
            Descartar
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90"
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
