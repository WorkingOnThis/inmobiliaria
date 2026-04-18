"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_SHORT_LABELS,
  SERVICE_TYPE_ICONS,
  HOLDER_TYPES,
  HOLDER_TYPE_LABELS,
  PAYMENT_RESPONSIBLE_TYPES,
  PAYMENT_RESPONSIBLE_LABELS,
  type ServiceType,
} from "@/lib/services/constants";
import { CompanyCombobox } from "./company-combobox";
import { ServiceFields } from "./service-fields";

type Props = {
  propertyId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ServiceFormNew({ propertyId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "electricity" as ServiceType,
    company: "",
    metadata: {} as Record<string, string>,
    holder: "",
    holderType: "propietario",
    paymentResponsible: "propietario",
    dueDay: "",
    activatesBlock: true,
  });

  const set = (key: string, value: string | boolean | Record<string, string>) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // First metadata field is copied to accountNumber for display in lists
      const firstFieldKey = Object.keys(form.metadata)[0];
      const accountNumber = firstFieldKey ? (form.metadata[firstFieldKey] || undefined) : undefined;

      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          tipo: form.type,
          company: form.company || undefined,
          accountNumber: accountNumber,
          metadata: Object.keys(form.metadata).length > 0 ? form.metadata : undefined,
          holder: form.holder || undefined,
          holderType: form.holderType,
          paymentResponsible: form.paymentResponsible,
          dueDay: form.dueDay ? parseInt(form.dueDay, 10) : undefined,
          triggersBlock: form.activatesBlock,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error creating service");
      toast.success("Service added");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Type */}
      <div>
        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          Service type *
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {SERVICE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, type: t, metadata: {} }))}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.65rem] font-semibold transition-colors ${
                form.type === t
                  ? "border-border-accent bg-primary-dim text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-base">{SERVICE_TYPE_ICONS[t]}</span>
              {SERVICE_TYPE_SHORT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Company */}
      <div>
        <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          Service provider
        </label>
        <CompanyCombobox
          value={form.company}
          onChange={(v) => set("company", v)}
        />
      </div>

      {/* Fields by type (account, contract, meter, etc.) */}
      <ServiceFields
        type={form.type}
        values={form.metadata}
        onChange={(v) => set("metadata", v)}
      />

      {/* Holder */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Holder
          </label>
          <input
            type="text"
            value={form.holder}
            onChange={(e) => set("holder", e.target.value)}
            placeholder="Holder name"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Holder type
          </label>
          <select
            value={form.holderType}
            onChange={(e) => set("holderType", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1d2022] px-3 py-2 text-sm outline-none focus:border-primary/40"
          >
            {HOLDER_TYPES.map((t) => (
              <option key={t} value={t}>{HOLDER_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payment responsible + Due day */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Payment responsible
          </label>
          <select
            value={form.paymentResponsible}
            onChange={(e) => set("paymentResponsible", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1d2022] px-3 py-2 text-sm outline-none focus:border-primary/40"
          >
            {PAYMENT_RESPONSIBLE_TYPES.map((t) => (
              <option key={t} value={t}>{PAYMENT_RESPONSIBLE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            Due day
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={form.dueDay}
            onChange={(e) => set("dueDay", e.target.value)}
            placeholder="Eg: 10"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </div>
      </div>

      {/* Activate block toggle */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
        <div>
          <p className="text-sm font-semibold">Activates rent block</p>
          <p className="mt-0.5 max-w-xs text-[0.67rem] text-muted-foreground">
            If active and the receipt hasn't been loaded for more than 30 days, the system blocks rent payment registration.
          </p>
        </div>
        <button
          type="button"
          onClick={() => set("activatesBlock", !form.activatesBlock)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form.activatesBlock ? "bg-primary" : "bg-white/20"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.activatesBlock ? "left-[18px]" : "left-0.5"}`}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-[#561100] transition-opacity hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Add service"}
        </button>
      </div>
    </form>
  );
}
