# Feature Specification: Creación de Cláusulas de Contratos

**Created**: 2025-01-21

## Permisos y Control de Acceso

**IMPORTANTE**: Los permisos para esta feature están centralizados en `src/lib/permissions.ts`. Los roles autorizados para crear cláusulas se definen en la constante `CLAUSE_MANAGEMENT_PERMISSIONS`.

Para agregar o modificar roles con acceso a esta feature, modifica únicamente el archivo de permisos. **NO es necesario modificar este spec** cuando se agreguen nuevos roles o se cambien los permisos.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Acceso a Creación de Cláusulas para Roles Autorizados (Priority: P1)

Los usuarios con roles autorizados (según la configuración de permisos en `src/lib/permissions.ts`) pueden acceder al formulario de creación de cláusulas a través de la ruta `/tablero/contratos/clausulas/nueva`. El sistema debe proporcionar una forma de acceder a esta ruta (por ejemplo, un botón o enlace en el menú lateral dentro del submenú "Contratos" o directamente desde el tablero). Los usuarios con roles no autorizados no pueden acceder a esta funcionalidad.

**Why this priority**: El control de acceso basado en roles es fundamental para la seguridad del sistema. Sin esta funcionalidad, usuarios no autorizados podrían intentar acceder a rutas protegidas o ver opciones de menú que no deberían estar disponibles para ellos. Esta es la base sobre la cual se construyen todas las demás funcionalidades.

**Independent Test**: Puede ser probado completamente iniciando sesión con un usuario con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`), verificando que puede acceder a `/tablero/contratos/clausulas/nueva` (ya sea desde un enlace en el menú o escribiendo la URL directamente). Luego iniciando sesión con un usuario con un rol no autorizado (por ejemplo, `visitor`) y verificando que no puede acceder a la ruta (debe ser redirigido o mostrar error de acceso denegado).

**Acceptance Scenarios**:

1. **Scenario**: Usuario con rol autorizado puede acceder al formulario de creación

   - **Given** Un usuario existe en el sistema con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) y está autenticado
   - **When** El usuario navega a `/tablero/contratos/clausulas/nueva` (ya sea desde un enlace en el menú o escribiendo la URL directamente)
   - **Then** El sistema muestra el formulario de creación de cláusulas sin errores de acceso denegado

2. **Scenario**: Usuario con rol no autorizado no puede acceder al formulario de creación

   - **Given** Un usuario existe en el sistema con un rol no autorizado (no incluido en `CLAUSE_MANAGEMENT_PERMISSIONS`, por ejemplo `visitor`) y está autenticado
   - **When** El usuario intenta navegar a `/tablero/contratos/clausulas/nueva` (escribiendo la URL directamente)
   - **Then** El sistema redirige al usuario a una página de acceso denegado o al tablero principal, y muestra un mensaje indicando que no tiene permisos para acceder a esta funcionalidad

---

### User Story 2 - Crear Nueva Plantilla de Cláusula (Priority: P1)

Los usuarios con roles autorizados (según `CLAUSE_MANAGEMENT_PERMISSIONS`) pueden crear nuevas plantillas de cláusulas accediendo directamente a `/tablero/contratos/clausulas/nueva` donde se muestra un formulario para crear la plantilla. El formulario incluye campos para: título de la cláusula, categoría, y contenido de la plantilla con soporte para variables/placeholders.

**Why this priority**: La creación de plantillas de cláusulas es la funcionalidad core de esta feature. Sin la capacidad de crear plantillas, no hay valor que entregar a los usuarios. Esta es la funcionalidad principal que justifica la existencia de esta feature.

**Independent Test**: Puede ser probado completamente iniciando sesión con un usuario autorizado, navegando a `/tablero/contratos/clausulas/nueva`, completando el formulario con datos válidos, y verificando que la plantilla se guarda correctamente en la base de datos.

**Acceptance Scenarios**:

1. **Scenario**: Usuario accede al formulario de creación de cláusula

   - **Given** Un usuario con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) está autenticado
   - **When** El usuario navega a `/tablero/contratos/clausulas/nueva`
   - **Then** El sistema muestra un formulario con los siguientes campos: Título (requerido), Categoría (requerido, selector), Contenido (requerido, área de texto), y un botón para guardar

2. **Scenario**: Usuario crea una cláusula con datos válidos

   - **Given** Un usuario con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) está autenticado y se encuentra en el formulario de creación (`/tablero/contratos/clausulas/nueva`)
   - **When** El usuario completa el formulario con:
     - Título: "Cláusula de Pago Mensual"
     - Categoría: "Pago"
     - Contenido: "El inquilino se compromete a pagar el monto de {{monto_mensual}} el día {{dia_pago}} de cada mes."
     - Y hace clic en "Guardar" o "Crear Cláusula"
   - **Then** El sistema valida los datos, guarda la plantilla en la base de datos asociada al usuario creador, muestra un mensaje de éxito, y redirige al usuario a una página apropiada (por ejemplo, el tablero o una página de confirmación)

3. **Scenario**: Sistema valida campos requeridos

   - **Given** Un usuario con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) está autenticado y se encuentra en el formulario de creación
   - **When** El usuario intenta guardar el formulario sin completar uno o más campos requeridos (Título, Categoría, o Contenido)
   - **Then** El sistema muestra mensajes de error específicos para cada campo faltante, no guarda la plantilla, y mantiene al usuario en el formulario con los datos parcialmente completados

4. **Scenario**: Usuario puede usar variables/placeholders en el contenido

   - **Given** Un usuario con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) está autenticado y se encuentra en el formulario de creación
   - **When** El usuario escribe en el campo Contenido texto que incluye variables en formato `{{nombre_variable}}`, por ejemplo: "El inquilino {{nombre_inquilino}} se compromete a pagar {{monto_mensual}}."
   - **Then** El sistema acepta el contenido con las variables, guarda el texto tal como está escrito (sin procesar las variables en este momento), y la plantilla se guarda correctamente con las variables preservadas

5. **Scenario**: Cláusula creada está asociada al usuario creador
   - **Given** Un usuario con ID "user-123" y un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) está autenticado
   - **When** El usuario crea una nueva cláusula con título "Mi Cláusula Personal"
   - **Then** El sistema guarda la cláusula en la base de datos con una referencia al usuario creador (user-123), y esta asociación se puede consultar posteriormente para determinar quién puede editar o eliminar la cláusula

---

### User Story 3 - Seleccionar Categoría para Cláusula (Priority: P2)

Al crear una nueva plantilla de cláusula, el usuario debe seleccionar una categoría de una lista predefinida. Las categorías ayudan a organizar las cláusulas y facilitan su búsqueda y selección posterior cuando se generen contratos. El sistema proporciona un selector (dropdown o similar) con categorías predefinidas.

**Why this priority**: Las categorías mejoran la organización y usabilidad del sistema, pero no son estrictamente necesarias para la funcionalidad básica de creación. Un usuario podría crear cláusulas sin categorías, aunque sería menos organizado. Por lo tanto, esta funcionalidad tiene prioridad P2.

**Independent Test**: Puede ser probado completamente creando una cláusula y verificando que se puede seleccionar una categoría del selector y que la categoría seleccionada se guarda correctamente en la base de datos.

**Acceptance Scenarios**:

1. **Scenario**: Usuario ve selector de categorías en el formulario

   - **Given** Un usuario con un rol autorizado (según `CLAUSE_MANAGEMENT_PERMISSIONS`) está autenticado y se encuentra en el formulario de creación (`/tablero/contratos/clausulas/nueva`)
   - **When** El usuario visualiza el formulario
   - **Then** El sistema muestra un campo "Categoría" con un selector (dropdown) que contiene las siguientes opciones predefinidas: "Pago", "Mantenimiento", "Terminación", "Obligaciones del Inquilino", "Obligaciones del Propietario", "General" (y posiblemente otras categorías estándar)

2. **Scenario**: Usuario selecciona una categoría válida

   - **Given** Un usuario está en el formulario de creación y el selector de categorías está visible
   - **When** El usuario hace clic en el selector de categorías y selecciona "Pago"
   - **Then** El sistema marca "Pago" como seleccionado en el formulario, y esta selección se mantiene cuando el usuario completa otros campos

3. **Scenario**: Categoría seleccionada se guarda con la cláusula

   - **Given** Un usuario está en el formulario de creación
   - **When** El usuario selecciona la categoría "Mantenimiento", completa los demás campos requeridos, y guarda la cláusula
   - **Then** El sistema guarda la cláusula en la base de datos con la categoría "Mantenimiento" asociada, y esta categoría se puede consultar posteriormente

4. **Scenario**: Sistema valida que se seleccione una categoría
   - **Given** Un usuario está en el formulario de creación
   - **When** El usuario intenta guardar la cláusula sin haber seleccionado una categoría
   - **Then** El sistema muestra un mensaje de error indicando que la categoría es requerida, no guarda la cláusula, y mantiene al usuario en el formulario

---

### Edge Cases

- ¿Qué sucede cuando un usuario intenta crear una cláusula con un título que ya existe (duplicado)?

  - El sistema debe permitir títulos duplicados, ya que diferentes usuarios pueden crear cláusulas con el mismo título. Sin embargo, si el mismo usuario intenta crear una cláusula con un título idéntico a una que ya creó, el sistema podría mostrar una advertencia pero permitir la creación (o requerir un título único por usuario). Para esta spec inicial, asumimos que se permiten títulos duplicados.

- ¿Cómo maneja el sistema variables/placeholders con formato incorrecto (por ejemplo, `{variable}` sin doble llave o `{{variable sin cerrar`)?

  - El sistema debe aceptar cualquier texto en el campo de contenido, incluyendo texto con formato de variables incorrecto. La validación y procesamiento de variables se realizará en una feature futura cuando se generen los contratos. Por ahora, el sistema solo almacena el texto tal como se escribe.

- ¿Qué sucede si el contenido de la cláusula es extremadamente largo (por ejemplo, más de 10,000 caracteres)?

  - El sistema debe aceptar contenido de cualquier longitud razonable. Se debe definir un límite máximo (por ejemplo, 50,000 caracteres) para prevenir abusos o problemas de rendimiento. Si el contenido excede el límite, el sistema debe mostrar un error y no guardar la cláusula.

- ¿Cómo maneja el sistema la creación de cláusulas cuando el usuario pierde la conexión a internet o la sesión expira durante el proceso?

  - Si la sesión expira, el sistema debe redirigir al usuario al login y, después del login, el usuario debería poder volver al formulario (aunque los datos no guardados se perderían). Si hay un error de red, el sistema debe mostrar un mensaje de error apropiado y permitir al usuario reintentar el guardado.

- ¿Qué sucede si un usuario con un rol autorizado cambia a un rol no autorizado mientras tiene una sesión activa y está en el formulario de creación?

  - El sistema debe detectar el cambio de rol (probablemente requiriendo recargar la sesión) y redirigir al usuario fuera del formulario de creación, ya que ya no tiene permisos para acceder. Idealmente, esto se manejaría a través del middleware de autenticación que verifica los permisos según `CLAUSE_MANAGEMENT_PERMISSIONS`.

- ¿Cómo maneja el sistema caracteres especiales, emojis, o formato HTML en el contenido de la cláusula?
  - El sistema debe aceptar texto plano. Si el usuario ingresa HTML, debe ser escapado o tratado como texto literal. Los emojis y caracteres especiales Unicode deben ser aceptados. El formato específico (rich text, markdown, etc.) se puede considerar en una feature futura.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST use the centralized permissions configuration (`src/lib/permissions.ts`) to determine which roles can access `/tablero/contratos/clausulas/nueva`
- **FR-002**: System MUST allow users with roles defined in `CLAUSE_MANAGEMENT_PERMISSIONS` to access `/tablero/contratos/clausulas/nueva`
- **FR-003**: System MUST deny access to `/tablero/contratos/clausulas/nueva` for users with roles not included in `CLAUSE_MANAGEMENT_PERMISSIONS`
- **FR-004**: System MUST implement permission checks using the `canManageClauses()` function from `src/lib/permissions.ts` to verify access to the creation form
- **FR-007**: System MUST provide a form at `/tablero/contratos/clausulas/nueva` for creating new clause templates
- **FR-008**: System MUST require the following fields when creating a clause template: Title (string, required), Category (string, required, from predefined list), Content (text, required)
- **FR-009**: System MUST validate that all required fields are provided before saving a clause template
- **FR-010**: System MUST display validation error messages for each missing or invalid required field
- **FR-011**: System MUST allow users to include variables/placeholders in the Content field using the format `{{variable_name}}`
- **FR-012**: System MUST store the clause template content exactly as entered by the user, preserving variable placeholders without processing them during creation
- **FR-013**: System MUST associate each created clause template with the user who created it (store creator user ID)
- **FR-014**: System MUST persist clause templates to the database with the following attributes: unique identifier (ID), title, category, content, creator user ID, creation timestamp, update timestamp
- **FR-015**: System MUST provide a predefined list of categories for clause templates, including at minimum: "Pago", "Mantenimiento", "Terminación", "Obligaciones del Inquilino", "Obligaciones del Propietario", "General"
- **FR-016**: System MUST display categories in a dropdown/selector component in the creation form
- **FR-017**: System MUST require users to select a category from the predefined list (category selection is mandatory)
- **FR-018**: System MUST validate that the selected category is from the predefined list of valid categories
- **FR-019**: System MUST redirect users to an appropriate page (e.g., dashboard or confirmation page) after successfully creating a clause template
- **FR-020**: System MUST display a success message after successfully creating a clause template
- **FR-021**: System MUST handle form submission errors gracefully and display appropriate error messages to the user
- **FR-022**: System MUST preserve partially entered form data when validation errors occur (user should not lose their input)
- **FR-023**: System MUST enforce a maximum length limit for the Content field [NEEDS CLARIFICATION: what is the maximum length? Suggested: 50,000 characters]
- **FR-024**: System MUST enforce a maximum length limit for the Title field [NEEDS CLARIFICATION: what is the maximum length? Suggested: 200 characters]
- **FR-025**: System MUST handle cases where user session expires during clause creation by redirecting to login
- **FR-026**: System MUST allow duplicate clause titles (different users can create clauses with the same title)
- **FR-027**: System MUST accept Unicode characters, special characters, and emojis in the Content field (text is stored as-is without HTML processing)

### Key Entities _(include if feature involves data)_

- **Clause Template (Plantilla de Cláusula)**: Represents a reusable text template for contract clauses. Key attributes include: unique identifier (ID), title (required, string, max length TBD), category (required, string from predefined list), content (required, text, can include variables in format `{{variable_name}}`), creator user ID (required, foreign key to User), creation timestamp (required), update timestamp (required). Relationships: belongs to one User (the creator). The clause template is created by users with roles authorized according to `CLAUSE_MANAGEMENT_PERMISSIONS` (see `src/lib/permissions.ts`) and can be used in the future to generate contract documents by selecting clauses and filling in variable values. The content field stores the template text exactly as entered, including variable placeholders that will be processed later when generating contracts.

- **User (Better Auth)**: Represents a user account in the Better Auth system. Key attributes include: unique identifier (ID), email address (unique, required), role (required, must be included in `CLAUSE_MANAGEMENT_PERMISSIONS` to create clause templates), name, email verification status. Relationships: can create many Clause Templates (one-to-many relationship). The user's role determines whether they can access the clause creation functionality through permission checks using `canManageClauses()` from `src/lib/permissions.ts`.

- **Category (Categoría)**: Represents a predefined category for organizing clause templates. This is not a database entity but a configuration/enum in the application code. Key attributes include: category name (string, from predefined list: "Pago", "Mantenimiento", "Terminación", "Obligaciones del Inquilino", "Obligaciones del Propietario", "General", and potentially others). Relationships: many Clause Templates can belong to one Category. Categories help users organize and find clause templates when creating contracts.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of users with roles included in `CLAUSE_MANAGEMENT_PERMISSIONS` can successfully access `/tablero/contratos/clausulas/nueva` without access denied errors (measured over 30 days of usage)
- **SC-002**: 100% of users with roles not included in `CLAUSE_MANAGEMENT_PERMISSIONS` are denied access to `/tablero/contratos/clausulas/nueva` and redirected or shown an access denied message (zero unauthorized accesses)
- **SC-003**: 95% of clause template creation attempts by authorized users result in successful saves (measured over 30 days, excluding user-cancelled attempts)
- **SC-004**: Users can complete the creation of a clause template (from accessing the form to successful save) in under 2 minutes for 90% of attempts (measured at 90th percentile)
- **SC-005**: Form validation errors are displayed within 500ms of form submission attempt (measured at 95th percentile)
- **SC-006**: Clause templates are persisted to the database with all required fields and correct associations to creator user in 100% of successful creation operations
- **SC-007**: System handles and displays appropriate error messages for network failures, session expiration, or server errors during clause creation in 100% of error cases (zero unhandled exceptions)
- **SC-008**: Permission checks for clause creation are enforced correctly in 100% of access attempts, with authorized users granted access and unauthorized users denied access (measured over 30 days)
