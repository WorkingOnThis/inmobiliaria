import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/dashboard-layout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user && !session.user.agencyId) {
    redirect("/register-oauth");
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}
