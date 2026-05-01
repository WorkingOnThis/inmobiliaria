"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { FileText, User, ChevronRight, Save, X, Loader2, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { GUARANTEE_KIND_LABELS, type GuaranteeKind } from "@/lib/guarantees/constants";

interface SalaryInfo {
  id: string;
  guaranteeId: string;
  employerName: string | null;
  employerAddress: string | null;
  employerPhone: string | null;
  jobTitle: string | null;
  jobStartDate: string | null;
  employmentType: string | null;
  monthlyGrossSalary: string | null;
  cuitEmpleador: string | null;
  notes: string | null;
}

interface GuaranteeRow {
  guarantee: {
    id: string;
    kind: string;
    status: string;
    contractId: string;
    tenantClientId: string;
    depositAmount: string | null;
    depositCurrency: string | null;
    depositHeldBy: string | null;
    depositNotes: string | null;
  };
  contract: {
    id: string;
    contractNumber: string;
    status: string;
  };
  tenant: { id: string; firstName: string; lastName: string | null } | null;
  salaryInfo: SalaryInfo | null;
  property: { id: string; address: string; type: string } | null;
}

interface Props {
  guaranteeRows: GuaranteeRow[];
  guarantorId: string;
  onSalaryInfoSaved: () => void;
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  active: "Vigente",
  expiring_soon: "Por vencer",
  expired: "Vencido",
  terminated: "Rescindido",
  draft: "Borrador",
  pending_signature: "Pendiente firma",
};

type SalaryForm = {
  employerName: string;
  employerAddress: string;
  employerPhone: string;
  jobTitle: string;
  jobStartDate: string;
  employmentType: string;
  monthlyGrossSalary: string;
  cuitEmpleador: string;
  notes: string;
};

function toForm(si: SalaryInfo | null): SalaryForm {
  return {
    employerName:        si?.employerName ?? "",
    employerAddress:     si?.employerAddress ?? "",
    employerPhone:       si?.employerPhone ?? "",
    jobTitle:            si?.jobTitle ?? "",
    jobStartDate:        si?.jobStartDate ?? "",
    employmentType:      si?.employmentType ?? "",
    monthlyGrossSalary:  si?.monthlyGrossSalary ?? "",
    cuitEmpleador:       si?.cuitEmpleador ?? "",
    notes:               si?.notes ?? "",
  };
}

function SalaryInfoSection({
  guaranteeId,
  salaryInfo,
  onSaved,
}: {
  guaranteeId: string;
  salaryInfo: SalaryInfo | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!salaryInfo);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SalaryForm>(toForm(salaryInfo));

  const setField = (key: keyof SalaryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const inputCls = "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[13px] px-3 py-[7px] outline-none focus:border-primary transition-all placeholder:text-muted-foreground";
  const labelCls = "text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v || null;
      }
      const res = await fetch(`/api/guarantees/${guaranteeId}/salary-info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      toast.success("Ficha laboral guardada");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Ficha laboral
        </span>
        {!editing && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEditing(true)}>
            <Edit2 size={11} /> Editar
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Empleador</label>
              <input className={inputCls} value={form.employerName} onChange={setField("employerName")} placeholder="Nombre de la empresa" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>CUIT empleador</label>
              <input className={cn(inputCls, "font-mono text-[12px]")} value={form.cuitEmpleador} onChange={setField("cuitEmpleador")} placeholder="30-12345678-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Cargo / Puesto</label>
              <input className={inputCls} value={form.jobTitle} onChange={setField("jobTitle")} placeholder="Ej: Contador" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Tipo de empleo</label>
              <select
                className={inputCls}
                value={form.employmentType}
                onChange={setField("employmentType")}
              >
                <option value="">Sin especificar</option>
                <option value="relacion_dependencia">Relación de dependencia</option>
                <option value="monotributo">Monotributo</option>
                <option value="autonomo">Autónomo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Salario bruto mensual</label>
              <input className={inputCls} value={form.monthlyGrossSalary} onChange={setField("monthlyGrossSalary")} placeholder="0.00" type="number" min="0" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Fecha de ingreso</label>
              <DatePicker value={form.jobStartDate} onChange={(v) => setForm((prev) => ({ ...prev, jobStartDate: v }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Domicilio empleador</label>
            <input className={inputCls} value={form.employerAddress} onChange={setField("employerAddress")} placeholder="Dirección de la empresa" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Notas</label>
            <textarea
              className={cn(inputCls, "resize-none")}
              rows={2}
              value={form.notes}
              onChange={setField("notes")}
              placeholder="Observaciones adicionales"
            />
          </div>
          <div className="flex gap-2 justify-end">
            {salaryInfo && (
              <Button variant="outline" size="sm" onClick={() => { setForm(toForm(salaryInfo)); setEditing(false); }} disabled={saving}>
                <X size={12} /> Cancelar
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            { label: "Empleador",   value: form.employerName },
            { label: "CUIT emp.",   value: form.cuitEmpleador },
            { label: "Cargo",       value: form.jobTitle },
            { label: "Tipo empleo", value: form.employmentType === "relacion_dependencia" ? "Rel. dependencia" : form.employmentType || null },
            { label: "Salario",     value: form.monthlyGrossSalary ? `$ ${Number(form.monthlyGrossSalary).toLocaleString("es-AR")}` : null },
            { label: "Ingreso",     value: form.jobStartDate || null },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
              {value ? (
                <span className="text-[13px] text-on-surface">{value}</span>
              ) : (
                <span className="text-[12px] text-muted-foreground italic">Sin cargar</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuarantorTabGuarantees({ guaranteeRows, onSalaryInfoSaved }: Props) {
  if (guaranteeRows.length === 0) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
        <div className="size-12 rounded-full bg-surface-mid flex items-center justify-center">
          <User size={22} className="text-muted-foreground" />
        </div>
        <div className="text-[0.85rem] text-muted-foreground">Sin garantías registradas</div>
      </div>
    );
  }

  return (
    <div className="p-7 flex flex-col gap-4">
      {guaranteeRows.map((row) => {
        const tenantName = row.tenant
          ? row.tenant.lastName
            ? `${row.tenant.firstName} ${row.tenant.lastName}`
            : row.tenant.firstName
          : "Inquilino desvinculado";

        return (
          <div key={row.guarantee.id} className="bg-surface border border-border rounded-[10px] overflow-hidden">
            {/* Header de la card */}
            <div className="px-4 py-3 bg-surface-mid border-b border-border flex items-center gap-3">
              <Badge
                variant="secondary"
                className="text-[10px] px-[7px] py-[2px] h-auto rounded-[4px] font-normal normal-case tracking-normal leading-none"
              >
                {GUARANTEE_KIND_LABELS[row.guarantee.kind as GuaranteeKind] ?? row.guarantee.kind}
              </Badge>
              <Badge
                className="text-[10px] px-[7px] py-[2px] h-auto rounded-[4px] bg-surface border-border normal-case tracking-normal font-normal leading-none"
              >
                {CONTRACT_STATUS_LABELS[row.contract.status] ?? row.contract.status}
              </Badge>
            </div>

            <div className="p-4">
              {/* Contrato */}
              <Link
                href={`/contratos/${row.contract.id}`}
                className="flex items-center gap-2 mb-3 group"
              >
                <div className="size-7 rounded-[6px] bg-surface-mid flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-on-surface group-hover:text-primary transition-colors">
                    {row.contract.contractNumber}
                  </div>
                  {row.property && (
                    <div className="text-[11.5px] text-muted-foreground truncate">{row.property.address}</div>
                  )}
                </div>
                <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </Link>

              {/* Inquilino */}
              {row.tenant && (
                <Link
                  href={`/inquilinos/${row.tenant.id}`}
                  className="flex items-center gap-2 group"
                >
                  <div className="size-7 rounded-full bg-surface-mid flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-muted-foreground">
                    {[row.tenant.firstName, row.tenant.lastName]
                      .filter(Boolean)
                      .map((s) => s![0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-on-surface group-hover:text-primary transition-colors">{tenantName}</div>
                    <div className="text-[11px] text-muted-foreground">Inquilino</div>
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>
              )}

              {/* Ficha laboral para salaryReceipt */}
              {row.guarantee.kind === "salaryReceipt" && (
                <SalaryInfoSection
                  guaranteeId={row.guarantee.id}
                  salaryInfo={row.salaryInfo}
                  onSaved={onSalaryInfoSaved}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
