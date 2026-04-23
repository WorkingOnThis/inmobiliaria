"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit2, Save, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GuarantorCompletenessBar } from "@/components/guarantors/guarantor-completeness-bar";

interface Guarantor {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  birthDate: string | null;
  nationality: string | null;
  occupation: string | null;
  internalNotes: string | null;
}

interface Props {
  guarantor: Guarantor;
}

type EditableFields = Omit<Guarantor, "id">;

function DataField({
  label, value, id, editing, onChange, type = "text", placeholder = "", mono = false,
}: {
  label: string; value: string | null; id: string; editing: boolean;
  onChange: (val: string) => void; type?: string; placeholder?: string; mono?: boolean;
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
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
        <div className={cn("text-[13.5px] text-on-surface", mono && "font-mono text-[12.5px]")}>{value}</div>
      ) : (
        <div className="text-[12px] text-muted-foreground italic">Sin cargar</div>
      )}
    </div>
  );
}

function TextareaField({
  label, value, id, editing, onChange, placeholder = "",
}: {
  label: string; value: string | null; id: string; editing: boolean;
  onChange: (val: string) => void; placeholder?: string;
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
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

export function GuarantorTabData({ guarantor }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<EditableFields>({
    firstName:    guarantor.firstName,
    lastName:     guarantor.lastName,
    dni:          guarantor.dni,
    cuit:         guarantor.cuit,
    phone:        guarantor.phone,
    email:        guarantor.email,
    address:      guarantor.address,
    birthDate:    guarantor.birthDate,
    nationality:  guarantor.nationality,
    occupation:   guarantor.occupation,
    internalNotes: guarantor.internalNotes,
  });

  const setField = (key: keyof EditableFields) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val || null }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/guarantors/${guarantor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["guarantor", guarantor.id] });
      toast.success("Cambios guardados");
      setEditing(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      firstName:    guarantor.firstName,
      lastName:     guarantor.lastName,
      dni:          guarantor.dni,
      cuit:         guarantor.cuit,
      phone:        guarantor.phone,
      email:        guarantor.email,
      address:      guarantor.address,
      birthDate:    guarantor.birthDate,
      nationality:  guarantor.nationality,
      occupation:   guarantor.occupation,
      internalNotes: guarantor.internalNotes,
    });
    setEditing(false);
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
      <GuarantorCompletenessBar guarantor={form} onChipClick={handleChipClick} />

      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
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
          <div className="border-t border-border" />
          <DataField id="email" label="Email" value={form.email} editing={editing} onChange={setField("email")} type="email" placeholder="usuario@gmail.com" />
          <div className="grid grid-cols-2 gap-4">
            <DataField id="phone"     label="Teléfono"            value={form.phone}     editing={editing} onChange={setField("phone")}     placeholder="351 612-4400" />
            <DataField id="birthDate" label="Fecha de nacimiento" value={form.birthDate} editing={editing} onChange={setField("birthDate")} type="date" mono />
          </div>
          <DataField id="address" label="Domicilio" value={form.address} editing={editing} onChange={setField("address")} placeholder="Av. Colón 1234, Córdoba" />
        </div>
      </SectionCard>

      <SectionCard title="Datos de interés">
        <div className="grid grid-cols-2 gap-4">
          <DataField id="nationality" label="Nacionalidad" value={form.nationality} editing={editing} onChange={setField("nationality")} placeholder="Argentina" />
          <DataField id="occupation"  label="Ocupación"    value={form.occupation}  editing={editing} onChange={setField("occupation")}  placeholder="Ej: Contador, Médico" />
          <div className="col-span-2">
            <TextareaField
              id="internalNotes" label="Notas internas" value={form.internalNotes}
              editing={editing} onChange={setField("internalNotes")}
              placeholder="Observaciones útiles para el staff…"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
