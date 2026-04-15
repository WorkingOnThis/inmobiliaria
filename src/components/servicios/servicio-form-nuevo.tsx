"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  SERVICIO_TIPOS,
  SERVICIO_TIPO_LABELS_CORTOS,
  SERVICIO_TIPO_ICONS,
  TITULAR_TIPOS,
  TITULAR_TIPO_LABELS,
  RESPONSABLE_PAGO_TIPOS,
  RESPONSABLE_PAGO_LABELS,
  type ServicioTipo,
} from "@/lib/servicios/constants";
import { EmpresaCombobox } from "./empresa-combobox";
import { CamposServicio } from "./campos-servicio";

type Props = {
  propertyId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ServicioFormNuevo({ propertyId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo: "luz" as ServicioTipo,
    empresa: "",
    metadatos: {} as Record<string, string>,
    titular: "",
    titularTipo: "propietario",
    responsablePago: "propietario",
    vencimientoDia: "",
    activaBloqueo: true,
  });

  const set = (key: string, value: string | boolean | Record<string, string>) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // El primer campo de metadatos se copia a numeroCuenta para mostrarlo en listas
      const primerCampoKey = Object.keys(form.metadatos)[0];
      const numeroCuenta = primerCampoKey ? (form.metadatos[primerCampoKey] || undefined) : undefined;

      const res = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          tipo: form.tipo,
          empresa: form.empresa || undefined,
          numeroCuenta,
          metadatos: Object.keys(form.metadatos).length > 0 ? form.metadatos : undefined,
          titular: form.titular || undefined,
          titularTipo: form.titularTipo,
          responsablePago: form.responsablePago,
          vencimientoDia: form.vencimientoDia ? parseInt(form.vencimientoDia, 10) : undefined,
          activaBloqueo: form.activaBloqueo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear el servicio");
      toast.success("Servicio agregado");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Tipo */}
      <div>
        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          Tipo de servicio *
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {SERVICIO_TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, tipo: t, metadatos: {} }))}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.65rem] font-semibold transition-colors ${
                form.tipo === t
                  ? "border-border-accent bg-primary-dim text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-base">{SERVICIO_TIPO_ICONS[t]}</span>
              {SERVICIO_TIPO_LABELS_CORTOS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Empresa */}
      <div>
        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          Empresa prestadora
        </label>
        <EmpresaCombobox
          value={form.empresa}
          onChange={(v) => set("empresa", v)}
        />
      </div>

      {/* Campos por tipo (cuenta, contrato, medidor, etc.) */}
      <CamposServicio
        tipo={form.tipo}
        valores={form.metadatos}
        onChange={(v) => set("metadatos", v)}
      />

      {/* Titular */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Titular
          </label>
          <input
            type="text"
            value={form.titular}
            onChange={(e) => set("titular", e.target.value)}
            placeholder="Nombre del titular"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Tipo de titular
          </label>
          <select
            value={form.titularTipo}
            onChange={(e) => set("titularTipo", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1d2022] px-3 py-2 text-sm outline-none focus:border-primary/40"
          >
            {TITULAR_TIPOS.map((t) => (
              <option key={t} value={t}>{TITULAR_TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsable + Vencimiento */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Responsable de pago
          </label>
          <select
            value={form.responsablePago}
            onChange={(e) => set("responsablePago", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1d2022] px-3 py-2 text-sm outline-none focus:border-primary/40"
          >
            {RESPONSABLE_PAGO_TIPOS.map((t) => (
              <option key={t} value={t}>{RESPONSABLE_PAGO_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Día de vencimiento
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={form.vencimientoDia}
            onChange={(e) => set("vencimientoDia", e.target.value)}
            placeholder="Ej: 10"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </div>
      </div>

      {/* Toggle bloqueo */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
        <div>
          <p className="text-sm font-semibold">Activa bloqueo de alquiler</p>
          <p className="mt-0.5 max-w-xs text-[0.67rem] text-muted-foreground">
            Si está activo y el comprobante lleva más de 30 días sin cargarse, el sistema bloquea el registro del pago de alquiler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => set("activaBloqueo", !form.activaBloqueo)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form.activaBloqueo ? "bg-primary" : "bg-white/20"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.activaBloqueo ? "left-[18px]" : "left-0.5"}`}
          />
        </button>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-[#561100] transition-opacity hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Guardando…" : "Agregar servicio"}
        </button>
      </div>
    </form>
  );
}
