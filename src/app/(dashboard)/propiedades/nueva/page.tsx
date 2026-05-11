import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuickPropertyForm } from "@/components/properties/quick-property-form";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreatePropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login?callbackUrl=/propiedades/nueva");
  }

  if (!canManageProperties(session.user.role)) {
    redirect("/tablero");
  }

  const { ownerId } = await searchParams;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">Nueva propiedad</h1>
        <p className="text-muted-foreground mt-1">
          Completá los datos mínimos para crear la ficha. Podés agregar más información después.
        </p>
      </div>
      <QuickPropertyForm defaultOwnerId={ownerId} />
    </div>
  );
}
