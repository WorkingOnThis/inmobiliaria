# Feature Specification: Gestión de Clientes

**Created**: 2025-12-28
**Unified from**: `specs/create-client/` and `specs/list-clients/`

## Permisos y Control de Acceso

**IMPORTANTE**: Los permisos para esta feature están centralizados en `src/lib/permissions.ts`. Los roles autorizados para gestionar clientes se definirán en la constante `CLIENT_MANAGEMENT_PERMISSIONS`.

## User Scenarios & Testing

### User Story 1 - Registro de Nuevo Cliente (Priority: P1)

Como agente inmobiliario, quiero poder registrar un nuevo cliente con sus datos básicos para mantener una base de datos organizada de contactos y sus roles en la inmobiliaria.

**Why this priority**: Es la funcionalidad core para comenzar a gestionar la cartera de clientes. Sin esto, no se puede realizar el seguimiento de interesados, dueños o inquilinos.

**Independent Test**: Puede ser probado navegando a `/clientes/nuevo`, completando el formulario con datos válidos y verificando que el cliente aparezca guardado en la base de datos con todos sus campos correctamente asociados.

**Acceptance Scenarios**:

1. **Scenario**: Acceso al formulario de creación
   - **Given** Un usuario con rol `agent` o `account_admin` está autenticado
   - **When** Navega a `/clientes/nuevo`
   - **Then** El sistema muestra el formulario con los campos: Nombre, Apellido, Tipo (vendedor, comprador, locador, dueño, inquilino, interesado), Teléfono, DNI, Email, Dueño de, Alquila.

2. **Scenario**: Registro exitoso de un cliente
   - **Given** El usuario está en el formulario de "Nuevo Cliente"
   - **When** Completa los campos:
     - Nombre: "Juan"
     - Apellido: "Pérez"
     - Tipo: "inquilino"
     - Teléfono: "1122334455"
     - DNI: "12345678"
     - Email: "juan.perez@example.com"
     - Alquila: "Departamento en Av. Santa Fe 1234"
     - Y hace clic en "Guardar"
   - **Then** El sistema valida los datos, guarda el cliente en la BD, muestra un mensaje de éxito y redirige al listado de clientes o al tablero.

3. **Scenario**: Validación de campos requeridos
   - **Given** El usuario está en el formulario de "Nuevo Cliente"
   - **When** Intenta guardar sin completar Nombre o Apellido
   - **Then** El sistema muestra un error de validación y no permite el guardado.

---

### User Story 2 - Clasificación por Tipo de Cliente (Priority: P1)

Como usuario del sistema, quiero clasificar a cada cliente según su rol (dueño, inquilino, etc.) para poder filtrar y segmentar mi comunicación y acciones comerciales.

**Why this priority**: La clasificación es fundamental en el negocio inmobiliario para distinguir entre quienes ofrecen propiedades y quienes las buscan.

**Independent Test**: Verificar que al seleccionar un tipo del desplegable, este se guarde correctamente en el registro del cliente.

**Acceptance Scenarios**:

1. **Scenario**: Selección de tipo de cliente
   - **Given** El formulario de nuevo cliente está abierto
   - **When** El usuario despliega el campo "Tipo"
   - **Then** Se muestran exactamente las opciones: Vendedor, Comprador, Locador, Dueño, Inquilino, Interesado.

---

### User Story 3 - Visualización de Lista de Clientes Paginada (Priority: P1)

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

- **FR-001**: El sistema DEBE permitir registrar clientes con los campos: nombre, apellido, tipo, telefono, dni, email, dueño_de (opcional), alquila (opcional).
- **FR-002**: El campo `tipo` DEBE ser una selección de: vendedor, comprador, locador, dueño, inquilino, interesado.
- **FR-003**: El sistema DEBE validar que `nombre` y `apellido` no estén vacíos.
- **FR-004**: El sistema DEBE validar el formato del `email` si se proporciona.
- **FR-005**: El sistema DEBE registrar la fecha de creación y la fecha de última edición (`updatedAt`).
- **FR-006**: El sistema DEBE asociar el cliente a la agencia del usuario que lo crea (o al usuario creador).
- **FR-007**: Solo usuarios con permisos (definidos en `CLIENT_MANAGEMENT_PERMISSIONS`) pueden acceder a la creación y visualización.
- **FR-008**: El sistema DEBE proporcionar un endpoint `GET /api/clients` que soporte parámetros de paginación `page` y `pageSize`.
- **FR-009**: La respuesta de la API DEBE incluir la lista de clientes y el conteo total de registros.
- **FR-010**: El frontend DEBE mostrar los clientes en una tabla responsiva utilizando componentes de shadcn/ui.
- **FR-011**: El frontend DEBE implementar controles de paginación (Anterior, Siguiente, Números de página).

### Key Entities

- **Cliente (Client)**: Representa a una persona física o jurídica con la que la inmobiliaria tiene relación.
  - Atributos: `id`, `nombre`, `apellido`, `tipo`, `telefono`, `dni`, `email`, `dueño_de`, `alquila`, `creado_por` (userId), `createdAt`, `updatedAt`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un agente puede registrar un cliente en menos de 45 segundos.
- **SC-002**: El 100% de los registros guardados deben persistir correctamente todos los campos ingresados.
- **SC-003**: El sistema debe impedir el guardado si falta el nombre o el apellido en el 100% de los casos.
- **SC-004**: La lista de clientes carga en menos de 1 segundo para más de 1000 registros totales (gracias a la paginación en el servidor).
- **SC-005**: Los usuarios pueden navegar a cualquier página de resultados con un máximo de 2 clics desde la página actual.
