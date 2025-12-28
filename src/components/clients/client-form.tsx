"use client";

import { useState } from "react";
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
import { CLIENT_TYPES, CLIENT_TYPE_LABELS, type ClientType } from "@/lib/clients/constants";

/**
 * ClientForm Component
 *
 * Formulario para agregar nuevos clientes al sistema.
 * Incluye validación de campos requeridos y manejo de estados.
 */
export function ClientForm() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [tipo, setTipo] = useState<ClientType | "">("");
  const [telefono, setTelefono] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [duenoDe, setDuenoDe] = useState("");
  const [alquila, setAlquila] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue) return true; // Opcional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setFieldErrors((prev) => ({
        ...prev,
        email: "Por favor ingresa un email válido",
      }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.email;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validaciones
    let hasErrors = false;
    const newFieldErrors: Record<string, string> = {};

    if (!nombre.trim()) {
      newFieldErrors.nombre = "El nombre es requerido";
      hasErrors = true;
    }

    if (!apellido.trim()) {
      newFieldErrors.apellido = "El apellido es requerido";
      hasErrors = true;
    }

    if (!tipo) {
      newFieldErrors.tipo = "El tipo de cliente es requerido";
      hasErrors = true;
    }

    if (email && !validateEmail(email)) {
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          tipo,
          telefono: telefono.trim() || null,
          dni: dni.trim() || null,
          email: email.trim() || null,
          dueño_de: duenoDe.trim() || null,
          alquila: alquila.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al crear el cliente. Por favor intenta de nuevo.");
        return;
      }

      // Éxito - redirigir al listado con mensaje de éxito
      router.push("/clientes?success=client_created");
      router.refresh();
    } catch (err) {
      console.error("Client creation error:", err);
      setError("Ocurrió un error al crear el cliente. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre Field */}
        <div className="space-y-2">
          <Label htmlFor="nombre">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: Juan"
            aria-invalid={!!fieldErrors.nombre}
          />
          {fieldErrors.nombre && (
            <p className="text-sm text-destructive">{fieldErrors.nombre}</p>
          )}
        </div>

        {/* Apellido Field */}
        <div className="space-y-2">
          <Label htmlFor="apellido">
            Apellido <span className="text-destructive">*</span>
          </Label>
          <Input
            id="apellido"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: Pérez"
            aria-invalid={!!fieldErrors.apellido}
          />
          {fieldErrors.apellido && (
            <p className="text-sm text-destructive">{fieldErrors.apellido}</p>
          )}
        </div>

        {/* Tipo Field */}
        <div className="space-y-2">
          <Label htmlFor="tipo">
            Tipo <span className="text-destructive">*</span>
          </Label>
          <Select
            value={tipo}
            onValueChange={(value: ClientType) => setTipo(value)}
            disabled={isLoading}
          >
            <SelectTrigger id="tipo" aria-invalid={!!fieldErrors.tipo}>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {CLIENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.tipo && (
            <p className="text-sm text-destructive">{fieldErrors.tipo}</p>
          )}
        </div>

        {/* DNI Field */}
        <div className="space-y-2">
          <Label htmlFor="dni">DNI</Label>
          <Input
            id="dni"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 12345678"
          />
        </div>

        {/* Teléfono Field */}
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 1122334455"
          />
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: juan.perez@ejemplo.com"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Dueño de Field */}
        <div className="space-y-2">
          <Label htmlFor="duenoDe">Dueño de</Label>
          <Input
            id="duenoDe"
            value={duenoDe}
            onChange={(e) => setDuenoDe(e.target.value)}
            disabled={isLoading}
            placeholder="Propiedad que posee"
          />
        </div>

        {/* Alquila Field */}
        <div className="space-y-2">
          <Label htmlFor="alquila">Alquila</Label>
          <Input
            id="alquila"
            value={alquila}
            onChange={(e) => setAlquila(e.target.value)}
            disabled={isLoading}
            placeholder="Propiedad que alquila"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
        {isLoading ? "Guardando..." : "Crear Cliente"}
      </Button>
    </form>
  );
}

