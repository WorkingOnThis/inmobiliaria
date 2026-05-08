import type { Metadata } from "next";
import { Suspense } from "react";
import { TenantsList } from "@/components/tenants/tenants-list";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Inquilinos",
};

export default function TenantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TenantsList />
    </Suspense>
  );
}
