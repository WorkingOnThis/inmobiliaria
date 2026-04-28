# Contract Document Section — Rediseño UX

**Fecha:** 2026-04-28
**Alcance:** `src/components/contracts/contract-document-section.tsx`

---

## Problema

La versión actual muestra las cláusulas como una lista de filas compactas. Para editar una cláusula hay que abrir un modal separado. Para ver el contrato renderizado hay que imprimir directamente sin previsualización inline. El flujo no es fluido y el usuario pierde contexto al saltar entre lista y modal.

## Objetivo

Reemplazar la lista + modal por dos estados integrados dentro del mismo componente:

1. **Estado editor** — lista de cláusulas en acordeón. Clic → expande inline.
2. **Estado preview** — sidebar compacto con títulos + panel de vista previa a la derecha.

---

## Diseño

### Estado 1 — Editor (default)

La sección ocupa todo el ancho disponible. Las cláusulas son filas apiladas verticalmente con esta anatomía cuando **colapsadas**:

```
[drag] [número] [título]  [switch activo/inactivo]  [▼]
```

Al hacer **clic en cualquier parte de la fila**, la cláusula se expande con borde azul:

```
[drag] [número] [título]                             [▲]
─────────────────────────────────────────────────────
Label: Título
[ input con el título actual                        ]

Label: Cuerpo
[ textarea con highlighting de [[variables]]        ]

                          [ Cancelar ]  [ Guardar ]
```

- Solo una cláusula puede estar expandida a la vez. Expandir una colapsa la anterior (si había cambios sin guardar, se descartan — sin prompt de confirmación, igual al generador de documentos).
- El drag handle (`GripVertical`) y el `Switch` siguen visibles en la fila header de la cláusula expandida.
- Las cláusulas inactivas se muestran tachadas con opacity reducida; se pueden expandir igual para editar.
- El `HighlightedBodyTextarea` ya extraído resalta `[[variables]]` y `{{free text}}` con los colores del sistema.
- Guardar llama a `PATCH /api/contracts/[id]/documents/[documentType]/clauses/[clauseId]` con `{ title, body }`.
- Cancelar descarta los cambios locales y colapsa.

**Header de la sección** (siempre visible, en ambos estados):
```
Cláusulas del contrato  [badge: nombre plantilla]
                    [+ Agregar]  [🖨 Imprimir]  [👁 Vista previa]
```

### Estado 2 — Preview activo

Al presionar **Vista previa**:

- El layout pasa a `flex-row`.
- **Izquierda** (~160px fijo): sidebar compacto con la lista de títulos numerados.
  - Cláusulas inactivas: tachadas, color muted, sin número.
  - Cláusula seleccionada en el sidebar: resaltada en azul.
  - Clic en un título → hace scroll suave en el panel preview hasta esa cláusula.
  - No hay edición posible desde el sidebar; es solo navegación.
- **Derecha** (flex: 1): preview del documento renderizado con `renderClauseBody`, encabezados ordinales (`clauseHeading`), texto justificado, `fieldOverrides` aplicados.
- El botón cambia a **"✕ Cerrar preview"**. Presionarlo vuelve al Estado 1.
- En estado preview, el acordeón queda colapsado; si había una cláusula expandida al presionar preview, se colapsa.

### Variable popover en el textarea

El `HighlightedBodyTextarea` en modo editor puede tener el popover de override wired (Ctrl+Click sobre una variable). Los overrides se guardan junto con el cuerpo en el PATCH (`fieldOverrides`). Esta funcionalidad ya existe — solo hay que mantenerla al reescribir el componente.

---

## Componentes afectados

| Archivo | Cambio |
|---|---|
| `src/components/contracts/contract-document-section.tsx` | Reescritura completa |
| `src/components/contracts/contract-clause-editor-modal.tsx` | **Eliminar** — ya no se usa |

### Componentes que se reutilizan sin cambios

- `HighlightedBodyTextarea` — `@/lib/document-templates/highlighted-body-textarea`
- `VariablePopover` + `PopoverState` — `@/lib/document-templates/variable-popover`
- `renderClauseBody` — `@/lib/document-templates/render-segments`
- `clauseHeading` — `@/lib/document-templates/ordinal-clause`
- `ContractClause` type — `@/db/schema/contract-clause`
- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` (ya instalados)

---

## Estado local del componente

```ts
const [expandedClauseId, setExpandedClauseId] = useState<string | null>(null);
const [editTitle, setEditTitle] = useState("");
const [editBody, setEditBody] = useState("");
const [editOverrides, setEditOverrides] = useState<Record<string, string>>({});
const [previewOpen, setPreviewOpen] = useState(false);
const [previewFocusId, setPreviewFocusId] = useState<string | null>(null);
const [localOrder, setLocalOrder] = useState<string[] | null>(null);
```

`editTitle`, `editBody`, `editOverrides` se inicializan cuando se expande una cláusula. Al colapsar (Cancelar o clic en otra) se resetean.

`previewFocusId` es la cláusula resaltada en el sidebar del preview (inicialmente la primera activa).

---

## Scroll al hacer clic en sidebar

El panel de preview tiene un `ref`. Cada cláusula en el preview tiene un `id` atributo (`clause-preview-{id}`). Al hacer clic en el sidebar se llama a:

```ts
document.getElementById(`clause-preview-${clauseId}`)?.scrollIntoView({ behavior: "smooth" });
```

---

## Print

El botón Imprimir está siempre disponible (en ambos estados). Abre una ventana nueva con el documento formateado usando `renderToStaticMarkup`, igual a la implementación actual.

---

## Fuera de alcance

- Soporte para múltiples `documentType` en la misma página — el componente recibe `documentType` como prop, sin cambios.
- Edición de cláusulas en modo preview — el sidebar es solo navegación.
- Confirmación al cancelar con cambios sin guardar — se descartan silenciosamente (igual al generador).
- Persistencia del estado de preview entre navegaciones — siempre abre en Estado 1.
