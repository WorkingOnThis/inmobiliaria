# Feature Specification: Creación de Propiedades

**Created**: 2025-12-27

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro de Propiedad con Datos Básicos (Priority: P1)

Como agente inmobiliario, quiero registrar una nueva propiedad en el sistema con su información básica y asociarla a un dueño (cliente) para mantener el inventario actualizado.

**Why this priority**: Es el núcleo de la funcionalidad de gestión de inmuebles. Sin la capacidad de crear propiedades, el sistema no puede cumplir su propósito principal.

**Independent Test**: Se puede probar creando una propiedad desde el formulario y verificando que los datos persistan en la base de datos y se visualicen correctamente en el tablero.

**Acceptance Scenarios**:

1. **Scenario**: Creación exitosa de propiedad básica
   - **Given** el usuario está autenticado con rol de `agent` o `account_admin`
   - **When** completa el formulario con: Título, Dirección, Precio y selecciona un Cliente (Dueño) existente
   - **Then** el sistema guarda la propiedad y redirige al listado con un mensaje de éxito

2. **Scenario**: Validación de campos obligatorios
   - **Given** el formulario de "Nueva Propiedad" está abierto
   - **When** el usuario intenta guardar sin completar el campo "Dirección" o "Precio"
   - **Then** el sistema muestra errores de validación y no permite el envío

---

### User Story 2 - Detalle Extendido de la Propiedad (Priority: P1)

Como agente inmobiliario, quiero especificar detalles técnicos de la propiedad como ambientes, baños y superficie para brindar información precisa a los interesados.

**Why this priority**: Los detalles son críticos para la búsqueda y filtrado de propiedades por parte de potenciales clientes.

**Independent Test**: Se puede probar completando los campos de detalle en el formulario de creación y verificando que se guarden correctamente.

**Acceptance Scenarios**:

1. **Scenario**: Registro de detalles técnicos
   - **Given** el formulario de "Nueva Propiedad" está abierto
   - **When** el usuario ingresa: 3 ambientes, 2 baños y 85m² de superficie
   - **Then** el sistema valida que los valores sean numéricos positivos y los asocia a la propiedad

---

### Edge Cases

- **Cliente inexistente**: ¿Qué ocurre si se intenta asociar un ID de cliente que no existe en la DB? (Debe fallar con error 400).
- **Precio negativo**: ¿Permite el sistema precios de 0 o negativos? (Debe validar que sea > 0).
- **Superficie inconsistente**: ¿Permite superficie cubierta mayor a la total? (Validar coherencia de datos si se separan).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir asociar cada propiedad a un único cliente con el rol de "Dueño" o "Locador".
- **FR-002**: El sistema DEBE validar que el título, dirección y precio sean obligatorios.
- **FR-003**: El sistema DEBE permitir ingresar datos de: ambientes (entero), baños (entero) y superficie (decimal/entero).
- **FR-004**: Solo usuarios con permisos de gestión de propiedades pueden acceder a esta funcionalidad.
- **FR-005**: El sistema DEBE registrar quién creó la propiedad y en qué fecha.

### Key Entities

- **Property**: Representa el inmueble. Atributos: `id`, `title`, `address`, `price`, `type` (casa, depto, etc.), `status` (disponible, alquilado, vendido).
- **PropertyDetails**: Detalles técnicos. Atributos: `rooms`, `bathrooms`, `surface`, `propertyId`. (Puede estar en la misma tabla `property` para simplicidad inicial).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un agente puede registrar una propiedad completa en menos de 1 minuto.
- **SC-002**: El 100% de las propiedades creadas deben tener un dueño asociado válido.
- **SC-003**: Error de validación inmediato si se ingresan tipos de datos incorrectos en campos numéricos.

