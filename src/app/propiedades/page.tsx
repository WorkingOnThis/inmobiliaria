"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { PropertyList } from "@/components/properties/property-list";

export default function PropiedadesPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col">
        <PropertyList />
      </div>
    </DashboardLayout>
  );
}
