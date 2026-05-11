"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserMinus, UserPlus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import { ZoneCombobox } from "@/components/ui/zone-combobox";
import { CityCombobox } from "@/components/ui/city-combobox";
import { ProvinceSelect } from "@/components/ui/province-select";
import { SectionLabel } from "@/components/ui/section-label";
import { CreateOwnerPopup } from "@/components/properties/create-owner-popup";

// ── Local helpers ─────────────────────────────────────────────────────────────

const NONE_SENTINEL = "__none__";

function EditInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </div>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Sin especificar",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value || NONE_SENTINEL}
        onValueChange={(v) => onChange(v === NONE_SENTINEL ? "" : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={NONE_SENTINEL}>
              <span className="text-muted-foreground">{placeholder}</span>
            </SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  firstName: string;
  lastName?: string | null;
  dni?: string | null;
  phone?: string | null;
  email?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PropertyNewForm({ defaultOwnerId }: { defaultOwnerId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [floorUnit, setFloorUnit] = useState("");
  const [type, setType] = useState("");
  const [destino, setDestino] = useState("");
  const [rentalStatus, setRentalStatus] = useState("available");
  const [saleStatus, setSaleStatus] = useState("");
  const [zone, setZone] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [rentalPrice, setRentalPrice] = useState("");
  const [rentalPriceCurrency, setRentalPriceCurrency] = useState("ARS");
  const [salePrice, setSalePrice] = useState("");
  const [salePriceCurrency, setSalePriceCurrency] = useState("USD");

  const [ownerId, setOwnerId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<Client | null>(null);
  const [owners, setOwners] = useState<Client[]>([]);
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);
  const [showCreateOwnerPopup, setShowCreateOwnerPopup] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!defaultOwnerId) return;
    fetch(`/api/clients/${defaultOwnerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.client) handleSelectOwner(data.client);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOwnerId]);

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
          setOwners(data.clients ?? []);
        }
      } finally {
        setIsSearchingOwners(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [ownerSearch, selectedOwner]);

  function handleSelectOwner(o: Client) {
    setSelectedOwner(o);
    setOwnerId(o.id);
    setOwnerSearch(`${o.firstName} ${o.lastName ?? ""}`.trim());
    setOwners([]);
  }

  function handleClearOwner() {
    setSelectedOwner(null);
    setOwnerId("");
    setOwnerSearch("");
  }

  const showDropdown = ownerSearch.length >= 2 && !selectedOwner;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addressStreet.trim()) {
      toast.error("La calle es obligatoria");
      return;
    }
    if (!type) {
      toast.error("El tipo de propiedad es obligatorio");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressStreet: addressStreet.trim(),
          addressNumber: addressNumber.trim() || null,
          floorUnit: floorUnit.trim() || null,
          type,
          destino: destino || null,
          rentalStatus: rentalStatus || "available",
          saleStatus: saleStatus || null,
          zone: zone || null,
          city: city || null,
          province: province || null,
          rentalPrice: rentalPrice ? parseFloat(rentalPrice) : null,
          rentalPriceCurrency,
          salePrice: salePrice ? parseFloat(salePrice) : null,
          salePriceCurrency,
          ownerId: ownerId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al crear la propiedad");
      }

      const data = await res.json();
      toast.success("Propiedad creada");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      router.push(`/propiedades/${data.property.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <CreateOwnerPopup
        isOpen={showCreateOwnerPopup}
        onClose={() => setShowCreateOwnerPopup(false)}
        onCreated={(owner) => {
          handleSelectOwner(owner as Client);
          setShowCreateOwnerPopup(false);
        }}
        initialName={ownerSearch}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Identificación y ubicación */}
        <div>
          <SectionLabel className="mb-3">Identificación y ubicación</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <EditInput
              label="Calle *"
              value={addressStreet}
              onChange={setAddressStreet}
              placeholder="Av. Corrientes"
              autoFocus
            />
            <EditInput
              label="Número"
              value={addressNumber}
              onChange={setAddressNumber}
              placeholder="1234"
            />
            <EditInput
              label="Piso / Unidad"
              value={floorUnit}
              onChange={setFloorUnit}
              placeholder="3B"
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Barrio / Zona
              </Label>
              <ZoneCombobox value={zone} onChange={setZone} placeholder="Nueva Córdoba" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Ciudad
              </Label>
              <CityCombobox value={city} onChange={setCity} placeholder="Córdoba" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Provincia
              </Label>
              <ProvinceSelect value={province} onChange={setProvince} />
            </div>
            <EditSelect
              label="Tipo *"
              value={type}
              onChange={setType}
              placeholder="Seleccionar"
              options={[
                { value: "departamento", label: "Departamento" },
                { value: "casa", label: "Casa" },
                { value: "terreno", label: "Terreno" },
                { value: "local", label: "Local Comercial" },
                { value: "oficina", label: "Oficina" },
                { value: "cochera", label: "Cochera" },
                { value: "otro", label: "Otro" },
              ]}
            />
            <EditSelect
              label="Destino"
              value={destino}
              onChange={setDestino}
              options={[
                { value: "vivienda", label: "Vivienda" },
                { value: "comercial", label: "Comercial" },
                { value: "mixto", label: "Mixto" },
                { value: "oficina", label: "Oficina" },
              ]}
            />
            <EditSelect
              label="Estado alquiler"
              value={rentalStatus}
              onChange={setRentalStatus}
              options={[
                { value: "available", label: "Disponible" },
                { value: "rented", label: "Alquilada" },
                { value: "reserved", label: "Reservada" },
                { value: "maintenance", label: "En mantenimiento" },
              ]}
            />
            <EditSelect
              label="Estado venta"
              value={saleStatus}
              onChange={setSaleStatus}
              placeholder="No está en venta"
              options={[
                { value: "for_sale", label: "En venta" },
                { value: "sold", label: "Vendida" },
              ]}
            />
          </div>
        </div>

        {/* Precios */}
        <div>
          <SectionLabel className="mb-3">Precios</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <EditInput
                  label="Precio alquiler"
                  value={rentalPrice}
                  onChange={setRentalPrice}
                  type="number"
                  placeholder="120000"
                />
              </div>
              <div className="w-24 flex flex-col gap-1.5">
                <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                  Moneda
                </Label>
                <Select value={rentalPriceCurrency} onValueChange={setRentalPriceCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">$ ARS</SelectItem>
                    <SelectItem value="USD">US$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <EditInput
                  label="Precio venta"
                  value={salePrice}
                  onChange={setSalePrice}
                  type="number"
                  placeholder="50000"
                />
              </div>
              <div className="w-24 flex flex-col gap-1.5">
                <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                  Moneda
                </Label>
                <Select value={salePriceCurrency} onValueChange={setSalePriceCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">$ ARS</SelectItem>
                    <SelectItem value="USD">US$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Propietario (opcional) */}
        <div>
          <SectionLabel className="mb-3">Propietario</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[0.6rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Buscar propietario (opcional — se puede asignar después)
            </Label>
            <div className="relative">
              <Input
                value={ownerSearch}
                onChange={(e) => {
                  setOwnerSearch(e.target.value);
                  if (selectedOwner) handleClearOwner();
                }}
                placeholder="Buscar por nombre o DNI..."
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {isSearchingOwners ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : selectedOwner ? (
                  <button type="button" onClick={handleClearOwner}>
                    <UserMinus size={16} className="text-primary" />
                  </button>
                ) : (
                  <Search size={16} />
                )}
              </div>

              {showDropdown && (
                <div className="absolute z-10 w-full top-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                  {owners.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleSelectOwner(o)}
                      className="w-full px-4 py-3 text-left hover:bg-accent flex flex-col gap-0.5 transition-colors"
                    >
                      <span className="text-[0.82rem] font-medium">
                        {o.firstName} {o.lastName}
                      </span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {o.dni ? `DNI ${o.dni}` : o.email ?? "Sin más datos"}
                      </span>
                    </button>
                  ))}
                  {owners.length > 0 && <div className="border-t border-border" />}
                  <button
                    type="button"
                    onClick={() => setShowCreateOwnerPopup(true)}
                    className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-2 transition-colors text-primary"
                  >
                    <UserPlus size={14} />
                    <span className="text-[0.75rem] font-semibold">Crear nuevo propietario</span>
                  </button>
                </div>
              )}
            </div>

            {selectedOwner && (
              <p className="text-[0.72rem] text-muted-foreground mt-1">
                Propietario seleccionado: {selectedOwner.firstName} {selectedOwner.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between border-t border-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/propiedades")}
          >
            <ArrowLeft size={16} />
            Volver
          </Button>
          <Button type="submit" disabled={isSaving || !addressStreet.trim() || !type}>
            {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Crear propiedad
          </Button>
        </div>
      </form>
    </>
  );
}
