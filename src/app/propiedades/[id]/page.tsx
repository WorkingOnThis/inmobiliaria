"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ArrowLeft, Loader2, Pencil, X, Save, ExternalLink, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyDetail {
  id: string;
  title: string | null;
  address: string;
  price: string | null;
  type: string;
  status: string;
  zone: string | null;
  floorUnit: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  serviceLuz: string;
  serviceGas: string;
  serviceAgua: string;
  serviceMunicipalidad: string;
  serviceRendas: string;
  serviceExpensas: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerDni: string | null;
  ownerCuit: string | null;
  ownerStatus: string | null;
}

type Tab = "personas" | "datos" | "contratos" | "servicios" | "mantenimiento" | "documentos" | "tareas";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  departamento: "🏢",
  casa: "🏠",
  terreno: "🌳",
  local: "🏪",
  oficina: "💼",
  cochera: "🚗",
  otro: "🏗️",
};

const TYPE_LABEL: Record<string, string> = {
  departamento: "Departamento",
  casa: "Casa",
  terreno: "Terreno",
  local: "Local Comercial",
  oficina: "Oficina",
  cochera: "Cochera",
  otro: "Otro",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  available:    { label: "Disponible",        bg: "rgba(253,222,168,0.15)", color: "#ffdea8", dot: "#ffdea8" },
  rented:       { label: "Alquilada",         bg: "rgba(141,207,149,0.12)", color: "#8dcf95", dot: "#8dcf95" },
  maintenance:  { label: "En mantenimiento",  bg: "rgba(253,186,116,0.12)", color: "#fdba74", dot: "#fdba74" },
  reserved:     { label: "Reservada",         bg: "rgba(147,197,253,0.12)", color: "#93c5fd", dot: "#93c5fd" },
  sold:         { label: "Vendida",           bg: "rgba(255,180,171,0.12)", color: "#ffb4ab", dot: "#ffb4ab" },
};

const SERVICIO_LABEL: Record<string, string> = {
  inquilino:   "Inquilino",
  propietario: "Propietario",
  na:          "N/A",
};

function getOwnerInitials(firstName: string | null, lastName: string | null) {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function formatSurface(surface: string | null) {
  if (!surface) return null;
  const n = parseFloat(surface);
  return isNaN(n) ? null : `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} m²`;
}

function buildSubtitle(prop: PropertyDetail) {
  const parts: string[] = [TYPE_LABEL[prop.type] ?? prop.type];
  if (prop.rooms) parts.push(`${prop.rooms} amb.`);
  const surf = formatSurface(prop.surface);
  if (surf) parts.push(surf);
  if (prop.zone) parts.push(prop.zone);
  return parts.join(" · ");
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.available;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.63rem] font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Dato item ─────────────────────────────────────────────────────────────────

function DatoItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-md px-3.5 py-3"
      style={{ background: "#191c1e", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-[#6b6d70] mb-1">
        {label}
      </div>
      <div
        className="text-[0.82rem] font-semibold"
        style={{ color: highlight ? "#ffdea8" : value ? "#e1e2e4" : "#6b6d70" }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

// ── Edit input ────────────────────────────────────────────────────────────────

function EditInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-[#6b6d70]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded px-3 py-2 text-[0.82rem] text-[#e1e2e4] outline-none transition-colors"
        style={{
          background: "#222527",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,180,162,0.4)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      />
    </div>
  );
}

// ── Edit select ───────────────────────────────────────────────────────────────

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-[#6b6d70]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded px-3 py-2 text-[0.82rem] text-[#e1e2e4] outline-none transition-colors cursor-pointer"
        style={{
          background: "#222527",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Placeholder tab ───────────────────────────────────────────────────────────

function PlaceholderTab({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="text-[0.9rem] font-semibold text-[#a8a9ac]">{title}</div>
      <div className="text-[0.75rem] text-[#6b6d70] max-w-xs">{description}</div>
    </div>
  );
}

// ── Contratos tab ─────────────────────────────────────────────────────────────

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:            { label: "Vigente",            color: "#8dcf95", bg: "rgba(141,207,149,0.12)" },
  draft:             { label: "Borrador",           color: "#a8a9ac", bg: "rgba(168,169,172,0.10)" },
  pending_signature: { label: "Pend. de firma",     color: "#93c5fd", bg: "rgba(147,197,253,0.12)" },
  expiring_soon:     { label: "Por vencer",         color: "#ffdea8", bg: "rgba(253,222,168,0.12)" },
  expired:           { label: "Vencido",            color: "#ffb4ab", bg: "rgba(255,180,171,0.12)" },
  terminated:        { label: "Rescindido",         color: "#ffb4ab", bg: "rgba(255,180,171,0.12)" },
};

function ContratosTab({ propertyId }: { propertyId: string }) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ["contracts", "property", propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts?propertyId=${propertyId}&limit=50`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al cargar contratos");
      }
      return res.json();
    },
  });

  const contracts: {
    id: string;
    contractNumber: string;
    status: string;
    startDate: string;
    endDate: string;
    monthlyAmount: string;
    tenantNames: string[];
    ownerName: string;
  }[] = data?.contracts ?? [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b6d70]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-7 py-6 text-[0.78rem] text-[#ffb4ab]">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="px-7 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70]">
          Historial de contratos
        </div>
        <Link
          href={`/contratos/nuevo?propertyId=${propertyId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-semibold rounded-[8px] transition-colors"
          style={{ background: "#282a2c", color: "#a8a9ac", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <PlusCircle size={12} /> Nuevo contrato
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-3 rounded-[12px]"
          style={{ background: "#191c1e", border: "1px dashed rgba(255,255,255,0.07)" }}
        >
          <div className="text-3xl">📄</div>
          <div className="text-[0.82rem] font-semibold text-[#a8a9ac]">Sin contratos</div>
          <div className="text-[0.72rem] text-[#6b6d70]">Esta propiedad no tiene contratos registrados todavía.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contracts.map((c) => {
            const cfg = CONTRACT_STATUS_CONFIG[c.status] ?? CONTRACT_STATUS_CONFIG.draft;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 px-4 py-3.5 rounded-[12px] cursor-pointer transition-colors"
                style={{ background: "#191c1e", border: "1px solid rgba(255,255,255,0.07)" }}
                onClick={() => router.push(`/contratos/${c.id}`)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,180,162,0.2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                {/* Número */}
                <div className="font-mono text-[0.82rem] font-bold text-[#e1e2e4] w-24 flex-shrink-0">
                  {c.contractNumber}
                </div>

                {/* Inquilino */}
                <div className="flex-1 min-w-0">
                  <div className="text-[0.78rem] font-semibold text-[#e1e2e4] truncate">
                    {c.tenantNames.length > 0 ? c.tenantNames.join(", ") : "Sin inquilino"}
                  </div>
                  <div className="text-[0.62rem] text-[#6b6d70] mt-0.5">
                    {format(new Date(c.startDate), "dd/MM/yyyy", { locale: es })}
                    {" → "}
                    {format(new Date(c.endDate), "dd/MM/yyyy", { locale: es })}
                    {" · "}${parseFloat(c.monthlyAmount).toLocaleString("es-AR")}/mes
                  </div>
                </div>

                {/* Badge de estado */}
                <span
                  className="px-2.5 py-0.5 rounded-full text-[0.63rem] font-bold flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>

                {/* Flecha */}
                <ExternalLink size={13} className="text-[#6b6d70] flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PropiedadFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get("tab") as Tab) ?? "personas";

  const setTab = (tab: Tab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.replace(`/propiedades/${id}?${p.toString()}`, { scroll: false });
  };

  const { data, isLoading, error } = useQuery<{ property: PropertyDetail }>({
    queryKey: ["property", id],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${id}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al cargar la propiedad");
      }
      return res.json();
    },
  });

  const prop = data?.property;

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState({
    address: "",
    type: "",
    status: "",
    zone: "",
    floorUnit: "",
    rooms: "",
    bathrooms: "",
    surface: "",
  });

  const startEdit = () => {
    if (!prop) return;
    setForm({
      address: prop.address,
      type: prop.type,
      status: prop.status,
      zone: prop.zone ?? "",
      floorUnit: prop.floorUnit ?? "",
      rooms: prop.rooms != null ? String(prop.rooms) : "",
      bathrooms: prop.bathrooms != null ? String(prop.bathrooms) : "",
      surface: prop.surface != null ? String(parseFloat(prop.surface)) : "",
    });
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditError(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: form.address || undefined,
          type: form.type || undefined,
          status: form.status || undefined,
          zone: form.zone || null,
          floorUnit: form.floorUnit || null,
          rooms: form.rooms ? Number(form.rooms) : null,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
          surface: form.surface ? Number(form.surface) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["property", id] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setEditing(false);
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  // ── Loading / error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#6b6d70]" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !prop) {
    return (
      <DashboardLayout>
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-[#6b6d70]">
          <div className="text-sm">{(error as Error)?.message ?? "Propiedad no encontrada"}</div>
          <button
            onClick={() => router.push("/propiedades")}
            className="text-[0.72rem] text-[#ffb4a2] hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver a la lista
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const ownerName = [prop.ownerLastName, prop.ownerFirstName].filter(Boolean).join(", ") || "—";

  // ── Tabs definition ──────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "personas",      label: "Personas vinculadas" },
    { key: "datos",         label: "Datos" },
    { key: "contratos",     label: "Contratos",    disabled: false },
    { key: "servicios",     label: "Servicios",    disabled: true },
    { key: "mantenimiento", label: "Mantenimiento",disabled: true },
    { key: "documentos",    label: "Documentos",   disabled: true },
    { key: "tareas",        label: "Tareas",       disabled: true },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full" style={{ background: "#111314" }}>

        {/* ── Breadcrumb topbar ── */}
        <div
          className="h-14 flex items-center px-7 gap-2.5 flex-shrink-0"
          style={{ background: "#191c1e", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={() => router.push("/propiedades")}
            className="text-[0.8rem] text-[#a8a9ac] hover:text-[#ffb4a2] transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={13} />
            Propiedades
          </button>
          <span className="text-[#6b6d70]">›</span>
          <span className="text-[0.8rem] font-semibold text-[#e1e2e4] truncate max-w-xs">
            {prop.address}
          </span>
        </div>

        {/* ── Ficha header ── */}
        <div
          className="flex-shrink-0"
          style={{ background: "#191c1e", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Identity */}
          <div className="px-7 pt-5 pb-0 flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-[12px] flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: "linear-gradient(135deg,#1a2a1a,#2a4a2a)",
                border: "2px solid rgba(163,217,165,0.2)",
              }}
            >
              {TYPE_ICON[prop.type] ?? "🏗️"}
            </div>

            <div className="flex-1 min-w-0">
              <h1
                className="text-[1.15rem] font-bold leading-tight text-[#e1e2e4] font-[Space_Grotesk] tracking-[-0.02em] mb-1"
              >
                {prop.address}
                {prop.floorUnit ? ` — ${prop.floorUnit}` : ""}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.75rem] text-[#a8a9ac]">{buildSubtitle(prop)}</span>
                <StatusBadge status={prop.status} />
              </div>
            </div>

            {/* Topbar actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeTab === "datos" && !editing && (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-semibold rounded-[8px] transition-colors"
                  style={{ background: "#282a2c", color: "#a8a9ac", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <Pencil size={12} /> Editar
                </button>
              )}
              {activeTab === "datos" && editing && (
                <>
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-semibold rounded-[8px] transition-colors"
                    style={{ background: "#282a2c", color: "#a8a9ac", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <X size={12} /> Cancelar
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-semibold rounded-[8px] transition-colors disabled:opacity-50"
                    style={{ background: "#ffb4a2", color: "#561100" }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Widgets row */}
          <div
            className="flex mt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginLeft: 0, marginRight: 0 }}
          >
            {/* Widget: Propietario */}
            <button
              onClick={() => router.push(`/propietarios/${prop.ownerId}`)}
              className="flex-1 px-5 py-3 text-left transition-colors group"
              style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#222527"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70] mb-1">Propietario</div>
              <div className="text-[0.88rem] font-bold text-[#a8a9ac] leading-tight">{ownerName}</div>
              <div className="text-[0.62rem] text-[#ffb4a2] mt-0.5">Ver ficha →</div>
            </button>

            {/* Widget: Contrato activo */}
            <div
              className="flex-1 px-5 py-3"
              style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70] mb-1">Contrato activo</div>
              <div className="text-[0.82rem] font-bold text-[#6b6d70]">Sin contrato</div>
              <div className="text-[0.62rem] text-[#6b6d70] mt-0.5">Módulo pendiente</div>
            </div>

            {/* Widget: Superficie */}
            <div
              className="flex-1 px-5 py-3"
              style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70] mb-1">Superficie</div>
              <div className="text-[0.88rem] font-bold text-[#e1e2e4]">
                {formatSurface(prop.surface) ?? "—"}
              </div>
              {prop.rooms && (
                <div className="text-[0.62rem] text-[#6b6d70] mt-0.5">{prop.rooms} ambientes</div>
              )}
            </div>

            {/* Widget: Tareas */}
            <div className="flex-1 px-5 py-3">
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70] mb-1">Tareas pendientes</div>
              <div className="text-[0.88rem] font-bold text-[#6b6d70]">—</div>
              <div className="text-[0.62rem] text-[#6b6d70] mt-0.5">Módulo pendiente</div>
            </div>
          </div>
        </div>

        {/* ── Tabs bar ── */}
        <div
          className="flex flex-shrink-0 overflow-x-auto"
          style={{ background: "#191c1e", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {TABS.map(({ key, label, disabled }) => (
            <button
              key={key}
              onClick={() => !disabled && setTab(key)}
              disabled={disabled}
              className={`px-4 py-3 text-[0.75rem] font-medium border-b-2 transition-all whitespace-nowrap ${
                disabled
                  ? "border-transparent text-[#333537] cursor-not-allowed"
                  : activeTab === key
                  ? "border-[#ffb4a2] text-[#ffb4a2] font-semibold"
                  : "border-transparent text-[#6b6d70] hover:text-[#a8a9ac]"
              }`}
              title={disabled ? "Módulo en desarrollo" : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── TAB: PERSONAS VINCULADAS ── */}
          {activeTab === "personas" && (
            <div className="px-7 py-6">

              {/* Propietario */}
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3">
                Propietario
              </div>
              <div
                className="flex items-center gap-4 px-4 py-4 rounded-[12px] mb-2 transition-colors cursor-pointer"
                style={{ background: "#191c1e", border: "1px solid rgba(255,255,255,0.07)" }}
                onClick={() => router.push(`/propietarios/${prop.ownerId}`)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,180,162,0.2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-[8px] flex items-center justify-center text-[0.82rem] font-extrabold flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg,#1a2a30,#1a4060)",
                    border: "1.5px solid rgba(138,180,248,0.25)",
                    color: "#8ab4f8",
                    fontFamily: "Montserrat, sans-serif",
                  }}
                >
                  {getOwnerInitials(prop.ownerFirstName, prop.ownerLastName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] font-semibold text-[#e1e2e4] mb-0.5">{ownerName}</div>
                  <div className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#6b6d70] mb-1">Propietario</div>
                  <div className="flex items-center gap-3 flex-wrap text-[0.72rem] text-[#a8a9ac]">
                    {prop.ownerPhone && <span>📱 {prop.ownerPhone}</span>}
                    {prop.ownerEmail && <span>{prop.ownerEmail}</span>}
                    {prop.ownerCuit && <span>CUIT {prop.ownerCuit}</span>}
                    {prop.ownerDni && !prop.ownerCuit && <span>DNI {prop.ownerDni}</span>}
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/propietarios/${prop.ownerId}`); }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[0.68rem] font-semibold rounded-[8px] transition-colors flex-shrink-0"
                  style={{ background: "#282a2c", color: "#a8a9ac", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  Ver ficha <ExternalLink size={10} />
                </button>
              </div>

              {/* Inquilino */}
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3 mt-5">
                Inquilino
              </div>
              <div
                className="flex items-center gap-3 px-4 py-4 rounded-[12px] text-center justify-center"
                style={{ background: "#191c1e", border: "1px dashed rgba(255,255,255,0.07)" }}
              >
                <span className="text-[0.78rem] text-[#6b6d70]">Sin inquilino activo</span>
                <span className="text-[0.65rem] text-[#333537]">· Disponible cuando haya un contrato vigente</span>
              </div>

              {/* Garantes */}
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3 mt-5">
                Garantes
              </div>
              <div
                className="flex items-center gap-3 px-4 py-4 rounded-[12px] text-center justify-center"
                style={{ background: "#191c1e", border: "1px dashed rgba(255,255,255,0.07)" }}
              >
                <span className="text-[0.78rem] text-[#6b6d70]">Sin garantes</span>
                <span className="text-[0.65rem] text-[#333537]">· Se vinculan al contrato</span>
              </div>
            </div>
          )}

          {/* ── TAB: DATOS ── */}
          {activeTab === "datos" && (
            <div className="px-7 py-6">

              {editError && (
                <div
                  className="mb-4 px-4 py-3 rounded-[8px] text-[0.78rem]"
                  style={{ background: "rgba(255,180,171,0.12)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.2)" }}
                >
                  {editError}
                </div>
              )}

              {editing ? (
                /* ── Edit mode ── */
                <div className="flex flex-col gap-6">

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3">
                      Identificación y ubicación
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <EditInput label="Dirección" value={form.address} onChange={set("address")} placeholder="Av. Corrientes 1234" />
                      </div>
                      <EditInput label="Piso / Unidad" value={form.floorUnit} onChange={set("floorUnit")} placeholder="3B" />
                      <EditInput label="Barrio / Zona" value={form.zone} onChange={set("zone")} placeholder="Nueva Córdoba" />
                      <EditSelect
                        label="Tipo"
                        value={form.type}
                        onChange={set("type")}
                        options={[
                          { value: "departamento", label: "Departamento" },
                          { value: "casa", label: "Casa" },
                          { value: "terreno", label: "Terreno" },
                          { value: "local", label: "Local Comercial" },
                          { value: "oficina", label: "Oficina" },
                          { value: "cochera", label: "Cochera" },
                          { value: "otro", label: "Otro" },
                        ]}
                      />
                      <EditSelect
                        label="Estado"
                        value={form.status}
                        onChange={set("status")}
                        options={[
                          { value: "available", label: "Disponible" },
                          { value: "rented", label: "Alquilada" },
                          { value: "reserved", label: "Reservada" },
                          { value: "maintenance", label: "En mantenimiento" },
                          { value: "sold", label: "Vendida" },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3">
                      Características físicas
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <EditInput label="Superficie (m²)" value={form.surface} onChange={set("surface")} type="number" placeholder="52" />
                      <EditInput label="Ambientes" value={form.rooms} onChange={set("rooms")} type="number" placeholder="2" />
                      <EditInput label="Baños" value={form.bathrooms} onChange={set("bathrooms")} type="number" placeholder="1" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex flex-col gap-6">

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3">
                      Identificación y ubicación
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-2">
                        <DatoItem label="Dirección" value={prop.address} />
                      </div>
                      <DatoItem label="Piso / Unidad" value={prop.floorUnit} />
                      <DatoItem label="Barrio / Zona" value={prop.zone} />
                      <DatoItem label="Tipo" value={TYPE_LABEL[prop.type] ?? prop.type} />
                      <DatoItem label="Estado" value={STATUS_CONFIG[prop.status]?.label} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3">
                      Características físicas
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <DatoItem label="Superficie total" value={formatSurface(prop.surface)} />
                      <DatoItem label="Ambientes" value={prop.rooms} />
                      <DatoItem label="Baños" value={prop.bathrooms} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] mb-3">
                      Responsabilidad de servicios
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <DatoItem label="Luz" value={SERVICIO_LABEL[prop.serviceLuz]} />
                      <DatoItem label="Gas" value={SERVICIO_LABEL[prop.serviceGas]} />
                      <DatoItem label="Agua" value={SERVICIO_LABEL[prop.serviceAgua]} />
                      <DatoItem label="Municipalidad" value={SERVICIO_LABEL[prop.serviceMunicipalidad]} />
                      <DatoItem label="Rentas" value={SERVICIO_LABEL[prop.serviceRendas]} />
                      <DatoItem label="Expensas" value={SERVICIO_LABEL[prop.serviceExpensas]} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: CONTRATOS ── */}
          {activeTab === "contratos" && (
            <ContratosTab propertyId={id} />
          )}

          {/* ── TAB: SERVICIOS ── */}
          {activeTab === "servicios" && (
            <PlaceholderTab
              icon="⚡"
              title="Control de servicios"
              description="ABL, gas, luz, agua y expensas. Próximamente."
            />
          )}

          {/* ── TAB: MANTENIMIENTO ── */}
          {activeTab === "mantenimiento" && (
            <PlaceholderTab
              icon="🔧"
              title="Mantenimiento"
              description="Desperfectos y reparaciones. Próximamente."
            />
          )}

          {/* ── TAB: DOCUMENTOS ── */}
          {activeTab === "documentos" && (
            <PlaceholderTab
              icon="🗂️"
              title="Documentos"
              description="Escritura, planos, habilitaciones y documentos importantes. Próximamente."
            />
          )}

          {/* ── TAB: TAREAS ── */}
          {activeTab === "tareas" && (
            <PlaceholderTab
              icon="✅"
              title="Tareas"
              description="Todas las tareas vinculadas a esta propiedad. Próximamente."
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
