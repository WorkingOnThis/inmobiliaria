"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit2, Save, X, Loader2, AlertCircle } from "lucide-react";

interface Propietario {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  birthDate: string | null;
  cbu: string | null;
  alias: string | null;
  banco: string | null;
  tipoCuenta: string | null;
  status: string;
}

interface PropietarioTabDatosProps {
  propietario: Propietario;
  onStatusChange: () => void;
  focusField?: string | null;
  onFocusHandled?: () => void;
}

type EditableFields = Omit<Propietario, "id" | "status">;

function DataField({
  label,
  value,
  id,
  editing,
  onChange,
  type = "text",
  placeholder = "Sin cargar",
  alert = false,
  mono = false,
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
}) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1">
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">
        {label}
      </div>
      {editing ? (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-surface-mid border border-border-accent rounded-[12px] text-on-surface text-[0.85rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-text-muted ${
            mono ? "font-mono text-[0.82rem]" : ""
          }`}
        />
      ) : (
        <div
          className={`text-[0.875rem] font-medium ${
            !value
              ? alert
                ? "text-mustard italic font-normal flex items-center gap-1.5"
                : "text-text-muted italic font-normal"
              : `text-on-surface ${mono ? "font-mono text-[0.82rem]" : ""}`
          }`}
        >
          {!value && alert && <AlertCircle size={13} className="flex-shrink-0" />}
          {value || (alert ? "Sin cargar — necesario para liquidar" : "Sin cargar")}
        </div>
      )}
    </div>
  );
}

export function PropietarioTabDatos({
  propietario,
  onStatusChange,
  focusField,
  onFocusHandled,
}: PropietarioTabDatosProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"suspendido" | "baja" | null>(null);

  const [form, setForm] = useState<EditableFields>({
    firstName: propietario.firstName,
    lastName: propietario.lastName,
    dni: propietario.dni,
    cuit: propietario.cuit,
    phone: propietario.phone,
    email: propietario.email,
    address: propietario.address,
    birthDate: propietario.birthDate,
    cbu: propietario.cbu,
    alias: propietario.alias,
    banco: propietario.banco,
    tipoCuenta: propietario.tipoCuenta,
  });

  const setField = (key: keyof EditableFields) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val || null }));

  useEffect(() => {
    if (!focusField) return;
    setEditing(true);
    // Esperamos un tick para que React renderice los inputs antes de hacer scroll
    const timer = setTimeout(() => {
      const el = document.getElementById(`field-${focusField}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el.querySelector("input, select") as HTMLElement | null)?.focus();
      }
      onFocusHandled?.();
    }, 50);
    return () => clearTimeout(timer);
  }, [focusField]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/propietarios/${propietario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      await queryClient.invalidateQueries({ queryKey: ["propietario", propietario.id] });
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
      firstName: propietario.firstName,
      lastName: propietario.lastName,
      dni: propietario.dni,
      cuit: propietario.cuit,
      phone: propietario.phone,
      email: propietario.email,
      address: propietario.address,
      birthDate: propietario.birthDate,
      cbu: propietario.cbu,
      alias: propietario.alias,
      banco: propietario.banco,
      tipoCuenta: propietario.tipoCuenta,
    });
    setEditing(false);
  };

  const handleStatusChange = async (newStatus: "suspendido" | "baja") => {
    try {
      const res = await fetch(`/api/propietarios/${propietario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      await queryClient.invalidateQueries({ queryKey: ["propietario", propietario.id] });
      await queryClient.invalidateQueries({ queryKey: ["propietarios"] });
      toast.success(
        newStatus === "baja" ? "Propietario dado de baja" : "Propietario suspendido"
      );
      setConfirmStatus(null);
      onStatusChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReactivar = async () => {
    try {
      const res = await fetch(`/api/propietarios/${propietario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "activo" }),
      });
      if (!res.ok) throw new Error("Error al reactivar");
      await queryClient.invalidateQueries({ queryKey: ["propietario", propietario.id] });
      await queryClient.invalidateQueries({ queryKey: ["propietarios"] });
      toast.success("Propietario reactivado");
      onStatusChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const cardClass =
    "bg-surface border border-border rounded-[18px] p-5";

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Acciones de edición */}
      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[0.72rem] font-semibold text-text-secondary bg-surface-highest border border-border rounded-[12px] hover:bg-surface-high transition-all disabled:opacity-50"
            >
              <X size={13} /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[0.72rem] font-semibold bg-primary text-primary-foreground rounded-[12px] hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar cambios
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[0.72rem] font-semibold text-text-secondary bg-surface-highest border border-border rounded-[12px] hover:bg-surface-high transition-all"
          >
            <Edit2 size={13} /> Editar datos
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Card: Datos personales */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Datos personales
            </span>
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3.5">
              <DataField
                id="firstName"
                label="Nombre"
                value={form.firstName}
                editing={editing}
                onChange={setField("firstName")}
              />
              <DataField
                id="lastName"
                label="Apellido"
                value={form.lastName}
                editing={editing}
                onChange={setField("lastName")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <DataField
                id="dni"
                label="DNI"
                value={form.dni}
                editing={editing}
                onChange={setField("dni")}
                placeholder="28441100"
              />
              <DataField
                id="cuit"
                label="CUIT / CUIL"
                value={form.cuit}
                editing={editing}
                onChange={setField("cuit")}
                placeholder="20-28441100-4"
              />
            </div>
            <div className="h-px bg-border" />
            <DataField
              id="email"
              label="Email"
              value={form.email}
              editing={editing}
              onChange={setField("email")}
              type="email"
              placeholder="cmendoza@gmail.com"
            />
            <div className="grid grid-cols-2 gap-3.5">
              <DataField
                id="phone"
                label="Teléfono"
                value={form.phone}
                editing={editing}
                onChange={setField("phone")}
                placeholder="351 612-4400"
              />
              <DataField
                id="birthDate"
                label="Fecha de nacimiento"
                value={form.birthDate}
                editing={editing}
                onChange={setField("birthDate")}
                type="date"
              />
            </div>
            <DataField
              id="address"
              label="Domicilio fiscal"
              value={form.address}
              editing={editing}
              onChange={setField("address")}
              placeholder="Av. Colón 1234, Córdoba"
            />
          </div>
        </div>

        {/* Card: Datos bancarios */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Datos bancarios
            </span>
          </div>
          <div className="flex flex-col gap-3.5">
            <DataField
              id="cbu"
              label="CBU / CVU"
              value={form.cbu}
              editing={editing}
              onChange={setField("cbu")}
              placeholder="0000003100012345678900"
              alert={true}
              mono={true}
            />
            <DataField
              id="alias"
              label="Alias"
              value={form.alias}
              editing={editing}
              onChange={setField("alias")}
              placeholder="carlos.mendoza.mp"
            />
            <div className="h-px bg-border" />
            <div className="grid grid-cols-2 gap-3.5">
              <DataField
                id="banco"
                label="Banco"
                value={form.banco}
                editing={editing}
                onChange={setField("banco")}
                placeholder="Banco Nación"
              />
              <div className="flex flex-col gap-1">
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">
                  Tipo de cuenta
                </div>
                {editing ? (
                  <select
                    value={form.tipoCuenta ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tipoCuenta: e.target.value || null,
                      }))
                    }
                    className="w-full bg-surface-mid border border-border-accent rounded-[12px] text-on-surface text-[0.85rem] px-3 py-2 outline-none focus:border-primary transition-all"
                  >
                    <option value="">Sin especificar</option>
                    <option value="caja_ahorro">Caja de ahorro</option>
                    <option value="cuenta_corriente">Cuenta corriente</option>
                  </select>
                ) : (
                  <div
                    className={`text-[0.875rem] font-medium ${
                      !form.tipoCuenta ? "text-text-muted italic font-normal" : "text-on-surface"
                    }`}
                  >
                    {form.tipoCuenta === "caja_ahorro"
                      ? "Caja de ahorro"
                      : form.tipoCuenta === "cuenta_corriente"
                      ? "Cuenta corriente"
                      : "Sin cargar"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card: Estado del propietario */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-text-muted">
            Estado del propietario
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-[0.875rem] text-on-surface">
              Estado actual:{" "}
              <span
                className={`font-semibold ${
                  propietario.status === "activo"
                    ? "text-green"
                    : propietario.status === "suspendido"
                    ? "text-mustard"
                    : "text-error"
                }`}
              >
                {propietario.status === "activo"
                  ? "Activo"
                  : propietario.status === "suspendido"
                  ? "Suspendido"
                  : "Dado de baja"}
              </span>
            </div>
            <div className="text-[0.72rem] text-text-muted mt-1">
              {propietario.status === "activo"
                ? "El propietario está activo y puede recibir liquidaciones."
                : propietario.status === "suspendido"
                ? "Las liquidaciones están pausadas temporalmente."
                : "El propietario fue dado de baja del sistema."}
            </div>
          </div>
          {propietario.status !== "activo" && (
            <button
              onClick={handleReactivar}
              className="px-3.5 py-2 text-[0.72rem] font-semibold bg-green-dim text-green border border-green/20 rounded-[12px] hover:bg-green/20 transition-all"
            >
              Reactivar
            </button>
          )}
        </div>
      </div>

      {/* Danger zone */}
      {propietario.status === "activo" && (
        <div className="bg-surface border border-error-dim rounded-[18px] p-5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-error mb-3">
            Zona de riesgo
          </div>
          {confirmStatus ? (
            <div className="flex flex-col gap-3">
              <div className="text-[0.82rem] text-on-surface">
                ¿Estás seguro de que querés{" "}
                <strong>
                  {confirmStatus === "suspendido" ? "suspender" : "dar de baja"}
                </strong>{" "}
                a este propietario?
                {confirmStatus === "baja" && (
                  <span className="text-error"> Esta acción es difícil de revertir.</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmStatus(null)}
                  className="px-3.5 py-2 text-[0.72rem] font-semibold text-text-secondary bg-surface-highest border border-border rounded-[12px] hover:bg-surface-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleStatusChange(confirmStatus)}
                  className={`px-3.5 py-2 text-[0.72rem] font-semibold rounded-[12px] transition-all ${
                    confirmStatus === "baja"
                      ? "bg-error-dim text-error border border-error/20 hover:bg-error/20"
                      : "bg-mustard-dim text-mustard border border-mustard/20 hover:bg-mustard/25"
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5 flex-wrap">
              <div>
                <button
                  onClick={() => setConfirmStatus("suspendido")}
                  className="px-3.5 py-2 text-[0.72rem] font-semibold bg-mustard-dim text-mustard border border-mustard/20 rounded-[12px] hover:bg-mustard/25 transition-all"
                >
                  Suspender temporalmente
                </button>
                <div className="text-[0.65rem] text-text-muted mt-1.5">
                  Pausa las liquidaciones, se puede revertir
                </div>
              </div>
              <div>
                <button
                  onClick={() => setConfirmStatus("baja")}
                  className="px-3.5 py-2 text-[0.72rem] font-semibold bg-error-dim text-error border border-error/20 rounded-[12px] hover:bg-error/20 transition-all"
                >
                  Dar de baja
                </button>
                <div className="text-[0.65rem] text-text-muted mt-1.5">
                  Cierra la relación comercial
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
