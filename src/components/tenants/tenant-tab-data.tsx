"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit2, Save, X, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TenantCompletenessBar } from "@/components/tenants/tenant-completeness-bar";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressZone: string | null;
  addressCity: string | null;
  addressProvince: string | null;
  birthDate: string | null;
  condicionFiscal: string | null;
  nationality: string | null;
  occupation: string | null;
  internalNotes: string | null;
  status: string;
  createdAt: string;
}

interface TenantTabDataProps {
  tenant: Tenant;
  onStatusChange: () => void;
  focusField?: string | null;
  onFocusHandled?: () => void;
}

type EditableFields = Pick<
  Tenant,
  | "firstName" | "lastName" | "dni" | "cuit" | "phone" | "email"
  | "address" | "addressStreet" | "addressNumber" | "addressZone" | "addressCity" | "addressProvince"
  | "birthDate" | "condicionFiscal" | "nationality"
  | "occupation" | "internalNotes"
>;

// ── DataField ─────────────────────────────────────────────────
function DataField({
  label, value, id, editing, onChange,
  type = "text", placeholder = "", alert = false, mono = false, hint,
}: {
  label: string; value: string | null; id: string; editing: boolean;
  onChange: (val: string) => void; type?: string; placeholder?: string;
  alert?: boolean; mono?: boolean; hint?: string;
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground italic normal-case tracking-normal">
            — {hint}
          </span>
        )}
      </div>
      {editing ? (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Sin cargar"}
          className={cn(
            "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[13.5px] px-3 py-[7px] outline-none focus:border-primary transition-all placeholder:text-muted-foreground",
            mono && "font-mono text-[12.5px]"
          )}
        />
      ) : value ? (
        <div className={cn("text-[13.5px] text-on-surface", mono && "font-mono text-[12.5px]")}>
          {value}
        </div>
      ) : alert ? (
        <div className="text-[12px] text-warning italic flex items-center gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0" />
          Sin cargar — necesario para el contrato
        </div>
      ) : (
        <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
      )}
    </div>
  );
}

function TextareaField({
  label, value, id, editing, onChange, placeholder = "", hint,
}: {
  label: string; value: string | null; id: string; editing: boolean;
  onChange: (val: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground italic normal-case tracking-normal">
            — {hint}
          </span>
        )}
      </div>
      {editing ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Sin cargar"}
          rows={3}
          className="w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[13.5px] px-3 py-[7px] outline-none focus:border-primary transition-all placeholder:text-muted-foreground resize-none"
        />
      ) : value ? (
        <div className="text-[13.5px] text-on-surface whitespace-pre-wrap">{value}</div>
      ) : (
        <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-mid">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function TenantTabData({
  tenant,
  onStatusChange,
  focusField,
  onFocusHandled,
}: TenantTabDataProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"suspendido" | "baja" | null>(null);

  const [form, setForm] = useState<EditableFields>({
    firstName:       tenant.firstName,
    lastName:        tenant.lastName,
    dni:             tenant.dni,
    cuit:            tenant.cuit,
    phone:           tenant.phone,
    email:           tenant.email,
    address:         tenant.address,
    addressStreet:   tenant.addressStreet,
    addressNumber:   tenant.addressNumber,
    addressZone:     tenant.addressZone,
    addressCity:     tenant.addressCity,
    addressProvince: tenant.addressProvince,
    birthDate:       tenant.birthDate,
    condicionFiscal: tenant.condicionFiscal,
    nationality:     tenant.nationality,
    occupation:      tenant.occupation,
    internalNotes:   tenant.internalNotes,
  });

  const setField = (key: keyof EditableFields) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val || null }));

  useEffect(() => {
    if (!focusField) return;
    setEditing(true);
    const timer = setTimeout(() => {
      const el = document.getElementById(`field-${focusField}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el.querySelector("input, select, textarea") as HTMLElement | null)?.focus();
      }
      onFocusHandled?.();
    }, 50);
    return () => clearTimeout(timer);
  }, [focusField, onFocusHandled]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenant.id] });
      toast.success("Cambios guardados");
      setEditing(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm({
      firstName:       tenant.firstName,
      lastName:        tenant.lastName,
      dni:             tenant.dni,
      cuit:            tenant.cuit,
      phone:           tenant.phone,
      email:           tenant.email,
      address:         tenant.address,
      addressStreet:   tenant.addressStreet,
      addressNumber:   tenant.addressNumber,
      addressZone:     tenant.addressZone,
      addressCity:     tenant.addressCity,
      addressProvince: tenant.addressProvince,
      birthDate:       tenant.birthDate,
      condicionFiscal: tenant.condicionFiscal,
      nationality:     tenant.nationality,
      occupation:      tenant.occupation,
      internalNotes:   tenant.internalNotes,
    });
    setEditing(false);
  };

  const handleStatusChange = async (newStatus: "suspendido" | "baja") => {
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenant.id] });
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(newStatus === "baja" ? "Inquilino dado de baja" : "Inquilino suspendido");
      setConfirmStatus(null);
      onStatusChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReactivar = async () => {
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "activo" }),
      });
      if (!res.ok) throw new Error("Error al reactivar");
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenant.id] });
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Inquilino reactivado");
      onStatusChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleChipClick = (fieldId: string) => {
    setEditing(true);
    setTimeout(() => {
      const el = document.getElementById(`field-${fieldId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el.querySelector("input, select, textarea") as HTMLElement | null)?.focus();
      }
    }, 50);
  };

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Completitud */}
      <TenantCompletenessBar tenant={form} onChipClick={handleChipClick} />

      {/* Edit button */}
      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
              <X size={13} /> Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar cambios
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 size={13} /> Editar datos
          </Button>
        )}
      </div>

      {/* Datos personales */}
      <SectionCard title="Datos personales">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <DataField id="firstName" label="Nombre"   value={form.firstName} editing={editing} onChange={setField("firstName")} />
            <DataField id="lastName"  label="Apellido" value={form.lastName}  editing={editing} onChange={setField("lastName")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DataField id="dni"  label="DNI"         value={form.dni}  editing={editing} onChange={setField("dni")}  placeholder="28441100" mono alert />
            <DataField id="cuit" label="CUIT / CUIL" value={form.cuit} editing={editing} onChange={setField("cuit")} placeholder="20-28441100-4" mono />
          </div>

          {/* Condición fiscal */}
          <div className="flex flex-col gap-1" id="field-condicionFiscal">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Condición fiscal
            </div>
            {editing ? (
              <select
                value={form.condicionFiscal ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, condicionFiscal: e.target.value || null }))}
                className="w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[13.5px] px-3 py-[7px] outline-none focus:border-primary transition-all"
              >
                <option value="">Sin especificar</option>
                <option value="responsable_inscripto">Responsable inscripto</option>
                <option value="monotributista">Monotributista</option>
                <option value="exento">Exento</option>
                <option value="consumidor_final">Consumidor final</option>
              </select>
            ) : (
              <div className={cn("text-[13.5px]", !form.condicionFiscal ? "text-muted-foreground italic text-[12px]" : "text-on-surface")}>
                {form.condicionFiscal === "responsable_inscripto" ? "Responsable inscripto"
                  : form.condicionFiscal === "monotributista" ? "Monotributista"
                  : form.condicionFiscal === "exento" ? "Exento"
                  : form.condicionFiscal === "consumidor_final" ? "Consumidor final"
                  : "Sin cargar"}
              </div>
            )}
          </div>

          <div className="border-t border-border" />
          <DataField id="email" label="Email" value={form.email} editing={editing} onChange={setField("email")} type="email" placeholder="usuario@gmail.com" />
          <div className="grid grid-cols-2 gap-4">
            <DataField id="phone"     label="Teléfono"            value={form.phone}     editing={editing} onChange={setField("phone")}     placeholder="351 612-4400" />
            <DataField id="birthDate" label="Fecha de nacimiento" value={form.birthDate} editing={editing} onChange={setField("birthDate")} type="date" mono />
          </div>
          <DataField id="address" label="Domicilio completo" value={form.address} editing={editing} onChange={setField("address")} placeholder="Av. Colón 1234, Córdoba" />
            <div className="grid grid-cols-2 gap-4">
              <DataField id="addressStreet"   label="Calle"     value={form.addressStreet}   editing={editing} onChange={setField("addressStreet")}   placeholder="Av. Colón" />
              <DataField id="addressNumber"   label="Número"    value={form.addressNumber}   editing={editing} onChange={setField("addressNumber")}   placeholder="1234" />
              <DataField id="addressZone"     label="Barrio"    value={form.addressZone}     editing={editing} onChange={setField("addressZone")}     placeholder="Nueva Córdoba" />
              <DataField id="addressCity"     label="Ciudad"    value={form.addressCity}     editing={editing} onChange={setField("addressCity")}     placeholder="Córdoba" />
              <DataField id="addressProvince" label="Provincia" value={form.addressProvince} editing={editing} onChange={setField("addressProvince")} placeholder="Córdoba" />
            </div>
        </div>
      </SectionCard>

      {/* Datos de interés */}
      <SectionCard title="Datos de interés">
        <div className="grid grid-cols-2 gap-4">
          <DataField
            id="nationality" label="Nacionalidad" value={form.nationality}
            editing={editing} onChange={setField("nationality")} placeholder="Argentina"
          />
          <DataField
            id="occupation" label="Ocupación" value={form.occupation}
            editing={editing} onChange={setField("occupation")} placeholder="Ej: Contador, Médico"
          />
          <div className="col-span-2">
            <TextareaField
              id="internalNotes" label="Notas internas" value={form.internalNotes}
              editing={editing} onChange={setField("internalNotes")}
              placeholder="Observaciones útiles para el staff…"
              hint="Solo visible para el equipo"
            />
          </div>
        </div>
      </SectionCard>

      {/* Estado */}
      <SectionCard title="Estado del inquilino">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13.5px] text-text-secondary">Estado actual:</span>
              <span
                className={cn(
                  "status-pill",
                  tenant.status === "activo" ? "status-active"
                    : tenant.status === "suspendido" ? "status-suspended"
                    : "status-baja"
                )}
              >
                {tenant.status === "activo" ? "Activo" : tenant.status === "suspendido" ? "Suspendido" : "Dado de baja"}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {tenant.status === "activo"
                ? "El inquilino está activo."
                : tenant.status === "suspendido"
                ? "El inquilino está suspendido temporalmente."
                : "El inquilino fue dado de baja del sistema."}
            </div>
          </div>
          {tenant.status !== "activo" && (
            <button
              onClick={handleReactivar}
              className="flex-shrink-0 px-3.5 py-2 text-[12px] font-semibold rounded-[6px] transition-all border"
              style={{
                background: "var(--success-dim)",
                color: "var(--success)",
                borderColor: "color-mix(in srgb, var(--success) 20%, transparent)",
              }}
            >
              Reactivar
            </button>
          )}
        </div>
      </SectionCard>

      {/* Zona de riesgo */}
      {tenant.status === "activo" && (
        <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-mid flex items-center gap-2">
            <AlertTriangle size={13} style={{ color: "var(--error)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--error)" }}>
              Zona de riesgo
            </span>
          </div>
          <div className="p-4">
            {confirmStatus ? (
              <div className="flex flex-col gap-3">
                <div className="text-[13px] text-on-surface">
                  ¿Estás seguro de que querés{" "}
                  <strong>{confirmStatus === "suspendido" ? "suspender" : "dar de baja"}</strong>{" "}
                  a este inquilino?
                  {confirmStatus === "baja" && (
                    <span style={{ color: "var(--error)" }}> Esta acción es difícil de revertir.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmStatus(null)}
                    className="px-3.5 py-2 text-[12px] font-semibold text-text-secondary bg-surface-high border border-border rounded-[6px] hover:bg-surface-highest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleStatusChange(confirmStatus)}
                    className="px-3.5 py-2 text-[12px] font-semibold rounded-[6px] transition-all border btn-danger"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 flex-wrap">
                <div>
                  <button onClick={() => setConfirmStatus("suspendido")} className="btn btn-danger btn-sm">
                    Suspender temporalmente
                  </button>
                  <div className="text-[11px] text-muted-foreground mt-1.5">Pausa el contrato, se puede revertir</div>
                </div>
                <div>
                  <button onClick={() => setConfirmStatus("baja")} className="btn btn-danger btn-sm">
                    Dar de baja
                  </button>
                  <div className="text-[11px] text-muted-foreground mt-1.5">Cierra la relación comercial</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
