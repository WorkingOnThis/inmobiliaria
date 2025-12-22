"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegisterFormProps {
  callbackUrl?: string;
}

/**
 * RegisterForm Component
 *
 * Formulario de registro con nombre de inmobiliaria, nombre, apellido, email y contraseña.
 * Maneja validación, estados de carga, errores, y redirección.
 */
export function RegisterForm({ callbackUrl }: RegisterFormProps) {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Validar formato de email
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

  // Validar contraseña
  const validatePassword = (passwordValue: string): boolean => {
    if (passwordValue.length < 8) {
      setFieldErrors((prev) => ({
        ...prev,
        password: "La contraseña debe tener al menos 8 caracteres",
      }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.password;
      return newErrors;
    });
    return true;
  };

  // Validar que las contraseñas coincidan
  const validatePasswordMatch = (): boolean => {
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: "Las contraseñas no coinciden",
      }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.confirmPassword;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validaciones
    if (!agencyName.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        agencyName: "El nombre de la inmobiliaria es requerido",
      }));
      return;
    }

    if (!firstName.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        firstName: "El nombre es requerido",
      }));
      return;
    }

    if (!lastName.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        lastName: "El apellido es requerido",
      }));
      return;
    }

    if (!validateEmail(email)) {
      return;
    }

    if (!validatePassword(password)) {
      return;
    }

    if (!validatePasswordMatch()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agencyName: agencyName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Error al registrarse. Por favor intenta de nuevo."
        );
        return;
      }

      // Registro exitoso - redirigir a página de verificación de email
      router.push("/verify-email?email=" + encodeURIComponent(email));
      router.refresh();
    } catch (err) {
      console.error("Registration error:", err);
      setError("Ocurrió un error al registrarse. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
          onChange={(e) => {
            setAgencyName(e.target.value);
            if (fieldErrors.agencyName) {
              setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.agencyName;
                return newErrors;
              });
            }
          }}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Mi inmobiliaria"
          autoComplete="organization"
        />
        {fieldErrors.agencyName && (
          <p className="mt-1 text-sm text-destructive">
            {fieldErrors.agencyName}
          </p>
        )}
      </div>

      {/* First Name Field */}
      <div>
        <label
          htmlFor="firstName"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Nombre
        </label>
        <input
          id="firstName"
          type="text"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            if (fieldErrors.firstName) {
              setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.firstName;
                return newErrors;
              });
            }
          }}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Juan"
          autoComplete="given-name"
        />
        {fieldErrors.firstName && (
          <p className="mt-1 text-sm text-destructive">
            {fieldErrors.firstName}
          </p>
        )}
      </div>

      {/* Last Name Field */}
      <div>
        <label
          htmlFor="lastName"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Apellido
        </label>
        <input
          id="lastName"
          type="text"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value);
            if (fieldErrors.lastName) {
              setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.lastName;
                return newErrors;
              });
            }
          }}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Pérez"
          autoComplete="family-name"
        />
        {fieldErrors.lastName && (
          <p className="mt-1 text-sm text-destructive">
            {fieldErrors.lastName}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) {
              validateEmail(e.target.value);
            }
          }}
          onBlur={() => validateEmail(email)}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="usuario@ejemplo.com"
          autoComplete="email"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-sm text-destructive">{fieldErrors.email}</p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) {
              validatePassword(e.target.value);
            }
            // Clear confirm password error if passwords now match
            if (
              e.target.value === confirmPassword &&
              fieldErrors.confirmPassword
            ) {
              setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.confirmPassword;
                return newErrors;
              });
            }
          }}
          onBlur={() => validatePassword(password)}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {fieldErrors.password && (
          <p className="mt-1 text-sm text-destructive">
            {fieldErrors.password}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Mínimo 8 caracteres
        </p>
      </div>

      {/* Confirm Password Field */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Confirmar Contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword && e.target.value === password) {
              setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors.confirmPassword;
                return newErrors;
              });
            }
          }}
          onBlur={() => validatePasswordMatch()}
          disabled={isLoading}
          required
          className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {fieldErrors.confirmPassword && (
          <p className="mt-1 text-sm text-destructive">
            {fieldErrors.confirmPassword}
          </p>
        )}
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
        {isLoading ? "Registrando..." : "Registrarse"}
      </button>
    </form>
  );
}
