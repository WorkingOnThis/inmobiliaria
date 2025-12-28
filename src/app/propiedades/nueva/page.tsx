import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PropertyForm } from "@/components/properties/property-form";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";

// Forzar renderizado dinámico para prevenir cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Create Property Page
 *
 * Página para registrar nuevas propiedades en el sistema.
 * Verifica permisos antes de mostrar el formulario.
 */
export default async function CreatePropertyPage() {
  // Obtener sesión del usuario
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Verificar que el usuario esté autenticado
  if (!session?.user) {
    redirect("/login?callbackUrl=/propiedades/nueva");
  }

  // Verificar permisos
  if (!canManageProperties(session.user.role)) {
    // Redirigir al tablero si no tiene permisos
    redirect("/tablero");
  }

  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-2 w-full items-center mx-auto">
          <h1 className="text-2xl font-bold">Agregar nueva propiedad</h1>
          <p className="text-muted-foreground text-center max-w-lg">
            Completa los detalles de la propiedad para registrarla en el inventario.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <PropertyForm />
        </div>
      </div>
    </DashboardLayout>
  );
}

