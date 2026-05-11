"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

interface ZoneComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showCreate?: boolean;
  /** Carga todas las zonas al montar y filtra en el cliente. Ideal para datasets chicos. */
  eager?: boolean;
}

export function ZoneCombobox({
  value,
  onChange,
  placeholder = "Ej: Nueva Córdoba",
  className,
  showCreate = true,
  eager = false,
}: ZoneComboboxProps) {
  const [zones, setZones] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  useEffect(() => {
    if (!eager) return;
    fetch("/api/zones?search=&all=true")
      .then((r) => r.ok ? r.json() : { zones: [] })
      .then((data) => setZones((data.zones ?? []).map((z: { name: string }) => z.name)));
  }, [eager]);

  const fetchZones = useCallback(async (q: string) => {
    const res = await fetch(`/api/zones?search=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setZones((data.zones ?? []).map((z: { name: string }) => z.name));
    }
  }, []);

  const handleQueryChange = (q: string) => {
    if (eager) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchZones(q), 250);
  };

  const handleCreate = async (name: string): Promise<string> => {
    const res = await fetch("/api/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Error al crear zona");
    const data = await res.json();
    return data.zone.name;
  };

  return (
    <CreatableCombobox
      value={value}
      onChange={onChange}
      options={zones}
      {...(eager ? {} : { onSearch: (_, opts) => opts, onQueryChange: handleQueryChange })}
      {...(showCreate ? { onCreate: handleCreate } : {})}
      placeholder={placeholder}
      className={className}
    />
  );
}
