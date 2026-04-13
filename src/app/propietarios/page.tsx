"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PropietariosList } from "@/components/propietarios/propietarios-list";
import { Loader2 } from "lucide-react";

export default function PropietariosPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <PropietariosList />
      </Suspense>
    </DashboardLayout>
  );
}
