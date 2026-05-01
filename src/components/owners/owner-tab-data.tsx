"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit2, Save, X, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZoneCombobox } from "@/components/ui/zone-combobox";
import { CityCombobox } from "@/components/ui/city-combobox";
import { ProvinceSelect } from "@/components/ui/province-select";
import { OwnerCompletenessBar } from "@/components/owners/owner-completeness-bar";

const NONE_SENTINEL = "__none__";

interface Owner {
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
  cbu: string | null;
  alias: string | null;
  bank: string | null;
  accountType: string | null;
  condicionFiscal: string | null;
  nationality: string | null;
  occupation: string | null;
  internalNotes: string | null;
  confianzaNombre: string | null;
  confianzaApellido: string | null;
  confianzaDni: string | null;
  confianzaEmail: string | null;
  confianzaTelefono: string | null;
  confianzaVinculo: string | null;
  status: string;
  createdAt: string;
}

interface OwnerTabDataProps {
  owner: Owner;
  onStatusChange: () => void;
  focusField?: string | null;
  onFocusHandled?: () => void;
}

type EditableFields = Omit<Owner, "id" | "status" | "createdAt">;

// ── DataField ────────────────────────────────────────────────
function DataField({
  label,
  value,
  id,
  editing,
  onChange,
  type = "text",
  placeholder = "",
  alert = false,
  mono = false,
  hint,
}: {
  label: string;
  value: string | null;
  id: string;
  editing: boolean;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  alert?: boolean;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground italic normal-case tracking-normal">
            ({hint})
          </span>
        )}
      </div>
      {editing ? (
        type === "date" ? (
          <DatePicker value={value ?? ""} onChange={onChange} />
        ) : (
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
        )
      ) : value ? (
        <div className={cn("text-[13.5px] text-on-surface", mono && "font-mono text-[12.5px]")}>
          {value}
        </div>
      ) : alert ? (
        <div className="text-[12px] text-warning italic flex items-center gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0" />
          Sin cargar — necesario para liquidar
        </div>
      ) : (
        <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
      )}
    </div>
  );
}

function TextareaField({
  label,
  value,
  id,
  editing,
  onChange,
  placeholder = "",
  hint,
}: {
  label: string;
  value: string | null;
  id: string;
  editing: boolean;
  onChange: (val: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground italic normal-case tracking-normal">
            ({hint})
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

// ── Card wrapper ─────────────────────────────────────────────
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

// ── Main component ────────────────────────────────────────────
export function OwnerTabData({
  owner,
  onStatusChange,
  focusField,
  onFocusHandled,
}: OwnerTabDataProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"suspendido" | "baja" | null>(null);

  const [form, setForm] = useState<EditableFields>({
    firstName:        owner.firstName,
    lastName:         owner.lastName,
    dni:              owner.dni,
    cuit:             owner.cuit,
    phone:            owner.phone,
    email:            owner.email,
    address:          owner.address,
    addressStreet:    owner.addressStreet,
    addressNumber:    owner.addressNumber,
    addressZone:      owner.addressZone,
    addressCity:      owner.addressCity,
    addressProvince:  owner.addressProvince,
    birthDate:        owner.birthDate,
    cbu:              owner.cbu,
    alias:            owner.alias,
    bank:             owner.bank,
    accountType:      owner.accountType,
    condicionFiscal:  owner.condicionFiscal,
    nationality:      owner.nationality,
    occupation:       owner.occupation,
    internalNotes:    owner.internalNotes,
    confianzaNombre:  owner.confianzaNombre,
    confianzaApellido: owner.confianzaApellido,
    confianzaDni:     owner.confianzaDni,
    confianzaEmail:   owner.confianzaEmail,
    confianzaTelefono: owner.confianzaTelefono,
    confianzaVinculo: owner.confianzaVinculo,
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
      const res = await fetch(`/api/owners/${owner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["propietario", owner.id] });
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
      firstName:        owner.firstName,
      lastName:         owner.lastName,
      dni:              owner.dni,
      cuit:             owner.cuit,
      phone:            owner.phone,
      email:            owner.email,
      address:          owner.address,
      addressStreet:    owner.addressStreet,
      addressNumber:    owner.addressNumber,
      addressZone:      owner.addressZone,
      addressCity:      owner.addressCity,
      addressProvince:  owner.addressProvince,
      birthDate:        owner.birthDate,
      cbu:              owner.cbu,
      alias:            owner.alias,
      bank:             owner.bank,
      accountType:      owner.accountType,
      condicionFiscal:  owner.condicionFiscal,
      nationality:      owner.nationality,
      occupation:       owner.occupation,
      internalNotes:    owner.internalNotes,
      confianzaNombre:  owner.confianzaNombre,
      confianzaApellido: owner.confianzaApellido,
      confianzaDni:     owner.confianzaDni,
      confianzaEmail:   owner.confianzaEmail,
      confianzaTelefono: owner.confianzaTelefono,
      confianzaVinculo: owner.confianzaVinculo,
    });
    setEditing(false);
  };

  const handleStatusChange = async (newStatus: "suspendido" | "baja") => {
    try {
      const res = await fetch(`/api/owners/${owner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      await queryClient.invalidateQueries({ queryKey: ["propietario", owner.id] });
      await queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast.success(newStatus === "baja" ? "Propietario dado de baja" : "Propietario suspendido");
      setConfirmStatus(null);
      onStatusChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReactivar = async () => {
    try {
      const res = await fetch(`/api/owners/${owner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "activo" }),
      });
      if (!res.ok) throw new Error("Error al reactivar");
      await queryClient.invalidateQueries({ queryKey: ["propietario", owner.id] });
      await queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast.success("Propietario reactivado");
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
      {/* Barra de completitud — usa form para reflejar cambios locales en tiempo real */}
      <OwnerCompletenessBar owner={form} onChipClick={handleChipClick} />

      {/* Botón editar — top right */}
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

      {/* ── 2 columnas: personales + bancarios ── */}
      <div className="grid grid-cols-[2fr_1fr] gap-5">
        {/* Datos personales */}
        <SectionCard title="Datos personales">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <DataField id="firstName" label="Nombre"   value={form.firstName} editing={editing} onChange={setField("firstName")} />
              <DataField id="lastName"  label="Apellido" value={form.lastName}  editing={editing} onChange={setField("lastName")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DataField id="dni"  label="DNI"         value={form.dni}  editing={editing} onChange={setField("dni")}  placeholder="28441100" mono />
              <DataField id="cuit" label="CUIT / CUIL" value={form.cuit} editing={editing} onChange={setField("cuit")} placeholder="20-28441100-4" mono />
            </div>
            {/* Condición fiscal */}
            <div className="flex flex-col gap-1" id="field-condicionFiscal">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Condición fiscal
              </div>
              {editing ? (
                <Select
                  value={form.condicionFiscal ?? NONE_SENTINEL}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, condicionFiscal: v === NONE_SENTINEL ? null : v }))}
                >
                  <SelectTrigger className="h-[34px] text-[13.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SENTINEL}>Sin especificar</SelectItem>
                    <SelectItem value="responsable_inscripto">Responsable inscripto</SelectItem>
                    <SelectItem value="monotributista">Monotributista</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                    <SelectItem value="consumidor_final">Consumidor final</SelectItem>
                  </SelectContent>
                </Select>
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
            <DataField id="email" label="Email" value={form.email} editing={editing} onChange={setField("email")} type="email" placeholder="cmendoza@gmail.com" />
            <div className="grid grid-cols-2 gap-4">
              <DataField id="phone"     label="Teléfono"            value={form.phone}     editing={editing} onChange={setField("phone")}     placeholder="351 612-4400" />
              <DataField id="birthDate" label="Fecha de nacimiento" value={form.birthDate} editing={editing} onChange={setField("birthDate")} type="date" mono />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DataField id="addressStreet"   label="Calle"     value={form.addressStreet}   editing={editing} onChange={setField("addressStreet")}   placeholder="Av. Colón" />
              <DataField id="addressNumber"   label="Número"    value={form.addressNumber}   editing={editing} onChange={setField("addressNumber")}   placeholder="1234" />
              <div id="field-addressZone" className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Barrio</span>
                {editing ? (
                  <ZoneCombobox value={form.addressZone ?? ""} onChange={setField("addressZone")} />
                ) : form.addressZone ? (
                  <div className="text-[13.5px] text-on-surface">{form.addressZone}</div>
                ) : (
                  <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
                )}
              </div>
              <div id="field-addressCity" className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Ciudad</span>
                {editing ? (
                  <CityCombobox value={form.addressCity ?? ""} onChange={setField("addressCity")} />
                ) : form.addressCity ? (
                  <div className="text-[13.5px] text-on-surface">{form.addressCity}</div>
                ) : (
                  <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
                )}
              </div>
              <div id="field-addressProvince" className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Provincia</span>
                {editing ? (
                  <ProvinceSelect value={form.addressProvince ?? ""} onChange={setField("addressProvince")} />
                ) : form.addressProvince ? (
                  <div className="text-[13.5px] text-on-surface">{form.addressProvince}</div>
                ) : (
                  <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Datos bancarios */}
        <SectionCard title="Datos bancarios">
          <div className="flex flex-col gap-4">
            <DataField id="cbu"   label="CBU / CVU" value={form.cbu}   editing={editing} onChange={setField("cbu")}   placeholder="0000003100012345678900" alert mono />
            <DataField id="alias" label="Alias"     value={form.alias} editing={editing} onChange={setField("alias")} placeholder="carlos.mendoza.mp" />
            <div className="border-t border-border" />
            <DataField id="bank" label="Banco" value={form.bank} editing={editing} onChange={setField("bank")} placeholder="Banco Nación" />
            {/* Tipo de cuenta */}
            <div className="flex flex-col gap-1" id="field-accountType">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Tipo de cuenta
              </div>
              {editing ? (
                <Select
                  value={form.accountType ?? NONE_SENTINEL}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, accountType: v === NONE_SENTINEL ? null : v }))}
                >
                  <SelectTrigger className="h-[34px] text-[13.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SENTINEL}>Sin especificar</SelectItem>
                    <SelectItem value="caja_ahorro">Caja de ahorro</SelectItem>
                    <SelectItem value="cuenta_corriente">Cuenta corriente</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn("text-[13.5px]", !form.accountType ? "text-muted-foreground italic text-[12px]" : "text-on-surface")}>
                  {form.accountType === "caja_ahorro"
                    ? "Caja de ahorro"
                    : form.accountType === "cuenta_corriente"
                    ? "Cuenta corriente"
                    : "Sin cargar"}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Datos de interés ── */}
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

      {/* ── Persona de confianza ── */}
      <SectionCard title="Persona de confianza">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <DataField id="confianzaNombre"   label="Nombre"   value={form.confianzaNombre}   editing={editing} onChange={setField("confianzaNombre")} />
            <DataField id="confianzaApellido" label="Apellido" value={form.confianzaApellido} editing={editing} onChange={setField("confianzaApellido")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DataField id="confianzaDni"     label="DNI"      value={form.confianzaDni}     editing={editing} onChange={setField("confianzaDni")}     mono placeholder="28441100" />
            <DataField id="confianzaVinculo" label="Vínculo"  value={form.confianzaVinculo} editing={editing} onChange={setField("confianzaVinculo")} placeholder="Ej: cónyuge, familiar, apoderado" hint="Relación con el owner" />
          </div>
          <DataField id="confianzaEmail"    label="Email"    value={form.confianzaEmail}    editing={editing} onChange={setField("confianzaEmail")}    type="email" placeholder="contacto@gmail.com" />
          <DataField id="confianzaTelefono" label="Teléfono" value={form.confianzaTelefono} editing={editing} onChange={setField("confianzaTelefono")} placeholder="351 612-4400" />
        </div>
      </SectionCard>

      {/* ── Estado del owner ── */}
      <SectionCard title="Estado del propietario">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13.5px] text-text-secondary">Estado actual:</span>
              <span
                className={cn(
                  "status-pill",
                  owner.status === "activo"
                    ? "status-active"
                    : owner.status === "suspendido"
                    ? "status-suspended"
                    : "status-baja"
                )}
              >
                {owner.status === "activo" ? "Activo" : owner.status === "suspendido" ? "Suspendido" : "Dado de baja"}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {owner.status === "activo"
                ? "El propietario está activo y puede recibir liquidaciones."
                : owner.status === "suspendido"
                ? "Las liquidaciones están pausadas temporalmente."
                : "El propietario fue dado de baja del sistema."}
            </div>
          </div>
          {owner.status !== "activo" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReactivar}
              className="flex-shrink-0 border-[color-mix(in_srgb,var(--success)_30%,transparent)] text-[var(--success)] hover:bg-[var(--success-dim)] hover:text-[var(--success)]"
            >
              Reactivar
            </Button>
          )}
        </div>
      </SectionCard>

      {/* ── Zona de riesgo ── */}
      {owner.status === "activo" && (
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
                  a este propietario?
                  {confirmStatus === "baja" && (
                    <span style={{ color: "var(--error)" }}> Esta acción es difícil de revertir.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmStatus(null)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleStatusChange(confirmStatus)}>
                    Confirmar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 flex-wrap">
                <div>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmStatus("suspendido")}>
                    Suspender temporalmente
                  </Button>
                  <div className="text-[11px] text-muted-foreground mt-1.5">Pausa las liquidaciones, se puede revertir</div>
                </div>
                <div>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmStatus("baja")}>
                    Dar de baja
                  </Button>
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
