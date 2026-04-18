# english-code

## Propósito
Todo el código de Arce debe estar en inglés. Esta instrucción define
exactamente qué va en inglés, qué puede ir en español, y cómo verificarlo.

## Regla general

Si lo lee la máquina (compilador, runtime, base de datos, caché) → inglés.
Si lo lee el usuario final en la pantalla → español.

## Tabla de referencia

| Elemento | Idioma | Ejemplo correcto |
|---|---|---|
| Nombres de variables y funciones | Inglés | `tenantId`, `getOwner`, `isActive` |
| Nombres de archivos y carpetas | Inglés | `tenant-tab.tsx`, `owner-form.tsx` |
| Rutas de API | Inglés | `/api/tenants/:id`, `/api/contracts` |
| Query keys de TanStack Query | Inglés | `["tenant", id]`, `["contract"]` |
| Nombres de tablas y columnas (DB) | Inglés | `tenant`, `contractEndDate` |
| Constantes de código | Inglés | `PROPERTY_STATUSES`, `CONTRACT_TYPES` |
| Props de componentes | Inglés | `isLoading`, `onSuccess`, `label` |
| Tipos e interfaces TypeScript | Inglés | `TenantData`, `ContractStatus` |
| Texto visible en la UI | Español | `"Sin cargar"`, `"Activo"`, `"Guardar"` |
| Placeholders de inputs | Español | `"Ej: Banco Nación"` |
| Mensajes de error para el usuario | Español | `"No se pudo guardar"` |
| Comentarios explicativos (opcional) | Cualquiera | depende del equipo |

## Verificación durante implementación

Antes de terminar cualquier archivo nuevo o modificado, revisar:

1. ¿Hay alguna variable, función, tipo o constante con nombre en español?
2. ¿Hay query keys con strings en español?
3. ¿Hay rutas de API con segmentos en español?
4. ¿Hay nombres de columnas o tablas en español en el schema de Drizzle?

Si encontrás alguno → corregirlo en el mismo momento, no dejarlo para después.

## Caso especial — migración de código existente

Si al implementar algo nuevo encontrás código existente que mezcla idiomas
(variable en español, query key en español, etc.):

1. Corregirlo en el mismo commit si está en el mismo archivo que tocaste
2. Si está en otro archivo, anotarlo como deuda técnica en un comentario
   `// TODO: rename to English — [nombre actual]`
3. No dejar pasar la mezcla sin registrarla

## Por qué importa

Las query keys en español que invalidan queries en inglés no generan error.
El sistema simplemente no actualiza la pantalla. Son bugs silenciosos que
solo se detectan manualmente. Consistencia en inglés elimina esta clase
de bugs por completo.