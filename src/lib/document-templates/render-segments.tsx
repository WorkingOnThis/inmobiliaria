import React from "react";

// Conditional block: [[if:path]]content[[/if]]
// If `path` resolves to a non-null value, the inner content is kept.
// Otherwise the entire block is removed.
const IF_RE = /\[\[if:([^\]]+)\]\]([\s\S]*?)\[\[\/if\]\]/g;

// Variable placeholder: [[path]]
const VAR_RE = /\[\[([^\]]+)\]\]/g;

export function renderPreviewSegments(
  text: string,
  resolved: Record<string, string | null>
): React.ReactNode[] {
  // Pass 1 — resolve conditional blocks
  IF_RE.lastIndex = 0;
  const processed = text.replace(IF_RE, (_, path: string, content: string) => {
    const val = resolved[path.trim()];
    return val !== null && val !== undefined ? content : "";
  });

  // Pass 2 — replace [[path]] with values or error spans
  const parts: React.ReactNode[] = [];
  let last = 0;
  VAR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = VAR_RE.exec(processed)) !== null) {
    if (match.index > last) {
      parts.push(<span key={`t-${last}`}>{processed.slice(last, match.index)}</span>);
    }
    const path = match[1].trim();
    const value = resolved[path];
    if (value !== null && value !== undefined) {
      parts.push(
        <span key={`v-${match.index}`} className="text-emerald-500 font-medium">
          {value}
        </span>
      );
    } else {
      parts.push(
        <span key={`m-${match.index}`} className="text-destructive font-bold">
          {match[0]}
        </span>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < processed.length) {
    parts.push(<span key="t-end">{processed.slice(last)}</span>);
  }
  return parts;
}
