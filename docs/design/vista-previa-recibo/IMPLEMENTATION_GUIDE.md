# Guía de Implementación: shadcn/ui + Tailwind

## Setup Inicial

### 1. Crear proyecto Next.js con shadcn
```bash
npx create-next-app@latest arce-admin --typescript --tailwind --use-npm
cd arce-admin

# Instalar shadcn/ui
npx shadcn-ui@latest init
# Selecciona: Tailwind CSS, TypeScript, Default style (New York)
```

### 2. Extender Tailwind Config

Edita `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Arce custom colors - oklch → hex approximations
        'bg': 'hsl(0, 0%, 10.2%)',        // oklch(0.165 0.006 40)
        'bg-raise': 'hsl(0, 0%, 13.7%)',  // oklch(0.195 0.007 40)
        'panel': 'hsl(0, 0%, 15.7%)',     // oklch(0.215 0.008 40)
        'panel-2': 'hsl(0, 0%, 18.6%)',   // oklch(0.235 0.008 40)
        'line': 'hsl(0, 0%, 25.1%)',      // oklch(0.285 0.010 40)
        'line-soft': 'hsl(0, 0%, 22.0%)', // oklch(0.255 0.010 40)
        'text': 'hsl(0, 0%, 96.9%)',      // oklch(0.972 0.004 60)
        'text-muted': 'hsl(0, 0%, 65.9%)',  // oklch(0.72 0.012 50)
        'text-dim': 'hsl(0, 0%, 41.9%)',  // oklch(0.54 0.012 40)
        'accent': 'hsl(12, 62%, 54%)',    // oklch(0.585 0.135 32) - coral/orange
        'accent-hover': 'hsl(12, 62%, 59%)',  // oklch(0.635 0.14 32)
        'accent-soft': 'hsla(12, 62%, 54%, 0.16)',  // oklch(0.585 0.135 32 / .16)
        'accent-ink': 'hsl(0, 0%, 96.1%)',  // oklch(0.97 0.02 34)
        'success': 'hsl(134, 54%, 50%)',   // oklch(0.74 0.14 155) - green
        'success-soft': 'hsla(134, 54%, 50%, 0.14)',
        'warn': 'hsl(43, 76%, 56%)',       // oklch(0.80 0.13 85) - yellow
        'warn-soft': 'hsla(43, 76%, 56%, 0.14)',
        'danger': 'hsl(0, 71%, 56%)',      // oklch(0.68 0.18 25) - red
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-jetbrains)'],
      },
      spacing: {
        'pad': '20px',
        'gap': '14px',
      },
      borderRadius: {
        md: '10px',
        sm: '6px',
      },
      boxShadow: {
        'modal': '0 20px 60px rgba(0, 0, 0, 0.5)',
        'toast': '0 12px 40px rgba(0, 0, 0, 0.5)',
      },
      fontSize: {
        'xs': ['10.5px', '1.1'],
        'sm': ['11.5px', '1.2'],
        'base': ['13.5px', '1.45'],
        'lg': ['14px', '1.3'],
        'xl': ['15px', '1.2'],
        '2xl': ['22px', '1.2'],
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
```

### 3. Configurar Fuentes en `app/layout.tsx`

```typescript
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-bg text-text font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

### 4. Instalar shadcn/ui Components Necesarios

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add scroll-area
```

### 5. Dependencias Adicionales

```bash
npm install react-hook-form zod zustand lucide-react react-dropzone
```

## Estructura de Carpetas

```
arce-admin/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   │   └── propietario/
│   │       ├── page.tsx
│   │       └── layout.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── TweaksPanel.tsx
│   ├── propietario/
│   │   ├── PropietarioPage.tsx
│   │   ├── OwnerHeader.tsx
│   │   ├── CompletudeRail.tsx
│   │   ├── TabNavigation.tsx
│   │   ├── MovementsTab.tsx
│   │   ├── PropertiesTab.tsx
│   │   ├── DocumentsTab.tsx
│   │   ├── HistoryTab.tsx
│   │   ├── MovementModal.tsx
│   │   ├── LiquidationModal.tsx
│   │   └── DocumentModal.tsx
│   └── ui/
│       └── [shadcn components]
├── lib/
│   ├── utils.ts
│   ├── types.ts
│   └── constants.ts
└── tailwind.config.ts
```

## Componentes Clave a Implementar

### 1. **Sidebar.tsx**

```typescript
import { useState } from 'react'
import { ChevronRight, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: (collapsed: boolean) => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const navItems = [
    { icon: '📊', label: 'Dashboard', active: true },
    { icon: '💸', label: 'Movimientos' },
    { icon: '🏠', label: 'Propiedades' },
    { icon: '📄', label: 'Documentos' },
  ]

  return (
    <aside
      className={`fixed left-0 top-0 h-screen border-r border-line bg-bg transition-all duration-300 ${
        collapsed ? 'w-14' : 'w-54'
      }`}
    >
      {/* Brand */}
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-orange-700 text-xs font-bold text-white">
            A
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold">Arce</div>
              <div className="text-xs text-text-dim">Demián Samir</div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 px-2.5 py-2.5">
        {navItems.map((item, i) => (
          <button
            key={i}
            className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.75 text-sm transition-colors ${
              item.active
                ? 'bg-panel text-text'
                : 'text-text-muted hover:bg-panel hover:text-text'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
            {item.active && !collapsed && (
              <div className="h-1 w-1 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-line-soft px-2.5 py-2.5">
        <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.75 text-sm text-text-muted hover:bg-panel hover:text-text">
          <LogOut size={16} />
          {!collapsed && <span className="flex-1 text-left">Salir</span>}
        </button>
      </div>
    </aside>
  )
}
```

### 2. **Topbar.tsx**

```typescript
import { Search, Bell, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Topbar() {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3.5 border-b border-line bg-bg/92 px-6 py-2.5 backdrop-blur-lg">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span>Dashboard</span>
        <span className="text-text-dim">/</span>
        <span>Propietario</span>
      </div>

      {/* Search */}
      <div className="relative ml-4 flex flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
        <Input
          placeholder="Buscar..."
          className="pl-9 text-xs"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-dim">
          ⌘K
        </kbd>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 w-7 rounded-md border-line">
          <Bell size={14} className="text-text-muted" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 rounded-md border-line">
          <Settings size={14} className="text-text-muted" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 rounded-md border-line">
          <User size={14} className="text-text-muted" />
        </Button>
      </div>
    </div>
  )
}
```

### 3. **OwnerHeader.tsx** (Page Header con Avatar + Info)

```typescript
interface OwnerHeaderProps {
  name: string
  dni: string
  id: string
  completitud: number
}

export function OwnerHeader({ name, dni, id, completitud }: OwnerHeaderProps) {
  return (
    <div className="mb-4.5 grid grid-cols-[1fr_auto] gap-6">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500 to-orange-600 text-2xl font-bold text-white">
          {name[0]}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
            <span>DNI: {dni}</span>
            <span className="text-text-dim">|</span>
            <code className="rounded bg-bg-raise px-1.5 py-0.5 font-mono text-xs text-text-dim">
              {id}
            </code>
          </div>
          {completitud === 100 && (
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-success">
              ✓ Perfil completo
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline">Editar</Button>
        <Button>Exportar</Button>
      </div>
    </div>
  )
}
```

### 4. **CompletudeRail.tsx**

```typescript
interface CompletudeRailProps {
  percentage: number
  filled: number
  total: number
}

export function CompletudeRail({ percentage, filled, total }: CompletudeRailProps) {
  return (
    <div className="mb-4 flex items-center gap-4 rounded-md border border-line bg-panel p-3">
      {/* Donut */}
      <div className="relative h-10 w-10 shrink-0">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-line"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${(percentage / 100) * 282.6} 282.6`}
            className="text-accent transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold">
          {percentage}%
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col text-xs">
        <div className="text-text-dim uppercase tracking-widest">Completitud</div>
        <div className="mt-0.5 text-sm">
          <span className="font-semibold text-accent">{filled}</span>
          <span className="text-text-muted">/{total} puntos</span>
        </div>
      </div>
    </div>
  )
}
```

### 5. **MovementsTab.tsx** (Tabla de Movimientos)

```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Movement {
  id: string
  concept: string
  property: string
  date: string
  origin: 'manual' | 'auto'
  amount: number
}

interface MovementsTabProps {
  movements: Movement[]
}

export function MovementsTab({ movements }: MovementsTabProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-line">
        <Table>
          <TableHeader>
            <TableRow className="border-line-soft hover:bg-transparent">
              <TableHead className="w-12 text-text-dim">
                <Checkbox />
              </TableHead>
              <TableHead className="text-text-dim">Concepto</TableHead>
              <TableHead className="text-text-dim">Propiedad</TableHead>
              <TableHead className="w-24 text-text-dim">Fecha</TableHead>
              <TableHead className="text-text-dim">Origen</TableHead>
              <TableHead className="w-28 text-right text-text-dim">Monto</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((mov) => (
              <TableRow key={mov.id} className="hover:bg-bg-raise">
                <TableCell>
                  <Checkbox />
                </TableCell>
                <TableCell className="font-medium text-text">
                  {mov.concept}
                </TableCell>
                <TableCell className="text-text-muted">{mov.property}</TableCell>
                <TableCell className="font-mono text-xs text-text-muted">
                  {mov.date}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      mov.origin === 'manual'
                        ? 'bg-warn-soft text-warn'
                        : 'bg-blue-950 text-blue-400'
                    }
                  >
                    {mov.origin === 'manual' ? 'Manual' : 'Automático'}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-semibold ${
                    mov.amount > 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {mov.amount > 0 ? '+' : '−'}$ {Math.abs(mov.amount).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    ⋮
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

### 6. **MovementModal.tsx** (Agregar Movimiento Manual)

```typescript
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MovementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => void
}

export function MovementModal({ open, onOpenChange, onSubmit }: MovementModalProps) {
  const [type, setType] = useState<'ingreso' | 'egreso' | 'pct'>('egreso')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-line bg-panel">
        <DialogHeader>
          <DialogTitle>Agregar movimiento manual</DialogTitle>
          <DialogDescription>
            Se registrará en la cuenta corriente de Demián Samir
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Type tabs */}
          <div>
            <Label className="mb-2 block">Tipo de movimiento</Label>
            <div className="inline-flex gap-1 rounded-lg border border-line bg-bg-raise p-0.5">
              {['Ingreso', 'Egreso', 'Porcentaje'].map((t, i) => (
                <button
                  key={i}
                  onClick={() => setType((['ingreso', 'egreso', 'pct'] as const)[i])}
                  className={`flex-1 rounded px-3 py-1 text-sm font-medium transition-colors ${
                    (i === 0 && type === 'ingreso') ||
                    (i === 1 && type === 'egreso') ||
                    (i === 2 && type === 'pct')
                      ? 'bg-panel-2 text-text'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Basic fields */}
          {type !== 'pct' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="prop">Propiedad</Label>
                  <select
                    id="prop"
                    className="flex h-9 rounded-md border border-line bg-bg px-3 py-1 text-sm text-text outline-none"
                  >
                    <option>—</option>
                    <option>Av. Rivadavia 4210, 3ºB</option>
                    <option>Bulnes 1880, 6ºA</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="concepto">Concepto</Label>
                <Input id="concepto" placeholder="Ej. Reparación caldera" />
              </div>

              <div>
                <Label htmlFor="monto">Monto</Label>
                <Input id="monto" placeholder="$ 0,00" />
              </div>
            </>
          )}

          {/* Percentage fields */}
          {type === 'pct' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Dirección</Label>
                  <div className="mt-1 inline-flex gap-1 rounded-lg border border-line bg-bg-raise p-0.5">
                    {['Sumar', 'Restar'].map((dir) => (
                      <button key={dir} className="rounded px-3 py-1 text-sm font-medium text-text-muted hover:text-text">
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="pct">Porcentaje</Label>
                  <div className="relative">
                    <Input
                      id="pct"
                      type="number"
                      defaultValue="7"
                      min="0"
                      step="0.5"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-dim">
                      %
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit({})}>Guardar movimiento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Notas de Implementación

### Color System
- Usa los valores HSL/Tailwind en lugar de oklch directo (oklch no es bien soportado en todos los browsers)
- Los valores hex aproximados están en `tailwind.config.ts`

### Componentes Custom
- Para elementos muy custom (como el donut de completitud), dibuja SVG simples
- Usa lucide-react para todos los iconos

### Tablas Complejas
- La tabla de movimientos tiene checkboxes, colores condicionales, y filas seleccionables
- Usa `shadcn/ui Table` + Tailwind utilities para custom styling

### Modales
- shadcn `Dialog` proporciona la base
- Personaliza con Tailwind para colores y estilos Arce

### State Management
- Para completitud, movimientos seleccionados, modales abiertos: usa `useState` local o Zustand para state global
- Considera usar `react-hook-form` para manejo de forms complejos

### Responsividad
- Desktop-first: diseña para 1440px ancho
- Mobile: sidebar colapsable, tabla scrollable horizontal

---

**Sigue esta guía step-by-step y tendrás un sistema robusto y listo para produción.**
