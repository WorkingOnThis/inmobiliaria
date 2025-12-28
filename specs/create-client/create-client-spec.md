# Feature Specification: Gestión de Clientes (Agregar)

**Created**: 2025-12-27

## Permisos y Control de Acceso

**IMPORTANTE**: Los permisos para esta feature están centralizados en `src/lib/permissions.ts`. Los roles autorizados para gestionar clientes se definirán en la constante `CLIENT_MANAGEMENT_PERMISSIONS`.

## User Scenarios & Testing *(mandatory)*

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

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar clientes con los campos: nombre, apellido, tipo, telefono, dni, email, dueño_de (opcional), alquila (opcional).
- **FR-002**: El campo `tipo` DEBE ser una selección de: vendedor, comprador, locador, dueño, inquilino, interesado.
- **FR-003**: El sistema DEBE validar que `nombre` y `apellido` no estén vacíos.
- **FR-004**: El sistema DEBE validar el formato del `email` si se proporciona.
- **FR-005**: El sistema DEBE registrar la fecha de creación y la fecha de última edición (`ultima_edicion`).
- **FR-006**: El sistema DEBE asociar el cliente a la agencia del usuario que lo crea (o al usuario creador).
- **FR-007**: Solo usuarios con permisos (definidos en `CLIENT_MANAGEMENT_PERMISSIONS`) pueden acceder a la creación.

### Key Entities

- **Cliente (Client)**: Representa a una persona física o jurídica con la que la inmobiliaria tiene relación.
  - Atributos: `id`, `nombre`, `apellido`, `tipo`, `telefono`, `dni`, `email`, `dueño_de` (texto descriptivo por ahora), `alquila` (texto descriptivo por ahora), `creado_por` (userId), `createdAt`, `updatedAt` (ultima_edicion).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un agente puede registrar un cliente en menos de 45 segundos.
- **SC-002**: El 100% de los registros guardados deben persistir correctamente todos los campos ingresados.
- **SC-003**: El sistema debe impedir el guardado si falta el nombre o el apellido en el 100% de los casos.

