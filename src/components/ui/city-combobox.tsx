"use client";

import { useMemo } from "react";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { CITIES } from "@/lib/argentina/locations";

interface CityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityCombobox({
  value,
  onChange,
  placeholder = "Ej: Córdoba",
  className,
}: CityComboboxProps) {
  const options = useMemo(() => CITIES, []);

  return (
    <CreatableCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
    />
  );
}
