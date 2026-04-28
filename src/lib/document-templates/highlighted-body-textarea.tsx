"use client";

import { useRef } from "react";

export function getHighlightedHTML(
  value: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  overrides: Record<string, string> = {}
): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withSysVars = escaped.replace(/\[\[([^\]]*)\]\]/g, (match, inner: string) => {
    const trimmed = inner.trim();
    if (
      trimmed.startsWith("if:") || trimmed === "/if" ||
      trimmed.startsWith("for:") || trimmed === "/for"
    ) {
      return `<span style="color:var(--muted-foreground)">${match}</span>`;
    }
    if (!hasContract) {
      return `<span style="color:hsl(var(--primary))">${match}</span>`;
    }
    if (overrides[trimmed] !== undefined) {
      return `<span style="color:var(--mustard)">${overrides[trimmed]}</span>`;
    }
    const val = resolved[trimmed];
    const color = val !== null && val !== undefined ? "var(--green)" : "hsl(var(--destructive))";
    return `<span style="color:${color}">${match}</span>`;
  });

  return withSysVars.replace(/\{\{(\w+)(?:\s+\[[^\]]*\])?\}\}/g, (match) => {
    return `<span style="color:var(--mustard)">${match}</span>`;
  });
}

export function HighlightedBodyTextarea({
  value,
  onChange,
  resolved,
  hasContract,
  overrides = {},
  minHeight = "240px",
  placeholder,
  textareaRef: externalRef,
  onBodyBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  resolved: Record<string, string | null>;
  hasContract: boolean;
  overrides?: Record<string, string>;
  minHeight?: string;
  placeholder?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onBodyBlur?: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? internalRef;

  function syncScroll() {
    if (backdropRef.current && ref.current) {
      backdropRef.current.scrollTop = ref.current.scrollTop;
    }
  }

  const highlighted = getHighlightedHTML(value, resolved, hasContract, overrides);

  const sharedStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
    lineHeight: "1.5rem",
    padding: "8px 12px",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  };

  return (
    <div className="relative rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
      <div
        aria-hidden="true"
        className="invisible w-full"
        style={{ ...sharedStyle, minHeight }}
      >
        {value + "\n"}
      </div>
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ ...sharedStyle, color: "var(--foreground)" }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onBlur={onBodyBlur}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full resize-none bg-transparent focus:outline-none placeholder:text-muted-foreground"
        style={{ ...sharedStyle, color: "transparent", caretColor: "var(--foreground)" }}
      />
    </div>
  );
}
