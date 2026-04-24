"use client";

import { PROVINCES } from "@/lib/argentina/locations";

interface ProvinceSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ProvinceSelect({ value, onChange, className }: ProvinceSelectProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[13.5px] px-3 py-[7px] outline-none focus:border-primary transition-all"
      }
    >
      <option value="">Sin especificar</option>
      {PROVINCES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
