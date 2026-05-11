"use client";

import { type ReactNode } from "react";

type Props = {
  topbar: ReactNode;
  paper: ReactNode;     // wrapped in Paper already
  sidebar: ReactNode;
};

export function DocumentPreviewShell({ topbar, paper, sidebar }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {topbar}
      <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
        <div
          className="overflow-auto p-7 flex justify-center items-start"
          style={{ background: "radial-gradient(circle at 1px 1px, oklch(0.25 0.008 40) 1px, transparent 0) 0 0 / 18px 18px, var(--bg)" }}
        >
          {paper}
        </div>
        <aside className="print:hidden border-l border-border bg-surface overflow-y-auto sticky top-14 h-[calc(100vh-56px)]">
          <div className="p-[18px] pb-6 flex flex-col gap-5">{sidebar}</div>
        </aside>
      </div>
    </div>
  );
}
