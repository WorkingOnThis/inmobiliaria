import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { redirect } from "next/navigation";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; email?: string; verified?: string }>;
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

  // Await searchParams (Next.js 15+ requires this)
  const params = await searchParams;

  // Si el usuario ya está autenticado y verificado, redirigir
  if (session?.user?.emailVerified) {
    redirect("/");
  }

  // Si hay un token, redirigir al endpoint de Better Auth para verificación
  // Better Auth maneja automáticamente la verificación cuando se visita /api/auth/verify-email
  if (params.token) {
    const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyURL = `${baseURL}/api/auth/verify-email?token=${params.token}${params.email ? `&email=${encodeURIComponent(params.email)}` : ""}&callbackURL=/verify-email?verified=true`;
    
    // Redirigir al endpoint de Better Auth que maneja la verificación
    redirect(verifyURL);
  }

  // Si hay un parámetro "verified=true", significa que la verificación fue exitosa
  if (params.verified === "true") {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-2">
            Email verificado exitosamente
          </h3>
          <p className="text-sm text-green-800 dark:text-green-200">
            Tu email ha sido verificado. Ahora puedes iniciar sesión.
          </p>
        </div>
      </div>
    );
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

      <VerifyEmailForm email={session?.user?.email || params.email} />
    </div>
  );
}

