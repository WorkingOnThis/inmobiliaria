"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/properties/format-address";
import { X, Users, Search, Plus, Loader2 as Spin, Shield, ChevronDown, Check } from "lucide-react";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  ADJUSTMENT_INDEX_LABELS,
  ADJUSTMENT_FREQUENCY_LABELS,
  type ContractType,
  type AdjustmentIndex,
} from "@/lib/clients/constants";
import { CreateOwnerPopup } from "@/components/properties/create-owner-popup";

// Tipos mínimos para los selects
interface SelectOption {
  id: string;
  label: string;
}

interface PropertyOption extends SelectOption {
  ownerId: string | null;
}

// Paso 1 — Partes del contrato
interface Step1Data {
  propertyId: string;
  ownerId: string;
  contractType: ContractType | "";
}

// Paso 2 — Condiciones
interface Step2Data {
  startDate: string;
  endDate: string;
  monthlyAmount: string;
  depositAmount: string;
  agencyCommission: string;
  managementCommissionPct: string;
  paymentDay: string;
  paymentModality: "A" | "split";
  adjustmentIndex: string;
  adjustmentFrequency: string;
}

export function ContractForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [isImported, setIsImported] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tenantSearchOpen, setTenantSearchOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const [guarantorSearchOpen, setGuarantorSearchOpen] = useState(false);
  const [guarantorSearch, setGuarantorSearch] = useState("");
  const [guarantors, setGuarantors] = useState<Array<{ id: string; firstName: string; lastName: string | null }>>([]);
  const [selectedTenants, setSelectedTenants] = useState<Array<{ id: string; label: string }>>([]);
  const [showGuarantorPopup, setShowGuarantorPopup] = useState(false);
  const [showTenantPopup, setShowTenantPopup] = useState(false);
  const [durationMonths, setDurationMonths] = useState("");

  const presetTenantId = searchParams.get("tenantId");
  const presetPropertyId = searchParams.get("propertyId");

  const [step1, setStep1] = useState<Step1Data>({
    propertyId: presetPropertyId ?? "",
    ownerId: "",
    contractType: "",
  });

  const defaultStartDate = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const [step2, setStep2] = useState<Step2Data>({
    startDate: defaultStartDate,
    endDate: "",
    monthlyAmount: "",
    depositAmount: "",
    agencyCommission: "",
    managementCommissionPct: "10",
    paymentDay: "1",
    paymentModality: "A",
    adjustmentIndex: "none",
    adjustmentFrequency: "3",
  });

  const startDateIsOld = (() => {
    if (!step2.startDate) return false;
    const start = new Date(step2.startDate + "T00:00:00");
    const diffDays = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  })();

  const [showNewIndexForm, setShowNewIndexForm] = useState(false);
  const [newIndexCode, setNewIndexCode] = useState("");
  const [newIndexLabel, setNewIndexLabel] = useState("");

  // Cargar propiedades disponibles
  const { data: propertiesData } = useQuery({
    queryKey: ["properties", "select"],
    queryFn: async () => {
      const res = await fetch("/api/properties?limit=100&isManaged=true");
      if (!res.ok) throw new Error("Error cargando propiedades");
      return res.json();
    },
  });

  // Buscar inquilinos por texto (server-side, se activa al tipear 2+ chars)
  const { data: tenantResults } = useQuery({
    queryKey: ["clients", "search-tenant", tenantSearch],
    queryFn: async () => {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(tenantSearch)}&limit=20`);
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: tenantSearchOpen && tenantSearch.trim().length >= 2,
  });
  const tenantOptions: Array<{ id: string; firstName: string; lastName: string | null }> =
    tenantResults?.clients ?? [];

  // Resolver presetTenantId al abrir el formulario
  const { data: presetTenantData } = useQuery({
    queryKey: ["client", presetTenantId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${presetTenantId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!presetTenantId,
  });

  useEffect(() => {
    if (presetTenantData?.client && selectedTenants.length === 0) {
      const c = presetTenantData.client;
      setSelectedTenants([{ id: c.id, label: `${c.firstName} ${c.lastName || ""}`.trim() }]);
    }
  }, [presetTenantData]);

  // Cargar propietarios (ambos valores de type)
  const { data: ownersData } = useQuery({
    queryKey: ["clients", "owner", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=propietario,owner&limit=100");
      if (!res.ok) throw new Error("Error cargando propietarios");
      return res.json();
    },
  });

  // Buscar garantes (cualquier cliente)
  const { data: guarantorResults } = useQuery({
    queryKey: ["clients", "search", guarantorSearch],
    queryFn: async () => {
      if (!guarantorSearch.trim()) return { clients: [] };
      const res = await fetch(
        `/api/clients?search=${encodeURIComponent(guarantorSearch)}&limit=20`
      );
      if (!res.ok) throw new Error("Error buscando clientes");
      return res.json();
    },
    enabled: guarantorSearchOpen,
  });
  const guarantorOptions: Array<{ id: string; firstName: string; lastName: string | null }> =
    guarantorResults?.clients ?? [];

  const addGuarantor = (g: { id: string; firstName: string; lastName: string | null }) => {
    if (!guarantors.find((x) => x.id === g.id)) {
      setGuarantors((prev) => [...prev, g]);
    }
    setGuarantorSearch("");
    setGuarantorSearchOpen(false);
  };

  const removeGuarantor = (id: string) => {
    setGuarantors((prev) => prev.filter((g) => g.id !== id));
  };

  // Cargar índices custom
  const { data: customIndexesData, refetch: refetchIndexes } = useQuery({
    queryKey: ["adjustment-indexes"],
    queryFn: async () => {
      const res = await fetch("/api/adjustment-indexes");
      if (!res.ok) return { indexes: [] };
      return res.json();
    },
  });
  const customIndexes: { code: string; label: string }[] =
    customIndexesData?.indexes ?? [];

  const createIndexMutation = useMutation({
    mutationFn: async ({ code, label }: { code: string; label: string }) => {
      const res = await fetch("/api/adjustment-indexes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, label }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al crear el índice");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchIndexes();
      setStep2((s) => ({ ...s, adjustmentIndex: data.index.code }));
      setShowNewIndexForm(false);
      setNewIndexCode("");
      setNewIndexLabel("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const allIndexOptions = [
    ...Object.entries(ADJUSTMENT_INDEX_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
    ...customIndexes.map((c) => ({ value: c.code, label: c.label })),
  ];

  const properties: PropertyOption[] =
    propertiesData?.properties?.map(
      (p: { id: string; addressStreet: string; addressNumber: string | null; ownerId: string | null }) => ({
        id: p.id,
        label: formatAddress(p),
        ownerId: p.ownerId ?? null,
      })
    ) ?? [];

  const owners: SelectOption[] =
    ownersData?.clients?.map(
      (c: { id: string; firstName: string; lastName: string | null }) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName || ""}`.trim(),
      })
    ) ?? [];

  const addTenant = (t: { id: string; firstName: string; lastName: string | null }) => {
    const label = `${t.firstName} ${t.lastName || ""}`.trim();
    if (!selectedTenants.find((x) => x.id === t.id)) {
      setSelectedTenants((prev) => [...prev, { id: t.id, label }]);
    }
    setTenantSearch("");
    setTenantSearchOpen(false);
    setFieldErrors((e) => ({ ...e, tenantIds: "" }));
  };

  const removeTenant = (id: string) => {
    setSelectedTenants((prev) => prev.filter((t) => t.id !== id));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: step1.propertyId,
          tenantIds: selectedTenants.map((t) => t.id),
          guarantorIds: guarantors.map((g) => g.id),
          ownerId: step1.ownerId,
          contractType: step1.contractType,
          startDate: step2.startDate,
          endDate: step2.endDate,
          monthlyAmount: parseFloat(step2.monthlyAmount),
          depositAmount: step2.depositAmount
            ? parseFloat(step2.depositAmount)
            : null,
          agencyCommission: step2.agencyCommission
            ? parseFloat(step2.agencyCommission)
            : null,
          managementCommissionPct: step2.managementCommissionPct
            ? parseFloat(step2.managementCommissionPct)
            : 10,
          paymentDay: parseInt(step2.paymentDay),
          paymentModality: step2.paymentModality,
          adjustmentIndex: step2.adjustmentIndex,
          adjustmentFrequency: parseInt(step2.adjustmentFrequency),
          isImported,
          ledgerStartDate: startDateIsOld && ledgerStartDate ? ledgerStartDate : null,
        }),
      });
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || "Error al crear el contrato");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const num = data.contract?.contractNumber ?? "nuevo";
      toast.success(`Contrato ${num} creado exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      router.push("/contratos");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!step1.propertyId) errors.propertyId = "Seleccioná una propiedad";
    if (selectedTenants.length === 0)
      errors.tenantIds = "Seleccioná al menos un inquilino";
    if (!step1.ownerId) errors.ownerId = "Seleccioná un propietario";
    if (!step1.contractType) errors.contractType = "Seleccioná el tipo de contrato";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!step2.startDate) errors.startDate = "La fecha de inicio es requerida";
    if (!step2.endDate) errors.endDate = "La fecha de fin es requerida";
    if (!step2.monthlyAmount || parseFloat(step2.monthlyAmount) <= 0)
      errors.monthlyAmount = "El monto mensual debe ser mayor a 0";
    if (!step2.paymentDay || parseInt(step2.paymentDay) < 1 || parseInt(step2.paymentDay) > 28)
      errors.paymentDay = "El día de pago debe ser entre 1 y 28";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goToStep2 = () => {
    if (validateStep1()) {
      setFieldErrors({});
      setStep(2);
    }
  };

  const goToStep3 = () => {
    if (validateStep2()) {
      setFieldErrors({});
      setStep(3);
    }
  };

  const selectedProperty = properties.find((p) => p.id === step1.propertyId);
  const selectedOwner = owners.find((o) => o.id === step1.ownerId);

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <>
    <CreateOwnerPopup
      isOpen={showTenantPopup}
      onClose={() => setShowTenantPopup(false)}
      defaultType="tenant"
      onCreated={(created) => {
        addTenant({ id: created.id, firstName: created.firstName, lastName: created.lastName ?? null });
        setShowTenantPopup(false);
      }}
    />
    <CreateOwnerPopup
      isOpen={showGuarantorPopup}
      onClose={() => setShowGuarantorPopup(false)}
      defaultType="guarantor"
      onCreated={(created) => {
        addGuarantor({ id: created.id, firstName: created.firstName, lastName: created.lastName ?? null });
        setShowGuarantorPopup(false);
      }}
    />
    <div className="w-full max-w-2xl space-y-8">
      {/* Indicador de pasos */}
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
                  step === s
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : step > s
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              <span
                className={cn(
                  "text-sm",
                  step === s ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {s === 1 ? "Partes" : s === 2 ? "Condiciones" : "Resumen"}
              </span>
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "h-0.5 w-10 rounded-full transition-colors duration-200",
                  step > s ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Paso 1 — Partes */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Partes del contrato</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Propiedad <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={properties.map((p) => ({ value: p.id, label: p.label }))}
                value={step1.propertyId}
                onValueChange={(v) => {
                  const prop = properties.find((p) => p.id === v);
                  setStep1((s) => ({
                    ...s,
                    propertyId: v,
                    ownerId: prop?.ownerId && !s.ownerId ? prop.ownerId : s.ownerId,
                  }));
                  if (v) setFieldErrors((e) => ({ ...e, propertyId: "" }));
                }}
                placeholder="Seleccionar propiedad..."
                searchPlaceholder="Buscar por dirección..."
                emptyText="No hay propiedades cargadas"
              />
              {fieldErrors.propertyId && (
                <p className="text-sm text-destructive">{fieldErrors.propertyId}</p>
              )}
            </div>

            {/* Multi-select de inquilinos */}
            <div className="space-y-2">
              <Label>
                Inquilinos <span className="text-destructive">*</span>
              </Label>

              {/* Inquilinos seleccionados como badges */}
              {selectedTenants.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {selectedTenants.map((t, i) => (
                    <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                      <Users className="h-3 w-3" />
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
                        onClick={() => removeTenant(t.id)}
                        className="ml-1 rounded-sm hover:bg-destructive/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Buscar inquilinos */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setTenantSearchOpen((v) => !v)}
                className="w-full justify-between font-normal text-muted-foreground hover:text-muted-foreground"
              >
                <span>
                  {tenantSearchOpen ? "Cerrar búsqueda" : "+ Agregar inquilino"}
                </span>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", tenantSearchOpen && "rotate-180")} />
              </Button>

              {tenantSearchOpen && (
                <div className="border rounded-md overflow-hidden">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      placeholder="Buscar persona..."
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
                    {tenantSearch.length < 2 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Escribí al menos 2 caracteres para buscar
                      </p>
                    ) : tenantOptions.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Sin resultados
                      </p>
                    ) : (
                      tenantOptions
                        .filter((t) => !selectedTenants.find((x) => x.id === t.id))
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => addTenant(t)}
                            className="w-full flex items-start px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                          >
                            {`${t.firstName} ${t.lastName || ""}`.trim()}
                          </button>
                        ))
                    )}
                    <button
                      type="button"
                      onClick={() => setShowTenantPopup(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-accent transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Crear nueva persona
                    </button>
                  </div>
                </div>
              )}

              {fieldErrors.tenantIds && (
                <p className="text-sm text-destructive">{fieldErrors.tenantIds}</p>
              )}
              <p className="text-xs text-muted-foreground">
                El primero seleccionado será el inquilino principal.
              </p>
            </div>

            {/* Garantes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Garantes
              </Label>

              {guarantors.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {guarantors.map((g) => (
                    <Badge key={g.id} variant="secondary" className="gap-1 pr-1">
                      <span>{`${g.firstName} ${g.lastName || ""}`.trim()}</span>
                      <button
                        type="button"
                        onClick={() => removeGuarantor(g.id)}
                        className="ml-1 rounded-sm hover:bg-destructive/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setGuarantorSearchOpen((v) => !v)}
                className="w-full justify-between font-normal text-muted-foreground hover:text-muted-foreground"
              >
                <span>
                  {guarantorSearchOpen ? "Cerrar búsqueda" : "+ Agregar garante"}
                </span>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", guarantorSearchOpen && "rotate-180")} />
              </Button>

              {guarantorSearchOpen && (
                <div className="border rounded-md overflow-hidden">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={guarantorSearch}
                      onChange={(e) => setGuarantorSearch(e.target.value)}
                      placeholder="Buscar persona..."
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                    {guarantorSearch && (
                      <button
                        type="button"
                        onClick={() => setGuarantorSearch("")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {guarantorSearch.length < 2 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Escribí al menos 2 caracteres para buscar
                      </p>
                    ) : guarantorOptions.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Sin resultados
                      </p>
                    ) : (
                      guarantorOptions
                        .filter((g) => !guarantors.find((x) => x.id === g.id))
                        .map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => addGuarantor(g)}
                            className="w-full flex items-start px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                          >
                            {`${g.firstName} ${g.lastName || ""}`.trim()}
                          </button>
                        ))
                    )}
                    <button
                      type="button"
                      onClick={() => setShowGuarantorPopup(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-accent transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Crear nueva persona
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Propietario <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={owners.map((o) => ({ value: o.id, label: o.label }))}
                value={step1.ownerId}
                onValueChange={(v) => {
                  setStep1((s) => ({ ...s, ownerId: v }));
                  if (v) setFieldErrors((e) => ({ ...e, ownerId: "" }));
                }}
                placeholder="Seleccionar propietario..."
                searchPlaceholder="Buscar por nombre..."
                emptyText="No hay propietarios cargados"
              />
              {fieldErrors.ownerId && (
                <p className="text-sm text-destructive">{fieldErrors.ownerId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Tipo de contrato <span className="text-destructive">*</span>
              </Label>
              <Select
                value={step1.contractType}
                onValueChange={(v) =>
                  setStep1((s) => ({ ...s, contractType: v as ContractType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONTRACT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.contractType && (
                <p className="text-sm text-destructive">
                  {fieldErrors.contractType}
                </p>
              )}
            </div>
          </div>

          <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${isImported ? "border-amber-500/40 bg-amber-500/5" : "border-border hover:border-border/80"}`}>
            <Checkbox
              checked={isImported}
              onCheckedChange={(v) => setIsImported(!!v)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium leading-tight">Contrato ya vigente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activá esto si el contrato ya está en curso (firma previa al sistema o viene de otra administración). Se creará directo en estado <strong>Activo</strong>.
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/contratos")}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={goToStep2}>
              Siguiente →
            </Button>
          </div>
        </div>
      )}

      {/* Paso 2 — Condiciones */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Condiciones del contrato</h2>

          {/* Período */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>
                  Fecha de inicio <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={step2.startDate}
                  onChange={(newStart) => {
                    const months = parseInt(durationMonths);
                    if (newStart && months >= 1) {
                      const d = new Date(newStart + "T12:00:00");
                      d.setMonth(d.getMonth() + months);
                      d.setDate(d.getDate() - 1);
                      const newEnd = d.toISOString().slice(0, 10);
                      setStep2((s) => ({ ...s, startDate: newStart, endDate: newEnd }));
                    } else {
                      setStep2((s) => ({ ...s, startDate: newStart }));
                    }
                    setLedgerStartDate(""); // reset so it defaults to new startDate
                  }}
                />
                {fieldErrors.startDate && (
                  <p className="text-sm text-destructive">{fieldErrors.startDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Duración (meses)</Label>
                <Input
                  type="number"
                  min="1"
                  value={durationMonths}
                  placeholder="Ej: 24"
                  onChange={(e) => {
                    const months = parseInt(e.target.value);
                    setDurationMonths(e.target.value);
                    if (step2.startDate && months >= 1) {
                      const d = new Date(step2.startDate);
                      d.setMonth(d.getMonth() + months);
                      d.setDate(d.getDate() - 1);
                      setStep2((s) => ({ ...s, endDate: d.toISOString().slice(0, 10) }));
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Fecha de fin <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={step2.endDate}
                  onChange={(newEnd) => {
                    setStep2((s) => ({ ...s, endDate: newEnd }));
                    if (step2.startDate && newEnd) {
                      const start = new Date(step2.startDate + "T12:00:00");
                      const end = new Date(newEnd + "T12:00:00");
                      const months =
                        (end.getFullYear() - start.getFullYear()) * 12 +
                        (end.getMonth() - start.getMonth());
                      if (months >= 1) setDurationMonths(String(months));
                    }
                  }}
                />
                {fieldErrors.endDate && (
                  <p className="text-sm text-destructive">{fieldErrors.endDate}</p>
                )}
              </div>
            </div>

            {startDateIsOld && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    El contrato empieza en el pasado
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ¿Desde qué mes generamos los cobros? Por defecto arranca desde la fecha de inicio.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Primer mes a cobrar</Label>
                  <DatePicker
                    value={ledgerStartDate || step2.startDate}
                    onChange={(v) => setLedgerStartDate(v)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Montos */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Monto mensual ($) <span className="text-destructive">*</span>
                </Label>
                <MoneyInput
                  value={step2.monthlyAmount}
                  onValueChange={(v) => setStep2((s) => ({ ...s, monthlyAmount: v }))}
                  placeholder="Ej: 150.000"
                />
                {fieldErrors.monthlyAmount && (
                  <p className="text-sm text-destructive">{fieldErrors.monthlyAmount}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Depósito ($)</Label>
                <MoneyInput
                  value={step2.depositAmount}
                  onValueChange={(v) => setStep2((s) => ({ ...s, depositAmount: v }))}
                  placeholder="Ej: 300.000"
                />
              </div>

              <div className="space-y-2">
                <Label>Comisión inmobiliaria (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={step2.agencyCommission}
                  onChange={(e) => setStep2((s) => ({ ...s, agencyCommission: e.target.value }))}
                  placeholder="Ej: 5"
                />
              </div>

              <div className="space-y-2">
                <Label>Administración al propietario (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={step2.managementCommissionPct}
                  onChange={(e) => setStep2((s) => ({ ...s, managementCommissionPct: e.target.value }))}
                  placeholder="Ej: 10"
                />
              </div>
            </div>
          </div>

          {/* Condiciones de pago */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condiciones de pago</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Día de pago <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={step2.paymentDay}
                  onChange={(e) => setStep2((s) => ({ ...s, paymentDay: e.target.value }))}
                  placeholder="1-28"
                />
                {fieldErrors.paymentDay && (
                  <p className="text-sm text-destructive">{fieldErrors.paymentDay}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Modalidad de pago</Label>
                <Select
                  value={step2.paymentModality}
                  onValueChange={(v) => setStep2((s) => ({ ...s, paymentModality: v as "A" | "split" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Modalidad A — inmobiliaria recibe y liquida</SelectItem>
                    <SelectItem value="split">Pago dividido — el inquilino paga directo a cada destino</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {step2.paymentModality === "A"
                    ? "La inmobiliaria cobra por su CBU y liquida al propietario. Se aplica un recargo del 1% sobre el alquiler, descontado de la liquidación."
                    : "El inquilino transfiere directamente al propietario y a la administración según el % configurado. El propietario puede recibir el 100% si el % de administración es 0."}
                </p>
              </div>
            </div>
          </div>

          {/* Ajuste */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ajuste</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Índice de ajuste</Label>
                <Select
                  value={step2.adjustmentIndex}
                  onValueChange={(v) => setStep2((s) => ({ ...s, adjustmentIndex: v }))}
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
                {!showNewIndexForm ? (
                  <button
                    type="button"
                    onClick={() => setShowNewIndexForm(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar índice personalizado
                  </button>
                ) : (
                  <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium">Nuevo índice</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Código</Label>
                        <Input
                          value={newIndexCode}
                          onChange={(e) => setNewIndexCode(e.target.value.toUpperCase())}
                          placeholder="Ej: RIPTE"
                          className="h-8 text-sm"
                          maxLength={20}
                        />
                        <p className="text-xs text-muted-foreground">Solo mayúsculas y números</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nombre</Label>
                        <Input
                          value={newIndexLabel}
                          onChange={(e) => setNewIndexLabel(e.target.value)}
                          placeholder="Ej: RIPTE"
                          className="h-8 text-sm"
                          maxLength={80}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setShowNewIndexForm(false);
                          setNewIndexCode("");
                          setNewIndexLabel("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!newIndexCode || !newIndexLabel || createIndexMutation.isPending}
                        onClick={() => createIndexMutation.mutate({ code: newIndexCode, label: newIndexLabel })}
                      >
                        {createIndexMutation.isPending ? <Spin className="h-3 w-3 mr-1 animate-spin" /> : null}
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Frecuencia de ajuste (meses)</Label>
                <Input
                  type="number"
                  min="1"
                  max="36"
                  value={step2.adjustmentFrequency}
                  onChange={(e) => setStep2((s) => ({ ...s, adjustmentFrequency: e.target.value }))}
                  placeholder="Ej: 12"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
            >
              ← Anterior
            </Button>
            <Button type="button" onClick={goToStep3}>
              Ver resumen →
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Resumen */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Resumen del contrato</h2>

          <div className="rounded-lg border text-sm overflow-hidden">
            {/* Partes */}
            <div className="px-4 py-2.5 bg-muted/40 border-b">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partes</p>
            </div>
            <div className="divide-y">
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Propiedad</span>
                <span className="font-medium">{selectedProperty?.label ?? "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">
                  {selectedTenants.length > 1 ? "Inquilinos" : "Inquilino"}
                </span>
                <div className="flex flex-col gap-0.5">
                  {selectedTenants.map((t, i) => (
                    <span key={t.id} className="font-medium">
                      {t.label}
                      {i === 0 && selectedTenants.length > 1 && (
                        <span className="text-muted-foreground text-xs ml-1">(principal)</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              {guarantors.length > 0 && (
                <div className="grid grid-cols-2 gap-2 px-4 py-3">
                  <span className="text-muted-foreground">
                    {guarantors.length > 1 ? "Garantes" : "Garante"}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {guarantors.map((g) => (
                      <span key={g.id} className="font-medium">
                        {`${g.firstName} ${g.lastName || ""}`.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Propietario</span>
                <span className="font-medium">{selectedOwner?.label ?? "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">
                  {step1.contractType ? CONTRACT_TYPE_LABELS[step1.contractType as ContractType] : "-"}
                </span>
              </div>
            </div>

            {/* Condiciones */}
            <div className="px-4 py-2.5 bg-muted/40 border-y">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condiciones</p>
            </div>
            <div className="divide-y">
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Período</span>
                <span className="font-medium">
                  {formatDate(step2.startDate)} → {formatDate(step2.endDate)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Monto mensual</span>
                <span className="font-medium">
                  ${parseFloat(step2.monthlyAmount || "0").toLocaleString("es-AR")}
                </span>
              </div>
              {step2.depositAmount && (
                <div className="grid grid-cols-2 gap-2 px-4 py-3">
                  <span className="text-muted-foreground">Depósito</span>
                  <span className="font-medium">
                    ${parseFloat(step2.depositAmount).toLocaleString("es-AR")}
                  </span>
                </div>
              )}
              {step2.agencyCommission && (
                <div className="grid grid-cols-2 gap-2 px-4 py-3">
                  <span className="text-muted-foreground">Comisión inmobiliaria</span>
                  <span className="font-medium">{step2.agencyCommission}%</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Comisión de administración</span>
                <span className="font-medium">{step2.managementCommissionPct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Día de pago</span>
                <span className="font-medium">Día {step2.paymentDay}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Modalidad</span>
                <span className="font-medium">
                  {step2.paymentModality === "A" ? "Modalidad A (inmobiliaria)" : "Pago dividido (split)"}
                </span>
              </div>
            </div>

            {/* Ajuste */}
            <div className="px-4 py-2.5 bg-muted/40 border-y">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ajuste</p>
            </div>
            <div className="divide-y">
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Índice</span>
                <span className="font-medium">
                  {ADJUSTMENT_INDEX_LABELS[step2.adjustmentIndex as AdjustmentIndex] ||
                    customIndexes.find((c) => c.code === step2.adjustmentIndex)?.label ||
                    step2.adjustmentIndex}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-3">
                <span className="text-muted-foreground">Frecuencia</span>
                <span className="font-medium">
                  {ADJUSTMENT_FREQUENCY_LABELS[parseInt(step2.adjustmentFrequency)] ||
                    `Cada ${step2.adjustmentFrequency} meses`}
                </span>
              </div>
            </div>
          </div>

          {isImported ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">Contrato importado</p>
              <p className="text-muted-foreground mt-0.5">
                Se creará directo en estado <strong>Activo</strong>. La firma es anterior a este sistema.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              El contrato se creará en estado <strong>Borrador</strong>. Podés
              actualizarlo más adelante.
            </p>
          )}

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              disabled={mutation.isPending}
            >
              ← Anterior
            </Button>
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creando..." : "Confirmar y crear contrato"}
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
