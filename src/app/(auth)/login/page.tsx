import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

/**
 * Login Page
 *
 * Página de inicio de sesión. Redirige usuarios ya autenticados.
 * Maneja errores de callback (por ejemplo, OAuth errors).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Await searchParams before using it
  const params = await searchParams;

  // Verificar si el usuario ya está autenticado
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect(params.callbackUrl || "/dashboard");
  }

  // Determinar mensaje de error si existe
  let errorMessage: string | null = null;
  if (params?.error) {
    switch (params.error) {
      case "email_not_verified":
        errorMessage =
          "Por favor verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada.";
        break;
      case "credentials_invalid":
        errorMessage = "Email o contraseña incorrectos";
        break;
      default:
        errorMessage = "Ocurrió un error. Por favor intenta de nuevo.";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Bienvenido
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Ingresa a tu cuenta para continuar
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      <LoginForm callbackUrl={params.callbackUrl} />

      <OAuthButtons />

      <div className="text-center text-sm text-muted-foreground">
        <p>
          ¿No tienes una cuenta?{" "}
          <a
            href="/register"
            className="font-medium text-primary hover:text-primary/80"
          >
            Regístrate aquí
          </a>
        </p>
      </div>
    </div>
  );
}
