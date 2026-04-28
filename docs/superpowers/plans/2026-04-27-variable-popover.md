# Variable Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ctrl+Click en cualquier variable `[[path]]` de la preview del generador de documentos abre un popover para ver y sobreescribir el valor temporalmente.

**Architecture:** Se extienden `renderInline` y `renderClauseBody` con dos parámetros opcionales (`overrides` y `onVarClick`). Un nuevo componente `VariablePopover` se posiciona con `position: fixed` usando el `DOMRect` del span clickeado. El estado `overrides: Record<string, string>` vive en `DocumentTemplateEditor` y es efímero (no se persiste).

**Tech Stack:** React 19, TypeScript, Tailwind v4, shadcn/ui (Input, Button)

---

## File Map

| Archivo | Cambio |
|---------|--------|
| `src/lib/document-templates/render-segments.tsx` | Añadir `overrides` y `onVarClick` a `renderInline` y `renderClauseBody`; lógica ámbar para overrides; onClick en spans de variables |
| `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx` | Nuevo tipo `PopoverState`; nuevo componente `VariablePopover`; estados `overrides` y `popoverState`; handlers; render condicional del popover |
| `src/app/(dashboard)/generador-documentos/[id]/print.css` | Regla `@media print` para imprimir overrides ámbar en negro |

---

## Task 1: Extender render-segments.tsx

**Files:**
- Modify: `src/lib/document-templates/render-segments.tsx`

- [ ] **Step 1: Actualizar la firma de `renderInline` para aceptar `overrides` y `onVarClick`**

Reemplazar la línea 40 (inicio de la función `renderInline`) con esta nueva firma. Los dos parámetros nuevos van al final y son opcionales:

```tsx
function renderInline(
  text: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  freeTextValues: Record<string, string>,
  kp: string,
  overrides: Record<string, string> = {},
  onVarClick?: (path: string, rect: DOMRect) => void
): React.ReactNode[] {
```

- [ ] **Step 2: Reemplazar el bloque de renderizado de variables `[[path]]` dentro de `renderInline`**

Ubicar el bloque `else if (varPath !== undefined)` (líneas ~78–99) y reemplazarlo completo:

```tsx
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
    }
```

- [ ] **Step 3: Propagar `overrides` y `onVarClick` en las llamadas recursivas dentro de `renderInline`**

Las tres llamadas recursivas (para bold, italic y underline) quedan así:

```tsx
      nodes.push(
        <strong key={`${kp}-${ki++}`}>
          {renderInline(bold, resolved, hasContract, freeTextValues, `${kp}-bi${ki}`, overrides, onVarClick)}
        </strong>
      );
```
```tsx
      nodes.push(
        <em key={`${kp}-${ki++}`}>
          {renderInline(italic, resolved, hasContract, freeTextValues, `${kp}-ii${ki}`, overrides, onVarClick)}
        </em>
      );
```
```tsx
      nodes.push(
        <u key={`${kp}-${ki++}`}>
          {renderInline(underline, resolved, hasContract, freeTextValues, `${kp}-ui${ki}`, overrides, onVarClick)}
        </u>
      );
```

- [ ] **Step 4: Actualizar la firma de `renderClauseBody` y propagar los nuevos parámetros**

Reemplazar la firma de `renderClauseBody` (línea ~153):

```tsx
export function renderClauseBody(
  body: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  freeTextValues: Record<string, string> = {},
  lists: Record<string, Record<string, string | null>[]> = {},
  overrides: Record<string, string> = {},
  onVarClick?: (path: string, rect: DOMRect) => void
): React.ReactNode {
```

Dentro de `renderClauseBody`, hay dos llamadas a `renderInline` en la función `flushParagraph` y en el bloque de headings. Agregarles `overrides, onVarClick` al final:

```tsx
      <p key={`p-${bk++}`} style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {renderInline(txt, resolved, hasContract, freeTextValues, `p${bk}`, overrides, onVarClick)}
      </p>
```

```tsx
      <Tag key={`h${level}-${bk++}`} style={{ fontWeight: "bold", marginTop: level === 1 ? "1em" : "0.7em", marginBottom: "0.3em" }}>
        {renderInline(content, resolved, hasContract, freeTextValues, `h${bk}`, overrides, onVarClick)}
      </Tag>
```

- [ ] **Step 5: Verificar que TypeScript no tiene errores**

```bash
bun run lint
```

Esperado: sin errores de TypeScript en `render-segments.tsx`. Puede haber warnings de otros archivos no relacionados — ignorarlos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/document-templates/render-segments.tsx
git commit -m "feat(render-segments): add overrides + onVarClick to renderInline/renderClauseBody"
```

---

## Task 2: Agregar `VariablePopover` a document-template-editor.tsx

**Files:**
- Modify: `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx`

- [ ] **Step 1: Agregar `useEffect` a los imports de React**

La línea 4 actual es:
```tsx
import { useState, useRef, useCallback } from "react";
```
Cambiarla a:
```tsx
import { useState, useRef, useCallback, useEffect } from "react";
```

- [ ] **Step 2: Agregar el tipo `PopoverState` después del bloque de tipos existente (línea ~101)**

Agregar justo después de la definición de `ContractListItem`:

```tsx
type PopoverState = {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
};
```

- [ ] **Step 3: Agregar la constante `POPOVER_WIDTH` y el componente `VariablePopover`**

Agregar justo antes de la línea del comentario `// ─── Syntax highlighting for body textarea` (línea ~103):

```tsx
// ─── Variable popover ────────────────────────────────────────────────────────

const POPOVER_WIDTH = 264;

function VariablePopover({
  path,
  rect,
  resolvedValue,
  currentOverride,
  onApply,
  onClear,
  onClose,
}: {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
  currentOverride: string | undefined;
  onApply: (path: string, value: string) => void;
  onClear: (path: string) => void;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState(currentOverride ?? "");
  const ref = useRef<HTMLDivElement>(null);

  const catalogEntry = VARIABLES_CATALOG.find((v) => v.path === path);
  const hasOverride = currentOverride !== undefined;

  const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8);
  const top = rect.bottom + 6;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  const pathColor = hasOverride
    ? "text-amber-400"
    : resolvedValue !== null
    ? "text-emerald-500"
    : "text-destructive";

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5"
      style={{ left, top, width: POPOVER_WIDTH }}
    >
      <div>
        <code className={`text-xs font-mono ${pathColor}`}>[[{path}]]</code>
        {catalogEntry && (
          <p className="text-xs text-muted-foreground mt-0.5">{catalogEntry.label}</p>
        )}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          Valor del contrato
        </p>
        <p
          className={`text-xs font-medium px-2 py-1 rounded ${
            resolvedValue !== null
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {resolvedValue ?? "Sin datos"}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
          {hasOverride ? "Override activo" : "Sobreescribir para esta impresión"}
        </p>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply(path, inputValue);
          }}
          placeholder="Dejá vacío para usar el valor real"
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2 flex-1"
          onClick={onClose}
        >
          Cancelar
        </Button>
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            onClick={() => {
              onClear(path);
              onClose();
            }}
          >
            Limpiar
          </Button>
        )}
        <Button
          size="sm"
          className="h-6 text-xs px-2 flex-1"
          onClick={() => onApply(path, inputValue)}
        >
          {hasOverride ? "Actualizar" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
bun run lint
```

Esperado: sin errores en `document-template-editor.tsx`. El componente `VariablePopover` aún no está conectado al estado — eso va en el siguiente task.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx
git commit -m "feat(editor): add VariablePopover component and PopoverState type"
```

---

## Task 3: Conectar el estado en `DocumentTemplateEditor`

**Files:**
- Modify: `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx`

- [ ] **Step 1: Agregar los estados `overrides` y `popoverState` en `DocumentTemplateEditor`**

Dentro de `DocumentTemplateEditor`, buscar el bloque de `useState` existente que empieza en la línea ~827. Agregar los dos estados nuevos a continuación del bloque existente:

```tsx
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);
```

- [ ] **Step 2: Agregar los tres handlers**

Agregar después de la constante `contracts` (alrededor de línea ~895):

```tsx
  const handleVarClick = useCallback(
    (path: string, rect: DOMRect) => {
      setPopoverState({ path, rect, resolvedValue: resolved[path] ?? null });
    },
    [resolved]
  );

  function handleOverrideApply(path: string, value: string) {
    setOverrides((prev) => {
      if (!value.trim()) {
        const next = { ...prev };
        delete next[path];
        return next;
      }
      return { ...prev, [path]: value.trim() };
    });
    setPopoverState(null);
  }

  function handleOverrideClear(path: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }
```

- [ ] **Step 3: Actualizar la llamada a `renderClauseBody` en el preview**

Buscar la línea con `renderClauseBody(clause.body, resolved, hasContract, freeTextValues, lists)` (dentro del `activeClauses.map` en la columna derecha) y reemplazarla:

```tsx
{renderClauseBody(
  clause.body,
  resolved,
  hasContract,
  freeTextValues,
  lists,
  overrides,
  handleVarClick
)}
```

- [ ] **Step 4: Renderizar `VariablePopover` al final del JSX retornado**

Justo antes del `</>` de cierre del return de `DocumentTemplateEditor`, agregar:

```tsx
      {popoverState && (
        <VariablePopover
          path={popoverState.path}
          rect={popoverState.rect}
          resolvedValue={popoverState.resolvedValue}
          currentOverride={overrides[popoverState.path]}
          onApply={handleOverrideApply}
          onClear={handleOverrideClear}
          onClose={() => setPopoverState(null)}
        />
      )}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
bun run lint
```

Esperado: 0 errores.

- [ ] **Step 6: Verificar en el navegador**

```bash
bun dev
```

Ir a `/generador-documentos/[id]`. Seleccionar un contrato. Hacer `Ctrl+Click` sobre una variable verde → debe abrirse el popover con el valor resuelto. Hacer `Ctrl+Click` sobre una variable roja → debe mostrar "Sin datos". Hacer clic fuera → debe cerrarse.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx
git commit -m "feat(editor): wire overrides state and VariablePopover into DocumentTemplateEditor"
```

---

## Task 4: Regla de impresión para overrides ámbar

**Files:**
- Modify: `src/app/(dashboard)/generador-documentos/[id]/print.css`

- [ ] **Step 1: Agregar regla `@media print` para `.text-amber-400`**

En `print.css`, dentro del bloque `@media print { ... }`, agregar justo después de la regla existente para `.text-destructive` (línea ~103):

```css
  /* Override values (amber): print in black */
  #print-preview .text-amber-400 {
    color: #000 !important;
    font-weight: bold;
  }
```

- [ ] **Step 2: Verificar impresión**

Con el servidor corriendo (`bun dev`), abrir el generador, seleccionar un contrato, aplicar un override en alguna variable. Hacer clic en "Imprimir" (o `Ctrl+P`). En la vista previa de impresión, el valor override debe aparecer en negro, no en ámbar.

- [ ] **Step 3: Commit final**

```bash
git add src/app/(dashboard)/generador-documentos/[id]/print.css
git commit -m "fix(print): render override values in black for printing"
```

---

## QA Manual Completo

Después de todos los commits, verificar estos escenarios:

| Escenario | Pasos | Esperado |
|-----------|-------|----------|
| Variable verde, sin override | Ctrl+Click sobre valor verde en preview | Popover muestra valor real + input vacío |
| Variable roja, sin override | Ctrl+Click sobre variable roja `[[path]]` | Popover muestra "Sin datos" + input vacío |
| Aplicar override a variable roja | Abrir popover rojo → escribir valor → "Aplicar" | Variable cambia a ámbar, muestra el valor escrito |
| Aplicar override a variable verde | Abrir popover verde → escribir valor → "Aplicar" | Variable cambia a ámbar, sobreescribe el valor del contrato |
| Limpiar override | Ctrl+Click sobre variable ámbar → "Limpiar" | Vuelve al color original (verde o rojo) |
| Cerrar con Esc | Abrir popover → presionar Esc | Popover se cierra, sin cambios |
| Cerrar clicando fuera | Abrir popover → clic fuera | Popover se cierra, sin cambios |
| Clic sin Ctrl | Clic normal sobre variable en preview | Nada pasa |
| Impresión con override | Aplicar override → clic en Imprimir | Valor override aparece en negro en la vista de impresión |
| Sin contrato seleccionado | No hay preview activa | No hay variables clickeables |
