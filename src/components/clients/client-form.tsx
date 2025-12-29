"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * ClientForm Component
 *
 * Formulario para agregar nuevos clientes al sistema.
 * Crea un Usuario y un Cliente asociado.
 */
export function ClientForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateEmail = (emailValue: string): boolean => {
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

    if (!firstName.trim()) {
      newFieldErrors.firstName = "El nombre es requerido";
      hasErrors = true;
    }

    if (!lastName.trim()) {
      newFieldErrors.lastName = "El apellido es requerido";
      hasErrors = true;
    }

    if (!email.trim()) {
      newFieldErrors.email = "El email es requerido";
      hasErrors = true;
    } else if (!validateEmail(email)) {
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
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          dni: dni.trim() || null,
          email: email.trim(),
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
          <Label htmlFor="firstName">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: Juan"
            aria-invalid={!!fieldErrors.firstName}
          />
          {fieldErrors.firstName && (
            <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
          )}
        </div>

        {/* Apellido Field */}
        <div className="space-y-2">
          <Label htmlFor="lastName">
            Apellido <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: Pérez"
            aria-invalid={!!fieldErrors.lastName}
          />
          {fieldErrors.lastName && (
            <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
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
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isLoading}
            placeholder="Ej: 1122334455"
          />
        </div>

        {/* Email Field */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
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
          <p className="text-xs text-muted-foreground">
            Se creará un usuario con este email para el cliente.
          </p>
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
