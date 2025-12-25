# Feature Specification: Registro

**Created**: 2025-12-21

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

### User Story 1 - Registro con Email y Contraseña (Priority: P1)

Un usuario puede registrarse en el sistema proporcionando sus datos personales (nombre, apellido, email, contraseña). El sistema crea la cuenta de usuario en Better Auth con el rol `visitor` y envía un email de verificación. El usuario debe verificar su email antes de poder iniciar sesión. El usuario puede crear o unirse a una inmobiliaria después del registro.

**Why this priority**: Este es el método de registro más fundamental y universal. Sin esta funcionalidad, los nuevos usuarios no pueden crear sus cuentas y comenzar a usar el sistema. Es el requisito mínimo para que la aplicación sea funcional y debe estar disponible antes que cualquier otro método de registro. Permite que el sistema tenga usuarios desde el primer día.

**Independent Test**: Puede ser probado completamente accediendo a la página de registro, completando el formulario con datos válidos (nombre del usuario, apellido del usuario, email único, contraseña válida), enviando el formulario, y verificando que se crea la cuenta de usuario en Better Auth con el rol `visitor` asignado, se envía el email de verificación, y el usuario es redirigido a la página de verificación de email. El test verifica que todo el flujo de registro funciona correctamente de extremo a extremo.

**Acceptance Scenarios**:

1. **Scenario**: Registro exitoso con datos válidos

   - **Given** No existe un usuario con email "usuario@ejemplo.com" en el sistema
   - **When** El usuario completa el formulario con nombre "Juan", apellido "Pérez", email "usuario@ejemplo.com", contraseña "password123" (que cumple los requisitos mínimos), y envía el formulario
   - **Then** El sistema crea la cuenta de usuario en Better Auth con email "usuario@ejemplo.com", nombre "Juan", apellido "Pérez", y rol `visitor`, envía un email de verificación, y redirige al usuario a la página de verificación de email

2. **Scenario**: Registro fallido por email duplicado

   - **Given** Ya existe un usuario con email "existente@ejemplo.com" en el sistema
   - **When** El usuario intenta registrarse con email "existente@ejemplo.com" y cualquier otra información válida
   - **Then** El sistema detecta el email duplicado, muestra un mensaje de error indicando que el email ya está registrado, no crea ninguna entidad (cuenta de usuario), y mantiene al usuario en la página de registro con los datos ingresados (excepto la contraseña)

3. **Scenario**: Registro fallido por datos inválidos

   - **Given** El usuario intenta registrarse con datos incompletos o inválidos
   - **When** El usuario envía el formulario con nombre vacío, o apellido vacío, o email en formato inválido, o contraseña que no cumple los requisitos mínimos
   - **Then** El sistema valida los campos, muestra mensajes de error específicos para cada campo inválido, no crea ninguna entidad, y mantiene al usuario en la página de registro con los datos válidos ingresados

4. **Scenario**: Registro bloqueado por rate limiting

   - **Given** Se han realizado 5 intentos de registro desde la misma IP en los últimos 15 minutos
   - **When** El usuario intenta registrarse nuevamente desde esa IP (incluso con datos válidos)
   - **Then** El sistema bloquea el intento, muestra un mensaje indicando que debe esperar antes de intentar nuevamente, no crea ninguna entidad, y registra el evento de seguridad

5. **Scenario**: Fallo transaccional durante el registro

   - **Given** El usuario envía datos válidos pero ocurre un error durante la creación (por ejemplo, fallo de conexión a la base de datos)
   - **When** Ocurre un error durante el proceso de registro
   - **Then** El sistema revierte toda la transacción (no se crea ninguna entidad parcial), muestra un mensaje de error genérico al usuario, registra el error para diagnóstico, y mantiene al usuario en la página de registro

6. **Scenario**: Registro fallido por fallo en envío de email de verificación

   - **Given** El usuario envía datos válidos y el sistema intenta crear la cuenta de usuario y enviar el email de verificación
   - **When** El envío del email de verificación falla (servicio de email caído, email inválido, error de red, etc.)
   - **Then** El sistema revierte toda la transacción (no se crea ninguna entidad: cuenta de usuario), muestra un mensaje apropiado al usuario indicando que hubo un problema al enviar el email y que debe intentar nuevamente, registra el error para diagnóstico, y mantiene al usuario en la página de registro

---

### User Story 2 - Registro con OAuth (Priority: P2)

Un usuario puede registrarse en el sistema usando su cuenta de un proveedor OAuth externo (como Google). El sistema autentica al usuario a través del proveedor OAuth, crea o actualiza su cuenta en Better Auth con el rol `visitor` usando los datos del proveedor (nombre y apellido cuando están disponibles), y marca el email como verificado automáticamente (ya que OAuth proporciona verificación implícita). El usuario puede crear o unirse a una inmobiliaria después del registro.

**Why this priority**: OAuth proporciona una experiencia de usuario mejorada al eliminar la necesidad de recordar otra contraseña y simplificar el proceso de registro. Sin embargo, es secundario al registro tradicional ya que no todos los usuarios pueden o quieren usar OAuth, y requiere configuración adicional de proveedores externos. Además, algunos usuarios pueden preferir mantener sus cuentas separadas.

**Independent Test**: Puede ser probado completamente configurando un proveedor OAuth de prueba (como Google OAuth en modo desarrollo), accediendo a la página de registro, haciendo clic en "Registrarse con Google", completando la autenticación con el proveedor, y verificando que se crea la cuenta de usuario en Better Auth con nombre y apellido (cuando están disponibles en los datos de OAuth), con el rol `visitor` asignado, se marca el email como verificado, y el usuario es redirigido al dashboard.

**Acceptance Scenarios**:

1. **Scenario**: Registro OAuth exitoso para usuario nuevo

   - **Given** El usuario no tiene cuenta en el sistema y hace clic en "Registrarse con Google" en la página de registro
   - **When** El usuario completa exitosamente la autenticación con Google y autoriza el acceso
   - **Then** El sistema crea la cuenta de usuario en Better Auth asociada al email de Google con los datos de Google (nombre y apellido cuando están disponibles), con el rol `visitor`, marca el email como verificado (ya que OAuth proporciona verificación implícita), y redirige al usuario al dashboard

2. **Scenario**: Registro OAuth fallido por email duplicado

   - **Given** Ya existe un usuario con email "existente@ejemplo.com" en el sistema (creado con email/contraseña)
   - **When** El usuario intenta registrarse con Google usando el mismo email "existente@ejemplo.com"
   - **Then** El sistema detecta el email duplicado, asocia la cuenta OAuth a la cuenta existente, muestra un mensaje indicando que el email ya está registrado y que debe iniciar sesión en su lugar, y redirige al usuario a la página de login

3. **Scenario**: Usuario cancela el flujo OAuth durante registro

   - **Given** El usuario hace clic en "Registrarse con Google" y es redirigido al proveedor OAuth
   - **When** El usuario cancela o rechaza la autorización en el proveedor OAuth
   - **Then** El sistema redirige al usuario de vuelta a la página de registro sin crear ninguna entidad y sin mostrar un error (comportamiento esperado)

4. **Scenario**: Error en el flujo OAuth durante registro

   - **Given** El usuario inicia el flujo OAuth pero ocurre un error en el proveedor (servicio caído, configuración incorrecta, etc.)
   - **When** El proveedor OAuth retorna un error
   - **Then** El sistema captura el error, muestra un mensaje apropiado al usuario, y lo redirige a la página de registro sin crear ninguna entidad

5. **Scenario**: OAuth retorna información incompleta

   - **Given** El usuario completa la autenticación OAuth pero el proveedor no retorna email o nombre
   - **When** El sistema intenta procesar la respuesta OAuth
   - **Then** El sistema rechaza el registro, muestra un mensaje indicando que no se pudo obtener la información necesaria, y redirige al usuario a la página de registro

---

### Edge Cases

- ¿Qué sucede cuando un usuario intenta registrarse mientras ya tiene una sesión activa?

  - El sistema debe detectar la sesión existente y redirigir al usuario a su dashboard sin permitir el registro. Si el usuario desea crear otra cuenta, debe cerrar sesión primero.

- ¿Cómo maneja el sistema un intento de registro con un email que está en proceso de verificación pero aún no verificado?

  - El sistema debe tratar el email como duplicado y no permitir el registro. El usuario debe verificar su email existente o usar un email diferente.

- ¿Qué sucede cuando el email de verificación no puede ser enviado (servicio de email caído, email inválido, etc.)?

  - El sistema debe revertir toda la transacción (no se crea ninguna entidad), mostrar un mensaje apropiado al usuario indicando que hubo un problema al enviar el email y que debe intentar nuevamente, registrar el error para diagnóstico, y requerir que el usuario intente el registro nuevamente.

- ¿Cómo maneja el sistema un registro que falla parcialmente?

  - El sistema debe usar transacciones de base de datos para garantizar atomicidad. Si cualquier parte del registro falla, toda la operación debe revertirse. No debe quedar ninguna entidad parcial creada.

- ¿Cómo maneja el sistema intentos de registro desde múltiples ubicaciones geográficas simultáneamente con el mismo email?

  - El sistema debe permitir solo un registro por email. Si se intenta registrar el mismo email desde múltiples ubicaciones simultáneamente, solo el primer intento exitoso debe completarse. Los demás deben fallar con un mensaje de email duplicado.

- ¿Qué sucede cuando un usuario intenta registrarse con OAuth pero el proveedor retorna información incompleta o inválida?

  - El sistema debe validar que el proveedor OAuth retorna al menos un email válido y un nombre. Si falta información crítica, debe rechazar el registro y mostrar un error apropiado, sugiriendo usar el método de registro con email/contraseña.

- ¿Cómo maneja el sistema rate limiting cuando múltiples usuarios intentan registrarse desde la misma IP (por ejemplo, en una oficina compartida)?

  - El rate limiting debe aplicarse por IP para prevenir ataques distribuidos, pero también debe considerar que múltiples usuarios legítimos pueden compartir una IP. El sistema debe balancear seguridad y usabilidad, posiblemente usando un límite más alto para registros que para login, o permitiendo excepciones para IPs conocidas.

- ¿Qué sucede cuando un usuario completa el registro pero nunca verifica su email?

  - El sistema debe mantener la cuenta de usuario creada pero el usuario no podrá iniciar sesión hasta verificar su email. El sistema debe permitir reenviar el email de verificación y puede implementar políticas de limpieza para cuentas no verificadas después de un período determinado (por ejemplo, 30 días).

- ¿Cómo maneja el sistema un registro OAuth cuando el email de OAuth ya está asociado a una cuenta?

  - El sistema debe detectar el email duplicado, asociar la cuenta OAuth a la cuenta existente, y redirigir al usuario a la página de login. Los usuarios pueden existir sin inmobiliaria asociada inicialmente.

- ¿Qué sucede cuando un proveedor OAuth retorna un nombre completo pero no proporciona nombre y apellido por separado?

  - El sistema debe intentar separar el nombre completo en nombre y apellido usando heurísticas apropiadas (por ejemplo, tomar la primera palabra como nombre y el resto como apellido, o usar el último espacio como separador). Si no es posible determinar una separación clara, el sistema debe almacenar el nombre completo en el campo de nombre y dejar el apellido como una cadena vacía o usar el nombre completo también para el apellido, dependiendo de los requisitos del negocio. El sistema debe documentar este comportamiento y considerar solicitar al usuario que confirme o corrija la separación si es necesario.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to register by providing user first name, user last name, email, and password
- **FR-002**: System MUST validate that email addresses are in correct format before processing registration
- **FR-003**: System MUST validate that email addresses are unique in the system before creating accounts
- **FR-005**: System MUST validate that user first name and last name are provided and not empty
- **FR-006**: System MUST validate that passwords meet minimum security requirements (minimum length, complexity) before accepting them during registration
- **FR-007**: System MUST hash and securely store passwords using industry-standard hashing algorithms (e.g., bcrypt, scrypt, argon2) - passwords MUST NEVER be stored in plain text
- **FR-008**: System MUST create Better Auth user account and send verification email in a single atomic transaction - if any part fails (including email sending), the entire operation MUST be rolled back
- **FR-011**: System MUST create user account in Better Auth system with the provided email and hashed password
- **FR-012**: System MUST require email verification before allowing users to complete registration and access protected routes
- **FR-013**: System MUST generate unique, time-limited verification tokens for email verification (tokens MUST expire after 24 hours)
- **FR-014**: System MUST send verification emails containing secure verification links when users register - if email sending fails, the entire registration transaction MUST be rolled back and no entities MUST be persisted
- **FR-015**: System MUST allow users to request resending of verification emails if the original email was not received or expired
- **FR-016**: System MUST support OAuth registration through at least one provider (Google) with extensible architecture for additional providers
- **FR-017**: System MUST create or update user accounts when OAuth registration succeeds, associating the OAuth provider account with the user record
- **FR-018**: System MUST automatically mark email as verified when registration is completed via OAuth (OAuth providers provide implicit email verification)
- **FR-020**: System MUST handle cases where OAuth registration is attempted with an email that already exists in the system by associating the OAuth account with the existing user account and redirecting to login
- **FR-021**: System MUST implement rate limiting on registration endpoints to prevent abuse and spam registrations (suggested: maximum 5 registration attempts per 15 minutes per IP)
- **FR-022**: System MUST temporarily block registration attempts after exceeding rate limit threshold and require waiting period before allowing new attempts
- **FR-023**: System MUST return appropriate error messages for failed registration attempts (email already exists, invalid data, etc.) without exposing sensitive system information
- **FR-024**: System MUST log all registration events (successful registrations, failed attempts, rate limit blocks) for security auditing
- **FR-025**: System MUST validate and sanitize all user inputs (user name, email, password, OAuth callbacks) to prevent injection attacks
- **FR-026**: System MUST implement CSRF protection for registration forms and OAuth flows
- **FR-027**: System MUST handle OAuth callback errors gracefully (user cancellation, provider errors, network failures) without exposing sensitive system information
- **FR-028**: System MUST verify OAuth provider responses and validate tokens before creating or updating user accounts
- **FR-029**: System MUST handle cases where OAuth provider returns incomplete user information (e.g., missing email or name) with appropriate error handling and user messaging
- **FR-030**: System MUST prevent users from accessing protected routes until their email is verified (applies to both email/password and OAuth registrations where email verification is required)
- **FR-031**: System MUST allow users to exist without an associated real estate agency (the relationship is optional)
- **FR-032**: System MUST handle registration failures gracefully, providing clear feedback to users and maintaining system stability
- **FR-033**: System MUST automatically assign the role `visitor` to all users during registration (both email/password and OAuth flows)
- **FR-034**: System MUST store the role `visitor` in the user record (as a field in the Better Auth user table)
- **FR-035**: System MUST validate that user last name is provided and not empty during registration
- **FR-036**: System MUST allow users to create or join a real estate agency after registration (this functionality is outside the scope of the registration feature)
- **FR-037**: System MUST allow updating the user role from `visitor` to `account_admin` at a later time (this functionality is outside the scope of the registration feature)

### Key Entities _(include if feature involves data)_

- **Inmobiliaria (Real Estate Agency)**: Represents a real estate agency in the system. Key attributes include: unique identifier (ID), name (required, [NEEDS CLARIFICATION: should name be unique?]), creation timestamp, update timestamp. Relationships: has exactly one Owner (one-to-one relationship). The inmobiliaria is NOT created during registration. Users can create or join an inmobiliaria after registration. This entity is the primary organizational unit for property management.

- **Usuario/Administrador**: Represents a user/administrator in the system. Key attributes include: unique identifier (ID), firstName (nombre, required), lastName (apellido, required), email address (unique, required), real estate agency reference (foreign key to Inmobiliaria, optional/nullable), creation timestamp, update timestamp. Relationships: can belong to zero or one Inmobiliaria (optional relationship), has one User account in Better Auth (linked via email). The user/administrator is created during registration but is NOT automatically associated with an inmobiliaria. Users can create or join an inmobiliaria after registration.

- **User (Better Auth)**: Represents a user account in the Better Auth system. Key attributes include: unique identifier (ID), name (required, may contain full name or be constructed from firstName and lastName), email address (unique, required), role (required, default: `visitor`), hashed password (nullable for OAuth-only users), email verification status (boolean), account creation timestamp, last login timestamp, account status (active, suspended, disabled). Relationships: has many Sessions, has many VerificationTokens, can have multiple OAuth accounts associated. The User account is created during registration with the role `visitor` automatically assigned. When Better Auth stores a full name in the `name` field, the system must extract or separate firstName and lastName for storage in the Usuario/Administrador table if that entity exists. The role can be updated from `visitor` to `account_admin` at a later time. This entity is managed by Better Auth and follows Better Auth's schema and conventions.

- **VerificationToken**: Represents a token used for email verification. Key attributes include: unique token string, identifier (email), expiration timestamp (24 hours from creation), creation timestamp. Relationships: associated with User via email identifier. Tokens are single-use and time-limited to ensure security. This entity is managed by Better Auth.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete registration with email/password in under 5 seconds from form submission to successful registration confirmation and email verification page redirect (measured at 95th percentile)
- **SC-002**: OAuth registration flow completes in under 8 seconds from clicking OAuth button to successful registration and dashboard redirect (measured at 95th percentile, excluding time spent on external provider)
- **SC-003**: 95% of registration attempts with valid data result in successful registration on the first attempt
- **SC-004**: System successfully blocks 100% of registration attempts exceeding rate limit threshold (5 attempts in 15 minutes per IP)
- **SC-005**: Email verification emails are delivered within 30 seconds of user registration in 99% of cases
- **SC-006**: 90% of users who receive verification emails successfully verify their accounts within 24 hours
- **SC-007**: Zero registration attempts result in partial data creation (100% transaction atomicity - all entities created or none)
- **SC-008**: System handles 500 concurrent registration attempts without performance degradation (response time remains under 5 seconds for email/password, under 8 seconds for OAuth)
- **SC-009**: Failed registration attempts are logged and available for security audit within 1 second of the attempt
- **SC-010**: System correctly identifies and rejects 100% of duplicate email registration attempts
- **SC-011**: System maintains data integrity with 100% accuracy - users can exist without an inmobiliaria, and when an inmobiliaria exists, it has exactly one administrator
- **SC-012**: 99% of OAuth registrations successfully complete when OAuth provider returns valid data
- **SC-013**: Registration form validation errors are displayed to users within 500ms of form submission (client-side validation) or 1 second (server-side validation)
- **SC-014**: 100% of successfully registered users have the role `visitor` assigned to their user account
