"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Building2,
  User,
  Users,
  CalendarRange,
  DollarSign,
  Percent,
  CalendarClock,
  TrendingUp,
  Pencil,
  X,
  Zap,
  Flame,
  Droplets,
  Landmark,
  ReceiptText,
  Building,
  Search,
  CheckCircle2,
} from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  ADJUSTMENT_INDEX_LABELS,
  ADJUSTMENT_FREQUENCY_LABELS,
  SERVICE_RESPONSIBILITY_LABELS,
  PROPERTY_SERVICES,
  type ContractStatus,
  type ContractType,
  type AdjustmentIndex,
  type ServiceResponsibility,
} from "@/lib/clients/constants";

interface PropertyServices {
  serviceLuz: string;
  serviceGas: string;
  serviceAgua: string;
  serviceMunicipalidad: string;
  serviceRendas: string;
  serviceExpensas: string;
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
  createdAt: string;
  propertyAddress: string | null;
  propertyType: string | null;
  propertyId: string;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    dni: string | null;
  } | null;
  tenants: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    phone: string | null;
    dni: string | null;
  }[];
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
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "expiring_soon":
      return "outline";
    case "terminated":
    case "expired":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatMoney(value: string | null | undefined): string {
  if (!value) return "—";
  return `$${parseFloat(value).toLocaleString("es-AR")}`;
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  serviceLuz: Zap,
  serviceGas: Flame,
  serviceAgua: Droplets,
  serviceMunicipalidad: Landmark,
  serviceRendas: ReceiptText,
  serviceExpensas: Building,
};

export function ContratoDetalle({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  // Cargar índices custom desde la API
  const { data: customIndexesData } = useQuery({
    queryKey: ["adjustment-indexes"],
    queryFn: async () => {
      const res = await fetch("/api/adjustment-indexes");
      if (!res.ok) return { indexes: [] };
      return res.json();
    },
  });
  const customIndexes: { code: string; label: string }[] =
    customIndexesData?.indexes ?? [];

  // Queries para el selector de partes (solo se usan cuando se edita)
  const { data: tenantsData } = useQuery({
    queryKey: ["clients", "inquilino", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=inquilino&limit=200");
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: isEditingPartes,
  });
  const { data: ownersData } = useQuery({
    queryKey: ["clients", "propietario", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=propietario&limit=200");
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: isEditingPartes,
  });

  const availableTenants: { id: string; label: string }[] =
    tenantsData?.clients?.map(
      (c: { id: string; firstName: string; lastName: string | null }) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName || ""}`.trim(),
      })
    ) ?? [];

  const availableOwners: { value: string; label: string }[] =
    ownersData?.clients?.map(
      (c: { id: string; firstName: string; lastName: string | null }) => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName || ""}`.trim(),
      })
    ) ?? [];

  const selectedTenantObjects = availableTenants.filter((t) =>
    editTenantIds.includes(t.id)
  );

  const toggleEditTenant = (id: string) => {
    setEditTenantIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const patchPartesMutation = useMutation({
    mutationFn: async ({
      ownerId,
      tenantIds,
    }: {
      ownerId: string;
      tenantIds: string[];
    }) => {
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
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const startEditingPartes = () => {
    if (!data) return;
    setEditOwnerId(data.owner?.id ?? "");
    setEditTenantIds(data.tenants.map((t) => t.id));
    setIsEditingPartes(true);
  };

  const cancelEditingPartes = () => {
    setIsEditingPartes(false);
    setTenantSearch("");
    setTenantSearchOpen(false);
  };

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
      };
      if (values.depositAmount)
        body.depositAmount = parseFloat(values.depositAmount);
      else body.depositAmount = null;
      if (values.agencyCommission)
        body.agencyCommission = parseFloat(values.agencyCommission);
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
      return res.json();
    },
    onSuccess: () => {
      toast.success("Condiciones actualizadas");
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setIsEditing(false);
      setEditValues(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const activarMutation = useMutation({
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
    onError: (err: Error) => {
      toast.error(err.message);
    },
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
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValues(null);
  };

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
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-6 text-center">
          <p className="text-destructive mb-4">
            {(error as Error)?.message || "Contrato no encontrado"}
          </p>
          <Button variant="outline" onClick={() => router.push("/contratos")}>
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  const durationMonths = differenceInMonths(
    new Date(data.endDate),
    new Date(data.startDate)
  );

  const statusLabel =
    CONTRACT_STATUS_LABELS[data.status as ContractStatus] || data.status;
  const contractTypeLabel =
    CONTRACT_TYPE_LABELS[data.contractType as ContractType] || data.contractType;

  // Etiqueta del índice: puede ser estándar, custom, o el código crudo
  const getIndexLabel = (code: string) => {
    if (ADJUSTMENT_INDEX_LABELS[code as AdjustmentIndex]) {
      return ADJUSTMENT_INDEX_LABELS[code as AdjustmentIndex];
    }
    const custom = customIndexes.find((c) => c.code === code);
    return custom ? custom.label : code;
  };

  const adjustmentLabel = getIndexLabel(data.adjustmentIndex);
  const frequencyLabel =
    ADJUSTMENT_FREQUENCY_LABELS[data.adjustmentFrequency] ||
    `Cada ${data.adjustmentFrequency} meses`;

  // Todos los índices disponibles para el selector de edición
  const allIndexOptions = [
    ...Object.entries(ADJUSTMENT_INDEX_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
    ...customIndexes.map((c) => ({ value: c.code, label: c.label })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      {/* Botón volver */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/contratos")}
          className="-ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Contratos
        </Button>
      </div>

      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Contrato {data.contractNumber}</h1>
          <Badge variant={statusBadgeVariant(data.status)}>{statusLabel}</Badge>
          {data.status === "draft" && (
            <Button
              size="sm"
              onClick={() => activarMutation.mutate()}
              disabled={activarMutation.isPending}
            >
              {activarMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Activar contrato
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {data.propertyAddress || "Sin dirección"}
          {data.tenants.length > 0 && (
            <>
              {" · "}
              {data.tenants.length === 1 ? "Inquilino" : "Inquilinos"}:{" "}
              {data.tenants.map((t) => t.name).join(", ")}
            </>
          )}
          {data.owner && ` · Propietario: ${data.owner.name}`}
          {" · "}
          {format(new Date(data.startDate), "dd/MM/yyyy", { locale: es })}
          {" → "}
          {format(new Date(data.endDate), "dd/MM/yyyy", { locale: es })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Alquiler base
            </span>
          </div>
          <p className="text-2xl font-bold">{formatMoney(data.monthlyAmount)}</p>
          <p className="text-xs text-muted-foreground">por mes</p>
        </div>

        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Depósito
            </span>
          </div>
          <p className="text-2xl font-bold">{formatMoney(data.depositAmount)}</p>
          <p className="text-xs text-muted-foreground">garantía</p>
        </div>

        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Duración
            </span>
          </div>
          <p className="text-2xl font-bold">{durationMonths} meses</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(data.startDate), "MMM yyyy", { locale: es })} →{" "}
            {format(new Date(data.endDate), "MMM yyyy", { locale: es })}
          </p>
        </div>

        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Día de pago
            </span>
          </div>
          <p className="text-2xl font-bold">Día {data.paymentDay}</p>
          <p className="text-xs text-muted-foreground">
            Modalidad {data.paymentModality === "A" ? "A — inmobiliaria" : "B — directo"}
          </p>
        </div>
      </div>

      {/* Condiciones + Partes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Condiciones del contrato */}
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Condiciones
              </h2>
            </div>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startEditing}
                className="h-7 px-2 text-xs gap-1"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            )}
          </div>

          {isEditing && editValues ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Inicio</Label>
                  <Input
                    type="date"
                    value={editValues.startDate}
                    onChange={(e) =>
                      setEditValues((v) => v && { ...v, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fin</Label>
                  <Input
                    type="date"
                    value={editValues.endDate}
                    onChange={(e) =>
                      setEditValues((v) => v && { ...v, endDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monto mensual ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editValues.monthlyAmount}
                    onChange={(e) =>
                      setEditValues((v) => v && { ...v, monthlyAmount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Depósito ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editValues.depositAmount}
                    onChange={(e) =>
                      setEditValues((v) => v && { ...v, depositAmount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comisión (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={editValues.agencyCommission}
                    onChange={(e) =>
                      setEditValues((v) =>
                        v && { ...v, agencyCommission: e.target.value }
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Día de pago</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={editValues.paymentDay}
                    onChange={(e) =>
                      setEditValues((v) => v && { ...v, paymentDay: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Modalidad de pago</Label>
                  <Select
                    value={editValues.paymentModality}
                    onValueChange={(v) =>
                      setEditValues((prev) =>
                        prev ? { ...prev, paymentModality: v as "A" | "B" } : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">
                        Modalidad A (inmobiliaria recibe y liquida)
                      </SelectItem>
                      <SelectItem value="B">
                        Modalidad B (pago directo al propietario)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Índice de ajuste</Label>
                  <Select
                    value={editValues.adjustmentIndex}
                    onValueChange={(v) =>
                      setEditValues((prev) =>
                        prev ? { ...prev, adjustmentIndex: v } : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allIndexOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frecuencia de ajuste</Label>
                  <Select
                    value={editValues.adjustmentFrequency}
                    onValueChange={(v) =>
                      setEditValues((prev) =>
                        prev ? { ...prev, adjustmentFrequency: v } : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ADJUSTMENT_FREQUENCY_LABELS).map(
                        ([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={patchMutation.isPending}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => editValues && patchMutation.mutate(editValues)}
                  disabled={patchMutation.isPending}
                >
                  {patchMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : null}
                  Guardar cambios
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y text-sm">
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Propiedad</span>
                <span className="font-medium">{data.propertyAddress || "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">{contractTypeLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Período</span>
                <span className="font-medium">
                  {format(new Date(data.startDate), "dd/MM/yyyy", { locale: es })}{" "}
                  →{" "}
                  {format(new Date(data.endDate), "dd/MM/yyyy", { locale: es })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Índice de ajuste
                </span>
                <span className="font-medium">{adjustmentLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarRange className="h-3 w-3" /> Frecuencia
                </span>
                <span className="font-medium">{frequencyLabel}</span>
              </div>
              {data.agencyCommission && (
                <div className="grid grid-cols-2 gap-2 px-4 py-3">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Comisión
                  </span>
                  <span className="font-medium">{data.agencyCommission}%</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">N° contrato</span>
                <span className="font-mono text-muted-foreground">
                  {data.contractNumber}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Partes */}
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Partes
              </h2>
            </div>
            {!isEditingPartes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startEditingPartes}
                className="h-7 px-2 text-xs gap-1"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            )}
          </div>

          {isEditingPartes ? (
            <div className="p-4 space-y-4">
              {/* Selector de propietario */}
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

              {/* Multi-select de inquilinos */}
              <div className="space-y-1">
                <Label className="text-xs">Inquilinos</Label>

                {/* Badges de seleccionados */}
                {selectedTenantObjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {selectedTenantObjects.map((t, i) => (
                      <Badge key={t.id} variant="secondary" className="gap-1 pr-1 text-xs">
                        <span>
                          {t.label}
                          {i === 0 && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              (principal)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleEditTenant(t.id)}
                          className="ml-1 rounded-sm hover:bg-destructive/20 p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Botón para desplegar lista */}
                <button
                  type="button"
                  onClick={() => setTenantSearchOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 border rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  <span>
                    {tenantSearchOpen
                      ? "Cerrar lista"
                      : selectedTenantObjects.length === 0
                      ? "Seleccionar inquilinos..."
                      : `${selectedTenantObjects.length} seleccionado${selectedTenantObjects.length > 1 ? "s" : ""} — agregar más`}
                  </span>
                  <span>{tenantSearchOpen ? "▲" : "▼"}</span>
                </button>

                {tenantSearchOpen && (
                  <div className="border rounded-md overflow-hidden">
                    <div className="p-2 border-b flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={tenantSearch}
                        onChange={(e) => setTenantSearch(e.target.value)}
                        placeholder="Buscar inquilino..."
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      />
                      {tenantSearch && (
                        <button
                          type="button"
                          onClick={() => setTenantSearch("")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {availableTenants.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground text-center">
                          No hay inquilinos cargados
                        </p>
                      ) : availableTenants.filter((t) =>
                          t.label.toLowerCase().includes(tenantSearch.toLowerCase())
                        ).length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground text-center">
                          Sin resultados
                        </p>
                      ) : (
                        availableTenants
                          .filter((t) =>
                            t.label.toLowerCase().includes(tenantSearch.toLowerCase())
                          )
                          .map((t) => (
                            <label
                              key={t.id}
                              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                            >
                              <Checkbox
                                checked={editTenantIds.includes(t.id)}
                                onCheckedChange={() => toggleEditTenant(t.id)}
                              />
                              <span className="text-sm">{t.label}</span>
                            </label>
                          ))
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  El primero seleccionado será el inquilino principal.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditingPartes}
                  disabled={patchPartesMutation.isPending}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    patchPartesMutation.mutate({
                      ownerId: editOwnerId,
                      tenantIds: editTenantIds,
                    })
                  }
                  disabled={
                    patchPartesMutation.isPending ||
                    !editOwnerId ||
                    editTenantIds.length === 0
                  }
                >
                  {patchPartesMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : null}
                  Guardar cambios
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {data.tenants.map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {t.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="secondary" className="text-xs h-5">
                        {t.role === "principal" ? "Principal" : "Co-titular"}
                      </Badge>
                    </div>
                    {t.email && (
                      <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                    )}
                    {t.phone && (
                      <p className="text-xs text-muted-foreground">{t.phone}</p>
                    )}
                    {t.dni && (
                      <p className="text-xs text-muted-foreground">DNI {t.dni}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs h-5 flex-shrink-0">
                    Inquilino
                  </Badge>
                </div>
              ))}

              <Separator />

              {data.owner && (
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {data.owner.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{data.owner.name}</span>
                    </div>
                    {data.owner.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {data.owner.email}
                      </p>
                    )}
                    {data.owner.phone && (
                      <p className="text-xs text-muted-foreground">
                        {data.owner.phone}
                      </p>
                    )}
                    {data.owner.dni && (
                      <p className="text-xs text-muted-foreground">
                        DNI {data.owner.dni}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs h-5">
                      Propietario
                    </Badge>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Servicios e impuestos */}
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Servicios e impuestos
          </h2>
          <span className="text-xs text-muted-foreground ml-1">
            (datos de la propiedad)
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
          {PROPERTY_SERVICES.map(({ key, label }) => {
            const value = data[key as keyof PropertyServices] as string;
            const Icon = SERVICE_ICONS[key];
            const resp = value as ServiceResponsibility;
            const respLabel = SERVICE_RESPONSIBILITY_LABELS[resp] ?? value;
            return (
              <div key={key} className="px-4 py-3 flex items-center gap-3">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={`text-sm font-medium ${
                      resp === "na" ? "text-muted-foreground" : ""
                    }`}
                  >
                    {respLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
