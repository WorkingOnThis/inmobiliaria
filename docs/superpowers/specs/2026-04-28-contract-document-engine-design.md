# Contract Document Engine — Diseño

**Fecha:** 2026-04-28
**Feature:** Motor de documentos integrado en la ficha del contrato — cláusulas editables, numeración automática, múltiples tipos de documento por contrato

---

## Contexto

Hoy el generador de documentos (`/generador-documentos/[id]`) es un módulo separado donde el agente elige una plantilla y luego selecciona un contrato para previsualizar. Los overrides de variables son efímeros (se pierden al recargar).

La visión es distinta: **el motor de documentos vive dentro de cada contrato**. Cuando se crea un contrato, se aplica una plantilla maestra que genera un conjunto de cláusulas propias del contrato. El agente puede editarlas, reordenarlas, activarlas o desactivarlas antes de firmar. Una vez firmado, todo queda bloqueado.

El mismo motor se reutiliza para otros documentos del contrato: acta de entrega de llaves, estado del inmueble, recibo de llaves, etc.

---

## Flujo de vida del contrato

El contrato avanza por 5 pasos (ya implementados como UI stepper):

| Paso | Estado | Qué contiene |
|------|--------|--------------|
| 01 | Legajo aprobado | Datos de las partes, propiedad |
| 02 | **Borrador generado** | ← Esta feature. Cláusulas editables |
| 03 | Firma electrónica | Pendiente (fuera de scope) |
| 04 | Acta de entrega | Mismo motor, documentType distinto |
| 05 | Inquilino activo | Contrato vigente, todo bloqueado |

**Editable:** estados `draft` y `pending_signature`.
**Bloqueado:** `active`, `expiring_soon`, `expired`, `terminated`.

---

## Arquitectura

### Principio: snapshot + vínculo de origen

Cuando se aplica una plantilla a un contrato, se copian todas sus cláusulas a una tabla propia del contrato (`contract_clause`). A partir de ese momento el contrato es dueño de sus cláusulas — cambios en la plantilla maestra no lo afectan.

Cada cláusula guarda el `sourceClauseId` (de dónde vino en la plantilla), lo que habilita en el futuro la opción "sincronizar desde plantilla" para contratos todavía en borrador.

### Extensibilidad multi-documento

La misma tabla `contract_clause` sirve para todos los documentos del contrato. El campo `documentType` diferencia a cuál pertenece cada cláusula (`"contract"`, `"delivery_act"`, etc.).

La configuración de qué plantilla se aplicó a cada tipo de documento vive en una tabla separada `contract_document_config`.

---

## Modelo de datos

### Nueva tabla: `contract_document_config`

```ts
pgTable("contract_document_config", {
  id:               text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractId:       text("contractId").notNull().references(() => contract.id, { onDelete: "cascade" }),
  documentType:     text("documentType").notNull(), // "contract" | "delivery_act" | ...
  appliedTemplateId: text("appliedTemplateId").references(() => documentTemplate.id, { onDelete: "set null" }),
  appliedAt:        timestamp("appliedAt").notNull().defaultNow(),
})
// unique constraint: (contractId, documentType)
```

### Nueva tabla: `contract_clause`

```ts
pgTable("contract_clause", {
  id:             text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractId:     text("contractId").notNull().references(() => contract.id, { onDelete: "cascade" }),
  documentType:   text("documentType").notNull().default("contract"),
  sourceClauseId: text("sourceClauseId").references(() => documentTemplateClause.id, { onDelete: "set null" }),
  title:          text("title").notNull(),
  body:           text("body").notNull().default(""),
  isActive:       boolean("isActive").notNull().default(true),
  order:          integer("order").notNull(),
  fieldOverrides: jsonb("fieldOverrides").notNull().default({}), // Record<string, string>
  createdAt:      timestamp("createdAt").notNull().defaultNow(),
  updatedAt:      timestamp("updatedAt").notNull().defaultNow(),
})
```

**Nota:** `order` es el índice de posición drag & drop (incluye cláusulas inactivas). La numeración impresa se calcula en runtime contando solo las activas en orden.

---

## API routes

Todos bajo `/api/contracts/[id]/documents/[documentType]/`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `.../apply` | Aplica una plantilla: copia cláusulas, crea `contract_document_config` |
| `GET`  | `.../clauses` | Lista `contract_clause` para este contrato + documentType |
| `POST` | `.../clauses` | Crea cláusula custom (sin `sourceClauseId`) |
| `PATCH` | `.../clauses/[clauseId]` | Edita `title`, `body`, `isActive`, `fieldOverrides` |
| `PUT`  | `.../clauses/reorder` | Actualiza `order` de todas las cláusulas (drag & drop) |
| `DELETE` | `.../clauses/[clauseId]` | Elimina cláusula custom (las de origen de plantilla solo se desactivan) |

La resolución de variables reutiliza el endpoint existente: `GET /api/document-templates/resolve?contractId=X`.

---

## UI — Ficha del contrato (paso 02)

### Sección "Cláusulas del contrato"

Aparece en el paso 2 del stepper (Borrador generado), debajo de los datos del contrato.

**Sin plantilla aplicada:**
- Banner: "No hay cláusulas generadas aún"
- Botón "Aplicar plantilla estándar" → llama a `.../apply` con la plantilla default de la agencia

> **Plantilla default:** se agrega el campo `isDefault boolean default false` a `documentTemplate`. Solo puede haber una default por agencia (constraint o validación en el PATCH). Si no hay ninguna marcada como default, el botón muestra un selector en su lugar.

**Con plantilla aplicada:**
- Badge "Estándar residencial" + botón "Cambiar plantilla" (solo en draft/pending_signature). Al confirmar el cambio: se eliminan todas las `contract_clause` del tipo de documento y se corre `.../apply` con la nueva plantilla desde cero. Modal de confirmación advierte que se perderán los cambios manuales.
- Lista de cláusulas con:
  - Handle drag & drop (solo editable)
  - Número auto-calculado (solo cláusulas activas, en orden)
  - Título descriptivo
  - Toggle activa/inactiva (las inactivas se ven tachadas, no consumen número)
  - Botón "Editar" → abre modal de edición
- Botón "+ Agregar cláusula" al final
- Botón "Vista previa / Imprimir"

**Bloqueado (active en adelante):**
- Sin handles, sin toggles, sin "Editar", sin "+ Agregar"
- Solo "Vista previa / Imprimir"

### Modal de edición de cláusula (opción B)

Modal mediano con:
1. Campo **Título** (solo la parte descriptiva, ej: "Mora")
2. **Textarea con highlighting** — variables `[[]]` en verde/rojo según resolución, `{{}}` en mostaza. Ctrl+Click abre el popover de override ya existente.
3. **Preview compacto** renderizado en tiempo real debajo del textarea, con borde izquierdo verde
4. Footer: hint "Ctrl+Click en una variable para sobreescribir" · Cancelar · Guardar

Guardar persiste `title`, `body` y `fieldOverrides` (los overrides del popover) a `contract_clause` vía `PATCH`.

### Numeración impresa

- En UI: "Cláusula 1", "Cláusula 2"... (arábigos, para operar)
- En preview/impresión: **"CLÁUSULA PRIMERA — MORA"**, **"CLÁUSULA SEGUNDA — GARANTÍAS"**... (ordinales en palabras, mayúsculas, estilo legal argentino)
- El número se calcula contando las cláusulas activas anteriores — no se guarda en DB

---

## Extensibilidad futura

Valores de `documentType` planificados:

| Valor | Documento | Paso del flujo |
|-------|-----------|----------------|
| `"contract"` | Contrato de locación | 02 |
| `"delivery_act"` | Acta de entrega de llaves | 04 |
| `"property_condition"` | Estado del inmueble | 04 |
| `"key_receipt"` | Recibo de llaves (al finalizar) | futuro |

Cada tipo necesita su propia plantilla en el generador de documentos (marcada con una categoría o tipo). La UI de cada paso del stepper renderiza el componente de cláusulas filtrando por su `documentType`.

---

## Lo que NO cambia

- El generador de documentos (`/generador-documentos/[id]`) sigue existiendo para crear y editar plantillas reutilizables
- El motor de render (`renderClauseBody`, `renderInline`) no se modifica
- El popover de Ctrl+Click ya construido se reutiliza sin cambios
- Los datos del contrato (monto, fechas, partes) se editan desde sus propios campos — el motor de documentos solo los lee

---

## Fuera de scope para V1

- Sincronización "actualizar desde plantilla" para contratos en borrador (el `sourceClauseId` ya la habilita, pero la lógica queda para V2)
- Firma electrónica (paso 3)
- Sub-cláusulas / numeración 3.1, 3.2 (se resuelve con incisos a), b), c) dentro del cuerpo)
- Historial de cambios por cláusula
