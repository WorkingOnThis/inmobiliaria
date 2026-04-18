"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface Zone {
  id: string;
  name: string;
}

interface ZoneComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** "form" = alta rápida (bg-surface-mid, h-12, rounded-xl)
   *  "field" = ficha edición (bg-surface-mid, borde, rounded-[6px]) */
  variant?: "form" | "field";
  placeholder?: string;
  className?: string;
}

export function ZoneCombobox({
  value,
  onChange,
  variant = "form",
  placeholder = "Ej: Nueva Córdoba",
  className,
}: ZoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchZones = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/zones?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchZones(search), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, open, fetchZones]);

  const handleSelect = (zone: Zone) => {
    onChange(zone.name);
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        onChange(data.zone.name);
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const displayValue = value || "";
  const showCreate = search.trim().length > 0 &&
    !zones.some((z) => z.name.toLowerCase() === search.trim().toLowerCase());

  const triggerClass =
    variant === "form"
      ? cn(
          "flex w-full items-center justify-between bg-surface-mid border-none text-on-surface h-12 rounded-xl px-4 focus:ring-1 focus:ring-primary transition-all",
          !displayValue && "text-muted-foreground",
          className
        )
      : cn(
          "flex w-full items-center justify-between bg-surface-mid border border-border rounded-[6px] text-on-surface text-[13.5px] px-3 py-[7px] outline-none focus:border-primary transition-all",
          !displayValue && "text-muted-foreground italic text-[12px]",
          className
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClass}>
          <span className={displayValue ? "text-on-surface" : ""}>
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown
            size={14}
            className="text-muted-foreground flex-shrink-0 ml-2"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 bg-surface-mid border border-border rounded-xl shadow-xl"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar zona..."
            value={search}
            onValueChange={setSearch}
            className="text-on-surface placeholder:text-muted-foreground"
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {zones.length === 0 && !showCreate && (
                  <CommandEmpty className="text-muted-foreground text-[12px]">
                    No hay zonas guardadas.
                  </CommandEmpty>
                )}

                {zones.length > 0 && (
                  <CommandGroup>
                    {zones.map((z) => (
                      <CommandItem
                        key={z.id}
                        value={z.id}
                        onSelect={() => handleSelect(z)}
                        className="flex items-center gap-2 text-on-surface cursor-pointer"
                      >
                        <Check
                          size={13}
                          className={cn(
                            "flex-shrink-0",
                            value === z.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {z.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {showCreate && (
                  <>
                    {zones.length > 0 && <CommandSeparator />}
                    <CommandGroup>
                      <CommandItem
                        value="__create__"
                        onSelect={handleCreate}
                        disabled={creating}
                        className="flex items-center gap-2 text-primary cursor-pointer"
                      >
                        {creating ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} className="flex-shrink-0" />
                        )}
                        <span className="text-[12px] font-medium">
                          Crear &ldquo;{search.trim()}&rdquo;
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
