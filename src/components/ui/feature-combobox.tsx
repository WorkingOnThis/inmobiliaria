"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

interface Feature {
  id: string;
  name: string;
}

interface FeatureComboboxProps {
  propertyId: string;
}

export function FeatureCombobox({ propertyId }: FeatureComboboxProps) {
  const queryClient = useQueryClient();
  const [availableOptions, setAvailableOptions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const { data } = useQuery<{ features: Feature[] }>({
    queryKey: ["property-features", propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/features`);
      if (!res.ok) throw new Error("Error al cargar características");
      return res.json();
    },
  });

  const selected = data?.features ?? [];
  const selectedNames = new Set(selected.map((f) => f.name.toLowerCase()));

  const fetchOptions = useCallback(
    async (q: string) => {
      const res = await fetch(`/api/property-features?search=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const d = await res.json();
      setAvailableOptions(
        (d.features ?? [])
          .map((f: Feature) => f.name)
          .filter((name: string) => !selectedNames.has(name.toLowerCase()))
      );
    },
    [selectedNames]
  );

  const handleQueryChange = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(q), 250);
  };

  const handleAdd = async (name: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al agregar característica");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["property-features", propertyId] });
    } catch {
      toast.error("Error de conexión al agregar característica");
    }
  };

  const handleRemove = async (featureId: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/features/${featureId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Error al quitar característica");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["property-features", propertyId] });
    } catch {
      toast.error("Error de conexión al quitar característica");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"
            >
              {f.name}
              <button
                type="button"
                onClick={() => handleRemove(f.id)}
                className="hover:opacity-70 transition-opacity"
                aria-label={`Quitar ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <CreatableCombobox
        value=""
        onChange={handleAdd}
        options={availableOptions}
        onSearch={(_, opts) => opts}
        onQueryChange={handleQueryChange}
        placeholder="Agregar característica…"
      />
    </div>
  );
}
