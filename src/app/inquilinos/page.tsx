"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { InquilinosList } from "@/components/inquilinos/inquilinos-list";
import { Loader2 } from "lucide-react";

export default function InquilinosPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <InquilinosList />
      </Suspense>
    </DashboardLayout>
  );
}
