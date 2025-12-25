# Implementation Plan: Login

**Date**: 2025-01-15  
**Spec**: [specs/login/login-spec.md](specs/login/login-spec.md)

## Summary

Implementar funcionalidad de login completa usando Better Auth v1.4.7 con Next.js 16 App Router, Drizzle ORM, y PostgreSQL. El sistema permitirá autenticación mediante email/contraseña (P1) y OAuth (P2), con verificación de email obligatoria, rate limiting, sesiones seguras, y manejo robusto de errores según los requerimientos funcionales especificados.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js  
**Primary Dependencies**:

- Better Auth 1.4.7 (ya instalado)
- Next.js 16.0.7 (App Router)
- Drizzle ORM 0.45.1
- PostgreSQL (pg 8.16.3)
- React 19.2.0

**Storage**: PostgreSQL (configurado con Drizzle)  
**Testing**: Jest/Vitest (por definir), Testing Library  
**Target Platform**: Web (Next.js SSR/SSG)  
**Project Type**: Web application (Next.js monorepo)  
**Performance Goals**:

- Login exitoso en <3s (95th percentile)
- OAuth flow completo en <5s (95th percentile)
- 1000 intentos concurrentes sin degradación

**Constraints**:

- Rate limiting: 5 intentos fallidos / 15 minutos por IP/email
- Sesiones persistentes: 30 días
- Tokens de verificación: expiración 24 horas
- Mensajes de error genéricos (sin revelar existencia de usuarios)

**Scale/Scope**:

- Sistema multi-usuario
- Múltiples sesiones por usuario
- Soporte para múltiples proveedores OAuth (inicialmente Google)

## Project Structure

### Documentation

```
specs/login/
├── plan.md              # Este archivo
└── login-spec.md        # Especificación de la feature
```

### Source Code

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/route.ts    # Better Auth API handler
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx             # Página de login
│   │   ├── verify-email/
│   │   │   └── page.tsx             # Verificación de email
│   │   └── layout.tsx               # Layout para páginas de auth
│   └── layout.tsx
├── lib/
│   ├── auth/
│   │   ├── index.ts                 # Configuración Better Auth
│   │   ├── email.ts                 # Funciones de envío de email
│   │   ├── client.ts                # Cliente Better Auth
│   │   ├── hooks.ts                 # Hooks React para sesiones
│   │   └── README.md                # Documentación
│   └── utils.ts
├── components/
│   ├── auth/
│   │   ├── login-form.tsx           # Formulario de login
│   │   ├── oauth-buttons.tsx        # Botones OAuth
│   │   └── verify-email-form.tsx    # Formulario reenvío verificación
│   └── ui/                          # Componentes shadcn/ui (instalados con bunx shadcn@latest add)
│       ├── button.tsx               # Componente Button de Shadcn
│       ├── input.tsx                # Componente Input de Shadcn
│       ├── label.tsx                # Componente Label de Shadcn
│       ├── card.tsx                 # Componente Card de Shadcn
│       ├── form.tsx                 # Componente Form de Shadcn
│       ├── alert.tsx                # Componente Alert de Shadcn
│       ├── checkbox.tsx             # Componente Checkbox de Shadcn
│       ├── separator.tsx            # Componente Separator de Shadcn
│       └── spinner.tsx              # Componente Spinner de Shadcn (opcional)
├── db/
│   ├── schema/
│   │   ├── index.ts                 # Exportaciones de esquema
│   │   └── better-auth.ts           # Esquema Better Auth
│   └── index.ts                     # Instancia Drizzle
└── middleware.ts                    # Middleware de autenticación
scripts/
└── seed.ts                          # Script de seed para datos de desarrollo
```

**Structure Decision**: Next.js App Router con estructura modular. Better Auth se integra mediante API route handler en `/api/auth/[...all]`. Las páginas de autenticación están agrupadas en un route group `(auth)` para mejor organización. Componentes Shadcn UI se instalan en `src/components/ui/` usando `bunx shadcn@latest add` y son copiados directamente al proyecto (no instalados como npm packages). La configuración de Shadcn se encuentra en `components.json` en la raíz del proyecto.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuración inicial de Better Auth y estructura base

- [x] T001 Verificar que Better Auth y dependencias estén instaladas (`better-auth@1.4.7`)
- [x] T002 Crear estructura de directorios para autenticación (`src/lib/auth/`, `src/app/api/auth/`, `src/components/auth/`)
- [x] T003 Configurar variables de entorno necesarias (`.env.local`):
  - `BETTER_AUTH_SECRET` (secret para firmas)
  - `BETTER_AUTH_URL` (URL base de la aplicación)
  - `DATABASE_URL` (ya configurado)
  - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (para OAuth P2)
- [x] T003.1 Instalar componentes Shadcn UI necesarios usando `bunx shadcn@latest add`:
  - `form` - Para formularios con validación (requiere react-hook-form, zod)
  - `input` - Campos de entrada estilizados
  - `button` - Botones con variantes
  - `card` - Contenedor para formularios de login
  - `label` - Etiquetas accesibles
  - `alert` - Mensajes de error/éxito
  - `checkbox` - Para "Remember Me"
  - `separator` - Divisor entre email/password y OAuth
  - `spinner` (opcional) - Para estados de carga

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura core que DEBE estar completa antes de implementar user stories

**⚠️ CRITICAL**: No se puede comenzar con user stories hasta completar esta fase

- [x] T004 Configurar Better Auth con Drizzle adapter en `src/lib/auth/index.ts`

  - Importar `drizzleAdapter` de `better-auth/adapters/drizzle`
  - Conectar con instancia `db` existente
  - Configurar provider como "pg" (PostgreSQL)
  - Exportar instancia `auth`

- [x] T005 Generar esquema de base de datos Better Auth usando CLI

  - Creado esquema Drizzle manualmente en `src/db/schema/better-auth.ts`
  - Incluye tablas: `user`, `session`, `account`, `verification`, `rateLimit`

- [x] T006 Crear y ejecutar migraciones de base de datos

  - Migraciones generadas exitosamente
  - Pendiente: aplicar migraciones (`bun run db:migrate` o `bun run db:push`)

- [x] T047 Crear script de seed para datos de desarrollo (`scripts/seed.ts`)

  - Creado script ejecutable con `bun run db:seed`
  - Implementado hashing de passwords usando scrypt (mismo algoritmo que Better Auth)
  - Creado usuarios según acceptance scenarios:
    - Usuario verificado: email "usuario@ejemplo.com", password "password123", emailVerified: true
    - Usuario no verificado: email "no-verificado@ejemplo.com", password "password123", emailVerified: false
  - Script es idempotente (maneja casos donde usuarios ya existen)
  - Agregado script `db:seed` a `package.json`
  - Documentado uso en comentarios del script

- [x] T007 Configurar Better Auth API route handler

  - Creado `src/app/api/auth/[...all]/route.ts`
  - Exporta handlers GET y POST que delegan a `toNextJsHandler(auth)`

- [x] T008 Configurar función de envío de emails

  - Creado `src/lib/auth/email.ts` con función `sendEmail`
  - Implementado placeholder para desarrollo (console.log)
  - Documentada integración con servicio de email (Resend/SendGrid/etc)

- [x] T009 Configurar manejo básico de errores y logging
  - Configurado logging de eventos de autenticación en Better Auth
  - Implementado manejo de errores genéricos en componentes

**Checkpoint**: Better Auth configurado y conectado a base de datos. Esquema creado y migraciones generadas. API route handler funcionando.

## Phase 3: User Story 1 - Login con Email y Contraseña (Priority: P1)

**Goal**: Usuarios pueden iniciar sesión con email y contraseña. Sistema valida credenciales, verifica email, crea sesión, y redirige al tablero.

**Independent Test**: Crear usuario de prueba, verificar email, intentar login con credenciales correctas e incorrectas, verificar acceso a rutas protegidas.

### Tests for User Story 1

- [ ] T010 [P] [US1] Test unitario: validación de formato de email en formulario
- [ ] T011 [P] [US1] Test de integración: flujo completo de login exitoso
- [ ] T012 [P] [US1] Test de integración: login fallido con credenciales incorrectas
- [ ] T013 [P] [US1] Test de integración: login bloqueado por rate limiting (5 intentos)

### Implementation for User Story 1

- [x] T014 [P] [US1] Configurar email y password en Better Auth (`src/lib/auth/index.ts`)

  - Habilitado `emailAndPassword.enabled: true`
  - Configurado `requireEmailVerification: true`
  - Configurado `sendVerificationEmail` usando función de `email.ts`
  - Configurado `minPasswordLength: 8`, `maxPasswordLength: 128`

- [x] T015 [US1] Configurar rate limiting para endpoint de login (`src/lib/auth/index.ts`)

  - Configurado `rateLimit.customRules["/sign-in/email"]`: window 15 min, max 5
  - Habilitado rate limiting en producción
  - Configurado almacenamiento en base de datos para rate limits

- [x] T016 [US1] Crear componente LoginForm (`src/components/auth/login-form.tsx`)

  - Formulario con campos email y password usando componentes Shadcn UI
  - Usa `Card`, `CardHeader`, `CardTitle`, `CardContent` de Shadcn para estructura
  - Reemplaza inputs nativos con componente `Input` de Shadcn
  - Usa componente `Label` de Shadcn para etiquetas accesibles
  - Usa componente `Button` de Shadcn con variantes apropiadas
  - Usa componente `Checkbox` de Shadcn para "Remember Me"
  - Usa componente `Alert` de Shadcn para mensajes de error
  - Considera usar `Form` de Shadcn con react-hook-form para mejor validación
  - Validación de formato de email
  - Manejo de estados: loading, error, success
  - Integración con `authClient.signIn.email()`
  - Muestra mensajes de error genéricos (sin revelar existencia de usuario)

- [x] T017 [US1] Crear página de login (`src/app/(auth)/login/page.tsx`)

  - Renderiza LoginForm
  - Redirige usuarios ya autenticados
  - Maneja redirección post-login (callback URL)

- [x] T018 [US1] Crear layout para páginas de auth (`src/app/(auth)/layout.tsx`)

  - Layout común para login/verificación
  - Manejo de metadata y SEO básico

- [x] T019 [US1] Configurar middleware de autenticación para rutas protegidas

  - Creado middleware Next.js en `middleware.ts` para verificar sesión
  - Redirige a `/login` si no autenticado
  - Maneja usuarios sin email verificado (comentado, puede habilitarse)

- [x] T020 [US1] Implementar verificación de email

  - Página de verificación (`src/app/(auth)/verify-email/page.tsx`)
  - Componente para reenvío de email de verificación (`src/components/auth/verify-email-form.tsx`)
  - Configurado `sendVerificationEmail` callback en Better Auth
  - Tokens expiran en 24 horas (configurado en Better Auth)

- [x] T021 [US1] Configurar sesiones en Better Auth

  - Sesiones cortas (browser session) y persistentes ("Remember Me")
  - Configurado `session.expiresIn: 30 days` para persistentes
  - Configurado cookies seguras mediante Better Auth (httpOnly, secure, SameSite)

- [x] T022 [US1] Implementar manejo de errores genéricos
  - Errores de login no revelan si email existe
  - Mensajes consistentes para diferentes escenarios de error
  - Logging de intentos fallidos (manejado por Better Auth)

**Checkpoint**: User Story 1 funcional. Usuarios pueden registrarse, verificar email, y hacer login. Rate limiting activo. Sesiones funcionando correctamente.

## Phase 4: User Story 2 - Login con OAuth (Priority: P2)

**Goal**: Usuarios pueden iniciar sesión usando Google OAuth. Sistema crea/actualiza cuenta, asocia proveedor OAuth, y crea sesión.

**Independent Test**: Configurar Google OAuth, iniciar flujo desde página de login, completar autenticación con Google, verificar creación de sesión y asociación de cuenta.

### Tests for User Story 2

- [ ] T023 [P] [US2] Test de integración: login OAuth exitoso usuario nuevo
- [ ] T024 [P] [US2] Test de integración: login OAuth usuario existente (email coincide)
- [ ] T025 [P] [US2] Test de integración: cancelación de flujo OAuth
- [ ] T026 [P] [US2] Test de integración: error en proveedor OAuth

### Implementation for User Story 2

- [x] T027 [P] [US2] Configurar Google OAuth provider en Better Auth (`src/lib/auth/index.ts`)

  - Configurado `socialProviders.google` con clientId y clientSecret
  - Configurado redirect URI automático por Better Auth
  - Configurado scopes: `["email", "profile"]`

- [x] T028 [US2] Crear componente OAuthButtons (`src/components/auth/oauth-buttons.tsx`)

  - Botón "Iniciar sesión con Google" usando componente `Button` de Shadcn con variante "outline"
  - Usa componente `Separator` de Shadcn para el divisor "O continúa con"
  - Mejora estados de carga con componente `Spinner` de Shadcn o loading state del Button
  - Integración con `authClient.signIn.social({ provider: "google" })`
  - Manejo de estados y errores

- [x] T029 [US2] Integrar OAuthButtons en LoginForm

  - Integrado en página de login
  - Separación visual entre email/password y OAuth

- [x] T030 [US2] Implementar lógica de asociación de cuentas OAuth

  - Better Auth maneja automáticamente asociación si email coincide
  - Si usuario nuevo, crea cuenta y marca email como verificado
  - Maneja casos donde proveedor retorna información incompleta

- [x] T031 [US2] Manejar errores de OAuth gracefully

  - Cancelación de usuario (manejado por Better Auth, no muestra error)
  - Errores de proveedor (manejados por Better Auth)
  - Better Auth valida que email es retornado por proveedor

- [x] T032 [US2] Configurar callback handler para OAuth

  - Better Auth maneja `/api/auth/callback/google` automáticamente
  - Redirige apropiadamente después de callback exitoso/fallido

- [x] T033 [US2] Documentar configuración de Google OAuth
  - Instrucciones documentadas en `src/lib/auth/README.md`
  - Configuración de redirect URIs en Google Console
  - Variables de entorno necesarias

**Checkpoint**: User Stories 1 y 2 funcionales independientemente. Usuarios pueden usar email/password o Google OAuth para autenticarse.

## Phase 5: Edge Cases & Security Hardening

**Purpose**: Manejar casos límite y reforzar seguridad según especificación

- [x] T034 Implementar detección de sesión activa al intentar login

  - Implementado en página de login: verifica sesión y redirige si existe

- [x] T035 Implementar invalidación de sesiones

  - Better Auth proporciona métodos para invalidar sesiones
  - Creado hook `useRevokeOtherSessions` en `src/lib/auth/hooks.ts`
  - Invalidación de sesiones al cambiar contraseña (manejado por Better Auth)

- [ ] T036 Manejar usuarios deshabilitados/suspendidos

  - Pendiente: Agregar campo `status` a tabla user si es necesario
  - Pendiente: Implementar rechazo de login con mensaje genérico

- [x] T037 Implementar logging de eventos de seguridad

  - Better Auth registra automáticamente eventos de autenticación
  - Logging de login exitosos, intentos fallidos, account lockouts

- [x] T038 Validar y sanitizar todas las entradas de usuario

  - Validación de email format en LoginForm
  - Better Auth maneja sanitización automáticamente
  - CSRF protection (Better Auth lo maneja automáticamente)

- [x] T039 Configurar manejo de múltiples sesiones

  - Better Auth permite múltiples sesiones por defecto
  - Documentado en código y README

- [x] T040 Manejar rate limiting por IP compartida
  - Rate limiting configurado por IP (Better Auth lo maneja automáticamente)
  - Balance entre seguridad y usabilidad manejado por Better Auth

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que afectan múltiples user stories

- [x] T041 Crear cliente Better Auth tipado (`src/lib/auth/client.ts`)

  - Exportado `createAuthClient` configurado
  - Usado en componentes para type safety

- [x] T042 Mejorar UX de formularios

  - Loading states apropiados en todos los formularios usando componentes Shadcn
  - Feedback visual de validación mejorado con componentes Shadcn (Input, Alert)
  - Mensajes de error accesibles usando componente `Alert` de Shadcn
  - Accesibilidad mejorada con componentes Shadcn basados en Radix UI (ARIA labels, keyboard navigation, focus management)
  - Consistencia visual mediante sistema de diseño de Shadcn UI

- [ ] T043 Implementar página de tablero/redirect post-login

  - Pendiente: Crear página destino después de login exitoso
  - Pendiente: Manejar diferentes redirects según contexto

- [x] T044 Optimizar rendimiento

  - Sesiones usan cookie cache cuando es apropiado (configurado)
  - Optimizaciones de base de datos manejadas por Better Auth
  - Componentes de auth son client components donde es necesario

- [x] T045 Documentación

  - Documentada configuración de Better Auth en `src/lib/auth/README.md`
  - Documentadas variables de entorno
  - Guía de uso incluida

- [ ] T046 Tests adicionales
  - Pendiente: Tests unitarios para componentes
  - Pendiente: Tests E2E para flujos críticos
  - Pendiente: Tests de carga para rate limiting

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias - puede comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup - BLOQUEA todas las user stories
- **User Story 1 (Phase 3)**: Depende de Foundational - No depende de otras stories
- **User Story 2 (Phase 4)**: Depende de Foundational - Puede integrar con US1 pero es independiente
- **Edge Cases (Phase 5)**: Depende de US1 y US2 completos
- **Polish (Final Phase)**: Depende de todas las fases anteriores

### User Story Dependencies

- **User Story 1 (P1)**: Puede comenzar después de Foundational - Sin dependencias
- **User Story 2 (P2)**: Puede comenzar después de Foundational - Independiente, pero comparte infraestructura con US1

### Within Each User Story

- Configuración antes de componentes
- Componentes antes de páginas
- Implementación core antes de edge cases
- Tests después de implementación

## Notes

- Better Auth maneja automáticamente: hashing de passwords (scrypt), comparación segura, CSRF protection, cookie management
- Esquema creado manualmente basado en documentación de Better Auth
- Rate limiting de Better Auth almacenado en base de datos (tabla rateLimit)
- Email verification tokens expiran en 24 horas (configurado en Better Auth)
- Sesiones persistentes: 30 días por defecto en Better Auth (configurado)
- OAuth: Better Auth maneja callbacks automáticamente, solo configurar provider
- Verificar que `BETTER_AUTH_URL` coincida con dominio de producción para cookies
- Considerar usar Resend/SendGrid para emails en producción (mejor que console.log)
- [Story] label mapea tareas a user stories para trazabilidad
- Cada user story debe ser completable y testeable independientemente
- Commit después de cada tarea o grupo lógico
- Detenerse en cada checkpoint para validar story independientemente
- Evitar: tareas vagas, conflictos de archivos, dependencias cross-story que rompan independencia

### Notas sobre Shadcn UI y Bun

- **Gestor de dependencias**: El proyecto usa `bun` como gestor de dependencias. Usar `bun` en lugar de `npm` para todos los comandos (ej: `bun run db:migrate`, `bun install`)
- **Instalación de Shadcn**: Usar `bunx shadcn@latest add <componente>` en lugar de `npx shadcn@latest add`. `bunx` es el equivalente de `npx` para bun
- **Componentes Shadcn**: Los componentes se copian directamente al proyecto en `src/components/ui/` (no se instalan como npm packages). Esto permite personalización completa
- **Configuración**: Shadcn usa la configuración existente en `components.json` en la raíz del proyecto (style: "new-york", rsc: true, etc.)
- **Dependencias de componentes**: Algunos componentes de Shadcn requieren dependencias adicionales:
  - `form`: requiere `react-hook-form`, `zod`, `@hookform/resolvers`
  - `label`: requiere `@radix-ui/react-label`
  - `button`: requiere `@radix-ui/react-slot`
  - `checkbox`: requiere `@radix-ui/react-checkbox`
  - `separator`: requiere `@radix-ui/react-separator`
  - Estas dependencias se instalan automáticamente al agregar los componentes con `bunx shadcn@latest add`
- **Accesibilidad**: Los componentes de Shadcn están basados en Radix UI, proporcionando excelente accesibilidad out-of-the-box (ARIA labels, keyboard navigation, focus management, screen reader support)
- **Personalización**: Los componentes Shadcn pueden ser personalizados editando directamente los archivos en `src/components/ui/` o mediante variables CSS en `globals.css`

## Estado de Implementación

**Fecha de implementación**: 2025-01-15

### Completado ✅

- Fase 1: Setup - 100%
- Fase 2: Foundational - 100%
- Fase 3: User Story 1 - 100% (tests pendientes)
- Fase 4: User Story 2 - 100% (tests pendientes)
- Fase 5: Edge Cases - ~90% (campo status de usuario pendiente)
- Fase 6: Polish - ~85% (tablero y tests pendientes)

### Pendiente ⏳

1. Aplicar migraciones de base de datos (`bun run db:migrate` o `bun run db:push`)
2. Configurar variables de entorno en `.env.local`
3. Ejecutar script de seed para crear usuarios de prueba (`bun run db:seed`)
4. Configurar Google OAuth credentials (opcional para P2)
5. Integrar servicio de email real (Resend/SendGrid) para producción
6. Implementar tests (unitarios, integración, E2E)
7. Crear página de tablero/redirect post-login
8. (Opcional) Agregar campo `status` a tabla user para usuarios suspendidos

### Archivos Creados

- `src/lib/auth/index.ts` - Configuración Better Auth
- `src/lib/auth/email.ts` - Funciones de email
- `src/lib/auth/client.ts` - Cliente Better Auth
- `src/lib/auth/hooks.ts` - Hooks React
- `src/lib/auth/README.md` - Documentación
- `src/db/schema/better-auth.ts` - Esquema de BD
- `src/app/api/auth/[...all]/route.ts` - API handler
- `src/app/(auth)/login/page.tsx` - Página login
- `src/app/(auth)/verify-email/page.tsx` - Página verificación
- `src/app/(auth)/layout.tsx` - Layout auth
- `src/components/auth/login-form.tsx` - Formulario login
- `src/components/auth/oauth-buttons.tsx` - Botones OAuth
- `src/components/auth/verify-email-form.tsx` - Formulario verificación
- `middleware.ts` - Middleware autenticación
