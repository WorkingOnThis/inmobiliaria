import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export default async function ReciboByNumberPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { numero } = await params;

  const [mov] = await db
    .select({ id: cajaMovimiento.id })
    .from(cajaMovimiento)
    .where(
      and(
        eq(cajaMovimiento.reciboNumero, numero),
        eq(cajaMovimiento.tipoFondo, "agencia")
      )
    )
    .limit(1);

  if (!mov) notFound();

  redirect(`/recibos/${mov.id}`);
}
