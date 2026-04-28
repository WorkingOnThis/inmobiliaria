# Variable Popover — Diseño

**Fecha:** 2026-04-27  
**Feature:** Ctrl+Click en variables `[[]]` del generador de documentos abre un popover para ver y sobreescribir el valor

---

## Contexto

El generador de documentos (`/generador-documentos/[id]`) tiene una columna de previsualización donde se renderizan las cláusulas del contrato. Las variables del sistema (`[[ruta.del.campo]]`) aparecen:

- En **verde** si el contrato seleccionado las resuelve correctamente
- En **rojo** si no hay datos disponibles

Hoy no hay forma de interactuar con esas variables desde la preview. El usuario quiere poder hacer Ctrl+Click sobre cualquier variable para ver su valor y sobreescribirlo temporalmente (para esa sesión de impresión).

---

## Alcance

- **Dónde aplica:** columna derecha de preview en `document-template-editor.tsx`
- **Qué tipo de variables:** solo `[[sistema.variable]]`. Las `{{texto libre}}` tienen su propio panel ya existente (`FreeTextVarsPanel`).
- **Persistencia:** los overrides son temporales. Se pierden al recargar, igual que los `freeTextValues`. No se guardan en la DB.

---

## Comportamiento

### Activación
- `Ctrl+Click` (Windows) o `Cmd+Click` (Mac) sobre cualquier span de variable en la preview
- Un clic normal no hace nada (no interfiere con la lectura)

### Estados del popover

| Estado | Variable | Valor mostrado | Botones |
|--------|----------|---------------|---------|
| Resuelta sin override | Verde | Valor real del contrato | Cancelar · Aplicar override |
| Sin datos sin override | Rojo | "Sin datos" | Cancelar · Aplicar override |
| Con override activo | Ámbar | Valor del override | Cancelar · Limpiar · Actualizar |

### Contenido del popover
1. Path de la variable (monospace, coloreado según estado)
2. Label/descripción (del `VARIABLES_CATALOG`)
3. Valor actual (del contrato) o "Sin datos"
4. Input para sobreescribir
5. Botones de acción

### Cierre
- Clic fuera del popover
- Tecla `Esc`
- Botones "Cancelar", "Aplicar override", "Limpiar"

### Color con override activo
Cuando una variable tiene override, se renderiza en **ámbar** (igual que las `{{freeText}}`). Así se distingue visualmente de los valores reales (verde) y los faltantes (rojo).

---

## Arquitectura

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/lib/document-templates/render-segments.tsx` | Añadir `overrides` y `onVarClick` como parámetros opcionales a `renderInline` y `renderClauseBody` |
| `src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx` | Nuevo estado `overrides`, nuevo componente `VariablePopover`, pasar callbacks al renderer |

### Nuevo estado en `DocumentTemplateEditor`

```ts
// Overrides temporales: path → valor sobreescrito
const [overrides, setOverrides] = useState<Record<string, string>>({});

// Estado del popover abierto (null = cerrado)
const [popoverState, setPopoverState] = useState<{
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
} | null>(null);
```

### Cambios en `render-segments.tsx`

`renderClauseBody` y `renderInline` reciben dos nuevos parámetros opcionales al final de su firma:

```ts
function renderInline(
  text: string,
  resolved: Record<string, string | null>,
  hasContract: boolean,
  freeTextValues: Record<string, string>,
  kp: string,
  overrides?: Record<string, string>,          // nuevo
  onVarClick?: (path: string, rect: DOMRect) => void  // nuevo
): React.ReactNode[]
```

Lógica de color para cada `[[variable]]`:

```
if overrides[path] existe   → ámbar, muestra el override
else if resolved[path] != null → verde, muestra el valor real
else                        → rojo, muestra el path literal
```

El `onClick` de cada span:
```tsx
onClick={(e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    onVarClick?.(path, (e.currentTarget as HTMLElement).getBoundingClientRect());
  }
}}
style={{ cursor: onVarClick ? 'pointer' : undefined }}
```

### Componente `VariablePopover`

Posicionado con `position: fixed` usando el `DOMRect` del span clickeado. Busca el label en `VARIABLES_CATALOG` por path. Props:

```ts
type VariablePopoverProps = {
  path: string;
  rect: DOMRect;
  resolvedValue: string | null;
  currentOverride: string | undefined;
  onApply: (path: string, value: string) => void;
  onClear: (path: string) => void;
  onClose: () => void;
};
```

El posicionamiento ajusta automáticamente si el popover se saldría del viewport por la derecha o por abajo.

Cierra con `Esc` (keydown listener) y con clic fuera (mousedown listener en `document`), ambos limpiados en el `useEffect` de cleanup.

---

## Lo que NO cambia

- `FreeTextVarsPanel` — sigue existiendo para variables `{{texto libre}}`
- `HighlightedBodyTextarea` — el editor de cláusulas no se toca
- La API y la DB — ningún dato nuevo se persiste
- El comportamiento de impresión — los overrides sí aplican al imprimir (ya están en el state)

---

## Casos límite

- **Variable de iteración** (`[[item.campo]]` dentro de bloques `[[for:]]`): quedan fuera del alcance de V1. Los spans dentro de for-blocks no son interactivos.
- **Variable `[[if:]]`**: los marcadores de control (`[[if:path]]`, `[[/if]]`) no son clickeables, solo las variables de datos.
- **Popover en el borde de pantalla**: el componente ajusta la posición horizontal y vertical para no salirse del viewport.
- **Sin contrato seleccionado**: no hay overrides ni popover disponibles (la preview muestra un placeholder, no variables).
