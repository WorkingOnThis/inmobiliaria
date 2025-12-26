import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CreateClauseForm } from "@/components/clauses/create-clause-form";
import { auth } from "@/lib/auth";
import { canManageClauses } from "@/lib/permissions";

// Forzar renderizado dinámico para prevenir cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Create Clause Page
 *
 * Página para crear nuevas plantillas de cláusulas de contratos.
 * Verifica permisos antes de mostrar el formulario.
 */
export default async function CreateClausePage() {
  // Obtener sesión del usuario
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Verificar que el usuario esté autenticado
  if (!session?.user) {
    redirect("/login?callbackUrl=/contratos/clausulas/nueva");
  }

  // Verificar permisos
  if (!canManageClauses(session.user.role)) {
    // Redirigir al tablero con mensaje de acceso denegado
    redirect("/tablero");
  }

  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-2 w-full items-center mx-auto">
          <h1 className="text-2xl font-bold">Crear nueva cláusula</h1>
          <p className="text-muted-foreground">
            Crea una nueva plantilla de cláusula para usar en contratos. Puedes
            incluir variables en el formato{" "}
            <code className="px-1 py-0.5 bg-muted rounded text-xs">
              {"{{variable}}"}
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col items-center">
          <CreateClauseForm />
        </div>
      </div>
    </DashboardLayout>
  );
}

