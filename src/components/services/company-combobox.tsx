"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
};

export function CompanyCombobox({
  value,
  onChange,
  placeholder = "Ej: EPEC, Ecogas, Aguas Cordobesas…",
  inputClassName = "w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["companys-prestadoras"],
    queryFn: async () => {
      const res = await fetch("/api/servicios/companys");
      if (!res.ok) throw new Error("Error");
      return res.json() as Promise<{ companys: string[] }>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const allCompanies = data?.companys ?? [];

  const suggestions = allCompanies
    .filter((e) =>
      query.length === 0
        ? true
        : e.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5);

  const isNew =
    query.length > 0 &&
    !allCompanies.some((e) => e.toLowerCase() === query.toLowerCase());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(company: string) {
    onChange(company);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
  }

  const showDropdown = open && !value && (suggestions.length > 0 || isNew);

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-mid px-3 py-2 min-h-[38px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {value}
            <button
              type="button"
              onClick={clear}
              className="hover:opacity-70 transition-opacity"
              aria-label="Remove company"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
            if (e.key === "Enter" && isNew) {
              e.preventDefault();
              select(query);
            }
          }}
          placeholder={placeholder}
          className={inputClassName}
          autoComplete="off"
        />
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <p className="px-3 pt-2 pb-1 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
            Select an option or create a new one
          </p>
          {suggestions.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => {
                ev.preventDefault();
                select(e);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-mid"
            >
              <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {e}
              </span>
            </button>
          ))}
          {isNew && (
            <button
              type="button"
              onMouseDown={(ev) => {
                ev.preventDefault();
                select(query);
              }}
              className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-sm text-primary hover:bg-surface-mid"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Create{" "}
              <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {query}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
