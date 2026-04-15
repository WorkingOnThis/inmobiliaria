import type { Metadata } from "next";
import { DashboardLayout } from "@/components/dashboard-layout";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tablero — Arce Administración",
  description: "Vista general del portfolio y estado del día",
};

export default function Page() {
  return (
    <DashboardLayout>
      <DashboardClient />
    </DashboardLayout>
  );
}
