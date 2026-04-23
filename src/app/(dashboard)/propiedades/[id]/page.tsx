"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, X, Save, ExternalLink, PlusCircle, Plus, Trash2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { toast } from "sonner";
import { ServiceTabProperty } from "@/components/services/service-tab-property";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ZoneCombobox } from "@/components/ui/zone-combobox";
import { FeatureCombobox } from "@/components/ui/feature-combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PropertyRoom {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface CoOwner {
  id: string;
  propertyId: string;
  clientId: string;
  role: string;
  vinculo: string | null;
  sharePercent: string | null;
  notes: string | null;
  createdAt: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientDni: string | null;
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
}

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
  bedrooms: number | null;
  bathrooms: number | null;
  surface: string | null;
  surfaceBuilt: string | null;
  surfaceLand: string | null;
  yearBuilt: number | null;
  condition: string | null;
  keys: string | null;
  ownerRole: string;
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

const CONDITION_LABEL: Record<string, string> = {
  a_reciclar:    "A reciclar",
  a_refaccionar: "A refaccionar",
  bueno:         "Bueno",
  muy_bueno:     "Muy bueno",
  excelente:     "Excelente",
  a_estrenar:    "A estrenar",
};

const KEYS_LABEL: Record<string, string> = {
  no_se_sabe:            "No se sabe",
  coordinar_dueno:       "Coordinar con dueño",
  coordinar_inquilino:   "Coordinar con inquilino",
  tenemos:               "Tenemos",
};

const OWNER_ROLE_LABEL: Record<string, string> = {
  ambos:  "Propietario Real y Legal",
  real:   "Propietario Real",
  legal:  "Propietario Legal",
};

function getOwnerInitials(firstName: string | null, lastName: string | null) {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function formatName(last: string | null | undefined, first: string | null | undefined, fallback = "Sin nombre") {
  return [last, first].filter(Boolean).join(", ") || fallback;
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

const NONE_SENTINEL = "__none__";

function EditSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Sin especificar",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value || NONE_SENTINEL}
        onValueChange={(v) => onChange(v === NONE_SENTINEL ? "" : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={NONE_SENTINEL}>
              <span className="text-muted-foreground">{placeholder}</span>
            </SelectItem>
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

// ── Owners section ────────────────────────────────────────────────────────────

interface MainOwnerInfo {
  id: string;
  ownerId: string;
  ownerRole: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerCuit: string | null;
  ownerDni: string | null;
}

const VINCULO_OPTIONS = ["hijo", "hija", "cónyuge", "hermano", "hermana", "socio", "otro"];

function OwnerCard({
  name,
  initials,
  subtitle,
  phone,
  email,
  cuit,
  dni,
  role,
  isLocadora,
  onRoleChange,
  onView,
  onRemove,
}: {
  name: string;
  initials: string;
  subtitle?: string;
  phone?: string | null;
  email?: string | null;
  cuit?: string | null;
  dni?: string | null;
  role: string;
  isLocadora?: boolean;
  onRoleChange: (r: string) => void;
  onView: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-4 rounded-[12px] bg-card border border-border hover:border-[var(--border-accent)] transition-colors cursor-pointer"
      onClick={onView}
    >
      <div
        className="size-10 rounded-[8px] flex items-center justify-center text-[0.82rem] font-extrabold flex-shrink-0 font-brand"
        style={{ background: "var(--gradient-owner)", border: "1.5px solid var(--status-reserved-dim)", color: "var(--primary)" }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.82rem] font-semibold text-foreground mb-0.5 flex items-center gap-1.5 flex-wrap">
          {name}
          {isLocadora && (
            <span className="text-[0.58rem] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
              Parte Locadora
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-0.5">{subtitle}</div>
        )}
        <div className="flex items-center gap-3 flex-wrap text-[0.72rem] text-muted-foreground">
          {phone && <span>📱 {phone}</span>}
          {email && <span>{email}</span>}
          {cuit && <span>CUIT {cuit}</span>}
          {dni && !cuit && <span>DNI {dni}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <Select value={role} onValueChange={onRoleChange}>
          <SelectTrigger className="h-8 text-[0.72rem] w-[11rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ambos">Real y Legal</SelectItem>
            <SelectItem value="real">Solo Real</SelectItem>
            <SelectItem value="legal">Solo Legal</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onView}>
          Ver ficha <ExternalLink size={10} />
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}

function OwnersSection({
  main,
  onMainRoleChange,
}: {
  main: MainOwnerInfo;
  onMainRoleChange: (role: string) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [newRole, setNewRole] = useState<string>("ambos");
  const [vinculo, setVinculo] = useState("");
  const [sharePercent, setSharePercent] = useState("");

  const { data, isLoading } = useQuery<{ coOwners: CoOwner[] }>({
    queryKey: ["co-owners", main.id],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${main.id}/co-owners`);
      if (!res.ok) throw new Error("Error al cargar co-propietarios");
      return res.json();
    },
  });

  const { data: clientsData } = useQuery<{ clients: ClientOption[] }>({
    queryKey: ["clients-owner-search", search],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "owner", limit: "30" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: showAdd,
  });

  const coOwners = data?.coOwners ?? [];
  const alreadyAdded = new Set([main.ownerId, ...coOwners.map((c) => c.clientId)]);
  const availableClients = (clientsData?.clients ?? []).filter((c) => !alreadyAdded.has(c.id));

  const resetModal = () => {
    setSelectedClient(null);
    setNewRole("ambos");
    setVinculo("");
    setSharePercent("");
    setSearch("");
    setSaveError(null);
  };

  const handleAdd = async () => {
    if (!selectedClient) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/properties/${main.id}/co-owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          role: newRole,
          vinculo: vinculo || null,
          sharePercent: sharePercent ? Number(sharePercent) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al agregar");
      }
      await queryClient.invalidateQueries({ queryKey: ["co-owners", main.id] });
      setShowAdd(false);
      resetModal();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCoOwnerRoleChange = async (coOwnerId: string, role: string) => {
    try {
      const res = await fetch(`/api/properties/${main.id}/co-owners/${coOwnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al actualizar el rol");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["co-owners", main.id] });
    } catch {
      toast.error("Error al actualizar el rol");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/properties/${main.id}/co-owners/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["co-owners", main.id] });
    } catch {
      // ignore
    } finally {
      setDeleteId(null);
    }
  };

  const renderCoOwnerCard = (co: CoOwner, keySuffix: string, isLocadora?: boolean) => (
    <OwnerCard
      key={co.id + keySuffix}
      name={formatName(co.clientLastName, co.clientFirstName)}
      initials={getOwnerInitials(co.clientFirstName, co.clientLastName)}
      subtitle={co.vinculo ?? undefined}
      isLocadora={isLocadora}
      dni={co.clientDni}
      role={co.role}
      onRoleChange={(r) => handleCoOwnerRoleChange(co.id, r)}
      onView={() => router.push(`/propietarios/${co.clientId}`)}
      onRemove={() => setDeleteId(co.id)}
    />
  );

  const mainName = formatName(main.ownerLastName, main.ownerFirstName, "—");

  const mainInitials = getOwnerInitials(main.ownerFirstName, main.ownerLastName);
  const hasCoOwners = coOwners.length > 0;

  const inReal = (role: string) => role === "ambos" || role === "real";
  const inLegal = (role: string) => role === "ambos" || role === "legal";
  const isLegalRole = inLegal;

  const mainInReal = hasCoOwners && inReal(main.ownerRole);
  const mainInLegal = hasCoOwners && inLegal(main.ownerRole);
  const realCoOwners = hasCoOwners ? coOwners.filter((c) => inReal(c.role)) : [];
  const legalCoOwners = hasCoOwners ? coOwners.filter((c) => inLegal(c.role)) : [];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      {!hasCoOwners ? (
        /* ── Simple mode: one section ── */
        <>
          <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center justify-between">
            <span>Propietario</span>
            <button
              onClick={() => { resetModal(); setShowAdd(true); }}
              className="flex items-center gap-1 text-primary hover:opacity-80 transition-opacity"
            >
              <Plus size={11} />
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em]">Agregar co-propietario</span>
            </button>
          </div>
          <OwnerCard
            name={mainName}
            initials={mainInitials}
            phone={main.ownerPhone}
            email={main.ownerEmail}
            cuit={main.ownerCuit}
            dni={main.ownerDni}
            role={main.ownerRole}
            isLocadora={isLegalRole(main.ownerRole)}
            onRoleChange={onMainRoleChange}
            onView={() => router.push(`/propietarios/${main.ownerId}`)}
          />
        </>
      ) : (
        /* ── Split mode: real and legal sections ── */
        <>
          <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Propietario Real
          </div>
          <div className="flex flex-col gap-2 mb-5">
            {!mainInReal && realCoOwners.length === 0 ? (
              <div className="flex items-center justify-center px-4 py-4 rounded-[12px] bg-card border border-dashed border-border">
                <span className="text-[0.78rem] text-muted-foreground">Sin propietario real asignado</span>
              </div>
            ) : (
              <>
                {mainInReal && (
                  <OwnerCard
                    key="main-real"
                    name={mainName}
                    initials={mainInitials}
                    phone={main.ownerPhone}
                    email={main.ownerEmail}
                    cuit={main.ownerCuit}
                    dni={main.ownerDni}
                    role={main.ownerRole}
                    onRoleChange={onMainRoleChange}
                    onView={() => router.push(`/propietarios/${main.ownerId}`)}
                  />
                )}
                {realCoOwners.map((co) => renderCoOwnerCard(co, "-real"))}
              </>
            )}
          </div>

          <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Propietario Legal
          </div>
          <div className="flex flex-col gap-2 mb-5">
            {!mainInLegal && legalCoOwners.length === 0 ? (
              <div className="flex items-center justify-center px-4 py-4 rounded-[12px] bg-card border border-dashed border-border">
                <span className="text-[0.78rem] text-muted-foreground">Sin propietario legal asignado</span>
              </div>
            ) : (
              <>
                {mainInLegal && (
                  <OwnerCard
                    key="main-legal"
                    name={mainName}
                    initials={mainInitials}
                    phone={main.ownerPhone}
                    email={main.ownerEmail}
                    cuit={main.ownerCuit}
                    dni={main.ownerDni}
                    role={main.ownerRole}
                    isLocadora
                    onRoleChange={onMainRoleChange}
                    onView={() => router.push(`/propietarios/${main.ownerId}`)}
                  />
                )}
                {legalCoOwners.map((co) => renderCoOwnerCard(co, "-legal", true))}
              </>
            )}
          </div>

          <button
            onClick={() => { resetModal(); setShowAdd(true); }}
            className="flex items-center gap-1 text-primary hover:opacity-80 transition-opacity mb-2"
          >
            <Plus size={11} />
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em]">Agregar propietario</span>
          </button>
        </>
      )}

      {/* Add modal */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) { setShowAdd(false); resetModal(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar propietario</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-2 block">
                Persona
              </Label>
              {selectedClient ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-[8px] border border-primary bg-primary/5">
                  <span className="text-[0.82rem] font-semibold">
                    {formatName(selectedClient.lastName, selectedClient.firstName)}
                  </span>
                  <button onClick={() => setSelectedClient(null)} className="text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <Command className="border border-border rounded-[8px]">
                  <CommandInput placeholder="Buscar propietario..." value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty className="text-[0.78rem] text-muted-foreground py-3 text-center">Sin resultados</CommandEmpty>
                    <CommandGroup>
                      {availableClients.map((c) => (
                        <CommandItem key={c.id} onSelect={() => setSelectedClient(c)} className="cursor-pointer">
                          <span>{formatName(c.lastName, c.firstName)}</span>
                          {c.dni && <span className="ml-2 text-muted-foreground text-[0.72rem]">DNI {c.dni}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1.5 block">
                  Rol
                </Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Real y Legal</SelectItem>
                    <SelectItem value="real">Solo Real</SelectItem>
                    <SelectItem value="legal">Solo Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1.5 block">
                  Vínculo
                </Label>
                <Select value={vinculo} onValueChange={setVinculo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {VINCULO_OPTIONS.map((v) => (
                        <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1.5 block">
                Participación %
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Ej: 50"
                value={sharePercent}
                onChange={(e) => setSharePercent(e.target.value)}
              />
            </div>

            {saveError && (
              <div className="text-[0.75rem] text-destructive px-3 py-2 rounded-[6px] bg-destructive/10">{saveError}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetModal(); }}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!selectedClient || saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar propietario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta persona dejará de figurar como propietario de la propiedad. Esta acción no elimina su ficha de cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive text-white hover:bg-destructive/90">
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────

function RoomCard({
  room,
  saving,
  onSave,
  onDelete,
}: {
  room: PropertyRoom;
  saving: boolean;
  onSave: (name: string, description: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);

  const isDirty = name !== room.name || description !== room.description;

  const handleDiscard = () => {
    setName(room.name);
    setDescription(room.description);
  };

  return (
    <div className="rounded-[12px] border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Living, Cocina, Dormitorio 1…"
          className="text-[0.82rem] font-semibold flex-1"
        />
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Eliminar ambiente"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción del ambiente…"
        className="text-[0.8rem] resize-none min-h-[72px] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent]"
      />
      {isDirty && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={handleDiscard}
            className="h-7 gap-1.5 text-[0.72rem] text-muted-foreground"
          >
            <X size={11} />
            Descartar
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => onSave(name, description)}
            className="h-7 gap-1.5 text-[0.72rem]"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Guardar
          </Button>
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

  const { data: roomsData } = useQuery<{ rooms: PropertyRoom[] }>({
    queryKey: ["property-rooms", id],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${id}/rooms`);
      if (!res.ok) throw new Error("Error al cargar ambientes");
      return res.json();
    },
    enabled: !!id && activeTab === "datos",
  });

  const { data: featuresData } = useQuery<{ features: { id: string; name: string }[] }>({
    queryKey: ["property-features", id],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${id}/features`);
      if (!res.ok) throw new Error("Error al cargar características");
      return res.json();
    },
    enabled: !!id && activeTab === "datos",
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
    bedrooms: "",
    bathrooms: "",
    surface: "",
    surfaceBuilt: "",
    surfaceLand: "",
    yearBuilt: "",
    condition: "",
    keys: "",
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
      bedrooms: prop.bedrooms != null ? String(prop.bedrooms) : "",
      bathrooms: prop.bathrooms != null ? String(prop.bathrooms) : "",
      surface: prop.surface != null ? String(parseFloat(prop.surface)) : "",
      surfaceBuilt: prop.surfaceBuilt != null ? String(parseFloat(prop.surfaceBuilt)) : "",
      surfaceLand: prop.surfaceLand != null ? String(parseFloat(prop.surfaceLand)) : "",
      yearBuilt: prop.yearBuilt != null ? String(prop.yearBuilt) : "",
      condition: prop.condition ?? "",
      keys: prop.keys ?? "",
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
          bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
          surface: form.surface ? Number(form.surface) : null,
          surfaceBuilt: form.surfaceBuilt ? Number(form.surfaceBuilt) : null,
          surfaceLand: form.surfaceLand ? Number(form.surfaceLand) : null,
          yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
          condition: form.condition || null,
          keys: form.keys || null,
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

  const handleOwnerRoleChange = async (role: string) => {
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerRole: role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al actualizar el rol");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["property", id] });
    } catch {
      toast.error("Error de conexión");
    }
  };

  // ── Rooms (ambientes) state ──────────────────────────────────────────────────
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);

  const rooms = roomsData?.rooms ?? [];

  const handleAddRoom = async () => {
    setAddingRoom(true);
    try {
      const res = await fetch(`/api/properties/${id}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", description: "" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al agregar ambiente");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["property-rooms", id] });
    } catch {
      toast.error("Error de conexión al agregar ambiente");
    } finally {
      setAddingRoom(false);
    }
  };

  const handleSaveRoom = async (roomId: string, name: string, description: string) => {
    setSavingRoomId(roomId);
    try {
      const res = await fetch(`/api/properties/${id}/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al guardar ambiente");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["property-rooms", id] });
    } catch {
      toast.error("Error de conexión al guardar ambiente");
    } finally {
      setSavingRoomId(null);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/properties/${id}/rooms/${roomId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al eliminar ambiente");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["property-rooms", id] });
    } catch {
      toast.error("Error de conexión al eliminar ambiente");
    } finally {
      setDeletingRoomId(null);
    }
  };

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

  const ownerName = formatName(prop.ownerLastName, prop.ownerFirstName, "—");

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
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">{OWNER_ROLE_LABEL[prop.ownerRole] ?? "Propietario"}</div>
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

              {/* Propietarios */}
              <OwnersSection
                main={{
                  id: prop.id,
                  ownerId: prop.ownerId,
                  ownerRole: prop.ownerRole,
                  ownerFirstName: prop.ownerFirstName,
                  ownerLastName: prop.ownerLastName,
                  ownerPhone: prop.ownerPhone,
                  ownerEmail: prop.ownerEmail,
                  ownerCuit: prop.ownerCuit,
                  ownerDni: prop.ownerDni,
                }}
                onMainRoleChange={handleOwnerRoleChange}
              />

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
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                          Barrio / Zona
                        </Label>
                        <ZoneCombobox
                          value={form.zone}
                          onChange={set("zone")}
                          placeholder="Nueva Córdoba"
                        />
                      </div>
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
                      <EditInput label="Superficie total (m²)" value={form.surface} onChange={set("surface")} type="number" placeholder="52" />
                      <EditInput label="M² construidos" value={form.surfaceBuilt} onChange={set("surfaceBuilt")} type="number" placeholder="45" />
                      <EditInput label="M² terreno" value={form.surfaceLand} onChange={set("surfaceLand")} type="number" placeholder="120" />
                      <EditInput label="Ambientes" value={form.rooms} onChange={set("rooms")} type="number" placeholder="2" />
                      <EditInput label="Dormitorios" value={form.bedrooms} onChange={set("bedrooms")} type="number" placeholder="1" />
                      <EditInput label="Baños" value={form.bathrooms} onChange={set("bathrooms")} type="number" placeholder="1" />
                      <EditInput label="Año de construcción" value={form.yearBuilt} onChange={set("yearBuilt")} type="number" placeholder="1995" />
                      <EditSelect
                        label="Condición"
                        value={form.condition}
                        onChange={set("condition")}
                        placeholder="Sin especificar"
                        options={[
                          { value: "a_reciclar", label: "A reciclar" },
                          { value: "a_refaccionar", label: "A refaccionar" },
                          { value: "bueno", label: "Bueno" },
                          { value: "muy_bueno", label: "Muy bueno" },
                          { value: "excelente", label: "Excelente" },
                          { value: "a_estrenar", label: "A estrenar" },
                        ]}
                      />
                      <EditSelect
                        label="Llaves"
                        value={form.keys}
                        onChange={set("keys")}
                        placeholder="Sin especificar"
                        options={[
                          { value: "no_se_sabe", label: "No se sabe" },
                          { value: "coordinar_dueno", label: "Coordinar con dueño" },
                          { value: "coordinar_inquilino", label: "Coordinar con inquilino" },
                          { value: "tenemos", label: "Tenemos" },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                      Características
                    </div>
                    <FeatureCombobox propertyId={id} />
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
                      <DatoItem label="M² construidos" value={formatSurface(prop.surfaceBuilt)} />
                      <DatoItem label="M² terreno" value={formatSurface(prop.surfaceLand)} />
                      <DatoItem label="Ambientes" value={prop.rooms} />
                      <DatoItem label="Dormitorios" value={prop.bedrooms} />
                      <DatoItem label="Baños" value={prop.bathrooms} />
                      <DatoItem label="Año construcción" value={prop.yearBuilt} />
                      <DatoItem label="Condición" value={prop.condition ? CONDITION_LABEL[prop.condition] : null} />
                      <DatoItem label="Llaves" value={prop.keys ? KEYS_LABEL[prop.keys] : null} />
                    </div>
                  </div>

                  {(featuresData?.features ?? []).length > 0 && (
                    <div>
                      <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                        Características
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(featuresData?.features ?? []).map((f) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"
                          >
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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

              {/* ── Ambientes ── */}
              <Collapsible open={roomsOpen} onOpenChange={setRoomsOpen} className="mt-6">
                <CollapsibleTrigger className="flex w-full items-center gap-2 cursor-pointer select-none hover:opacity-80 transition-opacity">
                  <ChevronDown
                    size={12}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200 shrink-0",
                      roomsOpen && "rotate-180"
                    )}
                  />
                  <div className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Ambientes
                  </div>
                  {rooms.length > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[0.6rem] font-bold bg-card text-muted-foreground border border-border">
                      {rooms.length}
                    </span>
                  )}
                </CollapsibleTrigger>

                <CollapsibleContent className="flex flex-col gap-3 mt-3">
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      saving={savingRoomId === room.id}
                      onSave={(name, description) => handleSaveRoom(room.id, name, description)}
                      onDelete={() => setDeletingRoomId(room.id)}
                    />
                  ))}

                  {rooms.length === 0 && (
                    <div className="flex items-center justify-center rounded-[12px] border border-dashed border-border bg-card px-4 py-6 text-center">
                      <span className="text-[0.78rem] text-muted-foreground">
                        Sin ambientes cargados. Usá el botón para agregar.
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddRoom}
                    disabled={addingRoom}
                    className="flex items-center gap-2 rounded-[10px] border border-dashed border-border bg-card px-4 py-3 text-[0.78rem] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
                  >
                    {addingRoom ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )}
                    Agregar ambiente
                  </button>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Delete room confirmation */}
          <AlertDialog open={!!deletingRoomId} onOpenChange={(o) => { if (!o) setDeletingRoomId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar ambiente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará este ambiente y se actualizará el contador de ambientes de la propiedad.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deletingRoomId && handleDeleteRoom(deletingRoomId)}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
