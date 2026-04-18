"use client";

import { SERVICE_FIELDS, type ServiceType } from "@/lib/services/constants";

type Props = {
  type: ServiceType;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  inputClassName?: string;
};

export function ServiceFields({ type, values, onChange, inputClassName }: Props) {
  const fields = SERVICE_FIELDS[type] ?? [];

  const baseInputClass =
    inputClassName ??
    "w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40";

  function handleChange(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  if (fields.length === 0) return null;

  return (
    <div className={fields.length > 1 ? "grid grid-cols-2 gap-3" : ""}>
      {fields.map((field) => (
        <div key={field.key}>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            {field.label}
          </label>
          <input
            type="text"
            value={values[field.key] ?? ""}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? ""}
            className={`${baseInputClass}${field.mono ? " font-mono" : ""}`}
          />
        </div>
      ))}
    </div>
  );
}
