# Field Notes — Diseño

**Fecha:** 2026-04-29  
**Scope:** Propiedades (extensible a clientes y propietarios)  
**Estado:** Aprobado, pendiente de implementación

---

## Resumen

Permitir que los agentes de la agencia dejen notas/aclaraciones sobre campos individuales de una propiedad (dirección, ciudad, etc.). Las notas son compartidas entre todos los agentes de la misma agencia. Cada agente puede dejar una sola nota por campo.

El flujo de anotación imita el estilo Discord: selección de texto → burbuja "Comentar" → label subrayado en ámbar → HoverCard de lectura / Popover interactivo con acciones estilo Discord en hover.

---

## 1. Modelo de datos

### Tabla: `field_note`

| columna | tipo | detalle |
|---|---|---|
| `id` | uuid | PK, generado automáticamente |
| `agency_id` | text | FK a `agency.id` |
| `entity_type` | text | `'property'` \| `'client'` |
| `entity_id` | text | FK al id de la entidad |
| `field_name` | text | nombre del campo en inglés, ej: `'address'`, `'city'`, `'zone'` |
| `comment` | text | texto de la nota |
| `author_id` | text | FK a `user.id` |
| `created_at` | timestamp | generado automáticamente |
| `updated_at` | timestamp | actualizado en cada PATCH |

**Restricción única:** `(agency_id, entity_type, entity_id, field_name, author_id)` — un agente puede tener máximo una nota por campo por entidad.

---

## 2. API

Todas las rutas bajo `/api/field-notes`. Requieren sesión activa.

### `GET /api/field-notes`

Query params: `entityType`, `entityId`

Devuelve todas las notas de esa entidad, enriquecidas con el nombre del autor:

```json
[
  {
    "id": "uuid",
    "fieldName": "address",
    "comment": "Portero eléctrico en el 3er timbre",
    "authorId": "uuid",
    "authorName": "Gastón Arce",
    "authorInitials": "GA",
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
]
```

Permisos: todos los roles (visitor incluido).

### `POST /api/field-notes`

Body: `{ entityType, entityId, fieldName, comment }`

Crea una nueva nota. Si ya existe una nota del mismo autor para ese campo, devuelve 409.

Permisos: `agent`, `account_admin`.

### `PATCH /api/field-notes/[id]`

Body: `{ comment }`

Solo el autor original puede editar su nota. Devuelve 403 si otro agente intenta editar.

Permisos: `agent`, `account_admin`.

### `DELETE /api/field-notes/[id]`

Solo el autor original puede eliminar su nota. Devuelve 403 si otro agente intenta eliminar.

Permisos: `agent`, `account_admin`.

---

## 3. Componente `AnnotatableField`

### Ubicación
`src/components/ui/annotatable-field.tsx`

### Props

```typescript
interface AnnotatableFieldProps {
  // idénticos a DatoItem
  label: string;
  value?: string | number | null;
  highlight?: boolean;
  // nuevos
  fieldName: string;       // ej: "address"
  entityType: "property" | "client";
  entityId: string;
}
```

`DatoItem` no se modifica. `AnnotatableField` reimplementa la misma estructura visual internamente.

### Uso

```tsx
// Antes
<DatoItem label="Dirección" value={prop.address} />

// Después
<AnnotatableField
  label="Dirección"
  value={prop.address}
  fieldName="address"
  entityType="property"
  entityId={prop.id}
/>
```

### Estados internos

El componente maneja cinco estados visuales:

1. **Sin notas (idle):** igual a `DatoItem`. Detecta `mouseup` dentro del card.
2. **Burbuja flotante:** al soltar el click con texto seleccionado, aparece una burbuja "💬 Comentar este campo" posicionada sobre la selección. Desaparece si el usuario hace click fuera o cancela.
3. **Anotado (idle):** el label cambia a color ámbar (`--mustard`) + subrayado + ✦. El valor se muestra igual.
4. **HoverCard (solo lectura):** al hacer hover sobre el label anotado. Muestra la lista de notas de todos los agentes — limpia, sin botones de acción.
5. **Popover (interactivo):** al hacer click sobre el label anotado. Misma lista de notas, pero al hacer hover sobre cada nota propia aparecen dos íconos en la esquina superior derecha: ✏️ (editar) y 🗑️ (eliminar), con tooltip en cada uno. Las notas de otros agentes se muestran sin íconos de acción.

### Carga de datos

- Las notas se cargan con `useQuery` haciendo `GET /api/field-notes?entityType=...&entityId=...` **una sola vez por página**.
- Cada `AnnotatableField` filtra del cache las notas que corresponden a su `fieldName`. Sin llamadas adicionales por campo.
- La query se invalida después de crear, editar o eliminar una nota (`queryClient.invalidateQueries`).

---

## 4. Flujos de escritura

### Agregar nota (desde selección de texto)
1. Usuario selecciona texto dentro del card → suelta el click (`mouseup`)
2. Aparece burbuja "💬 Comentar este campo"
3. Click en la burbuja → se abre el Popover con un textarea en blanco
4. Usuario escribe → Enter o click en "Guardar" → `POST /api/field-notes`
5. Label pasa a estado anotado (ámbar + ✦)

### Agregar nota (desde Popover de campo ya anotado)
1. Usuario hace click en el label anotado → Popover se abre
2. Ve las notas existentes. Si aún no comentó ese campo, ve "Agregar un comentario..." al pie
3. Click en ese texto → aparece textarea inline en el Popover
4. Mismo flujo de guardado

### Editar nota
1. Desde el Popover, usuario hace hover sobre su propia nota → aparecen íconos ✏️ 🗑️
2. Click en ✏️ → el texto de la nota se convierte en textarea editable inline
3. Usuario edita → Enter o click fuera del Popover → AlertDialog: "¿Guardar cambios?" con botones **Guardar** / **Descartar**
4. Guardar → `PATCH /api/field-notes/[id]`

### Eliminar nota
1. Desde el Popover, hover sobre nota propia → click en 🗑️
2. AlertDialog: "¿Eliminar este comentario?" con botón rojo **Eliminar** + **Cancelar**
3. Confirmar → `DELETE /api/field-notes/[id]`
4. Si era la única nota del campo → label vuelve al estado sin anotar

---

## 5. Permisos por rol

| acción | visitor | agent | account_admin |
|---|---|---|---|
| Ver notas (HoverCard) | ✓ | ✓ | ✓ |
| Agregar nota | ✗ | ✓ | ✓ |
| Editar nota propia | ✗ | ✓ | ✓ |
| Eliminar nota propia | ✗ | ✓ | ✓ |
| Editar nota ajena | ✗ | ✗ | ✗ |
| Eliminar nota ajena | ✗ | ✗ | ✗ |

---

## 6. Scope de implementación inicial

- Campos anotables en la primera entrega: todos los `DatoItem` del tab "Datos" de la página de propiedades (`/propiedades/[id]`).
- En una segunda entrega: aplicar el mismo componente en las fichas de propietarios e inquilinos.

---

## 7. Componentes shadcn a usar

- `HoverCard`, `HoverCardTrigger`, `HoverCardContent` — para la vista de solo lectura
- `Popover`, `PopoverTrigger`, `PopoverContent` — para el modo interactivo
- `AlertDialog` — para confirmación de eliminar y de guardar cambios al editar
- `Tooltip` — para los íconos de acción en hover

---

## 8. Lo que queda fuera de scope

- Notas en modo edición de la propiedad (solo aplican en modo vista)
- Resolución de conflictos si dos agentes editan simultáneamente (last-write-wins)
- Notificaciones cuando otro agente deja una nota
- Historial de versiones de una nota
