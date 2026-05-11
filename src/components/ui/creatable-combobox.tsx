"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onSearch?: (query: string, options: string[]) => string[];
  onCreate?: (value: string) => Promise<string> | string;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function CreatableCombobox({
  value,
  onChange,
  options,
  onSearch,
  onCreate,
  onQueryChange,
  placeholder = "Seleccioná o escribí...",
  className,
}: CreatableComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultSearch = (q: string, opts: string[]) =>
    q.length === 0
      ? opts
      : opts.filter((o) => o.toLowerCase().includes(q.toLowerCase()));

  const suggestions = (onSearch ?? defaultSearch)(query, options).slice(0, 5);

  const isNew =
    query.length > 0 &&
    !options.some((o) => o.toLowerCase() === query.toLowerCase());

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

  function select(option: string) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    if (onCreate) {
      setCreating(true);
      try {
        const result = await onCreate(name);
        onChange(result ?? name);
      } finally {
        setCreating(false);
      }
    } else {
      onChange(name);
    }
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    onQueryChange?.("");
  }

  const showDropdown = open && !value && (suggestions.length > 0 || isNew);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-mid px-3 py-2 min-h-[38px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {value}
            <button
              type="button"
              onClick={clear}
              className="hover:opacity-70 transition-opacity"
              aria-label="Quitar selección"
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
            onQueryChange?.(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            onQueryChange?.("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
            if (e.key === "Enter" && isNew) {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
          autoComplete="off"
        />
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <p className="px-3 pt-2 pb-1 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
            Seleccioná una opción o creá una nueva
          </p>
          {suggestions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(ev) => {
                ev.preventDefault();
                select(option);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-mid"
            >
              <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {option}
              </span>
            </button>
          ))}
          {isNew && onCreate && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(ev) => {
                ev.preventDefault();
                handleCreate();
              }}
              className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-sm text-primary hover:bg-surface-mid disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0" />
              )}
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
