import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ClientForm } from "@/components/clients/client-form";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

// Forzar renderizado dinámico para prevenir cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Create Client Page
 *
 * Página para registrar nuevos clientes en el sistema.
 * Verifica permisos antes de mostrar el formulario.
 */
export default async function CreateClientPage() {
  // Obtener sesión del usuario
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Verificar que el usuario esté autenticado
  if (!session?.user) {
    redirect("/login?callbackUrl=/clientes/nuevo");
  }

  // Verificar permisos
  if (!canManageClients(session.user.role)) {
    // Redirigir al tablero si no tiene permisos
    redirect("/tablero");
  }

  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-2 w-full items-center mx-auto">
          <h1 className="text-2xl font-bold">Agregar nuevo cliente</h1>
          <p className="text-muted-foreground text-center max-w-lg">
            Completa los datos básicos del cliente para registrarlo en el sistema.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <ClientForm />
        </div>
      </div>
    </DashboardLayout>
  );
}

