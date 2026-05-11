# Arce Administración — Especificaciones Visuales Detalladas

## Sistema de Colores (oklch → Tailwind)

### Conversión a Tailwind/Hex (referencia aproximada)

| Variable | oklch | Hex (aprox) | Uso |
|----------|-------|-------------|-----|
| --bg | oklch(0.165 0.006 40) | #1a1a1a | Fondo principal, page bg |
| --bg-raise | oklch(0.195 0.007 40) | #232323 | Inputs, raised surfaces |
| --panel | oklch(0.215 0.008 40) | #282828 | Cards, modals, panels |
| --panel-2 | oklch(0.235 0.008 40) | #303030 | Toggle bg, nested panels |
| --line | oklch(0.285 0.010 40) | #404040 | Standard borders |
| --line-soft | oklch(0.255 0.010 40) | #383838 | Soft dividers, dashed borders |
| --text | oklch(0.972 0.004 60) | #f7f7f7 | Foreground text |
| --text-muted | oklch(0.72 0.012 50) | #a8a8a8 | Secondary text, labels |
| --text-dim | oklch(0.54 0.012 40) | #6a6a6a | Tertiary text, helper text |
| --accent | oklch(0.585 0.135 32) | #d97757 | Buttons, highlights, links |
| --accent-hover | oklch(0.635 0.14 32) | #e88d6f | Accent on hover (lighter) |
| --accent-soft | oklch(0.585 0.135 32 / .16) | rgba(217, 119, 87, 0.16) | Background tint |
| --accent-ink | oklch(0.97 0.02 34) | #f5f5f5 | Text on accent bg |
| --success | oklch(0.74 0.14 155) | #3ba55d | Success messages, pills |
| --success-soft | oklch(0.74 0.14 155 / .14) | rgba(59, 165, 93, 0.14) | Success tint |
| --warn | oklch(0.80 0.13 85) | #c9a227 | Warning pills |
| --warn-soft | oklch(0.80 0.13 85 / .14) | rgba(201, 162, 39, 0.14) | Warning tint |
| --danger | oklch(0.68 0.18 25) | #d32f2f | Negative amounts, deletions |

**Nota**: Tailwind no soporta oklch nativamente en versiones < 3.4. Usa el color hex o extiende tailwind.config.js con oklch strings.

## Tipografía Detallada

### Family Stack
```
--font-ui: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace
```

### Escala de Tamaños

| Uso | Size | Weight | Line Height | Letter Spacing |
|-----|------|--------|-------------|-----------------|
| H1 (owner name) | 22px | 650 | 1.2 | -0.015em |
| H3 (modal titles) | 15px | 600 | 1.2 | 0 |
| H4 (section titles) | 14px | 600 | 1.3 | 0 |
| Body (default) | 13.5px | 400 | 1.45 | 0 |
| Body Bold | 13.5px | 600 | 1.45 | 0 |
| Label (form) | 11.5px | 500 | 1.2 | 0.05em |
| Label Caps | 10.5px | 600 | 1.1 | 0.06–0.08em |
| Small | 12px | 400 | 1.4 | 0 |
| Small Bold | 12px | 600 | 1.4 | 0 |
| Mono (amounts) | 13px | 500 | 1.4 | 0 |
| Mono (labels) | 11px | 400 | 1.3 | 0 |
| Tiny | 11px | 400 | 1.2 | 0 |

### Font-variant-numeric
Para monospace de montos/fechas:
```css
font-variant-numeric: tabular-nums;  /* Ancho fijo en dígitos */
```

## Componentes & Detalle

### Button Variants

#### Primary Button
```
Padding: 7px 12px
Font: 13px, weight 600, Inter
Background: var(--accent)
Text: #fff / var(--accent-ink)
Border: none
Border-radius: 7px
Hover: bg var(--accent-hover)
Active: transform translateY(1px)
```

#### Secondary Button (default)
```
Padding: 7px 12px
Font: 13px, weight 500, Inter
Background: var(--bg-raise)
Text: var(--text)
Border: 1px solid var(--line)
Border-radius: 7px
Hover: bg var(--panel)
```

#### Ghost Button
```
Padding: 7px 12px
Font: 13px, weight 500, Inter
Background: transparent
Text: var(--text-muted) → var(--text) on hover
Border: transparent
Hover: bg var(--panel)
```

#### Icon Button
```
Width: 30px
Height: 30px
Border-radius: 7px
Border: 1px solid var(--line)
Background: var(--bg-raise)
Icon: 14×14px
Color: var(--text-muted) → var(--text) on hover
```

### Form Inputs

```css
Input / Select / Textarea {
  Background: var(--bg);
  Border: 1px solid var(--line);
  Color: var(--text);
  Padding: 9px 11px;
  Border-radius: 7px;
  Font: inherit;
  Font-size: 13px;
  Outline: none;
}

Input:focus {
  Border-color: var(--accent);
  Box-shadow: 0 0 0 3px var(--accent-soft);
}
```

### Pills & Badges

#### Pill (Status)
```
Display: inline-flex
Align-items: center
Gap: 6px
Font-size: 11px
Font-weight: 600
Padding: 3px 8px
Border-radius: 999px
Text-transform: uppercase
Letter-spacing: 0.04em

.pill.success {
  Background: var(--success-soft);
  Color: var(--success);
}

.pill.warn {
  Background: var(--warn-soft);
  Color: var(--warn);
}

.dot {
  Width: 6px;
  Height: 6px;
  Border-radius: 50%;
  Background: currentColor;
}
```

#### Badge (Label)
```
Font-family: JetBrains Mono
Font-size: 11px
Color: var(--text-dim)
Padding: 2px 7px
Border-radius: 4px
Background: var(--bg-raise)
Border: 1px solid var(--line)
```

### Cards & Panels

#### Standard Card
```
Background: var(--card-bg) [CSS variable, changes with data-card attribute]
Border: 1px solid var(--line)
Border-radius: 10px
Padding: varies (12–14px typical)
Box-shadow: var(--card-shadow) [none by default]

/* Variants via data-card attribute */
[data-card="flat"]: 
  Background: transparent
  Border: 1px solid var(--line-soft)
  
[data-card="bordered"]:
  Background: var(--bg)
  Border: 1px solid var(--line)
  
[data-card="elevated"]:
  Background: var(--panel)
  Border: 1px solid transparent
  Box-shadow: 0 1px 0 rgba(255,255,255,.02), 0 6px 20px -12px rgba(0,0,0,.7)
```

### Tables

#### Movements Table
```
.mov {
  Width: 100%
  Border-collapse: separate
  Border-spacing: 0
  Font-variant-numeric: tabular-nums
}

thead th {
  Text-align: left
  Font-size: 10.5px
  Letter-spacing: 0.07em
  Text-transform: uppercase
  Color: var(--text-dim)
  Font-weight: 600
  Padding: 10px 14px
  Border-bottom: 1px solid var(--line-soft)
  Background: transparent
  Position: sticky
  Top: 0
}

tbody td {
  Padding: 11px 14px
  Border-bottom: 1px solid var(--line-soft)
  Font-size: 13px
}

tbody tr:hover td {
  Background: var(--bg-raise)
}

/* Numeric columns: right-aligned mono */
td.num {
  Text-align: right
  Font-family: JetBrains Mono
  Font-weight: 500
}

td.num.pos {
  Color: var(--success)
}

td.num.neg {
  Color: var(--danger)
}

/* Row selection */
tr.checked td {
  Background: color-mix(in oklab, var(--accent-soft) 40%, transparent)
}

.rowcheck {
  Display: inline-grid
  Place-items: center
  Width: 16px
  Height: 16px
  Border-radius: 4px
  Border: 1px solid var(--line)
  Background: var(--bg)
  Cursor: pointer
}

tr.checked .rowcheck {
  Background: var(--accent)
  Border-color: transparent
}

tr.checked .rowcheck::after {
  Content: ''
  Width: 8px
  Height: 4px
  Border-left: 2px solid #fff
  Border-bottom: 2px solid #fff
  Transform: rotate(-45deg) translate(1px, -1px)
}
```

### Modals

```
.scrim {
  Position: fixed
  Inset: 0
  Background: oklch(0.09 0.003 40 / 0.66)  /* Dark overlay */
  Display: none  /* flex when open */
  Align-items: center
  Justify-content: center
  Z-index: 50
  Padding: 20px
}

.modal {
  Width: 560px
  Max-width: 100%
  Background: var(--panel)
  Border: 1px solid var(--line)
  Border-radius: 14px
  Box-shadow: 0 20px 60px rgba(0,0,0,.5)
  Overflow: hidden
}

.modal-head {
  Padding: 16px 18px
  Border-bottom: 1px solid var(--line-soft)
  Display: flex
  Align-items: center
  Gap: 12px
}

.modal-head h3 {
  Margin: 0
  Font-size: 15px
  Font-weight: 600
}

.modal-head .sub {
  Color: var(--text-dim)
  Font-size: 12px
  Margin-top: 2px
}

.modal-body {
  Padding: 16px 18px
}

.modal-foot {
  Padding: 12px 18px
  Border-top: 1px solid var(--line-soft)
  Display: flex
  Align-items: center
  Gap: 8px
  Justify-content: flex-end
  Background: var(--bg-raise)
}
```

### Segmented Controls (Toggle Group)

```
.seg {
  Display: inline-flex
  Background: var(--bg-raise)
  Border: 1px solid var(--line)
  Border-radius: 7px
  Padding: 2px
}

.seg button {
  Background: transparent
  Border: 0
  Padding: 5px 10px
  Border-radius: 5px
  Color: var(--text-muted)
  Font-size: 12.5px
  Cursor: pointer
  Display: inline-flex
  Align-items: center
  Gap: 6px
  Transition: .15s
}

.seg button:hover {
  Color: var(--text)
}

.seg button.on {
  Background: var(--panel-2)
  Color: var(--text)
  Box-shadow: 0 1px 0 rgba(0,0,0,.2)
}

/* In modal, accent variant */
.modal .seg button.on {
  Background: var(--accent-soft)
  Color: var(--text)
  Border: 1px solid var(--accent)
}
```

### Dropzone

```
.dropzone {
  Border: 1.5px dashed var(--line)
  Border-radius: 10px
  Background: var(--bg)
  Padding: 28px 20px
  Text-align: center
  Cursor: pointer
  Transition: border-color .15s, background .15s
  Position: relative
}

.dropzone:hover,
.dropzone.over {
  Border-color: var(--accent)
  Background: var(--accent-soft)
}

.dropzone.has-file {
  Border-style: solid
  Border-color: var(--accent)
  Background: var(--accent-soft)
}

.dz-icon {
  Width: 36px
  Height: 36px
  Border-radius: 9px
  Background: var(--panel)
  Border: 1px solid var(--line)
  Display: grid
  Place-items: center
  Margin: 0 auto 10px
  Color: var(--text-muted)
}

.dz-lbl {
  Font-size: 13.5px
  Font-weight: 600
  Color: var(--text)
}

.dz-sub {
  Font-size: 12px
  Color: var(--text-dim)
  Margin-top: 4px
}

.dz-file-info {
  Display: flex
  Align-items: center
  Gap: 10px
  Background: var(--bg)
  Border: 1px solid var(--line)
  Border-radius: 8px
  Padding: 10px 12px
  Margin-top: 10px
}

.dz-fname {
  Font-size: 13px
  Font-weight: 500
  Min-width: 0
  Overflow: hidden
  Text-overflow: ellipsis
  White-space: nowrap
  Flex: 1
}

.dz-fsize {
  Font-size: 12px
  Color: var(--text-dim)
  Font-family: JetBrains Mono
  White-space: nowrap
}
```

### Radio Options (Custom)

```
.base-opt {
  Display: flex
  Align-items: flex-start
  Gap: 10px
  Padding: 10px 12px
  Border: 1px solid var(--line)
  Border-radius: 8px
  Background: var(--bg)
  Cursor: pointer
  Transition: border-color .12s, background .12s
}

.base-opt:hover {
  Border-color: var(--line-soft)
}

.base-opt.on {
  Border-color: var(--accent)
  Background: var(--accent-soft)
}

.base-opt .r {
  Width: 14px
  Height: 14px
  Border-radius: 50%
  Border: 1.5px solid var(--line)
  Margin-top: 2px
  Flex: 0 0 14px
  Position: relative
}

.base-opt.on .r {
  Border-color: var(--accent)
}

.base-opt.on .r::after {
  Content: ''
  Position: absolute
  Inset: 2px
  Border-radius: 50%
  Background: var(--accent)
}

.base-opt .t {
  Font-size: 13px
  Font-weight: 500
}

.base-opt .s {
  Font-size: 11.5px
  Color: var(--text-muted)
  Margin-top: 2px
}

.base-opt .s b {
  Font-family: JetBrains Mono
  Color: var(--text)
  Font-weight: 500
}
```

### Toast Notification

```
.toast {
  Position: fixed
  Left: 50%
  Bottom: 24px
  Transform: translate(-50%, 20px)
  Background: var(--panel)
  Border: 1px solid var(--line)
  Border-radius: 10px
  Padding: 10px 14px
  Font-size: 13px
  Display: none
  Z-index: 60
  Box-shadow: 0 12px 40px rgba(0,0,0,.5)
  Opacity: 0
}

.toast.show {
  Display: flex
  Align-items: center
  Gap: 10px
  Animation: toast .25s ease forwards
}

@keyframes toast {
  to {
    Transform: translate(-50%, 0)
    Opacity: 1
  }
}

.toast .ok {
  Width: 18px
  Height: 18px
  Border-radius: 50%
  Background: var(--success-soft)
  Color: var(--success)
  Display: grid
  Place-items: center
}
```

## Responsive & Density Variants

### Density: Compact
```css
[data-density="compact"] table.mov tbody td {
  Padding: 7px 14px;
  Font-size: 12.5px;
}

[data-density="compact"] table.mov thead th {
  Padding: 8px 14px;
}

[data-density="compact"] .kpi {
  Padding: 10px 14px;
}

[data-density="compact"] .kpi .v {
  Font-size: 24px;
  Margin-top: 4px;
}

[data-density="compact"] .nav-item {
  Padding: 5px 8px;
}
```

### Sidebar Collapsed (Icons Only)
```css
[data-sidebar="icons"] {
  --sidebar-w: 56px;
}

[data-sidebar="icons"] .brand-name,
[data-sidebar="icons"] .brand-sub,
[data-sidebar="icons"] .nav-label,
[data-sidebar="icons"] .nav-item span.label,
[data-sidebar="icons"] .nav-item .chev,
[data-sidebar="icons"] .who {
  Display: none;
}

[data-sidebar="icons"] .nav-item {
  Justify-content: center;
  Padding: 8px;
}
```

## Animation & Transitions

### Default Transitions
```css
/* Buttons */
Button {
  Transition: background .12s ease, border-color .12s ease, transform .04s ease;
}

/* Form inputs */
Input, Select {
  Outline: none; /* No browser outline */
}

/* Switches & toggles */
.switch {
  Transition: .15s;
}

.switch::after {
  Transition: .15s;
}

/* Modal fade-in */
.scrim.open {
  Opacity: 1;
  Visibility: visible;
}

.scrim {
  Opacity: 0;
  Visibility: hidden;
  Transition: opacity .25s ease, visibility .25s ease;
}
```

## Accessibility

- All interactive elements: accessible via keyboard (Tab)
- Modals: trap focus, close on Escape
- Form labels: always associated with inputs via `<label for="id">`
- Icons: use `aria-label` or wrap with meaningful text
- Colors: don't rely solely on color for information (use icons, text, patterns)
- Text contrast: ensure text meets WCAG AA standards (13.5px text on dark bg = ✓)

---

**Use this document as a CSS reference when implementing in Tailwind/shadcn.**
