import type { Metadata } from "next";
import { ServicesControlPanel } from "@/components/services/services-control-panel";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Servicios",
};

export default function ServiciosPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ServicesControlPanel />
      </Suspense>
    </div>
  );
}
