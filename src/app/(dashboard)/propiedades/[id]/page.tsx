"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, X, Save, ExternalLink, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ServiceTabProperty } from "@/components/services/service-tab-property";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  serviceElectricity: string;
  serviceGas: string;
  serviceWater: string;
  serviceCouncil: string;
  serviceStateTax: string;
  serviceHoa: string;
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
  available:    { label: "Disponible",        bg: "var(--status-available-dim)",   color: "var(--status-available)",   dot: "var(--status-available)" },
  rented:       { label: "Alquilada",         bg: "var(--status-rented-dim)",      color: "var(--status-rented)",      dot: "var(--status-rented)" },
  maintenance:  { label: "En mantenimiento",  bg: "var(--status-maintenance-dim)", color: "var(--status-maintenance)", dot: "var(--status-maintenance)" },
  reserved:     { label: "Reservada",         bg: "var(--status-reserved-dim)",    color: "var(--status-reserved)",    dot: "var(--status-reserved)" },
  sold:         { label: "Vendida",           bg: "var(--destructive-dim)",        color: "var(--destructive)",        dot: "var(--destructive)" },
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

const STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  available:   "available",
  rented:      "rented",
  maintenance: "maintenance",
  reserved:    "reserved",
  sold:        "baja",
};

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
    <div className="rounded-md px-3.5 py-3 bg-card border border-border">
      <div className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1">
        {label}
      </div>
      <div
        className="text-[0.82rem] font-semibold"
        style={{ color: highlight ? "var(--mustard)" : value ? "var(--foreground)" : "var(--muted-foreground)" }}
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
      <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
      <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Placeholder tab ───────────────────────────────────────────────────────────

function PlaceholderTab({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="text-[0.9rem] font-semibold text-muted-foreground">{title}</div>
      <div className="text-[0.75rem] text-muted-foreground max-w-xs">{description}</div>
    </div>
  );
}

// ── Contratos tab ─────────────────────────────────────────────────────────────

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; variant: "rented" | "draft" | "reserved" | "available" | "baja" }> = {
  active:            { label: "Vigente",        variant: "rented" },
  draft:             { label: "Borrador",       variant: "draft" },
  pending_signature: { label: "Pend. de firma", variant: "reserved" },
  expiring_soon:     { label: "Por vencer",     variant: "available" },
  expired:           { label: "Vencido",        variant: "baja" },
  terminated:        { label: "Rescindido",     variant: "baja" },
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-7 py-6 text-[0.78rem] text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="px-7 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Historial de contratos
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/contratos/nuevo?propertyId=${propertyId}`}>
            <PlusCircle size={12} /> Nuevo contrato
          </Link>
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-3 rounded-[12px] bg-card border border-dashed border-border"
        >
          <div className="text-3xl">📄</div>
          <div className="text-[0.82rem] font-semibold text-muted-foreground">Sin contratos</div>
          <div className="text-[0.72rem] text-muted-foreground">Esta propiedad no tiene contratos registrados todavía.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contracts.map((c) => {
            const cfg = CONTRACT_STATUS_CONFIG[c.status] ?? CONTRACT_STATUS_CONFIG.draft;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 px-4 py-3.5 rounded-[12px] cursor-pointer transition-colors bg-card border border-border hover:border-[var(--border-accent)]"
                onClick={() => router.push(`/contratos/${c.id}`)}
              >
                {/* Número */}
                <div className="font-mono text-[0.82rem] font-bold text-foreground w-24 flex-shrink-0">
                  {c.contractNumber}
                </div>

                {/* Inquilino */}
                <div className="flex-1 min-w-0">
                  <div className="text-[0.78rem] font-semibold text-foreground truncate">
                    {c.tenantNames.length > 0 ? c.tenantNames.join(", ") : "Sin inquilino"}
                  </div>
                  <div className="text-[0.62rem] text-muted-foreground mt-0.5">
                    {format(new Date(c.startDate), "dd/MM/yyyy", { locale: es })}
                    {" → "}
                    {format(new Date(c.endDate), "dd/MM/yyyy", { locale: es })}
                    {" · "}${parseFloat(c.monthlyAmount).toLocaleString("es-AR")}/mes
                  </div>
                </div>

                {/* Badge de estado */}
                <Badge variant={cfg.variant} className="flex-shrink-0">
                  {cfg.label}
                </Badge>

                {/* Flecha */}
                <ExternalLink size={13} className="text-muted-foreground flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function PropiedadFichaContent() {
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

  const { data: activeContractData } = useQuery({
    queryKey: ["contracts", "property", id, "active"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts?propertyId=${id}&status=activos&limit=5`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id,
  });

  const activeContract: {
    id: string;
    contractNumber: string;
    status: string;
    startDate: string;
    endDate: string;
    monthlyAmount: string;
    tenantNames: string[];
    tenantIds: string[];
  } | null =
    activeContractData?.contracts?.find(
      (c: { status: string }) => c.status === "active" || c.status === "expiring_soon"
    ) ?? null;

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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !prop) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="text-sm">{(error as Error)?.message ?? "Propiedad no encontrada"}</div>
        <Button variant="link" size="sm" onClick={() => router.push("/propiedades")}>
          <ArrowLeft size={12} /> Volver a la lista
        </Button>
      </div>
    );
  }

  const ownerName = [prop.ownerLastName, prop.ownerFirstName].filter(Boolean).join(", ") || "—";

  // ── Tabs definition ──────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "personas",      label: "Personas vinculadas" },
    { key: "datos",         label: "Datos" },
    { key: "contratos",     label: "Contratos",    disabled: false },
    { key: "servicios",     label: "Servicios" },
    { key: "mantenimiento", label: "Mantenimiento",disabled: true },
    { key: "documentos",    label: "Documentos",   disabled: true },
    { key: "tareas",        label: "Tareas",       disabled: true },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-background">

        {/* ── Breadcrumb topbar ── */}
        <div
          className="h-14 flex items-center px-7 gap-2.5 flex-shrink-0 bg-card border-b border-border"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/propiedades")}
            className="text-muted-foreground hover:text-primary gap-1 px-1"
          >
            <ArrowLeft size={13} />
            Propiedades
          </Button>
          <span className="text-muted-foreground">›</span>
          <span className="text-[0.8rem] font-semibold text-foreground truncate max-w-xs">
            {prop.address}
          </span>
        </div>

        {/* ── Ficha header ── */}
        <div className="flex-shrink-0 bg-card border-b border-border">
          {/* Identity */}
          <div className="px-7 pt-5 pb-0 flex items-start gap-4">
            <div
              className="size-14 rounded-[12px] flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: "var(--gradient-property)",
                border: "2px solid rgba(163,217,165,0.2)",
              }}
            >
              {TYPE_ICON[prop.type] ?? "🏗️"}
            </div>

            <div className="flex-1 min-w-0">
              <h1
                className="text-[1.15rem] font-bold leading-tight text-foreground font-headline tracking-[-0.02em] mb-1"
              >
                {prop.address}
                {prop.floorUnit ? ` — ${prop.floorUnit}` : ""}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.75rem] text-muted-foreground">{buildSubtitle(prop)}</span>
                <StatusBadge variant={STATUS_VARIANT[prop.status] ?? "available"}>
                  {STATUS_CONFIG[prop.status]?.label ?? prop.status}
                </StatusBadge>
              </div>
            </div>

            {/* Topbar actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeTab === "datos" && !editing && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil size={12} /> Editar
                </Button>
              )}
              {activeTab === "datos" && editing && (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X size={12} /> Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Widgets row */}
          <div className="flex mt-4 border-t border-border">
            {/* Widget: Propietario */}
            <button
              onClick={() => router.push(`/propietarios/${prop.ownerId}`)}
              className="flex-1 px-5 py-3 text-left transition-colors group border-r border-border hover:bg-muted"
            >
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Propietario</div>
              <div className="text-[0.88rem] font-bold text-muted-foreground leading-tight">{ownerName}</div>
              <div className="text-[0.62rem] text-primary mt-0.5">Ver ficha →</div>
            </button>

            {/* Widget: Contrato activo */}
            <button
              onClick={() => activeContract && router.push(`/contratos/${activeContract.id}`)}
              className={cn(
                "flex-1 px-5 py-3 text-left border-r border-border transition-colors",
                activeContract ? "cursor-pointer hover:bg-muted" : "cursor-default"
              )}
            >
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Contrato activo</div>
              {activeContract ? (
                <>
                  <div className="text-[0.82rem] font-bold text-foreground">{activeContract.contractNumber}</div>
                  <div className="text-[0.62rem] text-primary mt-0.5">Ver contrato →</div>
                </>
              ) : (
                <>
                  <div className="text-[0.82rem] font-bold text-muted-foreground">Sin contrato</div>
                  <div className="text-[0.62rem] text-muted-foreground mt-0.5">Sin contrato vigente</div>
                </>
              )}
            </button>

            {/* Widget: Superficie */}
            <div className="flex-1 px-5 py-3 border-r border-border">
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Superficie</div>
              <div className="text-[0.88rem] font-bold text-foreground">
                {formatSurface(prop.surface) ?? "—"}
              </div>
              {prop.rooms && (
                <div className="text-[0.62rem] text-muted-foreground mt-0.5">{prop.rooms} ambientes</div>
              )}
            </div>

            {/* Widget: Tareas */}
            <div className="flex-1 px-5 py-3">
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Tareas pendientes</div>
              <div className="text-[0.88rem] font-bold text-muted-foreground">—</div>
              <div className="text-[0.62rem] text-muted-foreground mt-0.5">Módulo pendiente</div>
            </div>
          </div>
        </div>

        {/* ── Tabs bar ── */}
        <div className="flex flex-shrink-0 overflow-x-auto bg-card border-b border-border">
          {TABS.map(({ key, label, disabled }) => (
            <button
              key={key}
              onClick={() => !disabled && setTab(key)}
              disabled={disabled}
              className={cn(
                "px-4 py-3 text-[0.75rem] font-medium border-b-2 transition-all whitespace-nowrap",
                disabled
                  ? "border-transparent text-secondary cursor-not-allowed"
                  : activeTab === key
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-muted-foreground"
              )}
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
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                Propietario
              </div>
              <div
                className="flex items-center gap-4 px-4 py-4 rounded-[12px] mb-2 transition-colors cursor-pointer bg-card border border-border hover:border-[var(--border-accent)]"
                onClick={() => router.push(`/propietarios/${prop.ownerId}`)}
              >
                {/* Avatar */}
                <div
                  className="size-10 rounded-[8px] flex items-center justify-center text-[0.82rem] font-extrabold flex-shrink-0 font-brand"
                  style={{
                    background: "var(--gradient-owner)",
                    border: "1.5px solid var(--status-reserved-dim)",
                    color: "var(--primary)",
                  }}
                >
                  {getOwnerInitials(prop.ownerFirstName, prop.ownerLastName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] font-semibold text-foreground mb-0.5">{ownerName}</div>
                  <div className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1">Propietario</div>
                  <div className="flex items-center gap-3 flex-wrap text-[0.72rem] text-muted-foreground">
                    {prop.ownerPhone && <span>📱 {prop.ownerPhone}</span>}
                    {prop.ownerEmail && <span>{prop.ownerEmail}</span>}
                    {prop.ownerCuit && <span>CUIT {prop.ownerCuit}</span>}
                    {prop.ownerDni && !prop.ownerCuit && <span>DNI {prop.ownerDni}</span>}
                  </div>
                </div>

                {/* Action */}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); router.push(`/propietarios/${prop.ownerId}`); }}
                >
                  Ver ficha <ExternalLink size={10} />
                </Button>
              </div>

              {/* Inquilino */}
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3 mt-5">
                Inquilino
              </div>
              {activeContract && activeContract.tenantNames.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activeContract.tenantNames.map((name, i) => {
                    const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
                    return (
                      <div
                        key={activeContract.tenantIds[i] ?? i}
                        className={cn(
                          "flex items-center gap-4 px-4 py-4 rounded-[12px] transition-colors bg-card border border-border",
                          activeContract.tenantIds[i]
                            ? "cursor-pointer hover:border-[var(--border-accent)]"
                            : "cursor-default"
                        )}
                        onClick={() => activeContract.tenantIds[i] && router.push(`/inquilinos/${activeContract.tenantIds[i]}`)}
                      >
                        <div
                          className="size-10 rounded-[8px] flex items-center justify-center text-[0.82rem] font-extrabold flex-shrink-0 font-brand"
                          style={{
                            background: "var(--gradient-tenant, var(--muted))",
                            border: "1.5px solid var(--border)",
                            color: "var(--foreground)",
                          }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.82rem] font-semibold text-foreground mb-0.5">{name}</div>
                          <div className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1">
                            {i === 0 ? "Inquilino principal" : "Co-titular"}
                          </div>
                          <div className="text-[0.62rem] text-muted-foreground">
                            Contrato {activeContract.contractNumber}
                          </div>
                        </div>
                        {activeContract.tenantIds[i] && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); router.push(`/inquilinos/${activeContract.tenantIds[i]}`); }}
                          >
                            Ver ficha <ExternalLink size={10} />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-4 rounded-[12px] text-center justify-center bg-card border border-dashed border-border">
                  <span className="text-[0.78rem] text-muted-foreground">Sin inquilino activo</span>
                  <span className="text-[0.65rem] text-muted-foreground">· Disponible cuando haya un contrato vigente</span>
                </div>
              )}

              {/* Garantes */}
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3 mt-5">
                Garantes
              </div>
              <div
                className="flex items-center gap-3 px-4 py-4 rounded-[12px] text-center justify-center bg-card border border-dashed border-border"
              >
                <span className="text-[0.78rem] text-muted-foreground">Sin garantes</span>
                <span className="text-[0.65rem] text-muted-foreground">· Se vinculan al contrato</span>
              </div>
            </div>
          )}

          {/* ── TAB: DATOS ── */}
          {activeTab === "datos" && (
            <div className="px-7 py-6">

              {editError && (
                <div
                  className="mb-4 px-4 py-3 rounded-[8px] text-[0.78rem] bg-destructive-dim text-destructive border border-destructive/20"
                >
                  {editError}
                </div>
              )}

              {editing ? (
                /* ── Edit mode ── */
                <div className="flex flex-col gap-6">

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
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
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
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
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
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
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                      Características físicas
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <DatoItem label="Superficie total" value={formatSurface(prop.surface)} />
                      <DatoItem label="Ambientes" value={prop.rooms} />
                      <DatoItem label="Baños" value={prop.bathrooms} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                      Responsabilidad de servicios
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <DatoItem label="Luz" value={SERVICIO_LABEL[prop.serviceElectricity]} />
                      <DatoItem label="Gas" value={SERVICIO_LABEL[prop.serviceGas]} />
                      <DatoItem label="Agua" value={SERVICIO_LABEL[prop.serviceWater]} />
                      <DatoItem label="Municipalidad" value={SERVICIO_LABEL[prop.serviceCouncil]} />
                      <DatoItem label="Rentas" value={SERVICIO_LABEL[prop.serviceStateTax]} />
                      <DatoItem label="Expensas" value={SERVICIO_LABEL[prop.serviceHoa]} />
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
            <ServiceTabProperty
              propertyId={id}
              initialServiceId={searchParams.get("serviceId")}
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
  );
}

export default function PropiedadFichaPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PropiedadFichaContent />
    </Suspense>
  );
}
