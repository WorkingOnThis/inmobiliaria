"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PaperProps = {
  watermark?: boolean;
  zoom?: number;
  children: ReactNode;
};

export function Paper({ watermark = false, zoom = 1, children }: PaperProps) {
  return (
    <div className="paper-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform .2s" }}>
      <div
        className={cn(
          "relative w-[794px] min-h-[1123px] bg-[#f7f5ef] text-[#1a1614] shadow-[0_4px_12px_rgba(0,0,0,.4),0_20px_60px_rgba(0,0,0,.5)] rounded-[2px] font-sans p-[56px_64px]",
          watermark && "preview-watermark"
        )}
      >
        {children}
      </div>
    </div>
  );
}
