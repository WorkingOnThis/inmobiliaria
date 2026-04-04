"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, ArrowRight, Loader2, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type PropertyType
} from "@/lib/properties/constants";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Client {
  id: string;
  firstName: string;
  lastName?: string;
  dni?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
}

interface QuickPropertyFormProps {
  onSuccess?: (propertyId: string) => void;
  onCancel?: () => void;
  inline?: boolean;
}

export function QuickPropertyForm({ onSuccess, onCancel, inline = false }: QuickPropertyFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Property Form State
  const [address, setAddress] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [zone, setZone] = useState("");
  const [floorUnit, setFloorUnit] = useState("");
  const [surface, setSurface] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  
  // UI State
  const [showContactForm, setShowContactForm] = useState(false);
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);
  const [owners, setOwners] = useState<Client[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<Client | null>(null);
  const [isPropertySaving, setIsPropertySaving] = useState(false);

  // Contact Form State (Inline)
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [isContactSaving, setIsContactSaving] = useState(false);

  // Search owners
  useEffect(() => {
    if (ownerSearch.length < 2 || selectedOwner) {
      setOwners([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOwners(true);
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(ownerSearch)}&limit=5`);
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
          zone,
          floorUnit,
          surface: surface ? parseFloat(surface) : null,
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
        router.push(`/tablero?success=property_created`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsPropertySaving(false);
    }
  };

  const handleCreateContact = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!contactName) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setIsContactSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: contactName,
          email: contactEmail || null,
          phone: contactPhone || null,
          whatsapp: contactWhatsapp || null,
          createAsUser: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el contacto");
      }

      const data = await res.json();
      const newClient = data.client;
      setOwners([newClient]);
      setSelectedOwner(newClient);
      setOwnerId(newClient.id);
      setOwnerSearch(`${newClient.firstName} ${newClient.lastName || ""}`.trim());
      setShowContactForm(false);
      toast.success("Contacto creado exitosamente");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsContactSaving(false);
    }
  };

  return (
    <div className={`relative w-full ${inline ? 'bg-transparent' : 'max-w-lg bg-[#1a1d1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all'}`}>
      
      {!inline && (
        <div className="p-6 pb-0">
          <h2 className="text-xl font-semibold text-white">Nueva propiedad</h2>
          <p className="text-sm text-gray-400 mt-1">
            Los campos con <span className="text-[#ffb4a2]">*</span> son obligatorios. El resto se completa en la ficha.
          </p>
        </div>
      )}

      <form onSubmit={handleCreateProperty} className="p-6 space-y-6">
        {/* Dirección */}
        <div className="space-y-2">
          <Label htmlFor="address" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Dirección <span className="text-[#ffb4a2]">*</span>
          </Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej: Godoy Cruz 2814, 3B"
            className="bg-[#242729] border-none text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Tipo <span className="text-[#ffb4a2]">*</span>
            </Label>
            <Select value={type} onValueChange={(v: PropertyType) => setType(v)}>
              <SelectTrigger className="bg-[#242729] border-none text-white h-12 rounded-xl focus:ring-1 focus:ring-[#ffb4a2]">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#242729] border-white/10 text-white">
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white">
                    {PROPERTY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Barrio / Zona */}
          <div className="space-y-2">
            <Label htmlFor="zone" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Barrio / Zona
            </Label>
            <Input
              id="zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Ej: Nueva Córdoba"
              className="bg-[#242729] border-none text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Piso / Unidad */}
          <div className="space-y-2">
            <Label htmlFor="floorUnit" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Piso / Unidad
            </Label>
            <Input
              id="floorUnit"
              value={floorUnit}
              onChange={(e) => setFloorUnit(e.target.value)}
              placeholder="Ej: 3° B"
              className="bg-[#242729] border-none text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
            />
          </div>

          {/* Superficie */}
          <div className="space-y-2">
            <Label htmlFor="surface" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Superficie (m²)
            </Label>
            <Input
              id="surface"
              type="number"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              placeholder="Ej: 52"
              className="bg-[#242729] border-none text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Propietario Section */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="space-y-2 relative">
            <Label htmlFor="owner" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Propietario <span className="text-[#ffb4a2]">*</span>
            </Label>
            <div className="relative">
              <Input
                id="owner"
                value={ownerSearch}
                onChange={(e) => {
                  setOwnerSearch(e.target.value);
                  if (selectedOwner) {
                    setSelectedOwner(null);
                    setOwnerId("");
                  }
                }}
                placeholder="Buscar propietario por nombre o DNI..."
                className="bg-[#242729] border-none text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600 pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {isSearchingOwners ? <Loader2 size={18} className="animate-spin" /> : 
                 selectedOwner ? <button onClick={() => { setSelectedOwner(null); setOwnerId(""); setOwnerSearch(""); }}><UserMinus size={18} className="text-[#ffb4a2]" /></button> : 
                 <Search size={18} />}
              </div>
            </div>
            
            {/* Search Results Dropdown */}
            {ownerSearch.length >= 2 && !selectedOwner && !showContactForm && (
              <div className="absolute z-10 w-full mt-1 bg-[#242729] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                {owners.length > 0 ? (
                  owners.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedOwner(o);
                        setOwnerId(o.id);
                        setOwnerSearch(`${o.firstName} ${o.lastName || ""}`.trim());
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 text-white flex flex-col gap-0.5"
                    >
                      <span className="font-medium">{o.firstName} {o.lastName}</span>
                      <span className="text-xs text-gray-400">{o.email || o.dni || "Sin más datos"}</span>
                    </button>
                  ))
                ) : !isSearchingOwners && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-400">No se encontraron resultados.</p>
                    <button 
                      type="button"
                      onClick={() => {
                        setContactName(ownerSearch);
                        setShowContactForm(true);
                      }}
                      className="mt-2 text-[#ffb4a2] text-sm font-medium hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      <UserPlus size={14} /> Crear nuevo contacto
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {!showContactForm && (
              <p className="text-[11px] text-gray-500 italic mt-1">
                Si el propietario no existe, puedes crearlo pulsando el botón que aparecerá si no hay resultados.
              </p>
            )}
          </div>

          {/* Inline Contact Form - BELOW the owner search */}
          {showContactForm && (
            <div className="bg-[#242729]/50 border border-white/5 rounded-2xl p-5 space-y-5 animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                   <UserPlus size={16} className="text-[#ffb4a2]" /> Nuevo Propietario
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowContactForm(false)}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName" className="text-[10px] font-bold text-gray-500 uppercase">
                    Nombre <span className="text-[#ffb4a2]">*</span>
                  </Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej: Claudia"
                    className="bg-[#2c3033] border-none h-11 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-[#ffb4a2]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="text-[10px] font-bold text-gray-500 uppercase">
                    Teléfono
                  </Label>
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Ej: 11 2233 4455"
                    className="bg-[#2c3033] border-none h-11 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-[#ffb4a2]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail" className="text-[10px] font-bold text-gray-500 uppercase">
                    Email
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Ej: email@ejemplo.com"
                    className="bg-[#2c3033] border-none h-11 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-[#ffb4a2]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactWhatsapp" className="text-[10px] font-bold text-gray-500 uppercase">
                    WhatsApp
                  </Label>
                  <Input
                    id="contactWhatsapp"
                    value={contactWhatsapp}
                    onChange={(e) => setContactWhatsapp(e.target.value)}
                    placeholder="Ej: 11 2233 4455"
                    className="bg-[#2c3033] border-none h-11 rounded-xl text-white focus-visible:ring-1 focus-visible:ring-[#ffb4a2]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateContact}
                disabled={isContactSaving}
                className="w-full bg-[#ffb4a2]/10 text-[#ffb4a2] border border-[#ffb4a2]/20 hover:bg-[#ffb4a2]/20 font-bold rounded-xl h-11 transition-all text-[13px]"
              >
                {isContactSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Crear contacto y vincular"}
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-gray-500 hover:text-white hover:bg-white/5 rounded-xl px-6 h-12"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isPropertySaving || !ownerId}
            className="bg-[#ffdad2] text-[#3c0800] hover:bg-[#ffcdc0] font-bold rounded-full px-8 h-12 flex items-center justify-center gap-2 group transition-all"
          >
            {isPropertySaving ? <Loader2 size={18} className="animate-spin" /> : <>Guardar y abrir ficha <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
          </Button>
        </div>
      </form>

    </div>
  );
}
