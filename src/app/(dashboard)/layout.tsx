import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/dashboard-layout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    const [existing] = await db
      .select({ id: agency.id })
      .from(agency)
      .where(eq(agency.ownerId, session.user.id))
      .limit(1);
    if (!existing) {
      redirect("/register-oauth");
    }
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}
