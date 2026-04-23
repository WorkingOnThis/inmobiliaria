import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
