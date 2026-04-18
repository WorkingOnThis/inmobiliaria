"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Loader2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type PropertyType
} from "@/lib/properties/constants";
import { ZoneCombobox } from "@/components/ui/zone-combobox";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CreateOwnerPopup } from "@/components/properties/create-owner-popup";

interface Client {
  id: string;
  firstName: string;
  lastName?: string | null;
  dni?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
}

interface QuickPropertyFormProps {
  onSuccess?: (propertyId: string) => void;
  onCancel?: () => void;
  inline?: boolean;
}

export function QuickPropertyForm({ onSuccess, onCancel, inline = false }: QuickPropertyFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Property form state
  const [address, setAddress] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [zone, setZone] = useState("");
  const [floorUnit, setFloorUnit] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");

  // UI state
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);
  const [owners, setOwners] = useState<Client[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<Client | null>(null);
  const [isPropertySaving, setIsPropertySaving] = useState(false);
  const [showCreateOwnerPopup, setShowCreateOwnerPopup] = useState(false);

  // Search owners — máximo 3 resultados
  useEffect(() => {
    if (ownerSearch.length < 2 || selectedOwner) {
      setOwners([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOwners(true);
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(ownerSearch)}&limit=3`);
        if (res.ok) {
          const data = await res.json();
          setOwners(data.clients || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearchingOwners(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ownerSearch, selectedOwner]);

  const handleSelectOwner = (o: Client) => {
    setSelectedOwner(o);
    setOwnerId(o.id);
    setOwnerSearch(`${o.firstName} ${o.lastName || ""}`.trim());
    setOwners([]);
  };

  const handleClearOwner = () => {
    setSelectedOwner(null);
    setOwnerId("");
    setOwnerSearch("");
  };

  const handleOwnerCreated = (owner: { id: string; firstName: string; lastName?: string | null }) => {
    handleSelectOwner(owner as Client);
    setShowCreateOwnerPopup(false);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !type || !ownerId) {
      toast.error("Por favor completa los campos obligatorios (*)");
      return;
    }

    setIsPropertySaving(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          type,
          zone: zone || null,
          floorUnit: floorUnit || null,
          ownerId,
          status: "available",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear la propiedad");
      }

      const data = await res.json();
      toast.success("Propiedad creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["properties"] });

      if (onSuccess) {
        onSuccess(data.property.id);
      } else {
        router.push(`/propiedades/${data.property.id}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsPropertySaving(false);
    }
  };

  const showDropdown = ownerSearch.length >= 2 && !selectedOwner;

  return (
    <>
      {/* Popup de crear propietario — z-[200], por encima del modal */}
      <CreateOwnerPopup
        isOpen={showCreateOwnerPopup}
        onClose={() => setShowCreateOwnerPopup(false)}
        onCreated={handleOwnerCreated}
        initialName={ownerSearch}
      />

      <div className={`relative w-full ${inline ? "bg-transparent" : "max-w-lg bg-surface border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all"}`}>

        {!inline && (
          <div className="p-6 pb-0">
            <h2 className="text-xl font-semibold text-on-surface">Nueva propiedad</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Los campos con <span className="text-primary">*</span> son obligatorios. El resto se completa en la ficha.
            </p>
          </div>
        )}

        <form onSubmit={handleCreateProperty} className="p-6 flex flex-col gap-5">

          {/* Dirección */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="address" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Dirección <span className="text-primary">*</span>
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Godoy Cruz 2814, 3B"
              className="bg-surface-mid border-none text-on-surface h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tipo */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="type" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tipo <span className="text-primary">*</span>
              </Label>
              <Select value={type} onValueChange={(v: PropertyType) => setType(v)}>
                <SelectTrigger className="bg-surface-mid border-none text-on-surface h-12 rounded-xl focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="bg-surface-mid border-white/10 text-on-surface">
                  <SelectGroup>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-on-surface">
                        {PROPERTY_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Barrio / Zona */}
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Barrio / Zona
              </Label>
              <ZoneCombobox
                value={zone}
                onChange={setZone}
                variant="form"
              />
            </div>
          </div>

          {/* Piso / Unidad — ocupa todo el ancho (superficie eliminada del alta rápida) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="floorUnit" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Piso / Unidad
            </Label>
            <Input
              id="floorUnit"
              value={floorUnit}
              onChange={(e) => setFloorUnit(e.target.value)}
              placeholder="Ej: 3° B"
              className="bg-surface-mid border-none text-on-surface h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* Propietario */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <Label htmlFor="owner" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Propietario <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Input
                id="owner"
                value={ownerSearch}
                onChange={(e) => {
                  setOwnerSearch(e.target.value);
                  if (selectedOwner) handleClearOwner();
                }}
                placeholder="Buscar por nombre o DNI..."
                className="bg-surface-mid border-none text-on-surface h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {isSearchingOwners ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : selectedOwner ? (
                  <button type="button" onClick={handleClearOwner}>
                    <UserMinus size={17} className="text-primary" />
                  </button>
                ) : (
                  <Search size={17} />
                )}
              </div>

              {/* Dropdown de resultados */}
              {showDropdown && (
                <div className="absolute z-10 w-full top-full mt-1 bg-surface-mid border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  {/* Resultados (máximo 3) */}
                  {owners.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleSelectOwner(o)}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 text-on-surface flex flex-col gap-0.5 transition-colors"
                    >
                      <span className="text-[13px] font-medium">
                        {o.firstName} {o.lastName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {o.dni ? `DNI ${o.dni}` : o.email || o.whatsapp || "Sin más datos"}
                      </span>
                    </button>
                  ))}

                  {/* Separador si hay resultados */}
                  {owners.length > 0 && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />
                  )}

                  {/* "Crear nuevo propietario" — siempre visible */}
                  <button
                    type="button"
                    onClick={() => setShowCreateOwnerPopup(true)}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 flex items-center gap-2 transition-colors text-primary"
                  >
                    <UserPlus size={14} />
                    <span className="text-[12px] font-semibold">Crear nuevo propietario</span>
                  </button>
                </div>
              )}
            </div>

            {selectedOwner && (
              <p className="text-[11px] text-green/70 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />
                Propietario vinculado: {selectedOwner.firstName} {selectedOwner.lastName}
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="pt-4 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="text-muted-foreground hover:text-on-surface hover:bg-white/5 rounded-xl px-6 h-12"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPropertySaving || !ownerId}
              className="bg-primary text-primary-foreground hover:brightness-110 font-bold rounded-full px-8 h-12 flex items-center justify-center gap-2 group transition-all"
            >
              {isPropertySaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Guardar y abrir ficha{" "}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
