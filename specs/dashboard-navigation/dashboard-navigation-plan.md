# Implementation Plan: Dashboard Navigation

**Date**: 2025-01-21  
**Spec**: [specs/dashboard-navigation/dashboard-navigation-spec.md](specs/dashboard-navigation/dashboard-navigation-spec.md)

## Summary

Implementar el sistema completo de navegación del tablero que incluye: (1) redirección automática post-login a `/tablero` respetando callback URLs, (2) menú lateral basado en roles del usuario con integración de permisos granulares, y (3) persistencia del estado de expansión/colapso del sidebar. La funcionalidad principal ya está implementada; el enfoque está en agregar la integración con permisos granulares (FR-012a) para filtrar items de menú según funciones como `canManageClauses()` y `hasRouteAccess()`.

## Technical Context

**Language/Version**: TypeScript, Next.js 15+  
**Primary Dependencies**: Better Auth, React, shadcn/ui (Sidebar components)  
**Storage**: localStorage (para estado del sidebar), Better Auth session (para rol del usuario)  
**Testing**: Manual testing basado en escenarios de aceptación  
**Target Platform**: Web (Next.js App Router)  
**Project Type**: Web application  
**Performance Goals**: Menú renderizado en <100ms después de que la sesión esté disponible (95th percentile), redirect post-login en <500ms  
**Constraints**: Menú debe actualizarse dinámicamente cuando cambia la sesión, estado del sidebar debe ser independiente por usuario  

## Current State Analysis

### Already Implemented ✅

1. **Post-login redirect**: Implementado en [`src/components/auth/login-form.tsx`](src/components/auth/login-form.tsx) (líneas 62, 72) y [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) (línea 27)
2. **Role-based menu**: Implementado en [`src/components/app-sidebar.tsx`](src/components/app-sidebar.tsx) usando `getMenuItemsByRole()` de [`src/lib/navigation/menu-config.ts`](src/lib/navigation/menu-config.ts)
3. **Persistent sidebar state**: Implementado en [`src/components/dashboard-layout.tsx`](src/components/dashboard-layout.tsx) con localStorage por usuario
4. **Menu configuration**: Sistema configurado en [`src/lib/navigation/menu-config.ts`](src/lib/navigation/menu-config.ts) con soporte para roles `visitor` y `account_admin`
5. **Callback URL middleware**: [`middleware.ts`](middleware.ts) establece `callbackUrl` cuando redirige a login (línea 34)

### Needs Implementation/Enhancement ⚠️

1. **Permission-based menu filtering (FR-012a)**: Integrar funciones de permisos granulares (`canManageClauses()`, `hasRouteAccess()`) de [`src/lib/permissions.ts`](src/lib/permissions.ts) para filtrar items de menú y sub-items
2. **OAuth callback URL handling**: Verificar que los redirects OAuth respeten callback URLs correctamente
3. **Enhanced logging**: Mejorar logging para roles desconocidos (hay un TODO en línea 219 de menu-config.ts)

## Project Structure

```text
src/
├── components/
│   ├── app-sidebar.tsx          # Sidebar component (existing)
│   ├── dashboard-layout.tsx     # Layout with sidebar persistence (existing)
│   └── auth/
│       ├── login-form.tsx       # Login form with redirect (existing)
│       └── oauth-buttons.tsx    # OAuth buttons (needs callback URL verification)
├── lib/
│   ├── navigation/
│   │   ├── menu-config.ts       # Menu configuration (needs permission filtering)
│   │   └── types.ts             # Menu types (existing)
│   └── permissions.ts           # Permission functions (existing)
└── app/
    └── (auth)/
        └── login/
            └── page.tsx         # Login page with redirect (existing)
```

## Phase 1: Permission-Based Menu Filtering (FR-012a) - Priority: P1

**Goal**: Integrar funciones de permisos granulares para filtrar items de menú basándose en permisos específicos de features, no solo roles básicos.

**Independent Test**: Iniciar sesión con un usuario que tiene rol `account_admin` pero no tiene permiso `canManageClauses()`. Verificar que los items de menú relacionados con cláusulas no aparecen en el menú, incluso si el rol normalmente tendría acceso.

### Implementation

- [ ] **T001 [P1] [US2]** Extender `MenuItem` type en [`src/lib/navigation/types.ts`](src/lib/navigation/types.ts) para soportar opcionalmente un campo `requiredPermission` que especifique qué función de permiso verificar (ej: "canManageClauses")

- [ ] **T002 [P1] [US2]** Crear función `filterMenuItemsByPermissions()` en [`src/lib/navigation/menu-config.ts`](src/lib/navigation/menu-config.ts) que:
  - Tome un array de `MenuItem[]` y un `role` string
  - Para cada item, verifique si tiene `requiredPermission`
  - Si tiene, llame a la función de permiso correspondiente desde `src/lib/permissions.ts`
  - Filtre items y sub-items recursivamente según los permisos
  - Retorne solo items visibles para el usuario

- [ ] **T003 [P1] [US2]** Modificar `getMenuItemsByRole()` en [`src/lib/navigation/menu-config.ts`](src/lib/navigation/menu-config.ts) para:
  - Llamar a `filterMenuItemsByPermissions()` después de obtener items por rol
  - Pasar el rol del usuario para verificación de permisos
  - Asegurar que items y sub-items se filtren recursivamente

- [ ] **T004 [P1] [US2]** Actualizar configuración de menú en `menu-config.ts` para agregar `requiredPermission` a items que requieren permisos granulares (ej: items relacionados con cláusulas de contratos deben verificar `canManageClauses`)

- [ ] **T005 [P1] [US2]** Agregar verificación de rutas usando `hasRouteAccess()` en `filterMenuItemsByPermissions()` como capa adicional de seguridad para validar que la URL del item es accesible

**Checkpoint**: Menú filtra correctamente items basándose en permisos granulares. Usuarios con rol `account_admin` pero sin permiso `canManageClauses()` no ven items de cláusulas.

---

## Phase 2: OAuth Callback URL Verification - Priority: P2

**Goal**: Asegurar que los redirects OAuth respeten callback URLs correctamente y redirijan a `/tablero` por defecto.

**Independent Test**: Iniciar sesión con OAuth después de intentar acceder a una ruta protegida. Verificar que después de la autenticación OAuth, el usuario es redirigido a la ruta original, no solo a `/tablero`.

### Implementation

- [ ] **T006 [P2] [US1]** Verificar que [`src/components/auth/oauth-buttons.tsx`](src/components/auth/oauth-buttons.tsx) respeta `callbackURL` prop correctamente (actualmente línea 26 usa `callbackURL || "/tablero"` pero necesita verificar que se pasa desde la página de login)

- [ ] **T007 [P2] [US1]** Verificar que [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) pasa `callbackUrl` a `OAuthButtons` component (actualmente solo lo pasa a `LoginForm`)

- [ ] **T008 [P2] [US1]** Verificar redirección OAuth en callbacks de Better Auth para asegurar que se respeta `callbackURL` después de autenticación OAuth exitosa

**Checkpoint**: OAuth redirects respetan callback URLs y redirigen a `/tablero` por defecto cuando no hay callback URL.

---

## Phase 3: Enhanced Logging & Error Handling - Priority: P2

**Goal**: Mejorar logging para roles desconocidos y casos edge, asegurando que eventos sean registrados para monitoreo.

**Independent Test**: Acceder al tablero con un usuario que tiene un rol no definido en la configuración. Verificar que se registra un evento de monitoreo y se muestra menú mínimo sin errores.

### Implementation

- [ ] **T009 [P2] [US2]** Implementar función de logging en [`src/lib/navigation/menu-config.ts`](src/lib/navigation/menu-config.ts) para roles desconocidos (reemplazar TODO en línea 219):
  - En desarrollo: usar `console.warn`
  - En producción: preparar estructura para enviar a servicio de logging (comentado para implementación futura)
  - Incluir: timestamp, userId, role, userAgent (opcional)

- [ ] **T010 [P2] [US2]** Agregar manejo de errores cuando `hasRouteAccess()` falla o retorna resultados inesperados, asegurando que el menú siempre muestre al menos items básicos (Tablero, Perfil)

- [ ] **T011 [P2] [US2]** Agregar logging cuando se filtran items de menú por permisos para ayudar en debugging (solo en desarrollo)

**Checkpoint**: Sistema registra eventos apropiadamente y maneja errores gracefully sin afectar experiencia del usuario.

---

## Phase 4: Testing & Validation - Priority: P1

**Goal**: Verificar que todas las funcionalidades trabajan correctamente según los escenarios de aceptación de la spec.

### Testing

- [ ] **T012 [P1] [US1]** Verificar redirección post-login a `/tablero` sin callback URL
- [ ] **T013 [P1] [US1]** Verificar redirección post-login respeta callback URL cuando se intenta acceder a ruta protegida
- [ ] **T014 [P1] [US1]** Verificar redirección post-OAuth a `/tablero` o callback URL
- [ ] **T015 [P1] [US2]** Verificar menú muestra items correctos para rol `visitor`
- [ ] **T016 [P1] [US2]** Verificar menú muestra items correctos para rol `account_admin`
- [ ] **T017 [P1] [US2]** Verificar menú filtra items basándose en permisos granulares (ej: `canManageClauses()`)
- [ ] **T018 [P1] [US2]** Verificar menú muestra menú mínimo cuando rol es desconocido
- [ ] **T019 [P1] [US3]** Verificar estado del sidebar se guarda al colapsar/expandir
- [ ] **T020 [P1] [US3]** Verificar estado del sidebar se restaura al volver después de logout/login
- [ ] **T021 [P1] [US3]** Verificar estado del sidebar es independiente por usuario

**Checkpoint**: Todos los escenarios de aceptación de la spec pasan correctamente.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Permission Filtering)**: Puede comenzar inmediatamente - no bloquea otras fases
- **Phase 2 (OAuth Verification)**: Puede ejecutarse en paralelo con Phase 1
- **Phase 3 (Enhanced Logging)**: Puede ejecutarse en paralelo con Phase 1 y 2
- **Phase 4 (Testing)**: Depende de completar Phase 1, 2, y 3

### Implementation Notes

- Mantener compatibilidad con código existente - no romper funcionalidad actual
- Permission filtering debe ser opt-in (items sin `requiredPermission` se muestran normalmente)
- Logging debe ser no-intrusivo y no afectar performance
- Todos los cambios deben mantener la arquitectura extensible para futuros roles

### Code Locations

**Files to Modify:**
- [`src/lib/navigation/menu-config.ts`](src/lib/navigation/menu-config.ts) - Agregar filtering de permisos
- [`src/lib/navigation/types.ts`](src/lib/navigation/types.ts) - Extender tipos si es necesario
- [`src/components/auth/oauth-buttons.tsx`](src/components/auth/oauth-buttons.tsx) - Verificar callback URL handling
- [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) - Pasar callbackUrl a OAuthButtons

**Files to Reference (No Changes):**
- [`src/lib/permissions.ts`](src/lib/permissions.ts) - Funciones de permisos existentes
- [`src/components/app-sidebar.tsx`](src/components/app-sidebar.tsx) - Usa menu-config, no requiere cambios
- [`src/components/dashboard-layout.tsx`](src/components/dashboard-layout.tsx) - Funcionalidad de sidebar ya completa

