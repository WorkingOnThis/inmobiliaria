"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * VerifyEmailForm Component
 * 
 * Componente para reenviar email de verificación.
 */
export function VerifyEmailForm({ email }: { email?: string }) {
  const [inputEmail, setInputEmail] = useState(email || "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleResendVerification = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!inputEmail) {
      setMessage({
        type: "error",
        text: "Por favor ingresa tu email",
      });
      setIsLoading(false);
      return;
    }

    try {
      await authClient.sendVerificationEmail({
        email: inputEmail,
        callbackURL: "/",
      });

      setMessage({
        type: "success",
        text: "Email de verificación enviado. Por favor revisa tu bandeja de entrada.",
      });
    } catch (error) {
      console.error("Error sending verification email:", error);
      setMessage({
        type: "error",
        text: "Ocurrió un error al enviar el email. Por favor intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {email
          ? "No recibiste el email de verificación? Puedes solicitar que te lo reenviemos."
          : "Ingresa tu email para recibir un nuevo link de verificación."}
      </p>

      <form onSubmit={handleResendVerification} className="space-y-4">
        <div>
          <label
            htmlFor="verify-email"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Email
          </label>
          <input
            id="verify-email"
            type="email"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            disabled={isLoading || !!email}
            required
            className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="usuario@ejemplo.com"
            autoComplete="email"
          />
        </div>

        {message && (
          <div
            className={`rounded-md p-3 ${
              message.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-destructive/10 border border-destructive/20"
            }`}
          >
            <p
              className={`text-sm ${
                message.type === "success" ? "text-green-800" : "text-destructive"
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Enviando..." : "Reenviar email de verificación"}
        </button>
      </form>
    </div>
  );
}

