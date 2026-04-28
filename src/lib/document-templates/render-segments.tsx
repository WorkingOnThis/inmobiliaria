import React from "react";

// ─── Patterns ────────────────────────────────────────────────────────────────

const FOR_RE = /\[\[for:(\w+)\]\]([\s\S]*?)\[\[\/for\]\]/g;
const IF_RE = /\[\[if:([^\]]+)\]\]([\s\S]*?)\[\[\/if\]\]/g;

// Inline: ** before * to avoid mis-matching bold as italic
const INLINE_RE =
  /\*\*(.+?)\*\*|\*([^*\n]+?)\*|__([^_\n]+?)__|\[\[([^\]]+)\]\]|\{\{(\w+)(?:\s+\[([^\]]*)\])?\}\}/g;

// Free text vars: {{name [default]}}
const FREE_VAR_RE = /\{\{(\w+)(?:\s+\[([^\]]*)\])?\}\}/g;

// ─── Free text variable types ─────────────────────────────────────────────────

export type FreeTextVar = {
  name: string;
  defaultVal: string;
};

export function parseFreeTextVarsFromBodies(bodies: string[]): FreeTextVar[] {
  const seen = new Set<string>();
  const vars: FreeTextVar[] = [];
  for (const body of bodies) {
    FREE_VAR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FREE_VAR_RE.exec(body)) !== null) {
      if (!seen.has(m[1])) {
        vars.push({ name: m[1], defaultVal: m[2] ?? "" });
        seen.add(m[1]);
      }
    }
  }
  return vars;
}

// ─── Inline renderer ─────────────────────────────────────────────────────────

function renderInline(
  text: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  freeTextValues: Record<string, string>,
  kp: string,
  overrides: Record<string, string> = {},
  onVarClick?: (path: string, rect: DOMRect) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let ki = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }

    const [full, bold, italic, underline, varPath, freeVarName, freeVarDefault] = m;

    if (bold !== undefined) {
      nodes.push(
        <strong key={`${kp}-${ki++}`}>
          {renderInline(bold, resolved, hasContract, freeTextValues, `${kp}-bi${ki}`, overrides, onVarClick)}
        </strong>
      );
    } else if (italic !== undefined) {
      nodes.push(
        <em key={`${kp}-${ki++}`}>
          {renderInline(italic, resolved, hasContract, freeTextValues, `${kp}-ii${ki}`, overrides, onVarClick)}
        </em>
      );
    } else if (underline !== undefined) {
      nodes.push(
        <u key={`${kp}-${ki++}`}>
          {renderInline(underline, resolved, hasContract, freeTextValues, `${kp}-ui${ki}`, overrides, onVarClick)}
        </u>
      );
    } else if (varPath !== undefined) {
      const path = varPath.trim();
      const isControlMarker =
        path.startsWith("if:") || path.startsWith("for:") ||
        path === "/if" || path === "/for";

      const clickHandler =
        !isControlMarker && onVarClick
          ? (e: React.MouseEvent<HTMLSpanElement>) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                onVarClick(path, (e.currentTarget as HTMLElement).getBoundingClientRect());
              }
            }
          : undefined;

      const interactive = clickHandler
        ? { onClick: clickHandler, style: { cursor: "pointer" } as React.CSSProperties }
        : {};

      if (!hasContract) {
        nodes.push(
          <span key={`${kp}-${ki++}`} className="text-primary" {...interactive}>
            {full}
          </span>
        );
      } else {
        const override = overrides[path];
        if (override !== undefined && !isControlMarker) {
          nodes.push(
            <span key={`${kp}-${ki++}`} className="text-amber-400 font-medium" {...interactive}>
              {override}
            </span>
          );
        } else {
          const val = resolved[path];
          nodes.push(
            val !== null && val !== undefined ? (
              <span key={`${kp}-${ki++}`} className="text-emerald-500 font-medium" {...interactive}>
                {val}
              </span>
            ) : (
              <span key={`${kp}-${ki++}`} className="text-destructive font-bold" {...interactive}>
                {full}
              </span>
            )
          );
        }
      }
    } else if (freeVarName !== undefined) {
      const provided = freeTextValues[freeVarName];
      if (provided !== undefined && provided !== "") {
        nodes.push(
          <span key={`${kp}-${ki++}`} className="text-amber-400 font-medium">
            {provided}
          </span>
        );
      } else if (freeVarDefault) {
        nodes.push(
          <span key={`${kp}-${ki++}`} className="text-amber-300/80 italic">
            {freeVarDefault}
          </span>
        );
      } else {
        nodes.push(
          <span key={`${kp}-${ki++}`} className="text-amber-400 font-bold">
            {full}
          </span>
        );
      }
    }

    last = m.index + full.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ─── For-block expander ───────────────────────────────────────────────────────

function expandForBlocks(
  body: string,
  lists: Record<string, Record<string, string | null>[]>
): string {
  FOR_RE.lastIndex = 0;
  return body.replace(FOR_RE, (_full, entity: string, inner: string) => {
    const items = lists[entity];
    if (!items?.length) return "";
    return items
      .map((item) =>
        inner.replace(/\[\[item\.(\w+)\]\]/g, (_m, key: string) => {
          const v = item[key];
          return v != null ? v : `[[item.${key}]]`;
        })
      )
      .join("");
  });
}

// ─── Clause body renderer (markdown + vars + free-text) ──────────────────────

export function renderClauseBody(
  body: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  freeTextValues: Record<string, string> = {},
  lists: Record<string, Record<string, string | null>[]> = {},
  overrides: Record<string, string> = {},
  onVarClick?: (path: string, rect: DOMRect) => void
): React.ReactNode {
  // Pass 0 — expand [[for:entidad]]...[[/for]] blocks
  const withForExpanded = expandForBlocks(body, lists);

  // Pass 1 — expand [[if:]] conditionals
  IF_RE.lastIndex = 0;
  const processed = withForExpanded.replace(IF_RE, (_, path: string, content: string) => {
    const val = resolved[path.trim()];
    return val !== null && val !== undefined ? content : "";
  });

  // Pass 2 — split into lines, detect block-level markdown
  const lines = processed.split("\n");
  const blocks: React.ReactNode[] = [];
  const pending: string[] = [];
  let bk = 0;

  function flushParagraph() {
    if (!pending.length) return;
    const txt = pending.join("\n");
    blocks.push(
      <p
        key={`p-${bk++}`}
        style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      >
        {renderInline(txt, resolved, hasContract, freeTextValues, `p${bk}`, overrides, onVarClick)}
      </p>
    );
    pending.length = 0;
  }

  for (const line of lines) {
    const hm = line.match(/^(#{1,4})\s+(.*)/);
    if (hm) {
      flushParagraph();
      const level = hm[1].length;
      const content = hm[2];
      const Tag = (["h3", "h4", "h5", "h6"] as const)[level - 1];
      blocks.push(
        <Tag
          key={`h${level}-${bk++}`}
          style={{
            fontWeight: "bold",
            marginTop: level === 1 ? "1em" : "0.7em",
            marginBottom: "0.3em",
          }}
        >
          {renderInline(content, resolved, hasContract, freeTextValues, `h${bk}`, overrides, onVarClick)}
        </Tag>
      );
    } else if (line.trim() === "") {
      flushParagraph();
      if (blocks.length > 0) {
        blocks.push(<div key={`br-${bk++}`} style={{ height: "0.4em" }} />);
      }
    } else {
      pending.push(line);
    }
  }
  flushParagraph();

  return <>{blocks}</>;
}

// ─── Legacy export ────────────────────────────────────────────────────────────

export function renderPreviewSegments(
  text: string,
  resolved: Record<string, string | null>
): React.ReactNode[] {
  return [renderClauseBody(text, resolved, true, {})];
}
