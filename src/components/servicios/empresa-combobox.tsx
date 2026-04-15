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

export function EmpresaCombobox({
  value,
  onChange,
  placeholder = "Ej: EPEC, Ecogas, Aguas Cordobesas…",
  inputClassName = "w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["empresas-prestadoras"],
    queryFn: async () => {
      const res = await fetch("/api/servicios/empresas");
      if (!res.ok) throw new Error("Error");
      return res.json() as Promise<{ empresas: string[] }>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const todasEmpresas = data?.empresas ?? [];

  const sugerencias = todasEmpresas
    .filter((e) =>
      query.length === 0
        ? true
        : e.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5);

  const esNueva =
    query.length > 0 &&
    !todasEmpresas.some((e) => e.toLowerCase() === query.toLowerCase());

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

  function seleccionar(empresa: string) {
    onChange(empresa);
    setQuery("");
    setOpen(false);
  }

  function limpiar() {
    onChange("");
    setQuery("");
  }

  const mostrarDropdown = open && !value && (sugerencias.length > 0 || esNueva);

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-mid px-3 py-2 min-h-[38px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {value}
            <button
              type="button"
              onClick={limpiar}
              className="hover:opacity-70 transition-opacity"
              aria-label="Quitar empresa"
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
            if (e.key === "Enter" && esNueva) {
              e.preventDefault();
              seleccionar(query);
            }
          }}
          placeholder={placeholder}
          className={inputClassName}
          autoComplete="off"
        />
      )}

      {mostrarDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <p className="px-3 pt-2 pb-1 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
            Seleccioná una opción o creá una
          </p>
          {sugerencias.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => {
                ev.preventDefault();
                seleccionar(e);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-mid"
            >
              <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {e}
              </span>
            </button>
          ))}
          {esNueva && (
            <button
              type="button"
              onMouseDown={(ev) => {
                ev.preventDefault();
                seleccionar(query);
              }}
              className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-sm text-primary hover:bg-surface-mid"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Crear{" "}
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
