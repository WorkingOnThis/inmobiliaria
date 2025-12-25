import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * Register Page
 *
 * Página de registro de nuevos usuarios.
 * Redirige a tablero si el usuario ya está autenticado y verificado.
 */
export default async function RegisterPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Si el usuario ya está autenticado y verificado, redirigir
  if (session?.user?.emailVerified) {
    redirect("/");
  }

  // Si está autenticado pero no verificado, redirigir a verificación
  if (session?.user && !session.user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-2xl font-bold text-foreground">
          Crear cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Completa el formulario para crear tu cuenta
        </p>
      </div>

      <RegisterForm />

      <OAuthButtons mode="signup" />

      <div className="text-center text-sm">
        <span className="text-muted-foreground">¿Ya tienes una cuenta? </span>
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary/80"
        >
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}
