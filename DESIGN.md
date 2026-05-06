---
name: Arce Administración
description: Sistema de gestión inmobiliaria, dark mode terracota, editorial-tool aesthetic.
colors:
  primary: "oklch(0.585 0.135 32)"
  primary-foreground: "oklch(0.97 0.02 34)"
  primary-dim: "oklch(0.585 0.135 32 / 0.16)"
  paper-bg: "#f7f5ef"
  paper-text: "#1a1614"
  paper-muted: "#5a514c"
  paper-border: "#d9d1c3"
  bg: "oklch(0.165 0.006 40)"
  surface: "oklch(0.215 0.008 40)"
  surface-mid: "oklch(0.195 0.007 40)"
  surface-high: "oklch(0.235 0.008 40)"
  surface-highest: "oklch(0.255 0.010 40)"
  on-bg: "oklch(0.972 0.004 60)"
  on-surface: "oklch(0.972 0.004 60)"
  text-secondary: "oklch(0.72 0.012 50)"
  text-muted: "oklch(0.72 0.012 50)"
  border: "oklch(0.285 0.010 40)"
  input: "oklch(0.195 0.007 40)"
  ring: "oklch(0.585 0.135 32)"
  income: "oklch(0.74 0.14 155)"
  income-dim: "oklch(0.74 0.14 155 / 0.12)"
  warning: "oklch(0.80 0.13 85)"
  warning-dim: "oklch(0.80 0.13 85 / 0.14)"
  destructive: "oklch(0.68 0.18 25)"
  destructive-dim: "oklch(0.68 0.18 25 / 0.14)"
  punitorio: "oklch(0.68 0.20 295)"
  punitorio-dim: "oklch(0.68 0.20 295 / 0.14)"
  info: "#8ab4f8"
  info-dim: "rgba(138, 180, 248, 0.12)"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  brand:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "0.6rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "18px"
  xl: "24px"
  "2xl": "32px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-outline:
    backgroundColor: "{colors.surface-mid}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  badge-active:
    backgroundColor: "{colors.income-dim}"
    textColor: "{colors.income}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-baja:
    backgroundColor: "{colors.destructive-dim}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "{colors.warning-dim}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px 22px"
  input-field:
    backgroundColor: "{colors.surface-mid}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
    height: "32px"
---

# Design System: Arce Administración

## 1. Overview

**Creative North Star: "The Quiet Ledger"**

A real estate accounting tool for Argentine agencies that deal with rental contracts, owner settlements, and tenant ledgers. The agent works at a desk, often at night, often with multiple browser tabs and a phone in the other hand. The interface should disappear into the task. Numbers in monospace, words in editorial sans, surfaces tinted toward warm earth so the data feels like it lives on aged paper, not a screen.

This is not a SaaS dashboard with gradient hero metrics. It's not a consumer app that performs delight. It's a tool, polished by use, never by branding. The terracota accent is rare; the surface holds it loosely. The system rejects: clunky legacy real-estate desktop UIs (too dense, no hierarchy), generic Tailwind UI templates (faceless), and consumer-app delight (clarity over personality, always).

**Key Characteristics:**
- Warm dark surface (oklch(0.165 0.006 40)) tinted toward terracota; no pure black, no pure white anywhere.
- Editorial sans pairing: Space Grotesk for headlines, Inter for body, Geist Mono for numbers, Montserrat for short brand-weight labels.
- Restrained color: terracota primary used on ≤10% of any screen, semantic colors (income green, warning amber, destructive red, punitorio violet) reserved for state.
- Flat-by-default depth; surfaces stack via tonality, not shadow.
- shadcn/ui is the component foundation. Custom CSS only when shadcn variants don't fit.

## 2. Colors: The Warm Workshop Palette

The palette is grounded in terracota and warm-tinted neutrals. Every neutral has a chroma of 0.005-0.012 toward hue 40 (warm). Pure neutrals would feel cold and clinical, the wrong tone for a tool that sits with a person all day.

### Primary
- **Aged Terracota** (`oklch(0.585 0.135 32)`): the only saturated color in the regular flow. Used on primary buttons (`<Button variant="default">`), focus rings, the active indicator on tabs and sidebar, and the conic-gradient progress on the completitud chip. Never decorative. If terracota appears on more than ~10% of a viewport, the screen is wrong.

### Neutral
- **Roasted Walnut** (`oklch(0.165 0.006 40)`): page background. Sets the mood: late-night office, warm desk lamp.
- **Warm Slate** (`oklch(0.215 0.008 40)`): surface for cards, panels, popovers, sheets. The next layer up.
- **Slate Step** (`oklch(0.235 0.008 40)`): surface-high; used for hover states and slightly elevated elements.
- **Cocoa Edge** (`oklch(0.255 0.010 40)`): surface-highest; the rare top-most layer.
- **Bone Cream** (`oklch(0.972 0.004 60)`): primary text on bg and surface. Never `#fff`.
- **Driftwood** (`oklch(0.72 0.012 50)`): secondary and muted text. Subtle warm tint keeps it from feeling like dead gray.
- **Charcoal Border** (`oklch(0.285 0.010 40)`): default border, used as 1px hairlines on panels and inputs.

### Semantic (state, not decoration)
- **Mint Ledger** (`oklch(0.74 0.14 155)`): income, success, "al día", positive financial state. The dim variant sits behind active status pills.
- **Pencil Amber** (`oklch(0.80 0.13 85)`): warning, vencimientos próximos, partial payment.
- **Iron Oxide** (`oklch(0.68 0.18 25)`): destructive, mora, error states, anular actions.
- **Indigo Penalty** (`oklch(0.68 0.20 295)`): punitorios. Distinct hue keeps interest charges visually separate from base rent and from generic errors.
- **Sky Info** (`#8ab4f8`): informational notices, neutral metadata, "ver más" links in panels.

### The Paper Surface (sub-system)

Receipts (`/recibos/[id]`), comprobantes de liquidación (`/comprobantes/[id]`), the receipt preview in agency settings, and the signature pad share a different visual register: **printed paper**. The dark UI palette would not print correctly, and the cream-on-warm-dark feeling is wrong for a document that claims to be a sheet of paper resting on a desk.

These surfaces use a fixed, theme-independent palette tokenized as `--paper-*`:

- **Cream Vellum** (`#f7f5ef`): paper background. Always the same value, light or dark mode.
- **Ink Black** (`#1a1614`): main text color, signature pen stroke, headers on the printed sheet.
- **Pencil Gray** (`#5a514c`): secondary text on paper, labels above values, period subtext.
- **Aged Border** (`#d9d1c3`): horizontal rules, dashed cell borders inside receipt tables.

Paper colors live in `globals.css` `:root` (not under `.dark`) because they don't theme-switch. They are consumed via `var(--paper-bg)`, `var(--paper-text)`, etc. **Never hardcode the hex values.** The canvas signature pad is the one exception (Canvas API requires a literal `strokeStyle`); it carries an inline comment pointing back to the token.

### Named Rules

**The One Voice Rule.** Aged Terracota appears on no more than ~10% of any screen. Its rarity is the meaning. The moment two terracota things shout for attention, the hierarchy is broken.

**The Tinted-Neutral Rule.** No `#000`, no `#fff`. Every neutral carries 0.005-0.012 chroma toward hue 40 or 60 (warm). Pure neutrals belong to clinical software; this is a tool that sits with a person.

**The Semantic-Only-When-Semantic Rule.** Income green, warning amber, destructive red, punitorio violet exist to carry meaning. They never decorate. If a button is green just because green looks nice there, it's wrong.

**The Paper Sub-System Rule.** Anything that simulates printed paper (receipts, comprobantes, the receipt preview, the signature canvas) uses `--paper-*` tokens. Anywhere else uses the dark UI palette. The two systems do not mix on the same surface.

## 3. Typography

**Display Font:** Space Grotesk (with system-ui, sans-serif fallback)
**Body Font:** Inter (with system-ui, sans-serif fallback)
**Mono Font:** Geist Mono (with ui-monospace fallback)
**Brand Font:** Montserrat (with system-ui fallback) — used for tight uppercase labels (avatars, tiny pills, KPI labels at 0.68rem)

**Character:** Space Grotesk gives the headlines a slightly geometric, mechanical edge: precise but not cold. Inter does the heavy lifting in dense body content; small body type at 0.8125rem (13px) sits comfortably on warm dark backgrounds. Geist Mono is the source of truth for any number a human compares (montos, DNI, períodos, números de recibo). Montserrat extra-bold at 0.6rem is the brand whisper inside avatars.

### Hierarchy
- **Display** (Space Grotesk, 700, 1.5rem, lh 1.15, tracking -0.02em): page titles, h1 in entity fichas (propietario name, inquilino name, contrato number).
- **Headline** (Space Grotesk, 600, 1.125rem, lh 1.2, tracking -0.015em): section heads, panel titles in dashboards.
- **Title** (Space Grotesk, 600, 0.9rem, lh 1.3): subsection labels, card headers in lists.
- **Body** (Inter, 400, 0.8125rem, lh 1.6): default paragraph and form text. Cap reading line length at 65-75ch for prose.
- **Label** (Inter, 600, 0.68rem, lh 1.2, tracking 0.1em, uppercase): KPI labels, column headers in tables, the small uppercase markers above values in receipts.
- **Mono** (Geist Mono, 400, 0.8125rem): numeric data, ledger amounts, DNI/CUIT, receipt numbers, periods like `05/2026`, exact dates.
- **Brand** (Montserrat, 800, 0.6rem, tracking 0.06em, uppercase): tiny pills inside avatars, the smallest tags.

### Named Rules

**The Mono-For-Numbers Rule.** Anything a human will scan, compare, or type-check, lives in Geist Mono: amounts, DNI, CUIT, periods, dates, receipt numbers, contract IDs. No exceptions. A peso amount in a sans body font is broken.

**The Headline Tracking Rule.** Headlines get `letter-spacing: -0.015em` to `-0.02em`. This is what makes Space Grotesk feel like a confident editorial title rather than a generic geometric sans. Body and labels stay at default tracking.

**The Label Whisper Rule.** UPPERCASE LABELS at 0.68rem with 0.1em tracking introduce data, never decorate. They live above values; values are the point.

## 4. Elevation

The system is **flat by default with tonal layering**. Depth is conveyed by stacking warm neutrals in 4 steps — bg → surface-mid → surface → surface-high — not by box-shadow. A panel "rises" because its surface is one step lighter than the bg behind it, not because it carries a drop shadow.

Shadows are reserved for **printed-paper artifacts**: the receipt page (`/recibos/[id]`) and the comprobante de liquidación page (`/comprobantes/[id]`) use a soft shadow (`0 8px 24px rgba(0,0,0,.3)`) on the A4 panel to evoke a sheet of paper resting on a desk. This shadow exists so the printed thing reads as an object, not a div. **Outside print artifacts, shadows are not used.**

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Cards do not float. Panels do not glow. Depth is tonal: surface-mid sits behind surface, which sits behind surface-high.

**The Paper-Only-Shadow Rule.** Box-shadow appears only on artifacts that simulate physical paper (receipts, comprobantes). Anywhere else (cards, modals, dropdowns), shadow is forbidden by default.

## 5. Components

shadcn/ui is the foundation. Components in `src/components/ui/` are extended (not replaced) with project-specific variants when shadcn defaults don't carry domain meaning. Reach for shadcn first. Custom CSS is the last resort, not the first.

### Buttons (shadcn `<Button>`)

The shadcn Button is extended through `buttonVariants` in `src/components/ui/button.tsx`. Use the variants by name; never hand-roll.

- **Variants:** `default` (terracota primary), `destructive` (Iron Oxide), `outline` (border + transparent), `secondary` (Warm Slate fill), `ghost` (transparent until hover), `link` (text-only).
- **Sizes:** `xs` (h-6, text-xs), `sm` (h-8), `default` (h-9), `lg` (h-10), plus icon variants (`icon`, `icon-xs`, `icon-sm`, `icon-lg`).
- **Shape:** rounded-md (10px) for buttons by default. The legacy `.btn` CSS class in globals.css uses pill — avoid it for new work; prefer `<Button>`.
- **Hover:** opacity 0.9 on the primary; `bg-accent` for ghost. Transitions on color and box-shadow only (not transform).

### Badges (shadcn `<Badge>`, extended)

The Badge in `src/components/ui/badge.tsx` carries an explicit set of domain variants:

- **Entity state:** `active` (Mint Ledger), `suspended` (mustard), `baja` (Iron Oxide).
- **Property state:** `rented`, `available`, `reserved`, `maintenance`.
- **Generic state:** `expiring`, `draft`.
- **Financial domain:** `income`.
- **Default shadcn:** `default`, `secondary`, `destructive`, `outline`.

Style: pill-shaped (`rounded-full`), `text-[0.75rem]`, `font-bold`, uppercase, `tracking-[0.1em]`. Always tinted dim background + saturated text + subtle border-color/20. **Use the variant name, never paint a Badge by hand.**

### Cards & Panels

Most surfaces use the shadcn `<Card>` primitive with `rounded-[var(--radius-lg)]` (18px) and a subtle 1px border in Charcoal. Internal padding scales by content density: 16-22px is the comfortable range. Nested cards are forbidden; if you need to subdivide a card, use a `<Separator>` or tonal background shift, not another card inside.

For dashboard KPI tiles, the project uses a **top-stripe** treatment: a 2px bar at the top of the card painted in semantic color (mustard / error / primary / muted). This stripe is the *only* sanctioned colored-stripe pattern in the system. Side-stripes are forbidden.

### Tabs (shadcn `<Tabs>`, line variant)

Tabs use the underline pattern, not chip backgrounds: `<TabsList variant="line">` with `rounded-none bg-transparent`. The active tab is marked by a 2px terracota underline (`after:bg-primary`). Counts are shown next to labels with a small mono badge in `bg-surface-mid`. Pills-style tabs are not used.

### Avatars (shadcn `<Avatar>`, with role gradients)

Avatars are squarish (`rounded-[12px]`), not circular. The fill is a role-specific gradient defined as a CSS variable:

- **Tenant:** `--gradient-tenant` (indigo gradient, oklch 0.45 0.16 265 → 0.35 0.14 260).
- **Owner:** `--gradient-owner` (terracota gradient, oklch 0.56 0.14 30 → 0.42 0.12 25).
- **Property:** `--gradient-property` (deep green gradient, #1a2a1a → #2a4a2a).

Initials sit in Bone Cream over the gradient. There's an inset highlight (`box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)`) that gives a faint top-edge shimmer. The role gradient signals what kind of entity you're looking at without reading the label.

### Inputs

The shadcn `<Input>`, `<Select>`, and `<Textarea>` are used as-is. Standard treatment:
- Background: Warm Slate (surface-mid).
- Border: 1px Charcoal (`--border`).
- Focus: border-color shifts to Aged Terracota; ring (3px terracota at 0.5 alpha) appears.
- Radius: `rounded-md` (10px) for normal inputs, `rounded-[var(--radius-sm)]` (6px) for compact ones.
- Mono inputs (`<MoneyInput>`, DNI fields): `font-mono` to stay consistent with the Mono-For-Numbers rule.

### Status pills (`StatusBadge`)

`src/components/ui/status-badge.tsx` is a thin wrapper over Badge that maps tenant/owner/property states to the right variant. Use it instead of picking variants by hand — the mapping logic centralizes the vocabulary.

### Tables

For list views (cuenta corriente, propiedades, contratos), the project uses CSS Grid layouts with explicit column widths in pixels for alignment, not shadcn `<Table>`. The pattern:

```
grid-cols-[28px_1fr_80px_110px_110px_220px_90px]
```

Column headers stick to top with `bg-muted/80 backdrop-blur-sm`. Hover rows tint to `surface-high`. Periods are grouped with a header row separating each month. **The `<Table>` component is fine for static reads; for interactive ledgers prefer the grid pattern.**

### Combobox & Search (`CreatableCombobox`, `SearchableSelect`)

The project has custom comboboxes built over `<Command>` + `<Popover>` for inline creation (zones, features). Use these wrappers instead of bare `<Select>` when the user might need to add a new option mid-flow.

## 6. Do's and Don'ts

### Do:
- **Do** reach for shadcn `<Button>`, `<Badge>`, `<Card>`, `<Input>`, `<Tabs>`, `<Dialog>` first. The variants live in `src/components/ui/`; extend them there if a new variant is needed across the app.
- **Do** use Geist Mono for every number a human will read or compare: amounts, DNI/CUIT, dates, periods, receipt numbers, contract IDs.
- **Do** tint every neutral toward hue 40 or 60 with chroma 0.005-0.012. Pure neutrals are forbidden.
- **Do** keep Aged Terracota under 10% of any visible viewport.
- **Do** use the existing semantic dim variants for status backgrounds (`bg-income-dim`, `bg-error-dim`, etc.) plus the saturated counterpart for text. Never invent new color pairs.
- **Do** stack surfaces by tonality (bg → surface-mid → surface → surface-high). The next layer up is one step lighter, not a shadow.
- **Do** use the Top-Stripe pattern for KPI cards (2px top accent in semantic color).
- **Do** show entity status with a leading colored dot inside the Badge (`size-1.5 rounded-full bg-current`).
- **Do** put labels above values in UPPERCASE Inter at 0.68rem with `tracking-[0.1em]`. The label whispers; the value speaks.
- **Do** use role gradients on Avatars to signal entity type (owner / tenant / property).

### Don't:
- **Don't** hand-roll a button when `<Button variant="...">` exists. If you need a new variant, add it to `buttonVariants` in `src/components/ui/button.tsx`.
- **Don't** paint Badges with arbitrary Tailwind classes (`bg-green-500 text-white`). Use the named variant (`active`, `income`, `baja`, `expiring`, etc.).
- **Don't** use `#000` or `#fff` anywhere. Both are forbidden.
- **Don't** use border-left or border-right > 1px as a colored stripe. Side-stripe accents are banned (impeccable absolute ban). Use the top-stripe on KPI cards or full-border tinted backgrounds instead.
- **Don't** use box-shadow on cards, dialogs, popovers, dropdowns. Depth is tonal. Shadows are reserved for printed paper artifacts (receipts, comprobantes).
- **Don't** nest cards. If you need to group inside a card, use `<Separator>`, a tonal shift, or labels.
- **Don't** add gradient text (`background-clip: text`). Forbidden.
- **Don't** put numbers (montos, DNI, dates) in body sans. Use Geist Mono.
- **Don't** use big-gradient-number hero KPIs. Anti-reference: "generic SaaS dashboards with big gradient numbers and empty charts" (PRODUCT.md).
- **Don't** make the screen look like a Tailwind UI template (PRODUCT.md anti-reference). Density, mono numbers, warm tinted neutrals, and editorial type pairing are the tells that distinguish this from a stock template.
- **Don't** use modals as the first thought. Inline editing (the `.edit-mode` pattern in fichas) is the project's preferred path. Modals are for confirmations of destructive actions.
- **Don't** animate layout properties (width, height, top, left). Animate `opacity`, `transform`, `color`, `background-color` only. Ease-out exponential, not bouncy.
