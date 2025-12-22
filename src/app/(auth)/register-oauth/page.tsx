import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/better-auth";
import { agency } from "@/db/schema/agency";
import { eq } from "drizzle-orm";
import { RegisterOAuthForm } from "@/components/auth/register-oauth-form";
import { redirect } from "next/navigation";

/**
 * Register OAuth Page
 * 
 * Página para completar registro OAuth solicitando nombre de inmobiliaria.
 * Se muestra después de autenticación OAuth exitosa si el usuario no tiene inmobiliaria.
 */
export default async function RegisterOAuthPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Si no hay sesión, redirigir a login
  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user.email;

  // Check if user already has agency
  const existingAgency = await db
    .select()
    .from(agency)
    .where(eq(agency.ownerId, session.user.id))
    .limit(1);

  // If already has agency, redirect to dashboard
  if (existingAgency.length > 0) {
    redirect("/");
  }

  // Obtener información del usuario de Better Auth
  const betterAuthUser = await db
    .select()
    .from(user)
    .where(eq(user.email, userEmail))
    .limit(1);

  if (betterAuthUser.length === 0) {
    redirect("/login");
  }

  const userName = betterAuthUser[0].name || userEmail;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-2xl font-bold text-foreground">
          Completa tu registro
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Un último paso para crear tu cuenta
        </p>
      </div>

      <RegisterOAuthForm email={userEmail} name={userName} />
    </div>
  );
}


