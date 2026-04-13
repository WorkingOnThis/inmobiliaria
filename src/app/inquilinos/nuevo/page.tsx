import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardLayout } from "@/components/dashboard-layout";
import { InquilinoForm } from "@/components/inquilinos/inquilino-form";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevoInquilinoPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login?callbackUrl=/inquilinos/nuevo");
  }

  if (!canManageClients(session.user.role)) {
    redirect("/tablero");
  }

  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-2 w-full items-center mx-auto">
          <h1 className="text-2xl font-bold">Agregar inquilino</h1>
          <p className="text-muted-foreground text-center max-w-lg">
            Registrá los datos del inquilino para vincularlo a un contrato.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <InquilinoForm />
        </div>
      </div>
    </DashboardLayout>
  );
}
