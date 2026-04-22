"use client";

import { useQuery } from "@tanstack/react-query";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function CompanyCombobox({
  value,
  onChange,
  placeholder = "Ej: EPEC, Ecogas, Aguas Cordobesas…",
}: Props) {
  const { data } = useQuery({
    queryKey: ["companys-prestadoras"],
    queryFn: async () => {
      const res = await fetch("/api/services/companies");
      if (!res.ok) throw new Error("Error");
      return res.json() as Promise<{ companys: string[] }>;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <CreatableCombobox
      value={value}
      onChange={onChange}
      options={data?.companys ?? []}
      placeholder={placeholder}
    />
  );
}
