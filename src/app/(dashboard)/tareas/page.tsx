import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TasksPanel } from "@/components/tasks/tasks-panel";

export const metadata: Metadata = {
  title: "Tareas",
};

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
        <TasksPanel />
      </Suspense>
    </div>
  );
}
