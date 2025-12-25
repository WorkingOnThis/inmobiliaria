# Feature Specification: Tablero Navigation

**Created**: 2025-01-21

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Redirección Post-Login al Tablero (Priority: P1)

Después de un login exitoso, el sistema redirige automáticamente a todos los usuarios autenticados a la página del tablero (`/tablero`), independientemente de su rol. Si el usuario intentó acceder a una ruta protegida antes de autenticarse, el sistema respeta la URL de callback y redirige a esa ruta después del login.

**Why this priority**: La redirección al tablero después del login es fundamental para proporcionar a los usuarios acceso inmediato a las funcionalidades principales de la aplicación. Sin esta funcionalidad, los usuarios quedarían en la página de login o en una página sin contenido relevante después de autenticarse, lo que degrada significativamente la experiencia de usuario.

**Independent Test**: Puede ser probado completamente realizando un login exitoso y verificando que el navegador redirige automáticamente a `/tablero`. El test también puede verificar que si un usuario intenta acceder a una ruta protegida (como `/tablero/properties`) antes de autenticarse, después del login es redirigido a esa ruta protegida original.

**Acceptance Scenarios**:

1. **Scenario**: Redirección al tablero después de login exitoso

   - **Given** Un usuario existe en el sistema con email "usuario@ejemplo.com", contraseña válida, y cuenta verificada
   - **When** El usuario completa un login exitoso desde la página de login
   - **Then** El sistema redirige automáticamente al usuario a la página `/tablero`

2. **Scenario**: Redirección respeta callback URL de ruta protegida

   - **Given** Un usuario no autenticado intenta acceder a la ruta protegida `/tablero/properties`
   - **When** El sistema redirige al usuario a `/login?callbackUrl=/tablero/properties`, el usuario completa el login exitosamente
   - **Then** El sistema redirige al usuario a `/tablero/properties` (la ruta protegida original) en lugar de `/tablero`

3. **Scenario**: Redirección al tablero cuando no hay callback URL

   - **Given** Un usuario no autenticado accede directamente a `/login` sin intentar acceder previamente a una ruta protegida
   - **When** El usuario completa un login exitoso
   - **Then** El sistema redirige al usuario a `/tablero` (la ruta por defecto)

4. **Scenario**: Redirección funciona después de login OAuth

   - **Given** Un usuario inicia sesión usando OAuth (Google) exitosamente
   - **When** El proveedor OAuth completa la autenticación y redirige de vuelta a la aplicación
   - **Then** El sistema crea o actualiza la sesión del usuario y redirige a `/tablero` (o a la callback URL si existe)

---

### User Story 2 - Menú Lateral Basado en Rol (Priority: P1)

El sistema muestra un menú lateral (sidebar) personalizado en el tablero que contiene diferentes items de navegación según el rol del usuario autenticado. El sistema obtiene el rol del usuario desde su sesión y muestra solo los items de menú apropiados para ese rol, asegurando que los usuarios no vean opciones de navegación a funcionalidades para las que no tienen acceso.

**Why this priority**: El menú basado en roles es esencial para la seguridad y la experiencia de usuario. Proporciona una interfaz clara y personalizada que refleja las capacidades de cada usuario, evitando confusión y mejorando la usabilidad. Sin esta funcionalidad, todos los usuarios verían el mismo menú, lo que puede ser confuso o incluso un riesgo de seguridad si se muestran rutas no autorizadas.

**Independent Test**: Puede ser probado completamente iniciando sesión con un usuario con rol `visitor`, verificando que se muestran solo los items de menú apropiados para ese rol, luego iniciando sesión con un usuario con rol `account_admin` y verificando que se muestran los items apropiados para ese rol. El test verifica que los items de menú son diferentes entre roles.

**Acceptance Scenarios**:

1. **Scenario**: Usuario con rol `visitor` ve menú básico

   - **Given** Un usuario existe en el sistema con rol `visitor` y está autenticado
   - **When** El usuario accede al tablero (`/tablero`)
   - **Then** El sistema muestra el menú lateral con items apropiados para el rol `visitor` (por ejemplo: Tablero, Perfil, Configuración básica)

2. **Scenario**: Usuario con rol `account_admin` ve menú completo

   - **Given** Un usuario existe en el sistema con rol `account_admin` y está autenticado
   - **When** El usuario accede al tablero (`/tablero`)
   - **Then** El sistema muestra el menú lateral con items apropiados para el rol `account_admin` (por ejemplo: Tablero, Propiedades, Contratos, Pagos, Mantenimiento, Reportes, Configuración, Administración)

3. **Scenario**: Menú se actualiza correctamente al cambiar de sesión

   - **Given** Un usuario con rol `visitor` está autenticado y viendo el tablero con su menú personalizado
   - **When** El usuario cierra sesión y otro usuario con rol `account_admin` inicia sesión
   - **Then** El sistema muestra el menú lateral apropiado para el rol `account_admin` sin necesidad de recargar manualmente la página

4. **Scenario**: Manejo de rol desconocido o inválido

   - **Given** Un usuario existe en el sistema con un rol que no está definido en la configuración del menú (por ejemplo, un rol futuro que aún no se ha implementado)
   - **When** El usuario accede al tablero (`/tablero`)
   - **Then** El sistema muestra un menú mínimo por defecto (solo items básicos como Tablero y Perfil) y registra un evento para monitoreo

5. **Scenario**: Items de menú no exponen rutas no autorizadas

   - **Given** Un usuario con rol `visitor` está autenticado
   - **When** El sistema renderiza el menú lateral
   - **Then** Ningún item de menú apunta a rutas que requieren permisos de `account_admin` o roles superiores

---

### User Story 3 - Estado Persistente del Sidebar (Priority: P2)

El sistema recuerda el estado de expansión/colapso del menú lateral (sidebar) entre sesiones del mismo usuario. Si un usuario colapsa o expande el sidebar, esa preferencia se guarda y se restaura la próxima vez que el usuario acceda al tablero.

**Why this priority**: Esta funcionalidad mejora la experiencia de usuario al permitir que cada usuario mantenga su preferencia de interfaz personalizada. Sin embargo, es secundaria a la funcionalidad básica de navegación y menú basado en roles, ya que no afecta la seguridad o las funcionalidades core del sistema.

**Independent Test**: Puede ser probado completamente colapsando el sidebar, cerrando sesión, iniciando sesión nuevamente, y verificando que el sidebar está colapsado. Luego expandiendo el sidebar, cerrando sesión, iniciando sesión nuevamente, y verificando que el sidebar está expandido.

**Acceptance Scenarios**:

1. **Scenario**: Estado del sidebar se guarda al colapsar

   - **Given** Un usuario está autenticado y viendo el tablero con el sidebar expandido
   - **When** El usuario hace clic en el botón para colapsar el sidebar
   - **Then** El sidebar se colapsa y el estado se guarda (en localStorage o preferencias del usuario)

2. **Scenario**: Estado del sidebar se restaura al volver

   - **Given** Un usuario colapsó el sidebar en una sesión previa y el estado fue guardado
   - **When** El usuario inicia sesión nuevamente y accede al tablero
   - **Then** El sidebar se muestra en estado colapsado (el estado guardado se restaura)

3. **Scenario**: Estado del sidebar es independiente por usuario

   - **Given** El Usuario A tiene el sidebar colapsado y el Usuario B tiene el sidebar expandido
   - **When** Ambos usuarios están autenticados en diferentes navegadores o dispositivos
   - **Then** Cada usuario ve el sidebar en su estado preferido (colapsado para Usuario A, expandido para Usuario B)

---

### Edge Cases

- ¿Qué sucede cuando un usuario cambia de rol mientras tiene una sesión activa?

  - El sistema debe detectar el cambio de rol y actualizar el menú lateral dinámicamente. Sin embargo, dado que los cambios de rol generalmente requieren recargar la sesión o iniciar sesión nuevamente, el caso más común es que el usuario necesite cerrar sesión y volver a iniciar sesión para ver el nuevo menú.

- ¿Cómo maneja el sistema la carga del menú cuando la sesión tarda en cargarse?

  - El sistema debe mostrar un estado de carga (loading state) o un menú mínimo mientras se obtiene la información del rol del usuario desde la sesión. Una vez que la sesión esté disponible, el menú completo se renderiza según el rol.

- ¿Qué sucede si la sesión no incluye información del rol?

  - El sistema debe manejar este caso mostrando un menú mínimo por defecto y registrando un error para monitoreo. Idealmente, esto no debería ocurrir si Better Auth está configurado correctamente, pero el sistema debe ser resiliente.

- ¿Cómo maneja el sistema múltiples roles o roles jerárquicos en el futuro?

  - La arquitectura del sistema de configuración de menú debe ser extensible para soportar múltiples roles por usuario o roles jerárquicos. Para la implementación inicial, se asume un solo rol por usuario, pero la estructura debe permitir extensión futura sin refactorización mayor.

- ¿Qué sucede cuando un item de menú apunta a una ruta que requiere permisos adicionales más allá del rol?

  - El sistema debe validar los permisos tanto en el nivel de menú (para ocultar items no autorizados) como en el nivel de ruta (para proteger contra acceso directo mediante URL). El middleware de autenticación debe verificar permisos incluso si el item de menú es visible.

- ¿Cómo maneja el sistema la navegación cuando el usuario no tiene acceso a ninguna ruta del menú?

  - Este caso no debería ocurrir en circunstancias normales, ya que todos los usuarios deberían tener acceso al menos a Tablero y Perfil. Sin embargo, si ocurre, el sistema debe mostrar un mensaje apropiado y permitir al usuario contactar soporte o cerrar sesión.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST redirect all authenticated users to `/tablero` after successful login by default
- **FR-002**: System MUST respect callback URLs (`callbackUrl` parameter) when redirecting users after login, redirecting to the callback URL instead of `/tablero` if provided
- **FR-003**: System MUST redirect to `/tablero` when no callback URL is provided or when callback URL is invalid/inaccessible
- **FR-004**: System MUST obtain user role from the active user session (from `session.user.role`)
- **FR-005**: System MUST display menu items in the sidebar based on the user's role
- **FR-006**: System MUST provide a configuration system for defining menu items per role that is extensible for future roles
- **FR-007**: System MUST hide menu items that point to routes the user's role does not have access to
- **FR-008**: System MUST handle cases where user role is unknown or invalid by showing a default minimal menu
- **FR-009**: System MUST log events when unknown or invalid roles are encountered for monitoring purposes
- **FR-010**: System MUST update the menu dynamically when user session changes (e.g., after login/logout)
- **FR-011**: System MUST show a loading state or minimal menu while user session and role are being loaded
- **FR-012**: System MUST validate menu item visibility based on role permissions before rendering
- **FR-013**: System MUST support at minimum two roles in menu configuration: `visitor` and `account_admin`
- **FR-014**: System MUST design menu configuration architecture to be extensible for future roles (Propietario, Administrador de Propiedades, Inquilino, etc.)
- **FR-015**: System MUST persist sidebar expansion/collapse state per user (using localStorage or user preferences)
- **FR-016**: System MUST restore sidebar state from persisted storage when user accesses tablero
- **FR-017**: System MUST maintain sidebar state independently per user (users on different devices/browsers have independent states)
- **FR-018**: System MUST handle cases where persisted sidebar state is unavailable or corrupted gracefully (default to expanded state)

### Key Entities _(include if feature involves data)_

- **User Session**: Represents the active authentication session for a user. Key attributes include: user ID, user email, user role (required for menu display), session expiration timestamp, session creation timestamp. Relationships: belongs to one User. The session is obtained from Better Auth and includes the user's role in `session.user.role`. This entity is used to determine which menu items to display.

- **Menu Configuration**: Represents the configuration of menu items available for each role. This is not a database entity but a configuration object in the application code. Key attributes include: role identifier (e.g., "visitor", "account_admin"), array of menu items for that role. Each menu item includes: title (string), URL/path (string), icon (optional), required permissions/role. The configuration is structured to allow easy addition of new roles and menu items. Relationships: maps roles to menu items. This configuration determines what menu items are visible to each role.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of successful logins result in redirect to `/tablero` (or callback URL if provided) within 500ms of authentication completion (measured at 95th percentile)
- **SC-002**: Menu items are rendered according to user role within 100ms after session data is available (measured at 95th percentile)
- **SC-003**: 100% of menu items displayed to users correspond to routes that the user's role has access to (zero unauthorized menu items visible)
- **SC-004**: System handles unknown or invalid roles gracefully (shows default menu, logs event) in 100% of cases without errors or crashes
- **SC-005**: Sidebar state (expanded/collapsed) is persisted and restored correctly for 99% of users across sessions
- **SC-006**: Menu configuration system supports addition of new roles without requiring changes to core menu rendering logic (extensibility requirement)
- **SC-007**: Tablero page loads and displays menu within 1 second for 95% of requests (including session fetch and menu rendering)

