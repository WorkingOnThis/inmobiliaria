# Diseño: Agrupación de co-inquilinos en la lista

**Fecha:** 2026-05-07  
**Estado:** Aprobado por el usuario  

---

## Resumen

Cuando dos o más inquilinos comparten el mismo contrato activo como su "mejor contrato", aparecen en la lista como un único grupo visual colapsado. El grupo muestra al inquilino primario; un toggle expande una sub-fila con los co-inquilinos. Cada fila sigue apuntando a la ficha individual de cada persona.

---

## Lógica de agrupación

Un **grupo** se forma cuando dos o más inquilinos tienen el mismo `contractId` como mejor contrato (según la prioridad de estado existente: `active > expiring_soon > pending_signature > draft > expired`).

- Si un inquilino tiene múltiples contratos y su mejor contrato cambia (por ejemplo, obtiene un nuevo contrato solo), deja de pertenecer al grupo de ese contrato. El grupo se deshace naturalmente o queda con un solo miembro (y se muestra como fila individual).
- Un inquilino puede aparecer en más de un grupo si tiene dos contratos distintos, cada uno con otro co-inquilino. Este caso es poco probable en V1 pero la arquitectura lo tolera.

**Inquilino primario dentro del grupo:** el participante con el `createdAt` más antiguo en `contract_participant` para ese contrato. No se requiere cambio de schema. Si los `createdAt` son iguales, se usa orden alfabético por `firstName`.

---

## API — `/api/tenants` (GET)

### Cambio en la respuesta

La respuesta pasa de un array plano de inquilinos a un array de **grupos**.

```typescript
// Antes
{ tenants: TenantRow[], stats, pagination }

// Después
{ groups: TenantGroup[], stats, pagination }
```

```typescript
interface TenantGroup {
  contractId: string | null;       // ID del contrato compartido (null si sin_contrato)
  primary: TenantRow;              // Inquilino primario (datos completos)
  coTenants: TenantRow[];          // Co-inquilinos; array vacío para inquilinos solos
  groupEstado: EstadoInquilino;    // Estado del peor miembro (ver "Resolución de estado")
  diasMora: number;                // diasMora del miembro con más mora
}

// TenantRow sin cambios (id, firstName, lastName, estado, diasMora, contrato, property, etc.)
```

### Lógica del servidor

1. Ejecutar las queries existentes (tenants, contracts, payments, ledger).
2. Determinar el mejor contrato por tenant (lógica existente).
3. Aplicar el override de estado por ledger (lógica recién agregada).
4. Agrupar tenants por `bestContractId`. Tenants sin contrato forman grupos individuales (contractId: null, uno por tenant).
5. Dentro de cada grupo, ordenar por `contractParticipant.createdAt ASC` → el primero es el primario.
6. Calcular `groupEstado` y `diasMora` del grupo (peor entre los miembros).
7. Aplicar filtro de estado, búsqueda y paginación **sobre grupos**, no sobre individuos.

### Paginación

`total` pasa a contar grupos, no individuos. El parámetro `limit` define cuántos grupos por página.

### Búsqueda

Un grupo aparece en los resultados de búsqueda si el término coincide con `firstName`, `lastName`, `dni` o `phone` de **cualquier** miembro (primario o co-inquilino).

### Filtro de estado

Un grupo aparece bajo el filtro `estado` si `groupEstado === estado`. El filtro "Al día" (`activo`) solo muestra grupos donde el peor miembro también está al día.

---

## Resolución del estado del grupo

El `groupEstado` es el "peor" estado entre todos los miembros, con esta prioridad (de mayor a menor gravedad):

```
en_mora > pendiente > por_vencer > activo > sin_contrato > pendiente_firma > historico
```

El badge del grupo colapsado siempre muestra `groupEstado`. El badge de cada co-inquilino en la sub-fila muestra su estado individual.

`diasMora` del grupo = máximo `diasMora` entre los miembros.

---

## Comportamiento de la UI

### Fila colapsada (estado por defecto)

```
[ ▶ ] [ PG PM ] Paggi Guido  +1 co-inquilino   Fray Mamerto…  CON-0001  27/02/2028  Sin cargar  9%  Al día
```

- **Toggle `▶`**: click expande la sub-fila. No navega.
- **Click en la fila** (fuera del toggle): navega a `/inquilinos/[primary.id]`.
- **Avatares**: apilados (el segundo con offset negativo). Se muestran las iniciales de todos los miembros.
- **Label de co-inquilinos**: `+1 co-inquilino` (singular) o `+N co-inquilinos` (plural).
- **Datos mostrados**: los del inquilino primario (property, contract, dates, completitud). `ultimoPago` muestra la fecha más reciente entre todos los miembros del grupo.
- **Badge de estado**: muestra `groupEstado`.

### Sub-fila expandida

```
      [ PM ] Paggi Malena                          Sin cargar        Al día
```

- Aparece inmediatamente debajo del primario, sin animación.
- Indentada ~32px a la derecha.
- Borde izquierdo de 3px en color `--primary` (azul) para señalar la pertenencia al grupo.
- Columnas de propiedad, contrato, vencimiento y completitud muestran `—` (datos idénticos al primario).
- El nombre es un link que navega a `/inquilinos/[coTenant.id]`.
- Badge de estado individual del co-inquilino.
- Toggle pasa a `▼`; segundo click colapsa.

### Fila individual (sin co-inquilinos)

Sin cambios respecto al diseño actual. Sin toggle, sin indicadores de grupo.

---

## Stats / KPIs

Los contadores del encabezado (`EN MORA`, `CONTRATO POR VENCER`, `SIN CONTRATO ACTIVO`) se calculan sobre **grupos**, no sobre individuos.

```typescript
stats = {
  total: groups.length,
  conContratoActivo: groups.filter(g => ["activo","pendiente","por_vencer","en_mora"].includes(g.groupEstado)).length,
  enMora:      groups.filter(g => g.groupEstado === "en_mora").length,
  pendiente:   groups.filter(g => g.groupEstado === "pendiente").length,
  porVencer:   groups.filter(g => g.groupEstado === "por_vencer").length,
  sinContrato: groups.filter(g => g.groupEstado === "sin_contrato").length,
  pendienteFirma: groups.filter(g => g.groupEstado === "pendiente_firma").length,
  historico:   groups.filter(g => g.groupEstado === "historico").length,
}
```

---

## Cambios de componentes

### `TenantsList` (`src/components/tenants/tenants-list.tsx`)

- `TenantRow[]` → `TenantGroup[]` como prop de entrada.
- Se extrae el subcomponente `TenantGroupRow` que renderiza la fila colapsada + sub-filas.
- El estado del toggle (`open`) es local a `TenantGroupRow` (no se persiste en URL ni en servidor).
- `EstadoBadge` y `ProgressBar` no cambian.

### Route `/api/tenants` (`src/app/api/tenants/route.ts`)

- Al inicio del handler, agregar una query de `contract_participant` con `role = "tenant"` que trae `clientId` y `createdAt`, para construir `participantOrder: Map<clientId, createdAt>`.
- Nueva función `groupTenants(enriched, participantOrder)` que agrupa el array de tenants enriquecidos.
- La función devuelve `TenantGroup[]`.

### Tipo `EstadoInquilino`

Sin cambios. `"pendiente"` ya fue agregado en el commit anterior.

---

## Edge cases

| Caso | Comportamiento |
|---|---|
| Grupo de 1 (el co-inquilino obtiene nuevo contrato) | El primario queda solo → no hay toggle, se muestra como fila individual |
| Grupo de 3+ inquilinos | Múltiples sub-filas expandidas bajo el primario |
| Grupo en mora + co-inquilino al día | Badge del grupo: "En mora". Badge del co-inquilino en sub-fila: "Al día" |
| Búsqueda por nombre de co-inquilino | El grupo aparece completo en resultados |
| Filtro "En mora" con grupo en mora | El grupo completo aparece; ambas filas visibles si ya está expandido |
| Paginación | Se pagina por grupos; un grupo de 2 ocupa 1 slot de página |

---

## Fuera de alcance (V1)

- Designación explícita del inquilino primario desde la UI.
- Animación de apertura/cierre del toggle.
- Agrupación en la página de detalle de una propiedad o contrato.
- Notificaciones o acciones en lote sobre el grupo.
