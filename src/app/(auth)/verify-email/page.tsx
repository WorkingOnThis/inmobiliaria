import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { redirect } from "next/navigation";

interface VerifyEmailPageProps {
  searchParams: { token?: string; email?: string };
}

/**
 * Verify Email Page
 * 
 * Página para verificar email o reenviar email de verificación.
 * Si se proporciona un token, intenta verificar el email.
 */
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Si el usuario ya está autenticado y verificado, redirigir
  if (session?.user?.emailVerified) {
    redirect("/");
  }

  // Si hay un token, intentar verificar el email
  if (searchParams.token) {
    try {
      // Better Auth maneja la verificación automáticamente cuando se visita la URL
      // Pero podemos hacer una llamada explícita si es necesario
      // Por ahora, asumimos que Better Auth manejará esto vía callback
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">
            Verificando email...
          </h3>
          <p className="text-sm text-muted-foreground">
            Por favor espera mientras verificamos tu email.
          </p>
        </div>
      );
    } catch (error) {
      return (
        <div className="space-y-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">
              El token de verificación es inválido o ha expirado. Por favor solicita un nuevo email de verificación.
            </p>
          </div>
          <VerifyEmailForm email={session?.user?.email || searchParams.email} />
        </div>
      );
    }
  }

  // Mostrar formulario para reenviar email de verificación
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">
          Verifica tu email
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {session?.user
            ? `Hemos enviado un email de verificación a ${session.user.email}. Por favor revisa tu bandeja de entrada y haz clic en el link para verificar tu cuenta.`
            : "Ingresa tu email para recibir un link de verificación."}
        </p>
      </div>

      <VerifyEmailForm email={session?.user?.email || searchParams.email} />
    </div>
  );
}

