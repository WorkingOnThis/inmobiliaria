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

1. **ElysiaJS** (`src/app/api/[[...slugs]]/route.ts`): The primary REST API. All routes are defined in one Elysia instance with `prefix: "/api"`. Export `AppType` for Eden Treaty type safety. Use the Eden Treaty client at `src/lib/eden.ts` (`api` from `@/lib/eden`) for type-safe calls.

2. **Next.js Route Handlers** (`src/app/api/clauses/route.ts`, `clients/`, `properties/`): Standalone handlers for specific endpoints that bypass ElysiaJS.

Use ElysiaJS for new endpoints that need validation, type-safe clients, or complex routing. Use standalone Route Handlers for simple endpoints or webhooks.

### Authentication — Better Auth

- Config: `src/lib/auth/index.ts` (server), `src/lib/auth/client.ts` (client)
- Auth routes handled by `src/app/api/auth/[...all]/route.ts`
- Route protection via `src/proxy.ts` (Next.js middleware pattern — not `middleware.ts`)
- Public routes: `/login`, `/register`, `/verify-email`, `/api/auth`
- User roles: `visitor` | `agent` | `account_admin` (defined in `src/lib/navigation/types.ts`)
- Email sending via Resend (`src/lib/auth/email.ts`)

### Authorization / Permissions

- Centralized in `src/lib/permissions.ts`
- Permission functions: `canManageClauses()`, `canManageClients()`, `canManageProperties()`
- Roles with write access: `agent`, `account_admin`; `visitor` is read-only
- Menu items respect permissions via `requiredPermission` field in `src/lib/navigation/menu-config.ts`

### Database Schema (`src/db/schema/`)

- `better-auth.ts` — Auth tables (user, session, account, verification, rateLimit)
- `agency.ts` — Agency (1:1 with user owner)
- `client.ts` — Client contacts (optionally linked 1:1 to a user)
- `property.ts` — Properties (owned by a client, created by a user)
- `clause.ts` — `clauseTemplate` with `{{variable_name}}` placeholders for contract generation

All schemas re-exported from `src/db/schema/index.ts`. DB instance at `src/db/index.ts` (`@/db`).

### Data Fetching Patterns

- **Server Components**: Query DB directly via Drizzle (`db.select().from(...)`)
- **Client Components**: Use TanStack Query + Eden Treaty (`api.resource.get()`)
- **Mutations**: Prefer Server Actions (`"use server"`) for form submissions; ElysiaJS for REST mutations
- React Compiler is enabled — no manual `useMemo`/`useCallback` needed

### Structured Clause Content

`src/lib/clauses/structured-content/` contains parser, serializer, validator, and types for the `{{variable_name}}` template system used in contract clauses.

### Path Aliases

`@/` maps to `src/`. Use `@/db`, `@/lib/...`, `@/components/...` throughout.

### Route Structure

```
app/
├── (auth)/          # Auth group layout (login, register, verify-email, register-oauth)
├── api/
│   ├── [[...slugs]] # ElysiaJS catch-all
│   ├── auth/[...all]# Better Auth handler
│   ├── clauses/     # Standalone handlers
│   ├── clients/
│   └── properties/
├── clientes/        # Client management (with @modal parallel route for intercept)
├── contratos/clausulas/nueva/  # Clause creation
├── propiedades/     # Property management
└── tablero/         # Dashboard
```
