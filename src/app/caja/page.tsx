import { DashboardLayout } from "@/components/dashboard-layout";
import { CajaGeneralClient } from "./caja-general-client";

export const metadata = {
  title: "Caja General — Arce Administración",
};

export default function CajaPage() {
  return (
    <DashboardLayout>
      <CajaGeneralClient />
    </DashboardLayout>
  );
}
