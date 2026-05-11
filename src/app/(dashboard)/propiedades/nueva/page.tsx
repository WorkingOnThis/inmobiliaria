import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageProperties } from "@/lib/permissions";
import { PropertyNewForm } from "./property-new-form";

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
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">Nueva propiedad</h1>
        <p className="text-muted-foreground mt-1">
          Los campos con * son obligatorios. El resto se puede completar desde la ficha.
        </p>
      </div>
      <PropertyNewForm defaultOwnerId={ownerId} />
    </div>
  );
}
