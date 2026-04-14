import React from "react";

export type StatusBadgeVariant =
  | "green"
  | "income"
  | "mustard"
  | "blue"
  | "red"
  | "orange"
  | "muted";

const STYLES: Record<StatusBadgeVariant, { bg: string; color: string }> = {
  green:   { bg: "var(--status-rented-dim)",      color: "var(--status-rented)" },
  income:  { bg: "var(--income-dim)",             color: "var(--income)" },
  mustard: { bg: "var(--status-available-dim)",   color: "var(--status-available)" },
  blue:    { bg: "var(--status-reserved-dim)",    color: "var(--status-reserved)" },
  red:     { bg: "var(--destructive-dim)",        color: "var(--destructive)" },
  orange:  { bg: "var(--status-maintenance-dim)", color: "var(--status-maintenance)" },
  muted:   { bg: "var(--muted)",                  color: "var(--muted-foreground)" },
};

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  const { bg, color } = STYLES[variant];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.6rem] font-bold rounded-full"
      style={{ background: bg, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current block flex-shrink-0" />
      {children}
    </span>
  );
}
