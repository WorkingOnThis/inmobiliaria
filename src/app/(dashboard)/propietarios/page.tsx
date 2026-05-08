import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnersList } from "@/components/owners/owners-list";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Propietarios",
};

export default function OwnersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OwnersList />
    </Suspense>
  );
}
