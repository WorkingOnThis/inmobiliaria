"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  SERVICIO_TIPOS,
  SERVICIO_TIPO_LABELS,
  SERVICIO_TIPO_ICONS,
  TITULAR_TIPOS,
  TITULAR_TIPO_LABELS,
  RESPONSABLE_PAGO_TIPOS,
  RESPONSABLE_PAGO_LABELS,
} from "@/lib/servicios/constants";

type Props = {
  propertyId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ServicioFormNuevo({ propertyId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo: "luz",
    empresa: "",
    numeroCuenta: "",
    titular: "",
    titularTipo: "propietario",
    responsablePago: "propietario",
    vencimientoDia: "",
    activaBloqueo: true,
  });

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          tipo: form.tipo,
          empresa: form.empresa || undefined,
          numeroCuenta: form.numeroCuenta || undefined,
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
              onClick={() => set("tipo", t)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.65rem] font-semibold transition-colors ${
                form.tipo === t
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-base">{SERVICIO_TIPO_ICONS[t]}</span>
              {SERVICIO_TIPO_LABELS[t].replace("Energía eléctrica", "Luz").replace("Gas natural", "Gas").replace("ABL / Impuesto inmobiliario", "ABL").replace("Seguro del inmueble", "Seguro")}
            </button>
          ))}
        </div>
      </div>

      {/* Empresa */}
      <div>
        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          Empresa prestadora
        </label>
        <input
          type="text"
          value={form.empresa}
          onChange={(e) => set("empresa", e.target.value)}
          placeholder="Ej: EPEC, Ecogas, Aguas Cordobesas…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
        />
      </div>

      {/* Número de cuenta */}
      <div>
        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          N° de cuenta / póliza / partida
        </label>
        <input
          type="text"
          value={form.numeroCuenta}
          onChange={(e) => set("numeroCuenta", e.target.value)}
          placeholder="Ej: 4412-8890-2"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
        />
      </div>

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
