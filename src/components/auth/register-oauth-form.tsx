"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegisterOAuthFormProps {
  email: string;
  name: string;
}

/**
 * RegisterOAuthForm Component
 * 
 * Formulario para completar registro OAuth solicitando nombre de inmobiliaria.
 */
export function RegisterOAuthForm({ email, name }: RegisterOAuthFormProps) {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!agencyName.trim()) {
      setError("El nombre de la inmobiliaria es requerido");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/register-oauth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agencyName: agencyName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al completar el registro. Por favor intenta de nuevo.");
        return;
      }

      // Registro exitoso - redirigir a dashboard
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("OAuth registration error:", err);
      setError("Ocurrió un error al completar el registro. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Hola <strong>{name}</strong>, solo necesitamos un dato más para completar tu registro.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agency Name Field */}
        <div>
          <label
            htmlFor="agencyName"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Nombre de la Inmobiliaria
          </label>
          <input
            id="agencyName"
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            disabled={isLoading}
            required
            className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Mi Inmobiliaria"
            autoComplete="organization"
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Completando registro..." : "Completar registro"}
        </button>
      </form>
    </div>
  );
}





