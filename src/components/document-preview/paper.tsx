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
      <style jsx global>{`
        .preview-watermark::before {
          content: 'BORRADOR';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-22deg);
          font-size: 140px;
          font-weight: 900;
          color: rgba(232, 90, 60, 0.1);
          letter-spacing: .05em;
          pointer-events: none;
          z-index: 1;
        }
        @media print {
          .preview-watermark::before { display: none; }
        }
      `}</style>
    </div>
  );
}
