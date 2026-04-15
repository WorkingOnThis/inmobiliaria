"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TareasPanel } from "@/components/tareas/tareas-panel";

export default function TareasPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <TareasPanel />
      </Suspense>
    </div>
  );
}
