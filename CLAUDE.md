# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev          # Start dev server with Turbopack

# Build & lint
bun run build
bun run lint

# Database (Drizzle ORM + PostgreSQL)
bun run db:generate   # Generate migrations from schema changes
bun run db:migrate    # Apply migrations
bun run db:push       # Push schema directly (dev only)
bun run db:studio     # Open Drizzle Studio GUI
bun run db:seed       # Seed database (scripts/seed.ts)
```

## Architecture

**Stack**: Next.js 16 App Router · React 19 · TypeScript · Drizzle ORM · PostgreSQL · Better Auth · ElysiaJS · TanStack Query · Tailwind v4 · shadcn/ui

### API Layer — Two Parallel Patterns

In practice, **all business endpoints are Next.js Route Handlers** (standalone files under `src/app/api/`). The ElysiaJS catch-all (`src/app/api/[[...slugs]]/route.ts`) exists for future use and currently only handles a health check — it exports `AppType` for Eden Treaty but no business routes live there yet.

1. **Next.js Route Handlers** (current standard): files at `src/app/api/<resource>/route.ts` and `src/app/api/<resource>/[id]/route.ts`. Use `NextResponse.json()`, validate with Zod, guard with `canManage*()` permission helpers. Return 401 (unauthenticated), 403 (no permission), 400 (validation error), 500 (unexpected).

2. **ElysiaJS** (`src/app/api/[[...slugs]]/route.ts`): intended for future routes needing Eden Treaty type safety. Export `AppType` and use the client at `src/lib/eden.ts`.

### Authentication — Better Auth

- Config: `src/lib/auth/index.ts` (server), `src/lib/auth/client.ts` (client)
- Auth routes handled by `src/app/api/auth/[...all]/route.ts`
- Route protection via `src/proxy.ts` (Next.js middleware pattern — not `middleware.ts`)
- Public routes: `/login`, `/register`, `/verify-email`, `/api/auth`
- User roles: `visitor` | `agent` | `account_admin` (defined in `src/lib/navigation/types.ts`)
- Email sending via Resend (`src/lib/auth/email.ts`)
- `getSession()` with headers for SSR; `authClient` for client components

### Authorization / Permissions

- Centralized in `src/lib/permissions.ts`
- Permission functions: `canManageClauses()`, `canManageClients()`, `canManageProperties()`
- Roles with write access: `agent`, `account_admin`; `visitor` is read-only
- Menu items respect permissions via `requiredPermission` field in `src/lib/navigation/menu-config.ts`
- Every API route handler must call the relevant `canManage*()` check before mutating data

### Database Schema (`src/db/schema/`)

All schemas re-exported from `src/db/schema/index.ts`. DB instance at `src/db/index.ts` (`@/db`).

| File | Tables |
|---|---|
| `better-auth.ts` | user, session, account, verification, rateLimit |
| `agency.ts` | agency (1:1 with user) — legal info, banking, email prefs |
| `client.ts` | client — type: owner\|tenant\|guarantor\|contact |
| `property.ts` | property — belongs to owner (client); `ownerRole`: "ambos"\|"real"\|"legal" |
| `property-co-owner.ts` | property_co_owner — additional owners; `role`: "ambos"\|"real"\|"legal" |
| `property-feature.ts` | property_feature — global feature catalog (e.g. "Pileta", "Garage") |
| `property-to-feature.ts` | property_to_feature — many-to-many join (propertyId, featureId) |
| `property-room.ts` | property_room — rooms per property (name, description, position) |
| `contract.ts` | contract, contract_tenant (many-to-many with role primary\|co-tenant) |
| `cash.ts` | cash_movement — tipo: income\|expense, source: manual\|contract\|settlement |
| `service.ts` | service, service_receipt, service_skip |
| `task.ts` | task, task_history, task_comment, task_file |
| `clause.ts` | clauseTemplate with `{{variable_name}}` placeholders |
| `zone.ts` | zone — barrio/zona catalog per agency |

**Key relationships**: `client` is the polymorphic contact model — owners, tenants and guarantors are all `client` rows differentiated by `type`. A `contract` links a `property` (→ owner) to one or more `client` rows (tenants) via `contract_tenant`.

**Property ownership model**: `property.ownerId` is the primary owner (used for contracts). `property.ownerRole` and `property_co_owner.role` both use "ambos" | "real" | "legal". The UI (`OwnersSection` in the property detail page) shows a single "Propietario" section when no co-owners exist; splits into "Propietario Real" / "Propietario Legal" sections when co-owners are added.

**Monetary amounts**: stored as `numeric(15,2)` in ARS. Dates as ISO `"YYYY-MM-DD"` strings. Periods as `"YYYY-MM"`.

### Data Fetching Patterns

- **Server Components**: Query DB directly via Drizzle (`db.select().from(...).where(...)`)
- **Client Components**: `useQuery` from TanStack Query + `fetch` to route handlers (or Eden Treaty when available)
- **Mutations**: Server Actions (`"use server"`) for form submissions; `fetch` to route handlers for REST mutations
- React Compiler is enabled — no manual `useMemo`/`useCallback` needed

### Component Conventions

- `*-client.tsx` suffix = client component (uses `"use client"`, TanStack Query, event handlers)
- Page files (`page.tsx`) are server components by default; extract client interactivity into `*-client.tsx` siblings
- Parallel route `@modal` under `clientes/` handles modal-intercept navigation pattern
- Tenant/owner status is computed by `calculateStatus()` in `src/lib/tenants/status.ts` — never recalculate inline

### Reusable UI Patterns

**`CreatableCombobox`** (`src/components/ui/creatable-combobox.tsx`): generic combobox with inline creation. Props: `value`, `onChange`, `options: string[]`, `onSearch?`, `onCreate?`, `onQueryChange?`, `placeholder?`. Wrappers that need server-side search pass `onSearch={(_, opts) => opts}` (skip client filtering) and drive API calls via `onQueryChange` with debounce. For multi-select, always pass `value=""` and show selections as removable badges above the input.

**`ZoneCombobox`** (`src/components/ui/zone-combobox.tsx`): thin wrapper around `CreatableCombobox`. Fetches from `GET /api/zones`, creates via `POST /api/zones`.

**`FeatureCombobox`** (`src/components/ui/feature-combobox.tsx`): multi-select wrapper. Fetches current selections from `GET /api/properties/[id]/features`; searches global catalog at `GET /api/property-features?search=`.

**`EditSelect` with unset support**: use a `NONE_SENTINEL = "__none__"` value to allow shadcn `<Select>` to show a "Sin especificar" option that maps to `""` / `null` — shadcn Select doesn't support `value=""`.

### Structured Clause Content

`src/lib/clauses/structured-content/` contains parser, serializer, validator, and types for the `{{variable_name}}` template system used in contract clauses.

Available iteration entities: `AVAILABLE_ENTITIES = ["owners", "tenants", "rooms"]` in `src/lib/clauses/constants.ts`. The `IterationPart.entity` type is derived from this constant via `AvailableEntity`. To add a new iterable entity, extend `AVAILABLE_ENTITIES` and add its label to `ENTITY_LABELS` in `src/lib/clauses/entity-definitions.ts`.

### Path Aliases

`@/` maps to `src/`. Use `@/db`, `@/lib/...`, `@/components/...` throughout.

### Route Structure

```
app/
├── (auth)/           # login, register, verify-email, register-oauth
├── (dashboard)/      # Protected; Spanish URL folders match nav URLs exactly
│   ├── tablero/      # Dashboard
│   ├── propietarios/ # Owners — list + [id] detail + [id]/liquidacion
│   ├── inquilinos/   # Tenants
│   ├── propiedades/  # Properties
│   ├── contratos/    # Contracts + clausulas/nueva/
│   ├── servicios/    # Services
│   ├── tareas/       # Tasks
│   └── caja/         # Cash management
└── api/
    ├── [...slugs]    # ElysiaJS catch-all (future)
    ├── auth/[...all] # Better Auth
    ├── owners/       # REST: owners + cuenta-corriente + movimientos
    ├── tenants/      # REST: tenants + movimientos
    ├── properties/   # REST + [id]/co-owners, [id]/features, [id]/rooms
    ├── property-features/  # Global feature catalog (search + create)
    ├── zones/        # Zone catalog (search + create)
    ├── contracts/    # REST
    ├── cash/         # REST: cash/movimientos
    ├── services/     # REST + summary + companies
    ├── tasks/        # REST + archivos
    ├── clauses/      # REST
    ├── receipts/     # PDF generation
    ├── dashboard/    # summary + portfolio
    └── arrears/      # active arrears
```

## Code Language

All internal code must be in English: function names, variables, TypeScript types, DB columns, tables, API routes, and folder names.

Exceptions — keep in Spanish:
- Argentine legal terms: `dni`, `cuit`, `cbu`, `alias`, `condicionFiscal` and their values (`monotributista`, `responsable inscripto`, etc.)
- User-facing text: labels, messages, placeholders, UI content

User-facing navigation URLs are in Spanish and match folder names under `app/(dashboard)/`:
- /propietarios → not /owners
- /inquilinos → not /tenants
- /propiedades → not /properties
- /contratos → not /contracts
- /servicios → not /services
- /tareas → not /tasks
- /caja → not /cash

## Domain Business Logic

- **Modality A**: agency collects rent via its CBU, adds 1% surcharge, deducts it from owner settlement
- **Modality B**: rent paid directly to owner's CBU, no surcharge
- **Cash**: always exempt from surcharges
- **Adjustment indexes**: ICL, IPC, CER, UVA (BCRA API with manual fallback); stored in `contract.adjustmentIndex`
- **Services with `triggersBlock: true`**: unpaid service blocks rent collection for that property
- **Tenant statuses**: `sin_contrato` | `activo` | `en_mora` | `por_vencer` — calculated by `calculateStatus()`, never stored

## UI Components — shadcn/ui

This project uses shadcn/ui with Tailwind v4. Dark mode only (`html class="dark"`). Custom CSS variables: `--income`, `--income-dim`, `--destructive`, `--destructive-dim`.

When working on UI:

- **General usage**: see `.agents/skills/shadcn/SKILL.md`
- **Forms**: see `.agents/skills/shadcn/rules/forms.md`
- **Styling**: see `.agents/skills/shadcn/rules/styling.md`
- **Composition**: see `.agents/skills/shadcn/rules/composition.md`
- **Icons**: see `.agents/skills/shadcn/rules/icons.md`
- **Base vs Radix**: see `.agents/skills/shadcn/rules/base-vs-radix.md`

Install components via CLI only:
```bash
npx shadcn@latest add [component]
```

Never write custom UI primitives — use components from `@/components/ui/`.
