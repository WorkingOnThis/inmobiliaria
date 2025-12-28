"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  PROPERTY_TYPES, 
  PROPERTY_TYPE_LABELS, 
  PROPERTY_STATUSES, 
  PROPERTY_STATUS_LABELS,
  type PropertyType,
  type PropertyStatus
} from "@/lib/properties/constants";

/**
 * PropertyForm Component
 *
 * Formulario para registrar nuevas propiedades en el sistema.
 */
export function PropertyForm() {
  const router = useRouter();
  
  // States para los campos del formulario
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [status, setStatus] = useState<PropertyStatus>("available");
  const [rooms, setRooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [surface, setSurface] = useState("");
  const [ownerId, setOwnerId] = useState("");
  
  // States para la carga de clientes y manejo de UI
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Cargar lista de clientes para el selector de dueño
  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch("/api/clients?limit=100");
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        } else {
          console.error("Failed to fetch clients");
        }
      } catch (err) {
        console.error("Error fetching clients:", err);
      } finally {
        setIsLoadingClients(false);
      }
    }
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validaciones básicas en el cliente
    let hasErrors = false;
    const newFieldErrors: Record<string, string> = {};

    if (!title.trim()) {
      newFieldErrors.title = "El título es requerido";
      hasErrors = true;
    }
    if (!address.trim()) {
      newFieldErrors.address = "La dirección es requerida";
      hasErrors = true;
    }
    if (!price || parseFloat(price) <= 0) {
      newFieldErrors.price = "El precio debe ser un número positivo";
      hasErrors = true;
    }
    if (!type) {
      newFieldErrors.type = "El tipo de propiedad es requerido";
      hasErrors = true;
    }
    if (!ownerId) {
      newFieldErrors.ownerId = "El dueño es requerido";
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          address: address.trim(),
          price: parseFloat(price),
          type,
          status,
          rooms: rooms ? parseInt(rooms) : null,
          bathrooms: bathrooms ? parseInt(bathrooms) : null,
          surface: surface ? parseFloat(surface) : null,
          ownerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al crear la propiedad. Por favor intenta de nuevo.");
        return;
      }

      // Éxito - redirigir al tablero con mensaje de éxito
      router.push("/tablero?success=property_created");
      router.refresh();
    } catch (err) {
      console.error("Property creation error:", err);
      setError("Ocurrió un error al crear la propiedad. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Título */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: Casa 3 Ambientes con Jardín"
            aria-invalid={!!fieldErrors.title}
          />
          {fieldErrors.title && (
            <p className="text-sm text-destructive">{fieldErrors.title}</p>
          )}
        </div>

        {/* Dirección */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">
            Dirección <span className="text-destructive">*</span>
          </Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: Av. del Libertador 1500, CABA"
            aria-invalid={!!fieldErrors.address}
          />
          {fieldErrors.address && (
            <p className="text-sm text-destructive">{fieldErrors.address}</p>
          )}
        </div>

        {/* Precio */}
        <div className="space-y-2">
          <Label htmlFor="price">
            Precio <span className="text-destructive">*</span>
          </Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 150000"
            aria-invalid={!!fieldErrors.price}
          />
          {fieldErrors.price && (
            <p className="text-sm text-destructive">{fieldErrors.price}</p>
          )}
        </div>

        {/* Tipo */}
        <div className="space-y-2">
          <Label htmlFor="type">
            Tipo <span className="text-destructive">*</span>
          </Label>
          <Select
            value={type}
            onValueChange={(value: PropertyType) => setType(value)}
            disabled={isLoading}
          >
            <SelectTrigger id="type" aria-invalid={!!fieldErrors.type}>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.type && (
            <p className="text-sm text-destructive">{fieldErrors.type}</p>
          )}
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select
            value={status}
            onValueChange={(value: PropertyStatus) => setStatus(value)}
            disabled={isLoading}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Selecciona un estado" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROPERTY_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dueño (Cliente) */}
        <div className="space-y-2">
          <Label htmlFor="ownerId">
            Dueño <span className="text-destructive">*</span>
          </Label>
          <Select
            value={ownerId}
            onValueChange={setOwnerId}
            disabled={isLoading || isLoadingClients}
          >
            <SelectTrigger id="ownerId" aria-invalid={!!fieldErrors.ownerId}>
              <SelectValue placeholder={isLoadingClients ? "Cargando clientes..." : "Selecciona un dueño"} />
            </SelectTrigger>
            <SelectContent>
              {clients.length > 0 ? (
                clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} {c.apellido}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="_empty" disabled>No se encontraron clientes</SelectItem>
              )}
            </SelectContent>
          </Select>
          {fieldErrors.ownerId && (
            <p className="text-sm text-destructive">{fieldErrors.ownerId}</p>
          )}
        </div>

        {/* Ambientes */}
        <div className="space-y-2">
          <Label htmlFor="rooms">Ambientes</Label>
          <Input
            id="rooms"
            type="number"
            value={rooms}
            onChange={(e) => setRooms(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 3"
          />
        </div>

        {/* Baños */}
        <div className="space-y-2">
          <Label htmlFor="bathrooms">Baños</Label>
          <Input
            id="bathrooms"
            type="number"
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 2"
          />
        </div>

        {/* Superficie */}
        <div className="space-y-2">
          <Label htmlFor="surface">Superficie (m²)</Label>
          <Input
            id="surface"
            type="number"
            step="0.01"
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 85.5"
          />
        </div>
      </div>

      {/* Mensaje de error general */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Botón de envío */}
      <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
        {isLoading ? "Guardando..." : "Crear Propiedad"}
      </Button>
    </form>
  );
}

