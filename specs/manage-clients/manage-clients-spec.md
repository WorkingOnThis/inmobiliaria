# Feature Specification: Gestión de Clientes

**Created**: 2025-12-28
**Unified from**: `specs/create-client/` and `specs/list-clients/`

## Permisos y Control de Acceso

**IMPORTANTE**: Los permisos para esta feature están centralizados en `src/lib/permissions.ts`. Los roles autorizados para gestionar clientes se definirán en la constante `CLIENT_MANAGEMENT_PERMISSIONS`.

## User Scenarios & Testing

### User Story 1 - Registro de Nuevo Cliente (Priority: P1)

Como agente inmobiliario, quiero poder registrar un nuevo cliente, creándole automáticamente una cuenta de usuario, para mantener una base de datos organizada de contactos y permitirles eventualmente acceder al sistema.

**Why this priority**: Es la funcionalidad core para comenzar a gestionar la cartera de clientes. Sin esto, no se puede realizar el seguimiento de interesados, dueños o inquilinos.

**Independent Test**: Puede ser probado navegando a `/clientes/nuevo`, completando el formulario con datos válidos y verificando que se cree tanto el usuario como el detalle del cliente en la base de datos.

**Acceptance Scenarios**:

1. **Scenario**: Acceso al formulario de creación
   - **Given** Un usuario con rol `agent` o `account_admin` está autenticado
   - **When** Navega a `/clientes/nuevo`
   - **Then** El sistema muestra el formulario con los campos: Nombre, Apellido, Email (obligatorio para el usuario), Teléfono, DNI.

2. **Scenario**: Registro exitoso de un cliente
   - **Given** El usuario está en el formulario de "Nuevo Cliente"
   - **When** Completa los campos:
     - Nombre: "Juan"
     - Apellido: "Pérez"
     - Email: "juan.perez@example.com"
     - Teléfono: "1122334455"
     - DNI: "12345678"
     - Y hace clic en "Guardar"
   - **Then** El sistema crea un usuario con rol base y un registro de cliente asociado 1:1.
   - **And** Muestra un mensaje de éxito y redirige al listado de clientes.

3. **Scenario**: Validación de campos requeridos
   - **Given** El usuario está en el formulario de "Nuevo Cliente"
   - **When** Intenta guardar sin completar Email, Nombre o Apellido
   - **Then** El sistema muestra un error de validación y no permite el guardado.

---

### User Story 2 - Visualización de Lista de Clientes Paginada (Priority: P1)

Como administrador o agente, quiero ver una lista de todos los clientes en una tabla para poder navegar entre ellos fácilmente. Quiero ver solo un número determinado de clientes por página para evitar tiempos de carga prolongados.

**Why this priority**: Esencial para gestionar clientes una vez que su número crece. Es la forma principal de acceder a la información de los clientes.

**Independent Test**: Navegar a `/clientes`, verificar que aparezca una tabla con clientes y que los controles de paginación permitan cambiar de página.

**Acceptance Scenarios**:

1. **Scenario**: Carga inicial de clientes
   - **Given** Hay 25 clientes en la base de datos
   - **When** Navego a `/clientes`
   - **Then** Veo los primeros 10 clientes en una tabla
   - **And** Veo controles de paginación indicando 3 páginas

2. **Scenario**: Navegación entre páginas
   - **Given** Estoy en la primera página de la lista de clientes
   - **When** Hago clic en "Siguiente"
   - **Then** Veo los siguientes 10 clientes
   - **And** El indicador de página actual muestra "2"

3. **Scenario**: Estado vacío
   - **Given** No hay clientes en la base de datos
   - **When** Navego a `/clientes`
   - **Then** Veo una tabla vacía con el mensaje "No se encontraron clientes"

---

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar clientes con los campos: firstName, lastName, email, phone, dni.
- **FR-002**: El sistema DEBE crear automáticamente una entidad `User` (Better Auth) al registrar un cliente.
- **FR-003**: El sistema DEBE crear una entidad `Client` vinculada 1:1 al `User` creado mediante `userId`.
- **FR-004**: El sistema DEBE validar que `firstName`, `lastName` y `email` no estén vacíos.
- **FR-005**: El sistema DEBE validar el formato del `email` y asegurar que sea único en la tabla `User`.
- **FR-006**: El sistema DEBE registrar la fecha de creación y actualización tanto en `User` como en `Client`.
- **FR-007**: El campo `tipo` de cliente se gestionará a través del `role` del usuario, eliminándose de la tabla `Client`.
- **FR-008**: Los campos `dueño_de`, `alquila` y `creado_por` se eliminan del modelo de datos del cliente (la relación es directa con User).
- **FR-009**: Solo usuarios con permisos (definidos en `CLIENT_MANAGEMENT_PERMISSIONS`) pueden acceder a la creación y visualización.
- **FR-010**: El sistema DEBE proporcionar un endpoint `GET /api/clients` que soporte parámetros de paginación `page` y `pageSize`.
- **FR-011**: La respuesta de la API DEBE incluir la lista de clientes (con datos combinados de User y Client) y el conteo total.
- **FR-012**: El frontend DEBE mostrar los clientes en una tabla responsiva utilizando componentes de shadcn/ui.
- **FR-013**: El frontend DEBE implementar controles de paginación (Anterior, Siguiente, Números de página).

### Key Entities

- **Cliente (Client)**: Detalle del perfil de usuario para el dominio inmobiliario.
  - Relación: 1:1 con `User` (Detail).
  - Atributos: `id`, `userId` (FK, unique, not null), `firstName`, `lastName`, `phone`, `dni`, `createdAt`, `updatedAt`.
  
- **Usuario (User)**: Entidad base de autenticación y acceso.
  - Atributos relevantes: `id`, `email`, `role`, `createdAt`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un agente puede registrar un cliente (y su usuario asociado) en menos de 45 segundos.
- **SC-002**: El 100% de los registros de clientes tienen un usuario correspondiente.
- **SC-003**: El sistema debe impedir el guardado si falta el email, nombre o apellido.
- **SC-004**: La lista de clientes carga en menos de 1 segundo para más de 1000 registros totales.
- **SC-005**: Los usuarios pueden navegar a cualquier página de resultados con un máximo de 2 clics desde la página actual.
