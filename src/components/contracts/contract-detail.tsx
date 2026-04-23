"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractTabParties } from "./contract-tab-parties";
import { ContractTabDocuments } from "./contract-tab-documents";
import { ContractTabDocumentData } from "./contract-tab-document-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Zap,
  Flame,
  Droplets,
  Landmark,
  ReceiptText,
  Building,
  Search,
  X,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { format, differenceInCalendarMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  ADJUSTMENT_INDEX_LABELS,
  ADJUSTMENT_FREQUENCY_LABELS,
  SERVICE_RESPONSIBILITY_LABELS,
  SERVICE_RESPONSIBILITY_OPTIONS,
  PROPERTY_SERVICES,
  type ContractStatus,
  type ContractType,
  type AdjustmentIndex,
  type ServiceResponsibility,
} from "@/lib/clients/constants";

/* ──────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────── */

interface PropertyServices {
  serviceElectricity: string;
  serviceGas: string;
  serviceWater: string;
  serviceCouncil: string;
  serviceStateTax: string;
  serviceHoa: string;
}

export interface ContractParticipant {
  id: string;
  role: string;
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    dni: string | null;
    cuit: string | null;
    address: string | null;
    type: string;
  };
}

export interface ContractGuarantee {
  id: string;
  type: string;
  clientId: string | null;
  propertyId: string | null;
  externalAddress: string | null;
  externalCadastralRef: string | null;
  externalOwnerName: string | null;
  externalOwnerDni: string | null;
  createdAt: string | null;
  guarantor: {
    firstName: string | null;
    lastName: string | null;
    dni: string | null;
    cuit: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export interface ContractDocument {
  id: string;
  name: string;
  url: string;
  uploadedBy: string | null;
  uploaderName: string | null;
  createdAt: string | null;
}

interface ContractDetail extends PropertyServices {
  id: string;
  contractNumber: string;
  status: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyAmount: string;
  depositAmount: string | null;
  agencyCommission: string | null;
  paymentDay: number;
  paymentModality: string;
  adjustmentIndex: string;
  adjustmentFrequency: number;
  graceDays: number | null;
  electronicPaymentFeePct: string | null;
  lateInterestPct: string | null;
  isRenewal: boolean | null;
  createdAt: string;
  propertyAddress: string | null;
  propertyType: string | null;
  propertyFloorUnit: string | null;
  propertyZone: string | null;
  propertyId: string;
  ownerId: string;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    dni: string | null;
    cuit: string | null;
    address: string | null;
    type: string;
  } | null;
  tenants: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    phone: string | null;
    dni: string | null;
  }[];
  participants: ContractParticipant[];
  guarantees: ContractGuarantee[];
  documents: ContractDocument[];
}

interface EditableConditions {
  startDate: string;
  endDate: string;
  monthlyAmount: string;
  depositAmount: string;
  agencyCommission: string;
  paymentDay: string;
  paymentModality: "A" | "B";
  adjustmentIndex: string;
  adjustmentFrequency: string;
  graceDays: string;
  electronicPaymentFeePct: string;
  lateInterestPct: string;
  isRenewal: boolean;
  serviceElectricity: string;
  serviceGas: string;
  serviceWater: string;
  serviceCouncil: string;
  serviceStateTax: string;
  serviceHoa: string;
}

/* ──────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────── */

function formatMoney(value: string | null | undefined): string {
  if (!value) return "—";
  return `$${parseFloat(value).toLocaleString("es-AR")}`;
}

function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_PALETTE = [
  "bg-primary-dark",
  "bg-[#3a2a6b]",
  "bg-[#1a4a4a]",
  "bg-[#1a2a4a]",
  "bg-[#3a3a1a]",
];

function avatarColor(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function statusTagClasses(status: string): string {
  switch (status) {
    case "active": return "bg-green-dim text-green";
    case "expiring_soon": return "bg-mustard-dim text-mustard";
    case "expired": return "bg-error-dim text-error";
    case "terminated": return "bg-surface-highest text-muted-foreground border border-border";
    case "draft": return "bg-info-dim text-info";
    case "pending_signature": return "bg-primary-dim text-primary";
    default: return "bg-surface-highest text-muted-foreground";
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "active": return "bg-green";
    case "expiring_soon": return "bg-mustard";
    case "expired": return "bg-error";
    case "terminated": return "bg-text-muted";
    case "draft": return "bg-info";
    case "pending_signature": return "bg-primary shadow-[0_0_5px_rgba(255,180,162,0.5)]";
    default: return "bg-text-muted";
  }
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  serviceElectricity: Zap,
  serviceGas: Flame,
  serviceWater: Droplets,
  serviceCouncil: Landmark,
  serviceStateTax: ReceiptText,
  serviceHoa: Building,
};

/* ──────────────────────────────────────────────────────────
   STEPPER CONFIG
   ────────────────────────────────────────────────────────── */

const STEPS = [
  { num: "01", name: "Legajo aprobado", statusText: { done: "Completado", active: "En revisión", pending: "Pendiente" } },
  { num: "02", name: "Borrador generado", statusText: { done: "Completado", active: "Generando", pending: "Pendiente" } },
  { num: "03", name: "Firma electrónica", statusText: { done: "Completado", active: "En curso", pending: "Pendiente" } },
  { num: "04", name: "Acta de entrega", statusText: { done: "Completado", active: "En curso", pending: "Pendiente" } },
  { num: "05", name: "Inquilino activo", statusText: { done: "Completado", active: "Activando", pending: "Pendiente" } },
];

function getStepStates(status: string): Array<"done" | "active" | "pending"> {
  if (status === "draft") {
    return ["done", "active", "pending", "pending", "pending"];
  }
  if (status === "pending_signature") {
    return ["done", "done", "active", "pending", "pending"];
  }
  return ["done", "done", "done", "done", "done"];
}

/* ──────────────────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────────────────── */

type ContractTab = "partes" | "operativo" | "documentos" | "datos";

export function ContractDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get("tab") as ContractTab) ?? "partes";
  const setTab = (tab: ContractTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/contratos/${id}?${params.toString()}`, { scroll: false });
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<EditableConditions | null>(null);
  const [isEditingPartes, setIsEditingPartes] = useState(false);
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editTenantIds, setEditTenantIds] = useState<string[]>([]);
  const [tenantSearchOpen, setTenantSearchOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");

  const { data, isLoading, error } = useQuery<ContractDetail>({
    queryKey: ["contract", id],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al obtener el contrato");
      }
      return res.json();
    },
  });

  const { data: customIndexesData } = useQuery({
    queryKey: ["adjustment-indexes"],
    queryFn: async () => {
      const res = await fetch("/api/adjustment-indexes");
      if (!res.ok) return { indexes: [] };
      return res.json();
    },
  });
  const customIndexes: { code: string; label: string }[] = customIndexesData?.indexes ?? [];

  const { data: servicesData } = useQuery({
    queryKey: ["services", data?.propertyId],
    queryFn: async () => {
      if (!data?.propertyId) return null;
      const hoy = new Date();
      const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/services?propertyId=${data.propertyId}&periodo=${periodo}&limit=20`);
      if (!res.ok) return null;
      return res.json() as Promise<{
        items: {
          id: string;
          tipo: string;
          empresa: string | null;
          estado: string;
          diasSinComprobante: number;
          responsablePago: string;
          triggersBlock: boolean;
        }[];
      }>;
    },
    enabled: !!data?.propertyId,
  });

  const { data: tenantsData } = useQuery({
    queryKey: ["clients", "tenant", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=inquilino,tenant&limit=200");
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: isEditingPartes,
  });
  const { data: ownersData } = useQuery({
    queryKey: ["clients", "owner", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=propietario,owner&limit=200");
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: isEditingPartes,
  });

  const availableTenants: { id: string; label: string }[] =
    tenantsData?.clients?.map((c: { id: string; firstName: string; lastName: string | null }) => ({
      id: c.id,
      label: `${c.firstName} ${c.lastName || ""}`.trim(),
    })) ?? [];

  const availableOwners: { value: string; label: string }[] =
    ownersData?.clients?.map((c: { id: string; firstName: string; lastName: string | null }) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName || ""}`.trim(),
    })) ?? [];

  const selectedTenantObjects = availableTenants.filter((t) => editTenantIds.includes(t.id));

  const toggleEditTenant = (tenantId: string) => {
    setEditTenantIds((prev) =>
      prev.includes(tenantId) ? prev.filter((t) => t !== tenantId) : [...prev, tenantId]
    );
  };

  /* mutations */
  const patchPartiesMutation = useMutation({
    mutationFn: async ({ ownerId, tenantIds }: { ownerId: string; tenantIds: string[] }) => {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, tenantIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Partes actualizadas");
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsEditingPartes(false);
      setTenantSearch("");
      setTenantSearchOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchMutation = useMutation({
    mutationFn: async (values: EditableConditions) => {
      const body: Record<string, unknown> = {
        startDate: values.startDate,
        endDate: values.endDate,
        monthlyAmount: parseFloat(values.monthlyAmount),
        paymentDay: parseInt(values.paymentDay),
        paymentModality: values.paymentModality,
        adjustmentIndex: values.adjustmentIndex,
        adjustmentFrequency: parseInt(values.adjustmentFrequency),
        graceDays: parseInt(values.graceDays) || 0,
        electronicPaymentFeePct: values.electronicPaymentFeePct || null,
        lateInterestPct: values.lateInterestPct || null,
        isRenewal: values.isRenewal,
      };
      if (values.depositAmount) body.depositAmount = parseFloat(values.depositAmount);
      else body.depositAmount = null;
      if (values.agencyCommission) body.agencyCommission = parseFloat(values.agencyCommission);
      else body.agencyCommission = null;

      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar");
      }

      // También actualizar responsabilidad de servicios en la propiedad
      if (data?.propertyId) {
        await fetch(`/api/properties/${data.propertyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceElectricity: values.serviceElectricity,
            serviceGas: values.serviceGas,
            serviceWater: values.serviceWater,
            serviceCouncil: values.serviceCouncil,
            serviceStateTax: values.serviceStateTax,
            serviceHoa: values.serviceHoa,
          }),
        });

        // También propagar a los registros de la tabla servicio (responsablePago)
        const TIPO_COND_KEY: Record<string, keyof EditableConditions> = {
          luz: "serviceElectricity",
          gas: "serviceGas",
          agua: "serviceWater",
          abl: "serviceCouncil",
          inmobiliario: "serviceStateTax",
          expensas: "serviceHoa",
        };
        await Promise.all(
          (servicesData?.items ?? []).map((srv) => {
            const condKey = TIPO_COND_KEY[srv.tipo];
            if (!condKey) return Promise.resolve();
            const newVal = values[condKey];
            if (!newVal || newVal === "na" || newVal === srv.responsablePago) return Promise.resolve();
            return fetch(`/api/services/${srv.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ responsablePago: newVal }),
            });
          })
        );
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Condiciones actualizadas");
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsEditing(false);
      setEditValues(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al activar el contrato");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contrato activado");
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEditing = () => {
    if (!data) return;
    setEditValues({
      startDate: data.startDate,
      endDate: data.endDate,
      monthlyAmount: data.monthlyAmount,
      depositAmount: data.depositAmount ?? "",
      agencyCommission: data.agencyCommission ?? "",
      paymentDay: String(data.paymentDay),
      paymentModality: data.paymentModality as "A" | "B",
      adjustmentIndex: data.adjustmentIndex,
      adjustmentFrequency: String(data.adjustmentFrequency),
      graceDays: data.graceDays != null ? String(data.graceDays) : "0",
      electronicPaymentFeePct: data.electronicPaymentFeePct ?? "",
      lateInterestPct: data.lateInterestPct ?? "",
      isRenewal: data.isRenewal ?? false,
      serviceElectricity: data.serviceElectricity || "inquilino",
      serviceGas: data.serviceGas || "inquilino",
      serviceWater: data.serviceWater || "inquilino",
      serviceCouncil: data.serviceCouncil || "inquilino",
      serviceStateTax: data.serviceStateTax || "inquilino",
      serviceHoa: data.serviceHoa || "na",
    });
    setIsEditing(true);
  };

  const startEditingPartes = () => {
    if (!data) return;
    setEditOwnerId(data.owner?.id ?? "");
    setEditTenantIds(data.tenants.map((t) => t.id));
    setIsEditingPartes(true);
  };

  /* ── loading / error ── */
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="rounded-xl bg-error-dim border border-error/20 p-6 text-center">
          <p className="text-error mb-4 text-sm">
            {(error as Error)?.message || "Contrato no encontrado"}
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/contratos")}>
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  /* ── derived data ── */
  // Parse "YYYY-MM-DD" strings as local time (appending T00:00:00 prevents UTC→local shift)
  const parseDate = (s: string) => new Date(s.length === 10 ? s + "T00:00:00" : s);
  const durationMonths = differenceInCalendarMonths(parseDate(data.endDate), parseDate(data.startDate)) + 1;
  const statusLabel = CONTRACT_STATUS_LABELS[data.status as ContractStatus] || data.status;
  const contractTypeLabel = CONTRACT_TYPE_LABELS[data.contractType as ContractType] || data.contractType;

  const getIndexLabel = (code: string) => {
    if (ADJUSTMENT_INDEX_LABELS[code as AdjustmentIndex]) return ADJUSTMENT_INDEX_LABELS[code as AdjustmentIndex];
    const custom = customIndexes.find((c) => c.code === code);
    return custom ? custom.label : code;
  };

  const adjustmentLabel = getIndexLabel(data.adjustmentIndex);
  const frequencyLabel = ADJUSTMENT_FREQUENCY_LABELS[data.adjustmentFrequency] || `Cada ${data.adjustmentFrequency} meses`;

  const allIndexOptions = [
    ...Object.entries(ADJUSTMENT_INDEX_LABELS).map(([value, label]) => ({ value, label })),
    ...customIndexes.map((c) => ({ value: c.code, label: c.label })),
  ];

  const showStepper = data.status === "draft" || data.status === "pending_signature";
  const stepStates = getStepStates(data.status);

  const SERVICE_TYPE_SHORT: Record<string, string> = {
    luz: "Luz",
    gas: "Gas",
    agua: "Agua",
    expensas: "Expensas",
    abl: "ABL",
    inmobiliario: "Inmobiliario",
    seguro: "Seguro",
    otro: "Otro",
  };

  const SERVICE_TYPE_ICON: Record<string, string> = {
    luz: "⚡",
    gas: "🔥",
    agua: "💧",
    expensas: "🏢",
    abl: "🏛",
    inmobiliario: "📋",
    seguro: "🛡",
    otro: "📄",
  };

  const servicesItems = servicesData?.items ?? [];

  // Mapeo entre clave de propiedad y tipo de servicio en la tabla servicio
  const SERVICE_KEY_TO_TIPO: Record<string, string> = {
    serviceElectricity: "electricity",
    serviceGas: "gas",
    serviceWater: "water",
    serviceCouncil: "abl",
    serviceStateTax: "property_tax",
    serviceHoa: "hoa",
  };

  const getServiceValue = (key: string): string => {
    const map: Record<string, string> = {
      serviceElectricity: data.serviceElectricity,
      serviceGas: data.serviceGas,
      serviceWater: data.serviceWater,
      serviceCouncil: data.serviceCouncil,
      serviceStateTax: data.serviceStateTax,
      serviceHoa: data.serviceHoa,
    };
    return map[key] || "na";
  };

  // Lista unificada: servicios aplicables (no "na") con o sin registro en la tabla servicio
  const combinedServices = PROPERTY_SERVICES
    .filter(({ key }) => getServiceValue(key) !== "na")
    .map(({ key, label }) => {
      const tipo = SERVICE_KEY_TO_TIPO[key];
      const existingServicio = servicesItems.find((s) => s.tipo === tipo);
      const responsableKey = getServiceValue(key) as ServiceResponsibility;
      const responsableLabel = SERVICE_RESPONSIBILITY_LABELS[responsableKey] || responsableKey;
      return { key, label, tipo, existingServicio, responsableLabel };
    });

  const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
    current: { bg: "bg-income-dim",      text: "text-income",      dot: "bg-income" },
    pending: { bg: "bg-surface-highest", text: "text-muted-foreground",  dot: "bg-text-muted" },
    alert:   { bg: "bg-mustard-dim",     text: "text-mustard",     dot: "bg-mustard" },
    blocked: { bg: "bg-error-dim",       text: "text-error",       dot: "bg-error" },
  };

  const STATUS_LABEL: Record<string, string> = {
    current: "Al día", pending: "Pendiente", alert: "En alerta", blocked: "Bloqueado",
  };

  /* ── RENDER ── */
  return (
    <div className="flex flex-1 flex-col">

      {/* ── Page header + topbar actions ─────────────────── */}
      <div className="flex items-start justify-between px-7 pt-6 pb-5">
        <div>
          <div className="flex items-center gap-[10px] mb-1.5">
            <h1 className="font-headline text-[1.35rem] font-bold text-on-bg tracking-tight leading-none">
              Contrato {data.contractNumber}
            </h1>
            <span
              className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[0.67rem] font-bold tracking-[0.02em] whitespace-nowrap ${statusTagClasses(data.status)}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(data.status)}`} />
              {statusLabel}
            </span>
          </div>
          <p className="text-[0.78rem] text-muted-foreground">
            {data.propertyAddress || "Sin dirección"}
            {data.tenants.length > 0 && (
              <> · {data.tenants.length === 1 ? "Inquilino" : "Inquilinos"}: {data.tenants.map((t) => t.name).join(", ")}</>
            )}
            {data.owner && ` · Propietario: ${data.owner.name}`}
            {" · "}
            {format(parseDate(data.startDate), "dd/MM/yyyy", { locale: es })} → {format(parseDate(data.endDate), "dd/MM/yyyy", { locale: es })}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold border border-border rounded-xl text-text-secondary bg-transparent hover:bg-surface-high transition-colors">
            ↓ Borrador PDF
          </button>
          <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold border border-border rounded-xl text-text-secondary bg-transparent hover:bg-surface-high transition-colors">
            Ver legajo
          </button>
          {data.status === "draft" && (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="px-[14px] py-[7px] text-[0.72rem] font-semibold rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-60 flex items-center gap-1.5"
            >
              {activateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Aprobar y enviar a firma →
            </button>
          )}
          {data.status === "pending_signature" && (
            <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all">
              Aprobar y enviar a firma →
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-7 pb-7">

        {/* ── Stepper (solo draft / pending_signature) ─────── */}
        {showStepper && (
          <div className="flex bg-surface border border-border rounded-[18px] overflow-hidden">
            {STEPS.map((step, i) => {
              const state = stepStates[i];
              const isLast = i === STEPS.length - 1;
              return (
                <div
                  key={step.num}
                  className={`flex-1 px-[18px] py-[14px] flex flex-col gap-[3px] relative ${!isLast ? "border-r border-border" : ""} ${
                    state === "done"
                      ? "bg-green/5"
                      : state === "active"
                      ? "bg-primary/8"
                      : "bg-transparent"
                  }`}
                >
                  {/* Arrow connector */}
                  {!isLast && (
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-10 w-0 h-0"
                      style={{
                        borderTop: "8px solid transparent",
                        borderBottom: "8px solid transparent",
                        borderLeft: `8px solid ${state === "done" ? "rgba(141,207,149,0.05)" : state === "active" ? "var(--primary-dim)" : "transparent"}`,
                      }}
                    />
                  )}
                  <p className={`text-[0.58rem] font-bold uppercase tracking-[0.12em] ${
                    state === "done" ? "text-green" : state === "active" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {step.num}
                  </p>
                  <p className={`text-[0.78rem] font-semibold ${
                    state === "done" ? "text-green" : state === "active" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {state === "done" ? `✓ ${step.name}` : step.name}
                  </p>
                  <p className={`text-[0.68rem] ${state === "active" ? "text-text-secondary" : "text-muted-foreground"}`}>
                    {state === "done" ? step.statusText.done : state === "active" ? step.statusText.active : step.statusText.pending}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Alert banner (pending_signature) ─────────────── */}
        {data.status === "pending_signature" && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[0.8rem] text-primary"
            style={{ background: "var(--primary-dim)", border: "1px solid var(--border-accent)" }}
          >
            <span className="text-[1rem] flex-shrink-0">✍</span>
            <div>
              Solicitud de firma enviada.{" "}
              <strong>Esperando firma de las partes.</strong>{" "}
              El contrato entrará en vigor automáticamente al completarse todas las firmas.
            </div>
          </div>
        )}

        {/* ── Alert banner (draft) ─────────────────────────── */}
        {data.status === "draft" && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[0.8rem] text-info"
            style={{ background: "var(--info-dim)", border: "1px solid rgba(147,197,253,0.2)" }}
          >
            <span className="text-[1rem] flex-shrink-0">✏</span>
            <div>
              Contrato en redacción.{" "}
              <strong>Completá los datos y generá el borrador PDF antes de enviarlo a firma.</strong>
            </div>
          </div>
        )}

        {/* ── KPI cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-[18px] border border-border bg-surface px-[18px] py-4">
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Alquiler base</p>
            <p className="font-headline text-[1.4rem] font-bold text-primary leading-none">
              {formatMoney(data.monthlyAmount)}
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-1.5">
              Ajuste {data.adjustmentIndex} · {frequencyLabel.toLowerCase()}
            </p>
          </div>

          <div className="rounded-[18px] border border-border bg-surface px-[18px] py-4">
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Depósito</p>
            <p className="font-headline text-[1.4rem] font-bold text-on-bg leading-none">
              {formatMoney(data.depositAmount)}
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-1.5">1 mes · garantía</p>
          </div>

          <div className="rounded-[18px] border border-border bg-surface px-[18px] py-4">
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Duración</p>
            <p className="font-headline text-[1.4rem] font-bold text-on-bg leading-none">
              {durationMonths} meses
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-1.5">
              {format(parseDate(data.startDate), "dd/MM/yyyy")} → {format(parseDate(data.endDate), "dd/MM/yyyy")}
            </p>
          </div>

          <div className="rounded-[18px] border border-border bg-surface px-[18px] py-4">
            <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">Día de pago</p>
            <p className="font-headline text-[1.4rem] font-bold text-on-bg leading-none">
              Día {data.paymentDay}
            </p>
            <p className="text-[0.68rem] text-muted-foreground mt-1.5">
              Modalidad {data.paymentModality === "A" ? "A — inmobiliaria" : "B — directo"}
            </p>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={(v) => setTab(v as ContractTab)}>
          <TabsList
            variant="line"
            className="w-full justify-start h-auto rounded-none bg-transparent p-0 gap-0 border-b border-border -mb-5"
          >
            {(["partes", "operativo", "documentos", "datos"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="px-4 py-3 text-[0.8rem] gap-2 rounded-none flex-none after:bg-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab === "partes" ? "Partes" : tab === "operativo" ? "Operativo" : tab === "documentos" ? "Documentos" : "Datos para documentos"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ── Tab: Partes ─────────────────────────────────── */}
        {activeTab === "partes" && (
          <ContractTabParties
            contractId={id}
            owner={data.owner}
            participants={data.participants}
            guarantees={data.guarantees}
          />
        )}

        {/* ── Tab: Documentos ─────────────────────────────── */}
        {activeTab === "documentos" && (
          <ContractTabDocuments contractId={id} documents={data.documents} />
        )}

        {/* ── Tab: Datos para documentos ─────────────────── */}
        {activeTab === "datos" && (
          <ContractTabDocumentData data={data} contractId={id} />
        )}

        {/* ── Tab: Operativo ─────────────────────────────── */}
        {activeTab === "operativo" && (<>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Condiciones */}
          <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Condiciones del contrato
              </p>
              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1 px-2 py-1 text-[0.67rem] font-semibold text-text-secondary border border-border rounded-md hover:bg-surface-high transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
              )}
            </div>

            {isEditing && editValues ? (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Inicio</Label>
                    <Input type="date" value={editValues.startDate}
                      onChange={(e) => setEditValues((v) => v && { ...v, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fin</Label>
                    <Input type="date" value={editValues.endDate}
                      onChange={(e) => setEditValues((v) => v && { ...v, endDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Monto mensual ($)</Label>
                    <Input type="number" min="0" step="0.01" value={editValues.monthlyAmount}
                      onChange={(e) => setEditValues((v) => v && { ...v, monthlyAmount: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Depósito ($)</Label>
                    <Input type="number" min="0" step="0.01" value={editValues.depositAmount}
                      onChange={(e) => setEditValues((v) => v && { ...v, depositAmount: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Comisión (%)</Label>
                    <Input type="number" min="0" max="100" step="0.5" value={editValues.agencyCommission}
                      onChange={(e) => setEditValues((v) => v && { ...v, agencyCommission: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Día de pago</Label>
                    <Input type="number" min="1" max="28" value={editValues.paymentDay}
                      onChange={(e) => setEditValues((v) => v && { ...v, paymentDay: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Días de gracia</Label>
                    <Input type="number" min="0" max="31" value={editValues.graceDays}
                      onChange={(e) => setEditValues((v) => v && { ...v, graceDays: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Comisión pago electrónico (%)</Label>
                    <Input type="number" min="0" step="0.01" value={editValues.electronicPaymentFeePct}
                      onChange={(e) => setEditValues((v) => v && { ...v, electronicPaymentFeePct: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Interés por mora (%)</Label>
                    <Input type="number" min="0" step="0.01" value={editValues.lateInterestPct}
                      onChange={(e) => setEditValues((v) => v && { ...v, lateInterestPct: e.target.value })} />
                  </div>
                  <div className="space-y-1 flex items-center gap-2 pt-5">
                    <input type="checkbox" id="isRenewal" checked={editValues.isRenewal}
                      onChange={(e) => setEditValues((v) => v && { ...v, isRenewal: e.target.checked })}
                      className="size-4 rounded border-border" />
                    <Label htmlFor="isRenewal" className="text-xs cursor-pointer">¿Es renovación?</Label>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Modalidad de pago</Label>
                    <Select value={editValues.paymentModality}
                      onValueChange={(v) => setEditValues((p) => p ? { ...p, paymentModality: v as "A" | "B" } : p)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Modalidad A (inmobiliaria recibe y liquida)</SelectItem>
                        <SelectItem value="B">Modalidad B (pago directo al propietario)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Índice de ajuste</Label>
                    <Select value={editValues.adjustmentIndex}
                      onValueChange={(v) => setEditValues((p) => p ? { ...p, adjustmentIndex: v } : p)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allIndexOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Frecuencia de ajuste</Label>
                    <Select value={editValues.adjustmentFrequency}
                      onValueChange={(v) => setEditValues((p) => p ? { ...p, adjustmentFrequency: v } : p)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ADJUSTMENT_FREQUENCY_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Responsabilidad de servicios e impuestos */}
                <div className="col-span-2 border-t border-border pt-3">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-2.5">
                    Servicios e impuestos — ¿quién paga?
                  </p>
                  <div className="space-y-2">
                    {PROPERTY_SERVICES.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[0.75rem] text-text-secondary w-[110px] shrink-0">{label}</span>
                        <Select
                          value={editValues[key as keyof EditableConditions] as string}
                          onValueChange={(v) => setEditValues((p) => p ? { ...p, [key]: v } : p)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_RESPONSIBILITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {SERVICE_RESPONSIBILITY_LABELS[opt]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end col-span-2">
                  <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditValues(null); }} disabled={patchMutation.isPending}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={() => editValues && patchMutation.mutate(editValues)} disabled={patchMutation.isPending}>
                    {patchMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Guardar cambios
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border text-sm">
                {[
                  { label: "Propiedad", value: data.propertyAddress || "—" },
                  { label: "Tipo", value: contractTypeLabel },
                  { label: "Período", value: `${format(parseDate(data.startDate), "dd/MM/yyyy", { locale: es })} → ${format(parseDate(data.endDate), "dd/MM/yyyy", { locale: es })}` },
                  { label: "Canon", value: formatMoney(data.monthlyAmount) },
                  { label: "Índice", value: adjustmentLabel },
                  { label: "Frecuencia", value: frequencyLabel },
                  { label: "Vto. pago", value: `Día ${data.paymentDay}` },
                  ...(data.agencyCommission ? [{ label: "Comisión", value: `${data.agencyCommission}%` }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-2 gap-2 px-[18px] py-[11px]">
                    <span className="text-muted-foreground text-[0.75rem]">{label}</span>
                    <span className="font-medium text-[0.78rem] text-on-surface">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Partes firmantes */}
          <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Partes firmantes
              </p>
              <div className="flex items-center gap-2">
                {data.status === "pending_signature" && (
                  <span className="px-[9px] py-[3px] rounded-full text-[0.65rem] font-bold bg-primary-dim text-primary">
                    1 / {data.tenants.length + (data.owner ? 2 : 1)} firmado
                  </span>
                )}
                {!isEditingPartes && (
                  <button
                    onClick={startEditingPartes}
                    className="flex items-center gap-1 px-2 py-1 text-[0.67rem] font-semibold text-text-secondary border border-border rounded-md hover:bg-surface-high transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>
            </div>

            {isEditingPartes ? (
              <div className="p-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Propietario</Label>
                  <SearchableSelect
                    options={availableOwners}
                    value={editOwnerId}
                    onValueChange={setEditOwnerId}
                    placeholder="Seleccionar propietario..."
                    searchPlaceholder="Buscar por nombre..."
                    emptyText="No hay propietarios cargados"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inquilinos</Label>
                  {selectedTenantObjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {selectedTenantObjects.map((t, i) => (
                        <Badge key={t.id} variant="secondary" className="gap-1 pr-1 text-xs">
                          <span>{t.label}{i === 0 && <span className="text-muted-foreground ml-1 text-xs">(principal)</span>}</span>
                          <button type="button" onClick={() => toggleEditTenant(t.id)} className="ml-1 rounded-sm hover:bg-destructive/20 p-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setTenantSearchOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 border rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
                  >
                    <span>{tenantSearchOpen ? "Cerrar lista" : selectedTenantObjects.length === 0 ? "Seleccionar inquilinos..." : `${selectedTenantObjects.length} seleccionado${selectedTenantObjects.length > 1 ? "s" : ""} — agregar más`}</span>
                    <span>{tenantSearchOpen ? "▲" : "▼"}</span>
                  </button>
                  {tenantSearchOpen && (
                    <div className="border rounded-md overflow-hidden">
                      <div className="p-2 border-b flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <input
                          autoFocus type="text" value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          placeholder="Buscar inquilino..."
                          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                        />
                        {tenantSearch && (
                          <button type="button" onClick={() => setTenantSearch("")} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="divide-y max-h-48 overflow-y-auto">
                        {availableTenants.length === 0 ? (
                          <p className="p-3 text-xs text-muted-foreground text-center">No hay inquilinos cargados</p>
                        ) : availableTenants.filter((t) => t.label.toLowerCase().includes(tenantSearch.toLowerCase())).length === 0 ? (
                          <p className="p-3 text-xs text-muted-foreground text-center">Sin resultados</p>
                        ) : (
                          availableTenants
                            .filter((t) => t.label.toLowerCase().includes(tenantSearch.toLowerCase()))
                            .map((t) => (
                              <label key={t.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                                <Checkbox checked={editTenantIds.includes(t.id)} onCheckedChange={() => toggleEditTenant(t.id)} />
                                <span className="text-sm">{t.label}</span>
                              </label>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">El primero seleccionado será el inquilino principal.</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setIsEditingPartes(false); setTenantSearch(""); setTenantSearchOpen(false); }} disabled={patchPartiesMutation.isPending}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm"
                    onClick={() => patchPartiesMutation.mutate({ ownerId: editOwnerId, tenantIds: editTenantIds })}
                    disabled={patchPartiesMutation.isPending || !editOwnerId || editTenantIds.length === 0}>
                    {patchPartiesMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Guardar cambios
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {data.tenants.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-[18px] py-[11px] border-b border-border">
                    <div className={`w-[34px] h-[34px] rounded-md flex items-center justify-center text-[0.65rem] font-bold text-white flex-shrink-0 ${avatarColor(t.name)}`}>
                      {getInitials(t.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8rem] font-semibold text-on-surface">{t.name}</p>
                      <p className="text-[0.67rem] text-muted-foreground mt-0.5">
                        {i === 0 ? "Inquilino principal" : "Co-titular"}
                        {t.email && ` · ${t.email}`}
                      </p>
                    </div>
                    <span className={`px-[9px] py-[3px] rounded-full text-[0.65rem] font-bold flex-shrink-0 ${
                      data.status === "pending_signature" && i === 0
                        ? "bg-green-dim text-green border border-green/20"
                        : "bg-surface-highest text-muted-foreground border border-border"
                    }`}>
                      {data.status === "pending_signature" && i === 0 ? "✓ Firmó" : "En espera"}
                    </span>
                  </div>
                ))}

                {data.owner && (
                  <div className="flex items-center gap-3 px-[18px] py-[11px] border-b border-border">
                    <div className={`w-[34px] h-[34px] rounded-md flex items-center justify-center text-[0.65rem] font-bold text-white flex-shrink-0 ${avatarColor(data.owner.name)}`}>
                      {getInitials(data.owner.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8rem] font-semibold text-on-surface">{data.owner.name}</p>
                      <p className="text-[0.67rem] text-muted-foreground mt-0.5">
                        Propietario{data.owner.email && ` · ${data.owner.email}`}
                      </p>
                    </div>
                    <span className="px-[9px] py-[3px] rounded-full text-[0.65rem] font-bold flex-shrink-0 bg-surface-highest text-muted-foreground border border-border">
                      En espera
                    </span>
                  </div>
                )}

                {/* Arce Administración firma institucional */}
                <div className="flex items-center gap-3 px-[18px] py-[11px]">
                  <div className="w-[34px] h-[34px] rounded-md flex items-center justify-center text-[0.65rem] font-bold text-primary flex-shrink-0 bg-primary-dark border border-border-accent">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8rem] font-semibold text-on-surface">Arce Administración</p>
                    <p className="text-[0.67rem] text-muted-foreground mt-0.5">Firma institucional</p>
                  </div>
                  <span className="px-[9px] py-[3px] rounded-full text-[0.65rem] font-bold flex-shrink-0 bg-surface-highest text-muted-foreground border border-border">
                    En espera
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Cláusulas ─────────────────────────────────────── */}
        <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Cláusulas del contrato
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[0.7rem] text-muted-foreground">estándar</span>
              <button className="px-2 py-1 text-[0.67rem] font-semibold border border-border rounded-md text-text-secondary bg-transparent hover:bg-surface-high transition-colors">
                + Agregar cláusula
              </button>
            </div>
          </div>
          <div className="p-[14px] space-y-1.5">
            {[
              "Objeto del contrato y partes",
              "Plazo de locación y condiciones de renovación",
              "Mascotas y convivencia",
              "Canon locativo y forma de pago",
              `Ajuste por índice ${data.adjustmentIndex} — periodicidad ${frequencyLabel.toLowerCase()}`,
              "Depósito · Servicios · Garantías · Rescisión · Inspecciones · Mora",
            ].map((clausula, i) => (
              <div key={i} className="flex items-center gap-[10px] px-[14px] py-[10px] border border-border rounded-md hover:border-white/12 transition-colors cursor-pointer">
                <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground flex-shrink-0">
                  Cláusula {i + 1 < 6 ? i + 1 : "6–12"}
                </span>
                <span className="text-[0.78rem] text-on-surface flex-1">{clausula}</span>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="px-2 py-0.5 text-[0.67rem] border border-border rounded text-text-secondary hover:bg-surface-high transition-colors flex-shrink-0"
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Acta de entrega + Actividad ───────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Acta de entrega */}
          <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">Acta de entrega de llaves</p>
              <span className="px-[9px] py-[3px] rounded-full text-[0.65rem] font-bold bg-surface-highest text-muted-foreground border border-border">
                {showStepper ? "Se genera al firmar" : "Completada"}
              </span>
            </div>
            <div className="p-[18px] space-y-2">
              {showStepper && (
                <p className="text-[0.72rem] text-muted-foreground mb-3">
                  Se completará luego de que todas las partes firmen. Ítems a relevar:
                </p>
              )}
              {[
                { label: "Fecha y hora de entrega efectiva", value: "—" },
                { label: "Estado general del inmueble", value: showStepper ? "Checklist" : "OK" },
                { label: "Medidor de luz (foto + número)", value: "—" },
                { label: "Medidor de gas (foto + número)", value: "—" },
                { label: "Inventario (del ABM)", value: "—" },
                { label: "Llaves entregadas", value: "—" },
              ].map(({ label, value }, i) => (
                <div key={i} className="flex items-center gap-[10px] px-[10px] py-2 bg-surface-low rounded-md">
                  <div className={`w-[15px] h-[15px] rounded-[3px] border-[1.5px] flex items-center justify-center flex-shrink-0 ${
                    !showStepper ? "bg-green border-green" : "border-primary-dim bg-primary-dim/30"
                  }`}>
                    {!showStepper && <span className="text-[0.5rem] text-white font-bold">✓</span>}
                  </div>
                  <span className="flex-1 text-[0.75rem] text-text-secondary">{label}</span>
                  <span className="text-[0.68rem] text-muted-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actividad */}
          <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
            <div className="px-[18px] py-[14px] border-b border-border">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">Actividad del contrato</p>
            </div>
            <div className="p-[18px]">
              {[
                {
                  state: "done" as const,
                  label: "Contrato creado",
                  meta: format(parseDate(data.createdAt), "dd/MM/yyyy", { locale: es }),
                },
                ...(data.status !== "draft" ? [{
                  state: "done" as const,
                  label: "Borrador generado",
                  meta: "Condiciones completadas",
                }] : []),
                ...(data.status === "pending_signature" ? [{
                  state: "active" as const,
                  label: "Solicitud de firma enviada",
                  meta: "Esperando firmas de las partes",
                }] : []),
                ...(data.status === "active" || data.status === "expiring_soon" ? [{
                  state: "done" as const,
                  label: "Contrato vigente",
                  meta: `Desde ${format(parseDate(data.startDate), "dd/MM/yyyy", { locale: es })}`,
                }] : []),
                ...(data.status === "expired" ? [{
                  state: "active" as const,
                  label: "Contrato vencido",
                  meta: `Venció el ${format(parseDate(data.endDate), "dd/MM/yyyy", { locale: es })}`,
                }] : []),
                ...(data.status === "terminated" ? [{
                  state: "active" as const,
                  label: "Contrato rescindido",
                  meta: "Terminado anticipadamente",
                }] : []),
              ].map((item, i, arr) => (
                <div key={i} className="flex gap-3 pb-4 relative">
                  {i < arr.length - 1 && (
                    <div className="absolute left-[10px] top-[22px] bottom-0 w-px bg-border" />
                  )}
                  <div className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 mt-0.5 text-[0.6rem] ${
                    item.state === "done"
                      ? "border-green bg-green-dim text-green"
                      : "border-primary bg-primary-dim"
                  }`}>
                    {item.state === "done" ? "✓" : (
                      <div className="w-[7px] h-[7px] rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[0.78rem] font-semibold text-on-surface">{item.label}</p>
                    <p className="text-[0.68rem] text-muted-foreground mt-0.5">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Servicios ─────────────────────────────────────── */}
        <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Servicios e impuestos
              </p>
            </div>
            <button
              onClick={() => router.push(`/propiedades/${data.propertyId}?tab=servicios`)}
              className="text-[0.68rem] text-primary hover:underline flex items-center gap-1"
            >
              Ver todos →
            </button>
          </div>

          {combinedServices.length === 0 ? (
            <div className="px-[18px] py-5 text-center">
              <p className="text-[0.75rem] text-muted-foreground">No hay servicios aplicables configurados</p>
              <button
                onClick={() => setIsEditing(true)}
                className="mt-2 text-[0.72rem] text-primary hover:underline"
              >
                Editar condiciones para configurar →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {combinedServices.map(({ key, label, tipo, existingServicio, responsableLabel }) => {
                if (existingServicio) {
                  const s = existingServicio;
                  const estadoInfo = STATUS_COLOR[s.estado] ?? STATUS_COLOR.pendiente;
                  const icon = SERVICE_TYPE_ICON[s.tipo] ?? "📄";
                  const nombre = SERVICE_TYPE_SHORT[s.tipo] ?? s.tipo;
                  return (
                    <div
                      key={s.id}
                      onClick={() => router.push(`/propiedades/${data.propertyId}?tab=servicios&servicioId=${s.id}`)}
                      className="flex items-center gap-3 px-[18px] py-3 cursor-pointer hover:bg-surface-mid transition-colors"
                    >
                      <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.78rem] font-semibold text-on-surface">{nombre}</p>
                        <p className="text-[0.66rem] text-muted-foreground truncate">
                          {s.empresa ? `${s.empresa} · ` : ""}Paga: {responsableLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {s.diasSinComprobante > 0 && (
                          <span className="text-[0.63rem] text-muted-foreground">
                            {s.diasSinComprobante}d sin comprobante
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.63rem] font-bold ${estadoInfo.bg} ${estadoInfo.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${estadoInfo.dot}`} />
                          {STATUS_LABEL[s.estado] ?? s.estado}
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                }

                // Tarjeta fantasma: servicio aplicable pero sin datos cargados
                const icon = SERVICE_TYPE_ICON[tipo] ?? "📄";
                return (
                  <div
                    key={key}
                    onClick={() => router.push(`/propiedades/${data.propertyId}?tab=servicios`)}
                    className="flex items-center gap-3 px-[18px] py-3 cursor-pointer hover:bg-surface-mid transition-colors opacity-45 hover:opacity-75"
                  >
                    <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.78rem] font-semibold text-muted-foreground">{label}</p>
                      <p className="text-[0.66rem] text-muted-foreground">Paga: {responsableLabel} · sin datos cargados</p>
                    </div>
                    <span className="text-[0.63rem] text-primary flex-shrink-0">+ Configurar →</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </>)} {/* end activeTab === "operativo" */}

        {/* ── Actions footer ───────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 bg-surface border border-border rounded-[18px]">
          <div className="flex gap-2">
            <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold border border-border rounded-xl text-text-secondary bg-transparent hover:bg-surface-high transition-colors">
              Guardar cambios
            </button>
            <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold border border-border rounded-xl text-text-secondary bg-transparent hover:bg-surface-high transition-colors">
              ↓ Vista previa PDF
            </button>
            <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold rounded-xl text-error bg-transparent border border-error/25 hover:bg-error-dim transition-colors">
              Rescindir contrato
            </button>
          </div>
          <div className="flex gap-2">
            {data.status === "pending_signature" && (
              <button className="px-[14px] py-[7px] text-[0.72rem] font-semibold border border-border rounded-xl bg-surface-highest text-on-surface hover:bg-surface-high transition-colors">
                Reenviar solicitud de firma
              </button>
            )}
            {(data.status === "draft" || data.status === "pending_signature") && (
              <button
                onClick={() => data.status === "draft" && activateMutation.mutate()}
                disabled={activateMutation.isPending}
                className="px-[14px] py-[7px] text-[0.72rem] font-semibold rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-60"
              >
                Aprobar y enviar a firma →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
