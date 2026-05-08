import type { Metadata } from "next";
import { Suspense } from "react";
import { ContractsList } from "@/components/contracts/contracts-list";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Contratos",
};

export default function ContratosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ContractsList />
    </Suspense>
  );
}
