"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  ADJUSTMENT_INDEXES,
  ADJUSTMENT_INDEX_LABELS,
  type ContractType,
  type AdjustmentIndex,
} from "@/lib/clients/constants";

// Tipos mínimos para los selects
interface SelectOption {
  id: string;
  label: string;
}

// Paso 1 — Partes del contrato
interface Step1Data {
  propertyId: string;
  tenantId: string;
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
  paymentDay: string;
  paymentModality: "A" | "B";
  adjustmentIndex: AdjustmentIndex;
}

export function ContratoForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [step1, setStep1] = useState<Step1Data>({
    propertyId: "",
    tenantId: "",
    ownerId: "",
    contractType: "",
  });

  const [step2, setStep2] = useState<Step2Data>({
    startDate: "",
    endDate: "",
    monthlyAmount: "",
    depositAmount: "",
    agencyCommission: "",
    paymentDay: "1",
    paymentModality: "A",
    adjustmentIndex: "sin_ajuste",
  });

  // Cargar propiedades disponibles
  const { data: propertiesData } = useQuery({
    queryKey: ["properties", "select"],
    queryFn: async () => {
      const res = await fetch("/api/properties?limit=100");
      if (!res.ok) throw new Error("Error cargando propiedades");
      return res.json();
    },
  });

  // Cargar inquilinos
  const { data: tenantsData } = useQuery({
    queryKey: ["clients", "inquilino", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=inquilino&limit=100");
      if (!res.ok) throw new Error("Error cargando inquilinos");
      return res.json();
    },
  });

  // Cargar propietarios
  const { data: ownersData } = useQuery({
    queryKey: ["clients", "propietario", "select"],
    queryFn: async () => {
      const res = await fetch("/api/clients?type=propietario&limit=100");
      if (!res.ok) throw new Error("Error cargando propietarios");
      return res.json();
    },
  });

  const properties: SelectOption[] =
    propertiesData?.properties?.map(
      (p: { id: string; address: string }) => ({
        id: p.id,
        label: p.address,
      })
    ) ?? [];

  const tenants: SelectOption[] =
    tenantsData?.clients?.map(
      (c: { id: string; firstName: string; lastName: string | null }) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName || ""}`.trim(),
      })
    ) ?? [];

  const owners: SelectOption[] =
    ownersData?.clients?.map(
      (c: { id: string; firstName: string; lastName: string | null }) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName || ""}`.trim(),
      })
    ) ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: step1.propertyId,
          tenantId: step1.tenantId,
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
          paymentDay: parseInt(step2.paymentDay),
          paymentModality: step2.paymentModality,
          adjustmentIndex: step2.adjustmentIndex,
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
    if (!step1.tenantId) errors.tenantId = "Seleccioná un inquilino";
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
  const selectedTenant = tenants.find((t) => t.id === step1.tenantId);
  const selectedOwner = owners.find((o) => o.id === step1.ownerId);

  return (
    <div className="w-full max-w-2xl space-y-8">
      {/* Indicador de pasos */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium border-2 transition-colors ${
                step === s
                  ? "border-foreground bg-foreground text-background"
                  : step > s
                  ? "border-foreground bg-foreground text-background opacity-60"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </div>
            <span
              className={`text-sm ${
                step === s ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {s === 1 ? "Partes" : s === 2 ? "Condiciones" : "Resumen"}
            </span>
            {s < 3 && <div className="h-px w-8 bg-border" />}
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
              <Select
                value={step1.propertyId}
                onValueChange={(v) => setStep1((s) => ({ ...s, propertyId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar propiedad..." />
                </SelectTrigger>
                <SelectContent>
                  {properties.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay propiedades cargadas
                    </SelectItem>
                  ) : (
                    properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {fieldErrors.propertyId && (
                <p className="text-sm text-destructive">{fieldErrors.propertyId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Inquilino <span className="text-destructive">*</span>
              </Label>
              <Select
                value={step1.tenantId}
                onValueChange={(v) => setStep1((s) => ({ ...s, tenantId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar inquilino..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay inquilinos cargados
                    </SelectItem>
                  ) : (
                    tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {fieldErrors.tenantId && (
                <p className="text-sm text-destructive">{fieldErrors.tenantId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Propietario <span className="text-destructive">*</span>
              </Label>
              <Select
                value={step1.ownerId}
                onValueChange={(v) => setStep1((s) => ({ ...s, ownerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar propietario..." />
                </SelectTrigger>
                <SelectContent>
                  {owners.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hay propietarios cargados
                    </SelectItem>
                  ) : (
                    owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={step2.startDate}
                onChange={(e) =>
                  setStep2((s) => ({ ...s, startDate: e.target.value }))
                }
              />
              {fieldErrors.startDate && (
                <p className="text-sm text-destructive">{fieldErrors.startDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Fecha de fin <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={step2.endDate}
                onChange={(e) =>
                  setStep2((s) => ({ ...s, endDate: e.target.value }))
                }
              />
              {fieldErrors.endDate && (
                <p className="text-sm text-destructive">{fieldErrors.endDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Monto mensual ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={step2.monthlyAmount}
                onChange={(e) =>
                  setStep2((s) => ({ ...s, monthlyAmount: e.target.value }))
                }
                placeholder="Ej: 150000"
              />
              {fieldErrors.monthlyAmount && (
                <p className="text-sm text-destructive">
                  {fieldErrors.monthlyAmount}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Depósito ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={step2.depositAmount}
                onChange={(e) =>
                  setStep2((s) => ({ ...s, depositAmount: e.target.value }))
                }
                placeholder="Ej: 300000"
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
                onChange={(e) =>
                  setStep2((s) => ({ ...s, agencyCommission: e.target.value }))
                }
                placeholder="Ej: 5"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Día de pago <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={step2.paymentDay}
                onChange={(e) =>
                  setStep2((s) => ({ ...s, paymentDay: e.target.value }))
                }
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
                onValueChange={(v) =>
                  setStep2((s) => ({ ...s, paymentModality: v as "A" | "B" }))
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

            <div className="space-y-2">
              <Label>Índice de ajuste</Label>
              <Select
                value={step2.adjustmentIndex}
                onValueChange={(v) =>
                  setStep2((s) => ({
                    ...s,
                    adjustmentIndex: v as AdjustmentIndex,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_INDEXES.map((idx) => (
                    <SelectItem key={idx} value={idx}>
                      {ADJUSTMENT_INDEX_LABELS[idx]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="rounded-lg border divide-y text-sm">
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Propiedad</span>
              <span className="font-medium">
                {selectedProperty?.label ?? "-"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Inquilino</span>
              <span className="font-medium">{selectedTenant?.label ?? "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Propietario</span>
              <span className="font-medium">{selectedOwner?.label ?? "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium">
                {step1.contractType
                  ? CONTRACT_TYPE_LABELS[step1.contractType as ContractType]
                  : "-"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Período</span>
              <span className="font-medium">
                {step2.startDate} → {step2.endDate}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Monto mensual</span>
              <span className="font-medium">
                ${parseFloat(step2.monthlyAmount || "0").toLocaleString("es-AR")}
              </span>
            </div>
            {step2.depositAmount && (
              <div className="grid grid-cols-2 gap-2 p-4">
                <span className="text-muted-foreground">Depósito</span>
                <span className="font-medium">
                  ${parseFloat(step2.depositAmount).toLocaleString("es-AR")}
                </span>
              </div>
            )}
            {step2.agencyCommission && (
              <div className="grid grid-cols-2 gap-2 p-4">
                <span className="text-muted-foreground">Comisión</span>
                <span className="font-medium">{step2.agencyCommission}%</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Día de pago</span>
              <span className="font-medium">Día {step2.paymentDay}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Modalidad</span>
              <span className="font-medium">
                {step2.paymentModality === "A"
                  ? "Modalidad A (inmobiliaria)"
                  : "Modalidad B (directo)"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <span className="text-muted-foreground">Índice de ajuste</span>
              <span className="font-medium">
                {ADJUSTMENT_INDEX_LABELS[step2.adjustmentIndex]}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            El contrato se creará en estado <strong>Borrador</strong>. Podés
            actualizarlo más adelante.
          </p>

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
  );
}
