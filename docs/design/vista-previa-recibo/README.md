# Handoff: Arce Administración — Dashboard Propietario

## Overview

**Arce Administración** es una plataforma de gestión inmobiliaria para propietarios de múltiples propiedades. Este handoff contiene el diseño del **dashboard principal (Propietario)**, que permite visualizar:

- Información del propietario y estado de completitud de datos
- Cuenta corriente con movimientos (alquileres, gastos, intereses, etc.)
- Listado de propiedades alquiladas y disponibles
- Documentos asociados (contratos, escrituras, formularios fiscales)
- Historial de cambios y operaciones
- Generación de liquidaciones mensuales

El diseño incluye modales para:
- Agregar movimientos manuales (ingresos, egresos, porcentajes)
- Generar liquidaciones
- Subir documentos con clasificación

## About the Design Files

Los archivos en este bundle son **prototipos HTML de diseño** que muestran la intención visual y el comportamiento esperado. **No son código de producción para copiar directamente.**

Tu tarea es **recrear este diseño en Next.js + TypeScript usando shadcn/ui**, manteniendo la fidelidad visual y funcional lo más cercana posible al original, pero usando los componentes y patrones de shadcn/ui + Tailwind CSS.

## Fidelity

**High-fidelity (hifi)**: Mockup con colores finales, tipografía, espaciado e interacciones precisas. Recrea el UI pixel-perfectamente usando shadcn/ui y sigue el sistema de colores oklch → Tailwind config personalizado.

## Design System & Color Tokens

### Colores (sistema oklch)

```
--bg:              oklch(0.165 0.006 40)      // Fondo principal (gris muy oscuro)
--bg-raise:        oklch(0.195 0.007 40)      // Fondo elevado (ligeramente más claro)
--panel:           oklch(0.215 0.008 40)      // Fondo de panels/cards
--panel-2:         oklch(0.235 0.008 40)      // Variante más clara de panel
--line:            oklch(0.285 0.010 40)      // Bordes y divisores
--line-soft:       oklch(0.255 0.010 40)      // Bordes más suaves
--text:            oklch(0.972 0.004 60)      // Texto principal (blanco oscuro)
--text-muted:      oklch(0.72 0.012 50)       // Texto secundario (gris)
--text-dim:        oklch(0.54 0.012 40)       // Texto terciario (muy gris)
--accent:          oklch(0.585 0.135 32)      // Color de acento (naranja/coral)
--accent-hover:    oklch(0.635 0.14 32)       // Acento en hover (más claro)
--accent-soft:     oklch(0.585 0.135 32 / .16) // Acento con transparencia
--accent-ink:      oklch(0.97 0.02 34)        // Texto sobre acento
--success:         oklch(0.74 0.14 155)       // Verde exitoso
--success-soft:    oklch(0.74 0.14 155 / .14) // Verde con transparencia
--warn:            oklch(0.80 0.13 85)        // Amarillo advertencia
--warn-soft:       oklch(0.80 0.13 85 / .14)  // Amarillo con transparencia
--danger:          oklch(0.68 0.18 25)        // Rojo peligro
```

### Tipografía

- **Font UI**: Inter (400, 500, 600, 700)
- **Font Mono**: JetBrains Mono (400, 500, 600)
- **Base size**: 13.5px (ajustable por density)

### Espaciado & Border Radius

- `--pad`: 20px
- `--gap`: 14px
- `--radius`: 10px
- `--radius-sm`: 6px
- `--row-h`: 40px (altura de filas de tabla)

### Dimensiones

- `--sidebar-w`: 216px (normal) | 56px (icons-only)
- Ancho máximo de página: 1440px

## Screens / Vistas

### 1. **Header (Global)**

**Ubicación**: Encima de todo, sticky

**Componentes**:
- Logo + marca "Arce" (26×26px, gradiente, color blanco)
- Breadcrumbs de navegación con separadores
- Buscador central (420px máx, con ícono lupa y kbd hint "⌘K")
- Top actions: 3 icon buttons (notification, settings, profile avatar)

**Styling**:
- Fondo: `color-mix(in oklab, var(--bg) 92%, transparent)` con backdrop-filter blur(8px)
- Border-bottom: 1px solid var(--line)
- Padding: 10px 24px
- z-index: 10

### 2. **Sidebar**

**Ubicación**: Izquierda, sticky, 100vh

**Secciones**:
1. **Brand** (14px × 16px padding)
   - Logo cuadrado con gradiente naranja
   - Nombre "Arce" + subtítulo "Demián Samir"

2. **Navigation**
   - **Sección Admin**: Dashboard, Movimientos, Propiedades, Documentos, Configuración
   - **Sección Personal**: Perfil, Preferencias, Soporte
   - Cada item: ícono + label, state = active (highlight con punto naranja)
   - Estilos: hover = bg panel, active = bg panel + text claro + punto naranja

3. **Footer** (margin-top: auto)
   - Avatar circular (28×28px, gradiente rojo)
   - Nombre + rol
   - Ícono logout

**Ancho**:
- Normal: 216px
- Icons-only (data-sidebar="icons"): 56px (labels hidden, icons centrados)

**Border**: Right 1px solid var(--line)

### 3. **Page: Propietario (Main Content)**

**Layout**: Grid de una columna, max-width 1440px, padding 22px 24px 80px

#### **3a. Page Header**

**Grid**: 1fr auto, gap 24px, align-items: start

**Left side** (owner info):
```
┌─────────────────────────────────────────┐
│ [Avatar]  H1: Demián Samir              │
│ 56×56px   DNI: 12.345.678 | ID: #PR-010 │
│ Gradient  ✓ Perfil completo             │
└─────────────────────────────────────────┘
```

- Avatar: 56×56px, border-radius 12px, gradiente rojo/naranja, letra "D" blanca (22px, bold)
- H1: "Demián Samir", 22px, letter-spacing -.015em, font-weight 650
- Subtitle (12.5px): DNI + referencia ID + pill "Perfil completo" (green)
- Pill styles: padding 3px 8px, border-radius 999px, uppercase, green background + text

**Right side** (actions):
```
[Icon Button] [Icon Button] [Primary Button]
```

- 2 icon buttons (edit, more) → 30×30px, border, hover bg
- 1 primary button "Exportar" → padding 7px 12px, bg accent, text white, bold

#### **3b. Subrail (Completitud + Facts)**

**Grid**: 1fr auto, gap 16px

**Left**: Completitud ring + status
```
Donut chart (conic-gradient):
- Outer ring: 40px Ø
- Inner circle: 30px Ø
- Percentage text in center
```

- Label: "23/35 puntos" (smaller gray text)
- Note: "Completitud define qué acciones puedes hacer"

**Right**: Quick facts (flex wrap, gap 18px 24px)
- Cada fact: columna (k, v)
- K: 10.5px, uppercase, dim
- V: 13px mono (tabular-nums)

Facts shown: Propiedades, Movimientos, Alquileres totales, Disponible

**Styling**:
- Card style (bg: var(--card-bg), border: 1px var(--line), border-radius 10px)
- Padding: 12px 14px
- Margin-bottom: 16px

#### **3c. Tabs**

**Tabs**: Cuenta Corriente | Propiedades | Documentos | Historial

- Tab styling: padding 9px 12px, font 13px/500, border-bottom 2px transparent
- Active: color text, border-bottom-color accent
- Count badge: small mono, 11px, bg-raise, border

#### **3d. Tab Panel: Cuenta Corriente**

**Layout**:
1. "Missing fields" chips (si completitud < 100%)
   - Dashed border-top, bg-raise, chip styling
   - Clickable: abre modal Datos y enfoca field
   - Al 100%: muestra "✓ Ficha completa"

2. KPI cards (3 columnas, gap 14px)
   ```
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Label    │ │ Label    │ │ Label    │
   │ $ 126.050│ │ 3 movs   │ │ 0 err    │
   │ sub text │ │          │ │          │
   └──────────┘ └──────────┘ └──────────┘
   ```
   - First card: left border 3px accent
   - Valores large (28px, bold)

3. Movements Table
   - Sticky header, tabular-nums
   - Columns: checkbox | concepto | propiedad | fecha | origen | monto | más
   - Row hover: bg-raise
   - Checked rows: bg accent-soft
   - Monto coloring: pos (green), neg (red)
   - Origen badge: manual (yellow) | auto (blue)

4. Footer Summary (12px text)
   - "3 movimientos · 1 a confirmar"
   - Right align: Ingresos / Egresos / Neto (mono, verde si pos)

**Missing fields chips** (si < 100%):
- Dashed border, clickable, hover = accent-soft + border solid
- Campos: nombre, apellido, dni, email, etc.

#### **3e. Tab Panel: Propiedades**

**Grid**: 3 columnas (auto-responsive)

Cada property card:
```
┌────────────────────────────────┐
│ [Thumbnail]  R                 │
│ Av. Rivadavia 4210, 3ºB        │
│ Balvanera, CABA · 2 amb · 58m² │
│ ✓ Alquilada  $ 150.000/mes     │
│ Inquilino: M. Torres · vence 08/2026
└────────────────────────────────┘
```

- Thumbnail: 240px wide (assumed), gradiente subtle, letra inicial (R/B/P)
- H4: 14px, bold
- Subtitle: 12px, muted
- Pills + KV text
- Footer: small text

#### **3f. Tab Panel: Documentos**

**Table**:
- Columns: Nombre | Tipo | Subido | Descargar
- Rows: Contratos, Escrituras, Formulariosisales
- Download button: small btn con ícono

#### **3g. Tab Panel: Historial**

**Timeline**:
- `<time>` + event description
- Simplemente listado vertical de eventos

### 4. **Modals**

#### **Modal: Agregar movimiento manual**

**Size**: 560px max-width, modal styling (bg panel, border, shadow)

**Sections**:
1. **Tipo** (segmented)
   - 3 buttons: "Ingreso", "Egreso", "Porcentaje"
   - Selected = accent-soft bg + accent border
   - Full-width in modal

2. **Básico** (si Ingreso/Egreso)
   - Fecha (date input)
   - Propiedad (select, opcional)
   - Concepto (text)
   - Monto (text with $ prefix)

3. **Porcentaje** (si Porcentaje)
   - Dirección: "Sumar" / "Restar" (segmented)
   - Porcentaje: number input with % suffix
   - "Se aplica sobre" (radio options):
     - Total a transferir
     - Subtotal alquileres
     - Subtotal ingresos
     - Monto manual (custom input)
   - Preview box mostrando cálculo

**Footer**:
- Cancelar | Guardar movimiento (primary)

#### **Modal: Generar liquidación**

**Sections**:
1. Período (select)
2. Fecha emisión (date)
3. Propiedades a incluir (multi-select)
4. Liquidation summary (readonly)
   - Alquileres: +$
   - Intereses: +$
   - Gastos: −$
   - Honorarios (7%): −$
   - **Total a transferir**: $ (accent color)

**Footer**:
- Cancelar | Vista previa | Generar y enviar (primary)

#### **Modal: Subir documento**

**Sections**:
1. Drop zone (dashed border, hover accent-soft)
   - Draggable, clickable file input
   - Shows file info after select

2. Tipo documento (combobox creador)
   - Autocomplete + create new option

3. Nombre documento (text, auto-fills from filename)

4. Propiedad + Vigencia (row2 grid)

5. Visibilidad (tag pills: Propietario | Inquilino)

6. Notas internas (textarea)

**Footer**:
- Cancelar | Subir documento (primary)

### 5. **Tweaks Panel** (bottom-right corner)

**Position**: fixed, right 18px, bottom 18px, z-index 40

**Size**: 280px

**Content** (when open):
- H4: "Tweaks" (uppercase, dim, with close icon)
- Groups of options:
  - Card style: flat | bordered | elevated
  - Density: normal | compact
  - Sidebar: full | icons-only
  - Secondary actions: on | off

**Styling**: bg panel, border, border-radius 12px, shadow

**Visibility**: Toggle via parent message (edit mode)

## Interactions & Behavior

### Tab Switching
- Click tab → show corresponding panel, hide others
- Active tab has underline accent

### Row Selection (Movements Table)
- Click checkbox → toggle row.checked class
- Checked rows: bg-soft, text black
- Selected rows affect liquidation modal calculation

### Modal Open/Close
- Click overlay → close modal
- Click X button → close modal
- Modal slides/fades in (smooth)

### Completitud Calculation
- Recalcs when edit mode exits
- Missing fields chips: show/hide based on filled status
- At 100%: show "✓ Ficha completa"
- Clicking chip → open tab Datos, enable edit, focus field

### Manual Movement Modal Type Change
- Selecting "Porcentaje" → hide monto block, show pct block
- Pct preview updates in real-time
- Dir (sumar/restar) changes preview color (green/red)

### Percentage Preview
- Shows calculation: base + percentage = result
- Updates live as user changes pct value or base selection

### File Upload (Documents Modal)
- Drag & drop or click → file input
- Shows file info (name, size)
- Can clear and re-select
- File type validation (pdf, doc, docx, jpg, png, webp)

## State Management

### Global State
- `sidebarMode`: 'full' | 'icons'
- `cardStyle`: 'flat' | 'bordered' | 'elevated'
- `density`: 'normal' | 'compact'
- `secondaryActionsVisible`: boolean

### Propietario State
- `propietarioData`: { nombre, apellido, dni, email, ... }
- `completitud`: { pct, filled, total }
- `movimientos`: [ { id, tipo, concepto, monto, fecha, ... } ]
- `propiedades`: [ { id, direccion, estado, alquiler, inquilino, ... } ]
- `documentos`: [ { id, nombre, tipo, fechaSubida, ... } ]
- `editing`: boolean (edit mode for datos)

### Modal State
- `openModalId`: string | null
- `manualMovement`: { type, fecha, propiedad, concepto, monto, dir, base, pct }
- `selectedMovementRows`: Set<id>
- `fileUpload`: { file, filename, type, size }

## Design Tokens

### Colors
See section "Design System & Color Tokens" above. All colors use oklch space.

### Typography
- **Body**: Inter, 13.5px, line-height 1.45
- **Label**: Inter, 10.5–11px, uppercase, letter-spacing .05–.08em, color dim
- **Heading (H1)**: Inter, 22px, font-weight 650, letter-spacing -.015em
- **Heading (H4)**: Inter, 14–15px, font-weight 600
- **Monospace**: JetBrains Mono, 11–13px, tabular-nums (for amounts, dates, IDs)

### Shadows
- **Card**: none (default) | 0 1px 0 rgba(255,255,255,.02), 0 6px 20px -12px rgba(0,0,0,.7) (elevated variant)
- **Modal**: 0 20px 60px rgba(0,0,0,.5)
- **Tooltip/Floating**: 0 12px 40px rgba(0,0,0,.5)

### Borders
- **Standard**: 1px solid var(--line)
- **Soft**: 1px solid var(--line-soft)
- **Dashed**: 1px dashed var(--line-soft)
- **Accent**: 1px solid var(--accent)

### Spacing Scale
- 2px, 4px, 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 22px, 24px

## Assets

### Icons
Icons are inline SVGs or from a sprite (#icon-id references). Icons include:
- `#i-more` (three dots)
- `#i-x` (close)
- `#i-down` (download)
- `#i-plus` (add)
- `#i-receipt` (document/invoice)
- `#i-doc` (document)
- Many others referenced in the HTML

For shadcn implementation, use **lucide-react** icons (same visual style).

### Images
- Property thumbnails: gradient backgrounds with initial letters (no actual photos)
- Avatar: gradient with initials

## Files

1. **Arce Administración - Propietario.html** — Main propietario dashboard HTML + styles + inline JS
   - 2084 lines total
   - Complete interactive prototype

2. **Datos de la Administración.html** — Reference page (data entry form, not fully detailed here)

3. **Vista Previa Recibo.html** — Receipt preview (linked from liquidation modal)

## Implementation Notes for Claude Code

### Tailwind Config
Extend the default Tailwind config with custom oklch colors:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg': 'oklch(0.165 0.006 40)',
        'bg-raise': 'oklch(0.195 0.007 40)',
        'panel': 'oklch(0.215 0.008 40)',
        'panel-2': 'oklch(0.235 0.008 40)',
        'line': 'oklch(0.285 0.010 40)',
        'line-soft': 'oklch(0.255 0.010 40)',
        'text': 'oklch(0.972 0.004 60)',
        'text-muted': 'oklch(0.72 0.012 50)',
        'text-dim': 'oklch(0.54 0.012 40)',
        'accent': 'oklch(0.585 0.135 32)',
        'accent-hover': 'oklch(0.635 0.14 32)',
        'accent-soft': 'oklch(0.585 0.135 32 / .16)',
        'success': 'oklch(0.74 0.14 155)',
        'warn': 'oklch(0.80 0.13 85)',
        'danger': 'oklch(0.68 0.18 25)',
      },
      fontFamily: {
        'sans': ['Inter', ...],
        'mono': ['JetBrains Mono', ...],
      },
      spacing: {
        'pad': '20px',
        'gap': '14px',
      },
      borderRadius: {
        'md': '10px',
        'sm': '6px',
      },
    },
  },
};
```

### Component Structure (shadcn/ui)

Use these shadcn/ui components as building blocks:

- **Layout**: Use `<div>` + Tailwind grid/flex (no special layout component in shadcn)
- **Buttons**: `Button` from shadcn
- **Forms**: `Input`, `Select`, `Textarea` from shadcn
- **Tabs**: `Tabs` from shadcn
- **Dialog**: `Dialog` (for modals) from shadcn
- **Card**: `Card` from shadcn
- **Badge**: `Badge` from shadcn
- **Table**: `Table` from shadcn (or custom, as movements table is complex)
- **Dropdown**: `DropdownMenu` from shadcn (for row actions)

### Example Structure

```tsx
// app/dashboard/propietario/page.tsx
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { PropietarioPage } from '@/components/PropietarioPage';
import { TweaksPanel } from '@/components/TweaksPanel';

export default function Page() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <PropietarioPage />
        </main>
      </div>
      <TweaksPanel />
    </div>
  );
}
```

### Key Challenges & Decisions

1. **Animations**: Modals fade in, tabs switch instantly. Use Tailwind transitions.
2. **Sticky elements**: Sidebar, topbar, table header — use `sticky` utility.
3. **Complex table**: Movements table with checkboxes, colored amounts, origin badges. Build custom or use shadcn Table component.
4. **Combobox with creation**: The "Tipo documento" field allows creating new types on the fly. Use `react-hook-form` + `@radix-ui/react-popover` or shadcn Combobox equivalent.
5. **Percentage calculation preview**: Update UI live as user changes inputs. Use React state + useEffect.
6. **File upload drop zone**: Use `react-dropzone` or hand-roll with drag/drop listeners.
7. **Edit mode toggle**: Track editing state, conditionally render inputs vs. display text.

---

**Next step**: Clone/fork this README, set up the Next.js + shadcn project, and start implementing screens in order of priority. Recommend priority: Sidebar & Topbar → Main header & KPIs → Movements table → Modals.
