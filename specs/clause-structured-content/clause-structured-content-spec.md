# Feature Specification: Editor Visual para Contenido Estructurado de Cláusulas

**Created**: 2025-01-21

## Relación con Features Existentes

Esta feature extiende la funcionalidad de creación de cláusulas definida en [create-contract-clause](create-contract-clause/), proporcionando una interfaz visual para usuarios no técnicos que elimina la necesidad de escribir sintaxis manual. Las cláusulas creadas con este editor son compatibles con el sistema existente y se almacenan usando el mismo schema de base de datos (campo `content` como TEXT con JSON stringificado). Las cláusulas existentes en formato texto plano seguirán funcionando sin cambios.

## User Scenarios & Testing

### User Story 1 - Insertar Variables Simples mediante UI (Priority: P1)

Los usuarios pueden insertar variables simples en el contenido de la cláusula utilizando un botón "Agregar Variable" que abre un selector con las propiedades disponibles, sin necesidad de escribir manualmente la sintaxis `{{variable}}`.

**Why this priority**: Esta es la funcionalidad más básica y esencial que diferencia este editor del editor de texto plano. Sin la capacidad de insertar variables visualmente, los usuarios no técnicos seguirían necesitando conocer la sintaxis manual, que es exactamente lo que esta feature pretende eliminar.

**Independent Test**: Puede ser probado completamente navegando a la página de creación de cláusulas, haciendo click en "Agregar Variable", seleccionando una propiedad disponible (ej: `propiedad.direccion`), y verificando que se inserta `{{propiedad.direccion}}` en la posición del cursor en el editor.

**Acceptance Scenarios**:

1. **Scenario**: Usuario inserta una variable simple de propiedad
   - **Given** Un usuario autorizado está en el formulario de creación de cláusulas y ha escrito "La propiedad está ubicada en "
   - **When** El usuario hace click en el botón "Agregar Variable", selecciona "Dirección" del grupo "Propiedad" en el selector
   - **Then** El sistema inserta `{{propiedad.direccion}}` en la posición del cursor y el selector se cierra

2. **Scenario**: Usuario inserta una variable simple de propietario/inquilino
   - **Given** Un usuario autorizado está en el formulario de creación de cláusulas
   - **When** El usuario hace click en "Agregar Variable", selecciona "Nombre" del grupo "Propietario"
   - **Then** El sistema inserta `{{propietario.nombre}}` en la posición del cursor

3. **Scenario**: Usuario cancela la inserción de variable
   - **Given** Un usuario autorizado está en el formulario y hace click en "Agregar Variable"
   - **When** El usuario hace click fuera del selector o presiona Escape
   - **Then** El selector se cierra sin insertar ninguna variable

---

### User Story 2 - Crear Bloque de Iteración mediante UI (Priority: P1)

Los usuarios pueden crear bloques de iteración sobre entidades (propietarios, inquilinos) utilizando un modal intuitivo que les permite seleccionar la entidad, escribir el template para cada item, y configurar opciones de formato (separadores, punto final).

**Why this priority**: Esta es la funcionalidad diferenciadora principal. Sin iteraciones visuales, los usuarios no técnicos no podrían crear cláusulas que manejen múltiples propietarios o inquilinos, que es un caso de uso muy común en contratos inmobiliarios.

**Independent Test**: Puede ser probado navegando a la página de creación de cláusulas, haciendo click en "Agregar Lista", seleccionando "Propietarios" como entidad, escribiendo un template como "{{nombre}} (DNI: {{dni}})", configurando separadores, y verificando que se crea un bloque visual en el editor que representa esta iteración.

**Acceptance Scenarios**:

1. **Scenario**: Usuario crea un bloque de iteración para propietarios
   - **Given** Un usuario autorizado está en el formulario de creación de cláusulas y ha escrito "Los propietarios son: "
   - **When** El usuario hace click en "Agregar Lista", selecciona "Propietarios" como entidad, escribe el template "{{nombre}} (DNI: {{dni}}), domiciliado en {{domicilio}}", configura separador ", " y separador final " y ", y hace click en "Aplicar"
   - **Then** El sistema muestra un bloque visual en el editor que representa esta iteración, con botones para editar y eliminar

2. **Scenario**: Usuario crea un bloque de iteración para inquilinos
   - **Given** Un usuario autorizado está en el formulario de creación de cláusulas
   - **When** El usuario hace click en "Agregar Lista", selecciona "Inquilinos" como entidad, escribe el template "{{nombre}} (DNI: {{dni}})", y aplica
   - **Then** El sistema crea un bloque visual que representa la iteración sobre inquilinos

3. **Scenario**: Usuario edita un bloque de iteración existente
   - **Given** Un usuario autorizado tiene un bloque de iteración en el editor
   - **When** El usuario hace click en el botón de editar del bloque
   - **Then** El sistema abre el mismo modal prellenado con la configuración actual, permitiendo modificar el template y las opciones

4. **Scenario**: Usuario elimina un bloque de iteración
   - **Given** Un usuario autorizado tiene un bloque de iteración en el editor
   - **When** El usuario hace click en el botón de eliminar del bloque
   - **Then** El sistema elimina el bloque visual del editor

5. **Scenario**: Usuario usa autocomplete dentro del template de iteración
   - **Given** Un usuario autorizado está en el modal de crear iteración escribiendo el template
   - **When** El usuario escribe `{{` dentro del campo template
   - **Then** El sistema muestra un dropdown con las propiedades disponibles para la entidad seleccionada (ej: si seleccionó "Propietarios", muestra: nombre, dni, domicilio)

---

### User Story 3 - Visualización y Edición de Contenido Estructurado (Priority: P2)

El editor muestra visualmente los bloques de iteración y variables insertadas, permitiendo diferenciar claramente entre texto normal, variables simples, y bloques de iteración. Los usuarios pueden editar texto normal directamente y hacer click en bloques para editarlos o eliminarlos.

**Why this priority**: La visualización clara es esencial para que los usuarios no técnicos entiendan qué representa cada parte del contenido. Sin una representación visual adecuada, los usuarios podrían confundirse sobre cómo se verá el resultado final. Sin embargo, esta funcionalidad es menos crítica que las dos anteriores porque las funciones básicas de inserción pueden funcionar con una visualización más simple.

**Independent Test**: Puede ser probado creando una cláusula con texto normal, variables simples, y bloques de iteración, y verificando que cada tipo de elemento se muestra de forma distintiva en el editor.

**Acceptance Scenarios**:

1. **Scenario**: Editor muestra diferentes tipos de contenido visualmente
   - **Given** Un usuario autorizado tiene contenido con texto normal, variables simples, y bloques de iteración
   - **When** El usuario visualiza el editor
   - **Then** El sistema muestra: texto normal como texto editable, variables como chips/badges con fondo diferenciado, y bloques de iteración como cards/boxes con borde y botones de acción

2. **Scenario**: Usuario edita texto normal directamente
   - **Given** Un usuario autorizado está en el editor con contenido que incluye texto normal
   - **When** El usuario hace click en una sección de texto normal y escribe
   - **Then** El sistema permite editar el texto directamente como en un editor de texto normal

3. **Scenario**: Usuario ve preview del resultado final
   - **Given** Un usuario autorizado está en el editor con contenido estructurado
   - **When** El usuario hace click en un botón "Preview" (opcional)
   - **Then** El sistema muestra cómo se vería el contenido renderizado con datos de ejemplo

---

### User Story 4 - Guardado y Persistencia de Contenido Estructurado (Priority: P1)

El sistema guarda el contenido estructurado como JSON stringificado en el campo `content` de la base de datos, manteniendo compatibilidad con el formato texto plano existente. El sistema debe poder distinguir entre contenido estructurado y texto plano al cargar cláusulas.

**Why this priority**: Sin la capacidad de guardar y cargar correctamente el formato estructurado, ninguna de las funcionalidades anteriores sería útil. Esta es una funcionalidad crítica que bloquea todo lo demás.

**Independent Test**: Puede ser probado creando una cláusula con contenido estructurado, guardándola, recargando la página de edición, y verificando que todos los bloques y variables se cargan correctamente en el editor.

**Acceptance Scenarios**:

1. **Scenario**: Sistema guarda contenido estructurado correctamente
   - **Given** Un usuario autorizado ha creado una cláusula con texto normal, variables simples, y bloques de iteración
   - **When** El usuario hace click en "Crear Cláusula"
   - **Then** El sistema guarda el contenido como JSON stringificado en el campo `content`, con una estructura que incluye el tipo de cada parte (text, variable, iteration)

2. **Scenario**: Sistema carga contenido estructurado correctamente
   - **Given** Existe una cláusula guardada con contenido estructurado en formato JSON
   - **When** Un usuario autorizado navega a la página de edición de esa cláusula (si existe en el futuro) o el sistema carga la cláusula para renderizar
   - **Then** El sistema parsea el JSON y reconstruye correctamente todos los bloques y variables en el editor

3. **Scenario**: Sistema detecta y mantiene compatibilidad con texto plano
   - **Given** Existe una cláusula guardada con contenido en formato texto plano (solo texto con `{{variables}}`)
   - **When** El sistema intenta cargar esta cláusula
   - **Then** El sistema detecta que es texto plano (no JSON válido o no tiene estructura esperada) y la trata como contenido legacy, permitiendo que se renderice normalmente

---

### Edge Cases

- ¿Qué sucede si el usuario crea un bloque de iteración pero no especifica un template válido?
  - El sistema debe validar que el template no esté vacío antes de permitir crear el bloque. Debe mostrar un mensaje de error claro indicando que el template es requerido.

- ¿Cómo maneja el sistema si el usuario inserta variables que no existen en las propiedades definidas?
  - El sistema solo permite seleccionar variables de la lista predefinida mediante el selector/modal. No se permite escribir variables manualmente en el editor estructurado para evitar errores.

- ¿Qué pasa si el usuario tiene contenido estructurado pero intenta editarlo como texto plano?
  - El sistema debe detectar el formato al cargar. Si es JSON estructurado, debe usar el editor visual. Si es texto plano, puede usar el editor de texto simple. No se debe permitir mezclar ambos formatos en la misma cláusula.

- ¿Cómo se maneja el renderizado de cláusulas estructuradas cuando se generan contratos?
  - El sistema debe tener un renderer que convierta el JSON estructurado en texto final, reemplazando variables con valores reales e iterando sobre las entidades según la configuración. Esto se implementará en una feature futura de generación de contratos.

- ¿Qué sucede si hay un error al parsear el JSON al cargar una cláusula?
  - El sistema debe detectar el error, tratar el contenido como texto plano legacy, y permitir que se renderice como tal. Debe loguear el error para debugging pero no debe romper la aplicación.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a visual editor component for creating clause content that replaces or extends the current textarea
- **FR-002**: System MUST provide a button or control labeled "Agregar Variable" that opens a selector/dropdown for inserting simple variables
- **FR-003**: System MUST display available properties grouped by entity (Propietario, Inquilino, Propiedad) in the variable selector
- **FR-004**: System MUST insert variables in the format `{{entity.property}}` when selected from the variable selector
- **FR-005**: System MUST provide a button or control labeled "Agregar Lista" or "Agregar Iteración" that opens a modal for creating iteration blocks
- **FR-006**: System MUST allow users to select an entity (Propietarios, Inquilinos) for iteration from a dropdown in the iteration modal
- **FR-007**: System MUST provide a text field in the iteration modal for users to write the template that will be used for each item in the iteration
- **FR-008**: System MUST provide autocomplete/suggestions for properties when the user types `{{` within the iteration template field
- **FR-009**: System MUST allow users to configure separator between items (default: ", ")
- **FR-010**: System MUST allow users to configure separator before the last item (default: " y ")
- **FR-011**: System MUST allow users to configure whether to add a period at the end of the iteration (default: true)
- **FR-012**: System MUST display iteration blocks visually as distinct UI elements (cards/boxes) in the editor
- **FR-013**: System MUST provide edit and delete buttons for each iteration block
- **FR-014**: System MUST store structured content as JSON stringified in the `content` field (maintaining TEXT type in database)
- **FR-015**: System MUST use a JSON structure that includes an array of parts, where each part can be: text, variable, or iteration
- **FR-016**: System MUST detect content format (structured JSON vs plain text) when loading clauses
- **FR-017**: System MUST maintain backward compatibility with existing plain text clauses (those with simple `{{variable}}` syntax)
- **FR-018**: System MUST validate that iteration templates are not empty before creating an iteration block
- **FR-019**: System MUST validate that selected entities and properties exist in the predefined lists
- **FR-020**: System MUST prevent users from manually typing variable syntax in structured mode (variables must be inserted via UI)
- **FR-021**: System MUST allow users to edit normal text directly in the editor
- **FR-022**: System MUST visually distinguish between text, variables, and iteration blocks in the editor
- **FR-023**: System MUST define available entities for iteration: "propietarios", "inquilinos" [NEEDS CLARIFICATION: Should "propiedad" be available for iteration or only as a single entity? Based on context, assuming only propietarios/inquilinos for now]
- **FR-024**: System MUST define properties for "propietario" entity: nombre, dni, domicilio [NEEDS CLARIFICATION: Are there additional properties needed?]
- **FR-025**: System MUST define properties for "inquilino" entity: nombre, dni, domicilio [NEEDS CLARIFICATION: Are there additional properties needed?]
- **FR-026**: System MUST define properties for "propiedad" entity: direccion, ambientes, superficie [NEEDS CLARIFICATION: Are there additional properties needed like tipo, valor, etc?]

### Key Entities

- **Clause Template Content (Structured Format)**: Represents the internal structure of clause content when using the visual editor. The content is stored as a JSON string in the `content` field (TEXT type). Structure: `{ type: "structured", parts: [...] }` where each part can be: `{ type: "text", content: "string" }`, `{ type: "variable", path: "entity.property" }`, or `{ type: "iteration", entity: "propietarios"|"inquilinos", template: "string", separator: "string", lastSeparator: "string", addPeriod: boolean }`. This structure allows the system to reconstruct the visual editor state when loading a clause and to render the final text when generating contracts.

- **Available Entity**: Represents the entities that can be used for iterations or as variable sources. Initially includes: "propietarios" (with properties: nombre, dni, domicilio), "inquilinos" (with properties: nombre, dni, domicilio), and "propiedad" (with properties: direccion, ambientes, superficie). These are defined as configuration constants in the application code, not database entities. The system must validate that users can only select from these predefined entities and properties.

- **Iteration Block**: Represents a visual UI element in the editor that corresponds to an iteration over an entity. When rendered in the editor, it appears as a distinct card/box with edit and delete controls. Internally, it is stored as an iteration part in the structured JSON format.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 90% of users can successfully insert a variable using the "Agregar Variable" button without needing to understand the underlying syntax (measured over 30 days of usage)
- **SC-002**: 90% of users can successfully create an iteration block using the "Agregar Lista" modal without errors (measured over 30 days)
- **SC-003**: 100% of clauses created with the visual editor are saved correctly as JSON and can be loaded back into the editor without data loss
- **SC-004**: 100% of existing plain text clauses continue to function correctly (backward compatibility maintained)
- **SC-005**: Users can complete the creation of a clause with one iteration block in under 3 minutes for 90% of attempts (measured at 90th percentile)
- **SC-006**: The system correctly detects and handles content format (structured vs plain text) in 100% of clause load operations
- **SC-007**: Zero data loss or corruption occurs when saving/loading structured content (measured over 30 days)
- **SC-008**: The visual editor renders all content types (text, variables, iterations) clearly and distinctly, with 95% of users reporting they can easily identify each type in user testing sessions

