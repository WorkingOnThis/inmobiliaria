"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ServiciosControlPanel } from "@/components/servicios/servicios-control-panel";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function ServiciosPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ServiciosControlPanel />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
