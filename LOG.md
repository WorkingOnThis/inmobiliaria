# LOG.md — Arce Administración

Registro de sesiones de trabajo. Más nueva arriba.

---

## Sesión 2026-04-23 — Unificación visual de KPI cards en Propiedades

### Qué hice

Actualicé el componente `KpiCard` en `src/components/properties/property-list.tsx` para que use el mismo patrón visual que las tarjetas de estadísticas de la lista de inquilinos.

**Antes:** `KpiCard` era un componente completamente custom con gradientes y colores hardcodeados via `style={{}}` inline (props `bgGradient`, `borderColor`, `valueColor`). No tenía iconos. El layout usaba `flex gap-3`.

**Después:**
- Usa `Card + CardContent` de shadcn con clases estándar (`rounded-xl border py-0 gap-0`, `p-4`)
- Layout interno `flex items-start justify-between` con un icono de Lucide en la esquina superior derecha
- Tipografía unificada: `text-xs font-medium text-muted-foreground uppercase tracking-wide` para el label, `text-3xl font-bold tabular-nums` para el número
- Colores del número via `valueClassName` (clase de Tailwind) en lugar de `style={{ color: ... }}`
- Layout externo cambiado a `grid grid-cols-2 gap-3 sm:grid-cols-4` — igual que inquilinos, más responsivo
- Iconos elegidos: `Building2` (total), `Key` (alquiladas), `CheckCircle2` (disponibles), `Tag` (en venta)

### Por qué lo hice así y no de otra forma

**`valueClassName` en lugar de `valueColor` con `style={{}}`:** los `style={{}}` inline rompen el sistema de diseño — no aprovechan las clases de Tailwind ni el modo oscuro. Con `valueClassName` el componente acepta cualquier clase de Tailwind, lo que es más consistente con el resto del proyecto.

**Saqué `bgGradient` y `borderColor` completamente:** los gradientes diferenciaban visualmente cada card, pero ese efecto "temático" es justamente lo que hacía que las propiedades se vieran distintas al resto de la app. El diseño de shadcn sin fondo personalizado es más limpio y consistente.

**`grid` en lugar de `flex`:** `flex` con `flex-1` en cada card funciona bien en desktop, pero en mobile los cuatro KPIs quedarían muy estrechos. `grid-cols-2 sm:grid-cols-4` es el mismo patrón que usan los inquilinos y se adapta mejor.

### Conceptos que aparecieron

- **Inline styles vs. clases de Tailwind:** `style={{ color: "var(--algo)" }}` y `className="text-[var(--algo)]"` producen el mismo resultado visual, pero las clases de Tailwind participan del sistema de purging y son más fáciles de inspeccionar en DevTools. Los inline styles solo tienen sentido cuando el valor es dinámico y calculado en runtime.
- **Sistema de diseño consistente:** cuando un componente usa su propio sistema de colores y tipografía (gradientes custom, tamaños de fuente únicos), se desconecta visualmente del resto aunque use los mismos tokens. La consistencia no es solo usar las mismas variables — es usar los mismos patrones de layout y composición.

### Preguntas para reflexionar

1. ¿Cuándo tiene sentido que un componente tenga su propio estilo custom vs. usar los patrones del sistema de diseño? ¿Hay casos donde el custom styling agrega valor real?
2. Las KPI cards de inquilinos no tienen color en el número del total (usa el color de texto por defecto), pero alquiladas, disponibles y en venta sí tienen colores. ¿Qué criterio usarías para decidir cuándo colorear un número en un KPI?

### Qué debería anotar en Obsidian

- [ ] Concepto: `style={{}}` inline vs. `className` — cuándo usar cada uno y por qué las clases de Tailwind son preferibles
- [ ] Patrón: KPI card con shadcn — `Card + CardContent`, icono en esquina, tipografía unificada
- [ ] Decisión técnica: `valueClassName` en lugar de `valueColor` — pasar clases en lugar de valores CSS raw

---

## Sesión 2026-04-23 — Módulo generador de documentos: markdown, variables libres, catálogo expandido y Parte Locadora

### Qué hice

Completamos el módulo de generador de documentos con cuatro bloques grandes:

**1. Catálogo de variables expandido** (`src/lib/document-templates/variables-catalog.ts`)
- De 16 variables pasamos a ~80. Nuevas categorías: `"administradora"` (razón social, CUIT, CBU, ciudad, provincia, etc.) y ampliación de `"propietario"`, `"inquilino"`, `"contrato"`.
- Aliases legales: `locador.*` y `locatario.*` apuntan a los mismos datos que `propietario.*` e `inquilino.*` — en los contratos argentinos se usan ambos términos.
- Fiadoras 1/2/3: 21 entradas que eran copy-paste se reemplazaron por un generador `[1,2,3].flatMap(...)`.
- Variables sin campo en el schema (ej: `propiedad.domicilio_calle`) retornan `null` con resolver declarado — el path ya existe, cuando se extienda el schema solo hay que actualizar el resolver.

**2. Markdown y variables de texto libre** (`src/lib/document-templates/render-segments.tsx`)
- Soporte de `**negrita**`, `*cursiva*`, `__subrayado__`, `# ## ### ####` (headers h3–h6) dentro del cuerpo de cláusulas.
- Variables de texto libre `{{nombre [default]}}`: no se resuelven desde el contrato sino desde un formulario que el usuario completa antes de imprimir. Se muestran en ámbar.
- `parseFreeTextVarsFromBodies(bodies[])`: extrae todas las `{{vars}}` únicas de una lista de cuerpos.

**3. Editor actualizado** (`src/app/(dashboard)/generador-documentos/[id]/document-template-editor.tsx`)
- Resaltado de sintaxis en el textarea: verde = variable resuelta, rojo = faltante, ámbar = texto libre, gris = `[[if:]]`.
- `FreeTextVarsPanel`: panel destacado en ámbar que aparece automáticamente en la columna de preview cuando hay `{{vars}}` en el documento.
- Panel de variables reorganizado en 6 grupos colapsables (propiedad, propietario/locador, inquilino/locatario, contrato, administradora, garantes/fiadoras).
- `CATALOG_BY_GROUP`: agrupación pre-calculada al cargar el módulo, evita filtrar el catálogo en cada render.

**4. Bug fix: Parte Locadora** (`src/app/api/document-templates/resolve/route.ts`)
- El bug: al cambiar el rol de un propietario de Legal a Real (y viceversa), el documento seguía mostrando el propietario viejo porque `resolve` usaba `contract.ownerId` fijo.
- El fix: `resolve` ahora busca quién tiene rol `"legal"` o `"ambos"` en la propiedad actual. Primero mira el propietario principal, luego los co-propietarios. Si nadie tiene rol legal, usa `contract.ownerId` como fallback.
- Optimización: el propietario principal se busca en Round 1 (paralelo), así en el 99% de los casos no hay round-trip extra. Solo se hace un fetch adicional cuando el locador es un co-propietario distinto.
- Badge "Parte Locadora" en la ficha de la propiedad, junto a quien tiene rol legal.

**Limpieza post-`/simplify`:**
- `isLegalRole = inLegal`: alias innecesario en `page.tsx`, eliminado.
- Doble guard en `FreeTextVarsPanel`: inner guard `vars.length === 0` removido (el call site ya lo guarda).
- `VARIABLES_CATALOG.filter()` en render: reemplazado por `CATALOG_BY_GROUP` calculado una vez.
- 21 entradas copy-paste de fiadoras: reemplazadas por `flatMap` con generador.

### Por qué lo hice así y no de otra forma

**Variables de texto libre como formulario, no como variables del contrato.** Podría haber creado un campo en el schema para cada dato faltante. Pero muchos datos son específicos de cada instancia del documento (ej: la fecha de firma exacta), no del contrato en general. El sistema `{{var}}` permite capturarlos en el momento de imprimir sin modificar la base de datos.

**Aliases locador/propietario en lugar de renombrar.** Los contratos argentinos usan "locador" en el texto legal pero "propietario" en el lenguaje de la inmobiliaria. En vez de elegir uno, los dos paths apuntan al mismo dato. El editor muestra ambos en el panel de variables.

**Parte Locadora desde la propiedad, no desde el contrato.** El `contract.ownerId` es un snapshot del momento en que se creó el contrato. Si cambian los roles después, el documento quedaría desactualizado. Al buscar en la propiedad actual, el documento siempre refleja la realidad vigente. La contrapartida es que si alguien cambia roles por error, el documento también cambia — pero eso es manejable con permisos.

**Round 1 + fetch condicional en el resolve API.** La alternativa más simple era siempre hacer dos rounds de DB. Pero en el 99% de los contratos el propietario principal es el legal, y ya teníamos su ID en `contractRow.ownerId`. Buscarlo en Round 1 (paralelo con todo lo demás) evita la latencia extra en el caso común.

### Conceptos que aparecieron

- **Backdrop textarea:** técnica para superponer HTML coloreado detrás de un `<textarea>` transparente. Un div "sombra" invisible crece el contenedor; un div "backdrop" con `dangerouslySetInnerHTML` muestra el HTML; el textarea encima tiene `color: transparent` pero `caretColor` visible. El scroll se sincroniza manualmente con `onScroll`.
- **Regex global con `lastIndex`:** las regex con flag `/g` guardan su posición en `lastIndex`. Si reutilizás la misma instancia (como `FREE_VAR_RE`) en múltiples llamadas, tenés que resetear `lastIndex = 0` antes de cada uso, si no, empieza desde donde terminó la vez anterior.
- **Two-round DB fetching:** cuando un query depende del resultado de otro, no podés paralelizarlos. La solución es buscar en Round 1 todo lo que no tiene dependencias (incluyendo datos que probablemente ya alcancen), y solo en Round 2 hacer el fetch condicional que depende de Round 1. En el caso feliz, Round 2 no tiene ese fetch extra.
- **Variables de plantilla vs. variables de contrato:** las `[[variables]]` se resuelven desde la base de datos (datos persistidos). Las `{{variables}}` se capturan en el momento de uso (datos efímeros, no persistidos). Son dos niveles distintos de "completar" un documento.
- **Generator pattern para catálogo:** cuando tenés N grupos de M campos idénticos (fiadoras 1/2/3 con apellido/dni/cuit/...), un `flatMap` con una función `mk(field, label, resolver)` evita 21 objetos literales casi iguales. El código dice "generá 7 campos para cada una de las 3 fiadoras" en vez de repetir 21 veces.

### Preguntas para reflexionar

1. Si un contrato tiene dos co-propietarios legales (ambos con rol "ambos"), el resolve toma el primero que encuentra. ¿Debería el sistema avisar que hay ambigüedad, o es suficiente con el orden de carga?
2. Las `{{variables de texto libre}}` son efímeras: si cerrás el editor, se pierden. Para un contrato real que vas a imprimir muchas veces (ej: copias para distintas partes), ¿tiene sentido persistirlas? ¿Dónde las guardarías sin romper la plantilla reutilizable?

### Qué debería anotar en Obsidian

- [ ] Patrón: Backdrop textarea para syntax highlighting — cómo superponer HTML coloreado sobre un textarea
- [ ] Concepto: Two-round DB fetching — cuándo paralelizar y cuándo necesitás secuenciar queries
- [ ] Decisión técnica: Variables efímeras {{}} vs. variables persistidas [[]] — por qué no guardamos los valores de texto libre en la DB
- [ ] Patrón: Generator con flatMap para catálogos repetitivos — reemplazar copy-paste de objetos literales
- [ ] Bug: Parte Locadora congelada en `contract.ownerId` — por qué resolver desde la propiedad actual y no desde el contrato

---

## Sesión 2026-04-21 — Modelo multi-rol de clientes y tenants sin contrato vigente

### Qué hice

Resolvimos dos problemas conectados: (1) un bug que hacía que Matías Konstantinides no apareciera en `/inquilinos` y (2) el diseño de cómo manejar clientes con múltiples roles simultáneos (alguien que cobra un alquiler como propietario y paga otro como inquilino).

**Bug fix:** el API de tenants filtraba por `client.type = "inquilino"` (español), pero el schema siempre usó inglés (`"tenant"`). Se normalizó a inglés en todos los routes. Se creó un script de migración de DB.

**Modelo multi-rol:** un cliente es una persona única con roles derivados de sus relaciones:
- `tenant` si tiene `type = "tenant"` o está en `contract_tenant`
- `owner` si tiene propiedades o contratos como propietario
- `guarantor` si está en `contract_guarantee`

**Tenants sin contrato activo:** ahora `/inquilinos` muestra tenants con contratos en cualquier estado. Nuevos estados: `pendiente_firma` (badge amarillo), `historico` (badge gris). No se calcula mora para esos estados.

**Selector de roles:** nuevo componente `ClientRolesBadges` que aparece en la ficha del inquilino y del propietario. Si la persona también tiene otro rol, muestra un chip clickeable que lleva a la otra vista.

**Archivos modificados:**
- `src/lib/tenants/status.ts` — nuevos estados `pendiente_firma` e `historico`
- `src/app/api/tenants/route.ts` — filtro por relación + tipo, inglés
- `src/app/api/tenants/[id]/route.ts` — sin filtro de tipo, contratos de cualquier status
- `src/app/api/tenants/[id]/movimientos/route.ts` — normalización de tipo
- `src/components/tenants/tenants-list.tsx` — nuevos badges y filtros
- `src/app/(dashboard)/inquilinos/[id]/page.tsx` — nuevos estados, bug fix de URL, integración de roles
- `src/app/(dashboard)/propietarios/[id]/page.tsx` — integración de roles

**Archivos nuevos:**
- `src/app/api/clients/[id]/roles/route.ts` — endpoint que devuelve roles derivados
- `src/components/clients/client-roles-badges.tsx` — badges cross-link entre roles
- `scripts/migrate-client-type-to-english.ts` — migración one-shot ya ejecutada

### Por qué lo hice así y no de otra forma

**No duplicamos clientes.** La alternativa era crear dos registros distintos para la misma persona (uno como propietario, otro como inquilino). Eso rompe la integridad: si cambia el teléfono, tenés que actualizar dos lugares y podés tener info desactualizada. En cambio, un cliente = una persona, y los roles se calculan desde las relaciones que ya existen (contratos, propiedades).

**Roles derivados, no almacenados.** La alternativa era guardar los roles en una tabla `client_role` o en un array en `client`. No lo hicimos porque agregar una tabla nueva requiere migración, y los roles ya están implícitos en las tablas de contratos y propiedades. Derivar evita sincronización manual.

**OR entre type y contract_tenant.** Matías tiene `type = "tenant"` pero todavía no está asignado a ningún contrato. La query pura por relación no lo hubiera mostrado. El OR entre tipo Y relación cubre ambos casos: clientes creados como tenants que todavía no tienen contrato, y clientes de otro tipo que son inquilinos por relación.

### Conceptos que aparecieron

- **Modelo polimórfico:** una sola tabla `client` representa personas con distintos roles. Los roles no se guardan en un campo fijo sino que se calculan desde las relaciones. Es más flexible pero requiere más queries.
- **Estado derivado vs. almacenado:** el estado de un inquilino (`activo`, `en_mora`, etc.) no se guarda en la base de datos — se calcula cada vez que se pide. Si se guardara, podría quedar desactualizado. Calcular es más trabajo pero siempre correcto.
- **Prioridad de contratos:** cuando un cliente tiene múltiples contratos (activo + uno histórico), ¿cuál mostramos? Asignamos un número de prioridad a cada status y elegimos el más relevante. Es una regla de negocio arbitraria pero explícita.
- **OR condition en Drizzle:** `or(eq(campo, valor1), inArray(campo, lista))` combina dos condiciones de filtro con OR. SQL equivalente: `WHERE type = 'tenant' OR id IN (...)`.

### Preguntas para reflexionar

1. ¿Qué pasa cuando alguien fue inquilino, se terminó su contrato, y dos años después es inquilino en otro lugar con la misma agencia? ¿Cómo distinguís el historial del primer contrato del segundo?
2. Si un cliente tiene rol `tenant` por `type` pero nunca se le asigna un contrato, ¿debería aparecer en la lista para siempre o hay un momento donde "caduca" ese rol?

### Qué debería anotar en Obsidian

- [ ] Concepto: Modelo polimórfico — una tabla, múltiples roles derivados de relaciones
- [ ] Decisión técnica: Roles derivados vs. almacenados — por qué no usamos tabla `client_role`
- [ ] Patrón: OR condition para "tipo declarado" + "relación existente" en queries de listado
- [ ] Bug: `client.type = "inquilino"` (español) vs. `"tenant"` (inglés) — cómo detectar este tipo de inconsistencia en el futuro

---

## Sesión 2026-04-20 — Ficha de contrato con tabs y schema de participantes

### Qué hice

Construí tres capas: schema, API y UI.

**Schema** — Tres tablas nuevas en PostgreSQL aplicadas con `db:push`:
- `contract_participant` — vincula un contrato con un cliente en un rol (owner/tenant/guarantor). Reemplaza a `contract_tenant`.
- `contract_guarantee` — registra garantías personales (cliente) o reales (propiedad interna o externa con campos libres).
- `contract_document` — almacena archivos adjuntos al contrato (PDF, JPG, PNG guardados en `/public/uploads/contracts/[id]/`).

**API** — Ocho endpoints nuevos (`POST/DELETE` para participants, guarantees y documents). Se extendió el `GET /api/contracts/[id]` para devolver los tres arrays nuevos, y el `PATCH` para ejecutar la lógica de activación: cuando el status cambia a "active", busca los participantes con role="tenant" y setea `client.type = 'tenant'` en la DB.

El `POST /api/contracts` (crear contrato) ahora escribe en `contractParticipant` en vez de `contract_tenant`. El `GET /api/contracts` (lista) también lee de la tabla nueva.

**UI** — Cuatro tabs en la ficha `/contratos/[id]`: Partes, Operativo, Documentos, Datos para documentos. El contenido previo (condiciones, cláusulas, acta, actividad, servicios) quedó en el tab Operativo sin tocar. Los tres tabs nuevos son componentes propios.

También se extendió el formulario de creación de contrato con una sección de garantes (combobox con búsqueda + popup "Crear nueva persona").

### Por qué lo hice así y no de otra forma

- **No reescribí el contrato-detail.tsx de cero**: tiene 1310 líneas con lógica compleja de edición inline. Envolverlo en tabs con un fragmento condicional fue mucho más seguro que extraerlo todo.
- **`contractParticipant` reemplaza `contract_tenant`** en código nuevo, pero deja la tabla vieja declarada en el schema sin eliminarla — así no rompemos nada hasta confirmar que ninguna consulta depende de ella.
- **Enums en inglés en código nuevo** (`owner/tenant/guarantor`), sin migrar los datos existentes en español. Es una deuda técnica documentada.
- **Archivos en `/public/uploads/`**: suficiente para MVP. Para producción real habría que usar S3 o similar.

### Conceptos que aparecieron

- **discriminated union en TypeScript**: el schema de Zod para garantías usa `z.discriminatedUnion("type", [...])` — el tipo depende del valor de un campo específico (`"personal"` o `"real"`). Drizzle ORM no lo acepta directo en el `insert`, tuvimos que construir el objeto de forma condicional.
- **Fragment de React (`<>...</>`)**: cuando un componente necesita devolver múltiples elementos sin un div contenedor. Lo usamos para envolver todo el contenido del tab Operativo en un solo bloque condicional.
- **`useSearchParams` + `router.replace`**: patrón para guardar el tab activo en la URL (`?tab=partes`). Permite compartir el link y que el botón atrás del navegador funcione.
- **`$defaultFn(() => crypto.randomUUID())`**: forma de decirle a Drizzle que genere el ID automáticamente al insertar, sin pasarlo desde el código.
- **shadcn `AlertDialog`**: componente de confirmación modal antes de ejecutar una acción destructiva (ej: eliminar documento). Diferente al `alert()` nativo del browser: es accesible y estilizable.

### Preguntas para reflexionar

1. ¿Por qué conviene guardar el tab activo en la URL (`?tab=`) en vez de en estado local del componente (`useState`)?
2. Si `contract_tenant` y `contractParticipant` tienen datos distintos (datos viejos en la vieja, datos nuevos en la nueva), ¿qué pasa cuando alguien abre un contrato viejo en la ficha nueva?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: `useSearchParams` + `router.replace` como forma de sincronizar UI state con la URL
- [ ] **Patrón**: wrapping condicional de tabs con fragment (`<>`) en componentes grandes sin refactorizar
- [ ] **Decisión técnica**: reemplazar tabla legacy (`contract_tenant`) gradualmente en código nuevo, sin migración de datos ni borrado de la tabla vieja
- [ ] **Bug**: discriminated union de Zod no es compatible directamente con Drizzle `insert` — hay que construir el objeto condicionalmente
- [ ] **Concepto**: `$defaultFn` en Drizzle vs. generar el UUID en el handler de la API

---

## Sesión 2026-04-17 — Migración shadcn/ui: lista e inquilinos

### Qué hice

Audité y migré los componentes custom del módulo **inquilinos** (lista + ficha) para que usen componentes de shadcn/ui en lugar de markup manual.

**Auditoría (agente `shadcn-migration-auditor`):**
- Lista: 6 componentes encontrados (1 alto, 1 medio, 4 bajo)
- Ficha: 16 piezas encontradas en 5 archivos (1 alto, 5 medio, 9 bajo + 1 ya migrado)

**Componentes instalados esta sesión:**
- `Progress` (`src/components/ui/progress.tsx`)
- `Alert` (`src/components/ui/alert.tsx`)

**Migraciones completadas — lista (`inquilinos-list.tsx`):**
- `StatusBadge`: `w-1.5 h-1.5` → `size-1.5`
- `EntityAvatar`: removido `"use client"` innecesario (sin hooks ni browser APIs)
- `ProgressBar` inline: `div` manual → `Progress` de shadcn con selector `[&>[data-slot=progress-indicator]]` para el color condicional
- `EstadoBadge` inline + 9 íconos: `h-N w-N` → `size-N`
- `ClientPagination`: ternarios de className → `cn()`, `let endPage` → `const`
- 4 KPI cards: `div rounded-xl` → `Card + CardContent`
- Estado de error: `div` manual → `Alert variant="destructive"`

**Migraciones completadas — ficha (`page.tsx` + 4 tabs):**
- `page.tsx`: avatar `w-14 h-14` → `size-14`, spinner `h-8 w-8` → `size-8`, mapa `estadoBadge` de `{cls}` a `{variant}`, 4 `<span>` badges → `StatusBadge`/`Badge`
- `inquilino-tab-cuenta-corriente.tsx`: alerta mora → `Alert`, 3 KPI cards → `Card`, historial → `Card + CardHeader + CardAction`, tabla HTML plana → `Table/*`, badges de tipo → `StatusBadge`, template literals → `cn()`
- `inquilino-tab-contrato.tsx`: mapa `statusLabel` de `{cls}` a `{variant}`, badge de estado → `StatusBadge`, resumen de contrato → `Card + CardHeader + CardContent`
- `inquilino-tab-propiedad.tsx`: datos de propiedad → `Card + CardHeader + CardContent`
- `inquilino-tab-propietario.tsx`: ya estaba migrado, sin cambios

**Pendiente (riesgo medio, sesión siguiente):**
- `TabsNavegacion` inline en `page.tsx`: requiere instalar `Tabs` de shadcn y decidir si mantener estado en URL
- `SelectFiltroMovimientos` inline en `inquilino-tab-cuenta-corriente.tsx`: `<select>` nativo → shadcn `Select` (adaptar `onChange` → `onValueChange`)
- `MiniCardContrato`, `MiniCardPropiedad`, `MiniCardPropietario`: tienen handlers de navegación/callback

### Por qué lo hice así y no de otra forma

**Patrón `{cls}` → `{variant}`:** los mapas de estado (estadoBadge, statusLabel) guardaban strings de clases CSS crudas como `"bg-error/10 text-error border-error/20"`. Eso duplica responsabilidad: el componente decide el color Y el mapa lo repite. Al pasar a `{variant}`, el color queda en `badge.tsx` una sola vez.

**`CardAction` para el select del historial:** el `CardHeader` de shadcn tiene un selector CSS `has-data-[slot=card-action]` que activa automáticamente un layout de 2 columnas cuando está presente un `CardAction`. Lo usé para el filtro de movimientos en lugar de un `flex justify-between` manual.

**No toqué los tabs:** `TabsNavegacion` sincroniza el tab activo con la URL via `router.replace`. El componente `Tabs` de shadcn maneja estado interno por defecto. Para preservar la URL sync habría que usar el modo controlado (`value`/`onValueChange`). Es una decisión de arquitectura, no un fix mecánico — quedó para la próxima sesión.

**`"use client"` removido de `EntityAvatar`:** el componente no usa hooks, router ni browser APIs. Solo calcula un string de CSS variable y renderiza. Quitarlo lo convierte en Server Component, que se renderiza en el servidor y no se incluye en el bundle del cliente.

### Conceptos que aparecieron

- **`size-*` vs `w-* h-*`**: `size-4` es lo mismo que `w-4 h-4` pero en una sola clase. La regla del proyecto es usar `size-*` cuando ancho y alto son iguales.
- **`cn()` para clases condicionales**: función utilitaria del proyecto que combina clases de forma segura. Reemplaza template literals (`\`clase ${condicion ? "a" : "b"}\``) por `cn("clase", condicion ? "a" : "b")`.
- **Server Component vs Client Component**: en Next.js, un componente sin `"use client"` se renderiza en el servidor. Solo necesita `"use client"` si usa hooks (`useState`, `useEffect`, etc.), router, o APIs del browser (`window`, `document`).
- **`[&>[data-slot=progress-indicator]]`**: selector CSS de Tailwind que apunta al hijo directo con `data-slot="progress-indicator"`. Así se puede cambiar el color del indicador del `Progress` de shadcn sin modificar el componente.
- **`CardAction`**: subcomponente de `Card` que shadcn posiciona automáticamente a la derecha usando CSS Grid con selector `has-data-[slot=card-action]`.
- **Blast radius**: el "radio de explosión" de un cambio. Un bug en `InquilinosList` deja a todos los usuarios sin ver la lista; un bug en `StatusBadge` es invisible si no se usa ese estado.

### Preguntas para reflexionar

1. ¿Por qué es mejor que el color del badge viva en `badge.tsx` y no en el mapa que define cada estado del dominio?
2. Si `EntityAvatar` es ahora un Server Component pero se usa dentro de `InquilinosList` que tiene `"use client"`, ¿cómo decide Next.js dónde renderizar `EntityAvatar`?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: `cn()` — qué es, para qué sirve, y por qué es mejor que template literals en className
- [ ] **Concepto**: Server Components vs Client Components en Next.js — cuándo usar `"use client"` y cuándo no
- [ ] **Patrón**: `{cls}` → `{variant}` — cómo centralizar estilos de estado en el sistema de diseño
- [ ] **Concepto**: `size-*` y otras utilidades de Tailwind que condensan dos clases en una

---

## Sesión 2026-04-15 — Módulo de contratos: lista + ficha alineadas al wireframe

### Qué hice

Reescribí los dos componentes principales del módulo de contratos (`contratos-list.tsx` y `contrato-detalle.tsx`) para que se parezcan al máximo a los wireframes aprobados.

**Lista de contratos:**
- 5 KPI cards con los colores del sistema de diseño (vigentes accent, por vencer mustard, en redacción info, pend. firma neutral, vencidos error)
- Toolbar combinado: búsqueda libre + chips de estado en una sola barra
- Chips actualizados: Todos / Activos / Por vencer / En redacción / Pend. firma / Vencidos / Rescindidos
- Tabla con 8 columnas: N° (mono), Propiedad, Inquilino (con avatar iniciales), Propietario (con avatar), Vigencia (fecha + días restantes con color), Monto actual (importe + índice), Estado (tag pill), Acciones (↓ PDF visible al hover)
- Filas con borde izquierdo mustard para "por vencer", rojo para "vencido", y opacidad para "rescindido"

**Ficha de contrato:**
- Stepper de 5 pasos (visible solo para draft y pending_signature)
- Alert banner contextual según estado
- 4 KPI cards (alquiler base, depósito, duración, día de pago)
- Partes firmantes con avatares, roles y badge de estado de firma
- Sección de Cláusulas (estática por ahora)
- Acta de entrega checklist + Timeline de actividad en grid 2 columnas
- Footer de acciones contextual según estado del contrato

**API:**
- Agregué `adjustmentIndex` y `adjustmentFrequency` al response del GET /api/contracts
- Agregué soporte para `status=activos` (filtra active + expiring_soon en la DB)

### Por qué lo hice así y no de otra forma

Reescritura total en lugar de edición incremental porque la estructura del JSX era incompatible con el wireframe (layouts completamente distintos). Mantuve toda la lógica de datos intacta: mutations, queries, edición inline de condiciones y partes — solo cambié la presentación visual.

Para los colores usé las CSS variables del sistema de diseño ya definidas (`--primary-dim`, `--mustard-dim`, `--info-dim`, `--error-dim`, `--green-dim`) en lugar de hardcodear valores, para que funcionen tanto en modo claro como oscuro.

### Conceptos que aparecieron

- **Stepper de proceso**: componente visual que muestra en qué paso de un flujo está un elemento. Cada paso puede estar `done` (completado), `active` (en curso) o `pending` (futuro). Es como una barra de progreso pero con etiquetas descriptivas en cada punto.
- **CSS variables en Tailwind v4**: con `@theme inline` y `--color-xxx`, Tailwind genera clases como `bg-mustard-dim` o `text-green` que apuntan a las variables CSS. Podés usarlas directamente sin escribir el valor hex.
- **Group hover**: clase `group` en el `<tr>` y `group-hover:opacity-100` en el botón de acción del row — el botón ↓ solo aparece cuando el mouse está sobre la fila.
- **Filtro compuesto en Drizzle ORM**: `inArray(contract.status, ["active", "expiring_soon"])` para filtrar varios valores en una sola condición, equivalente a `WHERE status IN ('active', 'expiring_soon')`.

### Preguntas para reflexionar

1. ¿Por qué el wireframe separa "En redacción" de "Borrador" siendo el mismo estado en la DB? ¿Tiene sentido distinguirlos visualmente?
2. El timeline de actividad es estático hoy — ¿cuándo conviene agregar una tabla de eventos reales en la DB vs. derivar el estado del propio contrato?

### Qué debería anotar en Obsidian

- [ ] Concepto: Stepper de proceso (cuándo usarlo, cómo modelarlo visualmente)
- [ ] Patrón: Group hover en tablas con acciones por fila
- [ ] Decisión técnica: Reescritura total vs. edición incremental de un componente visual

---

## Sesión2 2026-04-13 (tarde) — Lista de propiedades: rebuild + modal de nueva propiedad

### Qué hice

Rehice la página `/propiedades` para que coincida con el wireframe `wireframe_lista_propiedades.html`, con tres ajustes específicos del usuario:

**API (`src/app/api/properties/route.ts`)**
- Agregué el filtro `?zone=` para buscar por barrio
- Extendí la búsqueda (`?search=`) para que también filtre por `zone`, `client.firstName` y `client.lastName` (antes solo buscaba en `title` y `address`)
- Agregué info de contrato activo por propiedad: una segunda query trae el contrato más reciente (activo, expirando, pendiente de firma o borrador) de cada propiedad de la página, y lo mergea al response como `contractNumber`, `contractEndDate`, `contractStatus`

**Popup de nuevo propietario (`src/components/properties/create-owner-popup.tsx`)**
- Componente nuevo: formulario mínimo con `Nombre*` (obligatorio), DNI y WhatsApp (opcionales)
- Aparece encima del modal con `z-[200]` y backdrop con blur
- Al guardar hace POST `/api/clients` y llama un callback `onCreated()` para que el form padre seleccione automáticamente el propietario recién creado

**Formulario rápido (`src/components/properties/quick-property-form.tsx`)**
- Eliminé el campo Superficie — ese dato se completa en la ficha de la propiedad
- Limité los resultados del buscador de propietario a 3 (era 5)
- "Crear nuevo propietario" ahora aparece siempre como última opción del dropdown (antes solo aparecía cuando no había resultados)
- Reemplacé el formulario inline de contacto por el nuevo `CreateOwnerPopup`
- Al crear una propiedad ahora redirige a `/propiedades/{id}` (antes al tablero)

**Lista principal (`src/components/properties/property-list.tsx`)**
- KPI cards: cada una con su propio color — Total (terracotta), Alquiladas (verde), Disponibles (mustard), Mantenimiento (naranja)
- Chips de filtro: cada estado activo muestra su propio color (antes todos usaban el primary terracotta)
- Filtro barrio: fila secundaria debajo del toolbar, debounced, sincronizado con URL params
- Columna "Contrato activo": muestra datos reales — número en monospace, fecha de vencimiento, alerta en mustard si quedan ≤60 días, azul para contratos pendientes de firma
- Botón "+ Nueva propiedad": más grande y prominente (sombra suave, padding mayor, icono más grande)
- Reemplacé el Drawer por un Dialog/Modal centrado (más fiel al wireframe)
- Columna "Acciones": botón "Ver →" que aparece en hover por cada fila
- Título de propiedad: fallback a `address` si `title` está vacío

---

### Por qué lo hice así y no de otra forma

**El contrato: segunda query en vez de N+1**
Podría haber hecho un query por cada propiedad para buscar su contrato. Eso se llama N+1: si hay 8 propiedades en la página, son 8 queries extra. En cambio hice una sola query con `WHERE propertyId IN (ids_de_la_página)` — siempre 1 query sin importar cuántas propiedades haya. Es el patrón estándar para este tipo de joins opcionales.

**El popup encima del modal: z-index manual**
React renderiza los elementos en capas (como papeles apilados). Para que el popup de nuevo propietario aparezca encima del modal de nueva propiedad, necesitaba un `z-index` más alto. El modal de shadcn/ui usa `z-50` internamente. Puse `z-[200]` en el popup, que en Tailwind es una notación para valores arbitrarios.

**Drawer → Dialog**
El Drawer (cajón que se desliza desde el costado) es útil para formularios de edición donde querés ver el fondo. El wireframe muestra un modal centrado clásico, que es más adecuado para un alta rápida (el contexto previo no importa tanto). Cambié a `Dialog` de shadcn/ui sin tocar la lógica interna del formulario.

---

### Conceptos que aparecieron

- **N+1 queries**: patrón a evitar donde por cada ítem de una lista hacés un query extra a la base de datos. Se resuelve con `IN (...)` o con joins.
- **z-index**: propiedad CSS que controla el orden de apilamiento visual. Números más altos aparecen encima de números más bajos.
- **Debounce**: técnica para "esperar que el usuario termine de escribir" antes de ejecutar una acción costosa (como un fetch). Si el usuario escribe rápido, cancelas el timer anterior y empezas uno nuevo.
- **URL-driven state**: guardar el estado de los filtros en la URL (`?status=rented&zone=Alberdi`). Permite compartir el link y mantener el estado al recargar la página.
- **`as const`**: en TypeScript, marca un array o objeto como "immutable y de tipo literal". Permite que TypeScript infiera tipos exactos en vez de tipos genéricos (`"active"` en vez de `string`).

---

### Preguntas para reflexionar

1. ¿Por qué cuando filtrás por barrio y después hacés una búsqueda general, los dos filtros se aplican juntos? ¿Cómo lo maneja el código?
2. Si en el futuro quisieramos ordenar la tabla por estado o por fecha de vencimiento del contrato, ¿qué parte del código habría que tocar?

---

### Qué debería anotar en Obsidian

- [ ] **Patrón: Evitar N+1 con IN (...)** — `tag: patron/pr` — Cómo traer datos relacionados de forma eficiente: una sola query con `WHERE id IN (lista)` en vez de una query por ítem
- [ ] **Concepto: z-index y stacking context** — `tag: concepto/pr` — Cómo funciona el apilamiento de elementos en CSS y por qué no siempre alcanza con poner un número alto

---

## Sesión 2026-04-13 — Módulo Propiedades: lista mejorada + ficha completa

### Qué hice

- **Lista de propiedades** (`property-list.tsx`): corregí los colores de los tags de estado para que coincidan con el wireframe (verde = alquilada, mostaza = disponible, naranja = mantenimiento, azul = reservada). Agregué borde izquierdo de color en las filas según el estado. Hice cada fila clickeable para navegar a la ficha individual (`/propiedades/[id]`).
- **Constantes** (`lib/properties/constants.ts`): agregué `"maintenance"` como estado válido en `PROPERTY_STATUSES`, que antes estaba incompleto y rompía el filtro de la lista.
- **API GET `/api/properties`**: agregué el count de `maintenance` al objeto de respuesta que ya lo pedía el front pero nunca llegaba.
- **API nueva `GET /api/properties/[id]`**: devuelve todos los datos de una propiedad con JOIN al propietario (client). También implementé `PATCH /api/properties/[id]` para editar desde la ficha.
- **Ficha de propiedad** (`/propiedades/[id]/page.tsx`): nueva página completa con:
  - Header con ícono por tipo de propiedad, dirección, status badge y 4 widgets (propietario clickeable → lleva a su ficha, contrato activo placeholder, superficie, tareas placeholder).
  - 7 tabs: **Personas vinculadas** (propietario con card clickeable + placeholders para inquilino y garantes), **Datos** (vista + modo edición con form), **Contratos** (placeholder), **Servicios / Mantenimiento / Documentos / Tareas** (placeholders deshabilitados, para desarrollar).

### Por qué lo hice así y no de otra forma

- **Una página por entidad, no un slide panel**: el wireframe lo plantea así. Un slide panel tiene espacio limitado; la ficha necesita tabs, widgets en el header y edición inline — cosas que necesitan toda la pantalla.
- **Placeholder tabs deshabilitados** en lugar de omitirlos: el usuario pidió explícitamente dejar los tabs en su lugar para desarrollarlos después. Un tab deshabilitado muestra la estructura futura sin engañar al usuario con una pantalla rota.
- **Edición inline en el tab Datos** en lugar de un modal separado: el wireframe tiene el botón "Editar" en el topbar y activa/desactiva los campos del tab. Esto mantiene el contexto visible mientras editás.
- **`PATCH` con solo los campos presentes**: en lugar de mandar todo el objeto, mando solo lo que cambió. Esto evita pisar datos con `undefined` si el schema crece.

### Conceptos que aparecieron

- **Dynamic route en Next.js** (`/propiedades/[id]`): la carpeta `[id]` es una convención de Next.js que dice "cualquier cosa en este segmento de la URL es un parámetro". Es como un comodín. Dentro del componente lo leés con `useParams()`.
- **PATCH vs PUT**: PUT reemplaza el recurso completo, PATCH modifica solo los campos que mandás. Usamos PATCH porque queremos actualizar solo algunos campos sin pisar el resto.
- **`Promise<{ id: string }>`** en params del route handler: en Next.js 15, los params llegaron a ser asíncronos. Hay que hacer `await params` antes de leer el `id`. Es un cambio de Next.js 14 → 15.
- **LEFT JOIN en Drizzle**: cuando hacemos `db.select().from(property).leftJoin(client, ...)`, le decimos a la base de datos "traeme la propiedad aunque no encuentres el cliente asociado". Si fuera `innerJoin`, una propiedad sin propietario directamente no aparecería en los resultados.
- **`countsMap`**: en la API de lista, agrupamos por status con `GROUP BY` y construimos un mapa `{ rented: 5, available: 3, ... }`. Antes faltaba `maintenance` en ese mapa porque no estaba en las constantes — el contador siempre daba 0 aunque hubiera propiedades en mantenimiento.

### Preguntas para reflexionar

1. ¿Por qué una propiedad en la DB tiene `ownerId` que apunta a `client` en lugar de tener su propio concepto de "Propietario"? ¿Qué ventaja y qué desventaja tiene unificar propietarios, inquilinos y garantes en una sola tabla `client`?
2. El tab "Contratos" hoy es un placeholder. Cuando lo desarrolles, ¿qué datos necesitarías agregar al schema para representar un contrato de alquiler argentino?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Dynamic routes en Next.js (`[id]` folder) — qué son, cómo se leen con `useParams`, cómo conviven con routes estáticas
- [ ] **Decisión técnica**: Por qué usamos PATCH y no PUT para actualizar propiedades — diferencia semántica y práctica
- [ ] **Patrón**: Ficha de entidad con tabs en Next.js App Router — cómo manejar el tab activo con `useSearchParams` + `router.replace` para que el estado sobreviva a un refresh

---

## Sesión 2026-04-13 — Módulo Control de Servicios

### Qué hice

Implementé el módulo completo de **Control de Servicios** desde cero:

- **Schema de base de datos** (`src/db/schema/servicio.ts`): 3 tablas nuevas: `servicio` (configuración por propiedad), `servicioComprobante` (una entrada por período cuando se carga el recibo), y `servicioOmision` (cuando el staff decide omitir el bloqueo con justificación).
- **Constantes** (`src/lib/servicios/constants.ts`): tipos de servicio, labels, íconos emoji, estados, y una función `calcularEstadoServicio()` que determina si un servicio está al día, pendiente, en alerta o bloqueado.
- **5 API routes**: `/api/servicios` (listar/crear), `/api/servicios/[id]` (detalle/editar), `/api/servicios/[id]/comprobante` (cargar recibo), `/api/servicios/[id]/omitir-bloqueo` (bypass del bloqueo con motivo), `/api/servicios/resumen` (KPIs para el dashboard).
- **Vista global** `/servicios`: página con selector de período, 4 KPI cards, leyenda de estados, búsqueda, filtros por estado, y tabla de propiedades con chips de servicio coloreados.
- **Tab en la ficha de propiedad** (`ServicioTabPropiedad`): lista de servicios con cards clickeables, alerta visible si hay servicios vencidos.
- **Drawer de detalle** (`ServicioDrawerDetalle`): panel lateral con estado del período, formulario de carga de comprobante, toggle de obligatoriedad, historial de comprobantes, y sección de omisión de bloqueo.
- **Formulario nuevo servicio** (`ServicioFormNuevo`): picker de tipo con iconos, campos de empresa/cuenta/titular, toggle de bloqueo.
- Migración aplicada a la base de datos con `bun run db:push`.
- Build TypeScript sin errores.

### Por qué lo hice así y no de otra forma

**Por qué 3 tablas separadas en vez de una sola:**
Cada tabla tiene un ciclo de vida y un propósito distintos. `servicio` es la configuración permanente (cambia poco). `servicioComprobante` se crea una vez por mes cuando alguien sube el recibo. `servicioOmision` es un evento de auditoría excepcional que el staff registra con un motivo. Mezclar todo en una sola tabla haría las consultas más complicadas y los datos menos claros.

**Por qué el estado se calcula en el backend (no se guarda):**
El estado depende de *cuántos días pasaron desde el inicio del período* — eso cambia todos los días. Si lo guardaras en la base de datos tendrías que actualizarlo constantemente. Es más limpio calcularlo al momento de leer.

**Por qué el tab de servicios en la ficha de propiedad es un componente separado:**
El wireframe muestra que el tab vive dentro de la ficha de propiedad. No creamos la ficha completa en esta sesión (ya existe `/propiedades/[id]`), pero el tab queda listo para embeber cuando se agregue esa pantalla.

**Por qué el drawer usa `vaul` (el componente Drawer ya existente):**
El proyecto ya usa `vaul` para los drawers en propiedades. Reutilizar el mismo componente mantiene consistencia visual y de comportamiento.

### Conceptos que aparecieron

- **Schema Drizzle ORM**: es como el "plano de la base de datos". Cada `pgTable(...)` es una tabla. Los campos son las columnas. Las FK (foreign keys) son como referencias entre tablas — "este campo apunta a ese otro registro".
- **Migración**: cuando modificás el schema, la migración es el SQL que lleva la base de datos del estado anterior al nuevo. `db:generate` la crea, `db:push` la aplica.
- **Estado calculado vs. estado persistido**: algunos datos se pueden derivar de otros en el momento de consultarlos. No siempre conviene guardar un valor que puede quedar "viejo" — a veces es más confiable calcularlo fresco.
- **Mutation (TanStack Query)**: `useMutation` es para operaciones que modifican datos (POST, PUT, DELETE), a diferencia de `useQuery` que es para leer. Después de mutate, se invalidan las queries para que la UI se refresque.
- **`as const`**: en TypeScript, `["a", "b"] as const` crea un array donde los valores son tipos fijos, no solo strings genéricos. Permite derivar tipos (`typeof ARRAY[number]`) que el compilador puede verificar.

### Preguntas para reflexionar

1. ¿Cuándo conviene calcular un valor al momento de consultar versus guardarlo en la base de datos? ¿Cuál es el criterio para elegir?
2. El drawer de detalle hace varias llamadas a la API (una por servicio cuando se abre). ¿Cómo cambiaría esto si tuvieras miles de propiedades? ¿Habría algún problema de rendimiento?

### Qué debería anotar en Obsidian

- [ ] **Patrón**: "Estado calculado en backend" — cómo y cuándo calcular estados derivados en lugar de persistirlos (`calcularEstadoServicio` en `src/lib/servicios/constants.ts`)
- [ ] **Concepto**: "Migración de base de datos" — qué es, cuándo se genera, cómo se aplica con Drizzle
- [ ] **Decisión técnica**: "3 tablas vs 1 tabla para servicios/comprobantes/omisiones" — por qué separar entidades con ciclos de vida distintos
- [ ] **Patrón**: "Módulo completo en Next.js App Router" — la receta de 7 pasos: schema → constantes → permisos → API routes → página → componentes → navegación

---

## Sesión 2026-04-13 — Módulo Propietarios: Lista + Ficha + Cuenta Corriente

### Qué hice

Construí el módulo de propietarios completo desde los wireframes:

1. **Schema**: agregué `cuit` y `status` ("activo" | "suspendido" | "baja") a la tabla `client`. Apliqué con `db:push`.

2. **4 endpoints nuevos** en `src/app/api/propietarios/`:
   - `GET /api/propietarios` — lista con filtro por status, búsqueda cross (nombre/DNI/tel/dirección de propiedad), conteo de propiedades y contratos activos
   - `GET/PATCH /api/propietarios/[id]` — ficha completa + edición
   - `GET /api/propietarios/[id]/cuenta-corriente` — KPIs + movimientos agrupados
   - `POST /api/propietarios/[id]/movimientos` — registrar crédito/débito manual

3. **Lista redeseñada** (`propietarios-list.tsx`): search bar con dropdown, filter pills Activos/Inactivos/Todos, tabla con avatares y badges, slide-out panel al hacer click en una fila, modal de alta rápida.

4. **Slide panel** (`propietario-slide-panel.tsx`): panel lateral que muestra cuenta corriente resumida del propietario seleccionado.

5. **Ficha del propietario** (`/propietarios/[id]`): header con avatar + barra de completitud con chips clicables, tabs (Datos / Cuenta Corriente / Propiedades deshabilitado / Documentos deshabilitado).

6. **Tab Datos**: cards de datos personales y bancarios con modo edición inline, card de estado, danger zone con confirmación para suspender/dar de baja.

7. **Tab Cuenta Corriente**: 3 KPIs, tabla de movimientos agrupados por período, FAB flotante con modales para generar liquidaciones y agregar movimientos manuales.

### Por qué lo hice así y no de otra forma

- **Standalone Route Handlers** (no ElysiaJS): el proyecto ya los usaba para `clients`, `properties`, `inquilinos`. Seguir el mismo patrón mantiene coherencia y evita mezclar paradigmas.
- **Reutilizar tabla `client` con `type="propietario"`**: la BD ya estaba diseñada así. Crear una tabla separada sería duplicar columnas innecesariamente.
- **Búsqueda cross por propiedad**: en lugar de un full-text search, hice dos consultas (matches directos + matches por propiedad) y las uní en el servidor. Es claro y fácil de mantener.
- **`db:push` en lugar de `db:migrate`**: las tablas ya existían (creadas antes con push). El archivo `0000` de migrate intentaba CREATE ALL, que falla si las tablas ya existen. Push detecta solo el diff.
- **`useState` + fetch directo** en los modales de cuenta corriente: sin Eden Treaty porque los endpoints nuevos son standalone Route Handlers, no ElysiaJS. TanStack Query maneja el caché.

### Conceptos que aparecieron

- **Schema migration vs push**: migration es un historial de cambios que se aplica en orden (bueno para producción). Push es "llevá la base a este estado ahora" (solo para desarrollo). Usar push cuando ya hay tablas y no hay historial previo evita el error de "tabla ya existe".
- **Route Handler standalone vs ElysiaJS**: dos formas de definir APIs en Next.js App Router. Los standalone son archivos `route.ts` en carpetas de `app/api/`. ElysiaJS es un framework de servidor que vive en un catch-all `[[...slugs]]`. Se pueden usar juntos.
- **Búsqueda cross-tabla**: buscar en datos de otra tabla relacionada. En SQL sería un JOIN + WHERE. Con Drizzle ORM se hace con `innerJoin` o con dos queries separadas.
- **FAB (Floating Action Button)**: botón circular flotante en la esquina inferior, común en apps móviles. Se expande para mostrar sub-acciones.
- **Optimistic update**: mostrar el resultado en la UI antes de que el servidor confirme. Acá lo usé de forma simple: marcar la fila nueva con tag "Nuevo" después de crear y esperar 8 segundos.
- **Barra de completitud**: medir qué tan lleno está un formulario asignando pesos distintos a cada campo (CBU tiene más peso porque es crítico para liquidar).

### Preguntas para reflexionar

1. El endpoint `GET /api/propietarios` hace 3 consultas (propietarios, conteo de propiedades, conteo de contratos) por cada listado. ¿Cuándo se volvería lento esto? ¿Qué herramienta existe para hacerlo en una sola consulta?
2. La barra de completitud calcula el porcentaje en el frontend. ¿Qué ventajas y desventajas tiene calcularlo en el servidor?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Migration vs Push en Drizzle ORM — cuándo usar cada uno y por qué
- [ ] **Patrón**: Búsqueda cross-tabla (buscar propietario por dirección de su propiedad) — dos queries + merge en servidor
- [ ] **Concepto**: Standalone Route Handlers en Next.js App Router — cómo funcionan y cuándo usarlos
- [ ] **Decisión técnica**: reutilizar tabla `client` polimórfica vs tabla separada por tipo de persona
- [ ] **Concepto**: TanStack Query `queryKey` — cómo funciona el caché y cuándo se invalida

---

## Sesión 2026-04-13 — Contratos: condiciones editables, servicios, índices custom

### Qué hice

- Agregué `adjustmentFrequency` (frecuencia de ajuste) al schema de contratos: cuántos meses pasan entre cada actualización del índice (mensual, trimestral, semestral, anual, etc.)
- Agregué 6 campos de responsabilidad de servicios al schema de propiedades: `serviceLuz`, `serviceGas`, `serviceAgua`, `serviceMunicipalidad`, `serviceRendas`, `serviceExpensas`. Cada uno puede ser "inquilino", "propietario" o "na" (no aplica).
- Creé la tabla `customAdjustmentIndex` para guardar índices de ajuste personalizados (además de los estándar ICL, IPC, CER, UVA).
- Creé la API `/api/adjustment-indexes` (GET y POST) para listar y crear índices custom.
- Actualicé el GET y agregué un PATCH en `/api/contracts/[id]` para editar condiciones desde la ficha.
- Actualicé la ficha del contrato (`contrato-detalle.tsx`): modo edición inline en el card de condiciones, nueva sección "Servicios e impuestos" con íconos.
- Actualicé el formulario de nuevo contrato: campo de frecuencia + selector de índice que incluye los custom + formulario inline para agregar uno nuevo.
- Corrí `db:push` para aplicar los cambios al schema en la base de datos.

### Por qué lo hice así y no de otra forma

**Índices custom como tabla separada**: podría haberlos guardado como un campo JSON en la tabla agency, pero una tabla separada es más limpia: permite buscar, listar y referenciar fácilmente. Además, si en el futuro querés asociar datos extra al índice (tipo de fórmula, fuente de datos) ya tenés el lugar.

**Servicios en la propiedad, no en el contrato**: los servicios son una característica de la propiedad, no del contrato en sí. Una misma propiedad siempre va a tener la misma configuración de servicios (la municipalidad siempre la paga el propietario, por ejemplo). Si los pusiéramos en el contrato, estaríamos duplicando info. El contrato solo los *muestra* para que queden claros.

**PATCH con campos opcionales**: el endpoint PATCH no requiere enviar todos los campos — solo los que querés cambiar. Esto se llama "partial update". Así, si solo editás el monto, no tenés que mandar las fechas, el índice, etc. Internamente construimos el objeto `updates` solo con los campos que llegaron.

**Edición inline en el card de condiciones**: en vez de ir a una página de edición separada, el card hace toggle entre modo visualización y modo edición. Más cómodo para cambiar un dato sin perder contexto de la ficha completa.

### Conceptos que aparecieron

- **PATCH vs PUT**: PUT reemplaza el recurso completo (tenés que mandar todo). PATCH actualiza parcialmente (solo lo que querés cambiar). Para editar condiciones de un contrato, PATCH es lo correcto porque no siempre querés tocar todos los campos.
- **Partial update pattern**: construir el objeto de actualizaciones dinámicamente, agregando solo las claves que llegaron en el body. Si el campo no está en el request, no lo tocamos.
- **Schema migration (db:push)**: cada vez que modificás el schema de la base de datos (agregás columnas, creás tablas), hay que sincronizarlo con la base real. `db:push` hace eso directamente en desarrollo.
- **Modo edición inline**: patrón de UI donde el mismo componente alterna entre "mostrar datos" y "formulario de edición" con un estado booleano (`isEditing`). Común en dashboards para no perder contexto.

### Preguntas para reflexionar

1. ¿Por qué usamos PATCH y no PUT para editar condiciones? ¿Cuándo usarías PUT?
2. Los servicios se guardan en la propiedad pero se muestran en el contrato. ¿Cómo harías si el contrato necesitara sobreescribir una de esas condiciones (ej: en este contrato particular, el gas lo paga el propietario aunque normalmente lo paga el inquilino)?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: PATCH vs PUT — cuándo usar cada uno, con ejemplo de este contrato
- [ ] **Decisión técnica**: guardar servicios en property y no en contract — motivación y cuándo revisarlo
- [ ] **Patrón**: edición inline con toggle isEditing — receta con código base

---

## Sesión 2026-04-13 — Caja: edición, buscadores y colores

### Qué hice

1. **Colores verde/rojo para ingresos y egresos** — los badges de tipo en la tabla y los montos ahora son verdes para ingreso y rojos para egreso. Los KPIs y el pie de tabla también usan esos colores. El saldo neto pasa a azul cuando es cero (en la práctica raro, pero definido).

2. **Constantes de color** — definí `C_INGRESO`, `C_EGRESO` y `C_NEUTRO` al principio del archivo para que el color esté en un solo lugar y no repetido en 6 lados. Si mañana el verde tiene que ser otro tono, se cambia en un solo lugar.

3. **`BuscadorSelector`** — nuevo componente que reemplaza los `<select>` nativos. Tiene un input de texto donde se puede escribir para filtrar. Cuando el input tiene foco, aparece un dropdown con las opciones filtradas en tiempo real.

4. **Búsqueda contextual en contratos** — las opciones de contratos ahora incluyen dirección de la propiedad en el label visible (`CON-0001 · Calle Falsa 123`) y los nombres de propietario e inquilinos como texto extra de búsqueda (no visible en el label principal, pero sí buscable). Así podés escribir "García" y encontrar el contrato de García aunque el label no diga García.

5. **Botón "✕" para limpiar** — cuando hay una opción seleccionada, aparece una X dentro del campo para deseleccionarla sin tener que abrir el dropdown.

---

### Por qué lo hice así y no de otra forma

- **Colores hardcoded en lugar de tokens del tema**: El tema Arce no tiene tokens para "verde éxito" ni "azul neutro". La alternativa era agregar los tokens a `globals.css`, pero eso cambia el design system completo. Para el MVP, definir las constantes en el mismo archivo es suficiente. Si el diseño escala, se mueven al tema.

- **`BuscadorSelector` en lugar de una librería externa**: Existen librerías como `react-select` o `cmdk` que hacen exactamente esto. Pero para el MVP con 4 selectores, traer una dependencia nueva agrega complejidad de configuración y temas. El componente propio tiene exactamente lo que necesitamos, nada más.

- **`onMouseDown` en el dropdown para evitar que el blur cierre el menú**: Cuando hacés click en una opción del dropdown, el navegador primero dispara `blur` en el input (que cerraría el menú) y *después* dispara `click` en la opción. Si el menú ya cerró, el click no llega a la opción. La solución es `e.preventDefault()` en el `onMouseDown` del contenedor del dropdown: eso evita que el input pierda foco al hacer click dentro del dropdown. El blur solo ocurre cuando el usuario sale del componente completamente.

- **`searchText` separado del `label`**: Para contratos, el label visible es `"CON-0001 · Calle Falsa 123"`. Pero también quiero poder buscar por `"García"` (el propietario). Si metiera todo en el label, el label mostrado sería demasiado largo. Con `searchText` separo lo que se *muestra* de lo que se *busca*.

---

### Conceptos que aparecieron

- **Bubbling de eventos (propagación)**: Cuando hacés click en un elemento, el evento "sube" por el árbol de la página — primero el elemento clickeado, después su contenedor, después el de arriba, etc. `e.preventDefault()` detiene la acción por defecto del navegador (como perder el foco). `e.stopPropagation()` detiene el ascenso del evento (usado antes para que el click en un chip no abra el modal). Son dos cosas distintas.

- **Orden de eventos del navegador**: Para cualquier interacción de click, el navegador dispara los eventos en este orden: `mousedown` → `focus/blur` → `mouseup` → `click`. Es por eso que para interceptar el blur, hay que actuar en `mousedown`, no en `click` (que llega tarde).

- **Constantes de color como única fuente de verdad**: Si el color `C_INGRESO = "#6ee7a0"` está en un solo lugar y se usa en 5 sitios distintos, cambiar el verde requiere cambiar una sola línea. Si el hex estuviera repetido en cada uso, habría que buscarlo y cambiarlo en los 5 lugares sin perder ninguno. Esto es el principio DRY (Don't Repeat Yourself).

---

### Preguntas para reflexionar

1. El buscador filtra en el cliente (en el navegador, sobre los datos ya cargados). Si un día hay 500 contratos, ¿seguiría siendo suficiente este enfoque o habría que buscar en el servidor mientras el usuario escribe? ¿Cuál sería la diferencia para el usuario?
2. Ahora los contratos muestran dirección + propietario + inquilinos. ¿De dónde viene esa información? Repasá el archivo `route.ts` de contratos para ver cómo el servidor la construye antes de devolverla.

---

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Orden de eventos del navegador (mousedown → blur → mouseup → click) — por qué importa al construir componentes interactivos
- [ ] **Patrón**: Combobox / buscador con dropdown propio — la receta completa con `onMouseDown` para prevenir blur
- [ ] **Concepto**: DRY (Don't Repeat Yourself) — constantes de color como ejemplo concreto
- [ ] **Concepto**: `searchText` vs `label` — separar lo que se muestra de lo que se busca

---

## Sesión 2026-04-13 — Módulo Caja General (wireframe → producción)

### Qué hice

1. **Creé `/src/app/caja/page.tsx`** — el punto de entrada de la ruta `/caja`. Es un Server Component que monta el layout y delega la UI al componente cliente.

2. **Creé `/src/app/caja/caja-general-client.tsx`** — la página completa de Caja General reproducida desde el wireframe, con:
   - 4 KPIs (Total cobrado, Pendiente, Liquidado, En mora)
   - 3 tarjetas de acciones pendientes con scroll a sección y apertura de modales
   - Tabla de movimientos con filtros funcionales (Todos / Contratos / Manuales / A validar / Vencidos)
   - Barra de totales al pie de la tabla
   - Sección de índices pendientes con urgencia visual (error / mostaza)
   - Modal "Nuevo movimiento" con toggle ingreso/egreso, chips de categoría y campos opcionales
   - Modal "Liquidación al propietario" con breakdown de conceptos y ajuste manual
   - Selector de período funcional (mes/año navegable con flechas)

3. **Actualicé `menu-config.ts`** — agregué "Caja General" con ícono `Landmark` en el menú de staff y admin, antes de Propietarios.

4. **Actualicé `dashboard-layout.tsx`** — agregué `caja: "Caja General"` al mapa de labels de breadcrumb.

---

### Por qué lo hice así y no de otra forma

- **Client Component separado del Server Component**: La página tiene mucho estado interactivo (filtros, modales, selector de período). En Next.js App Router, los Server Components no pueden tener estado. La solución es `page.tsx` (server, puede exportar `metadata` y es fácil agregar fetching de datos después) + `caja-general-client.tsx` (client, maneja todo el estado).

- **Tokens CSS `var(--color-arce-*)` en lugar de clases Tailwind puras**: Los tokens de Arce están definidos en `globals.css` con `@theme`. Tailwind genera las clases automáticamente (`bg-arce-primary`, etc.), pero para valores complejos como `rgba(255,180,162,0.12)` que no tienen una clase exacta, usé `style={{ ... }}` con las variables CSS directamente. Es más fiel al diseño system que inventar clases arbitrarias.

- **Datos mock hardcodeados**: La tabla de movimientos usa datos estáticos por ahora. La alternativa era conectar a la API real, pero eso requiere primero crear el esquema de base de datos para `caja`. Para el MVP, primero se valida la UI, después se conecta el backend.

- **Sub-componentes en el mismo archivo**: `PendienteCard`, `IndiceCard`, `FormGroup`, `ModalBackdrop`, `Tag` son componentes pequeños que solo existen para esta vista. Ponerlos en archivos separados hubiera sido sobre-ingeniería — tres usos como máximo cada uno. Un archivo de 400 líneas bien organizado es más manejable que 8 archivos de 50.

- **`<style>` inline para `.form-input-arce`**: El input necesita estilos de focus (`:focus`) que Tailwind no puede manejar con solo `className`. En lugar de crear un archivo CSS separado para un selector, preferí el scoped `<style>` dentro del componente. No es ideal pero es práctico para el MVP.

---

### Conceptos que aparecieron

- **Server Component vs Client Component**: En Next.js App Router, todo es Server Component por defecto (se renderiza en el servidor, no hay estado, no hay eventos del navegador). Para agregar interactividad (`useState`, `onClick`, etc.) necesitás marcar el componente con `"use client"` al principio del archivo. Los Server Components pueden importar Client Components, pero no al revés.

- **Prerenderizado estático (`○`)**: El build mostró `/caja` como `○ (Static)`. Eso significa que Next.js detectó que la página no tiene fetching de datos dinámicos y la prerenderizó como HTML en tiempo de build. Cuando alguien entre, recibirá el HTML listo sin esperar al servidor. Cuando conectemos el backend, pasará a `ƒ (Dynamic)`.

- **Tokens CSS vs clases Tailwind**: Los tokens (`--color-arce-primary`) son variables CSS estándar que cualquier estilo puede consumir. Las clases Tailwind (`bg-arce-primary`) son utilidades generadas por Tailwind que internamente asignan `background-color: var(--color-arce-primary)`. El resultado visual es el mismo, pero las clases son más cortas. Para valores que Tailwind no puede expresar (rgba con opacidad flotante), los tokens directos son la única opción.

- **`hasRouteAccess` — seguridad por defecto seguro**: La función devuelve `true` para cualquier ruta no listada explícitamente. `/caja` no estaba en la lista de rutas restringidas, así que accede cualquier usuario autenticado. Esto es intencional para el MVP — cuando tengamos roles de staff vs admin, se puede agregar la restricción.

---

### Preguntas para reflexionar

1. La tabla de movimientos hoy mezcla contratos y movimientos manuales en un array estático. Cuando conectemos el backend, ¿cómo harías para que vengan de dos endpoints distintos y se muestren en la misma tabla ordenados por fecha?
2. El modal "Ejecutar transferencia" tiene un botón que en producción debería hacer una transferencia real de dinero. ¿Qué precauciones habría que tomar para que esa acción no se ejecute por accidente (doble click, refresco de página, etc.)?

---

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Server Component vs Client Component — cuándo usar cada uno y por qué no podés mezclarlos en cualquier dirección  
- [ ] **Patrón**: `page.tsx` (server) + `*-client.tsx` (client) — el patrón estándar para páginas con estado en Next.js App Router  
- [ ] **Concepto**: Tokens CSS (`--var`) vs clases Tailwind — la diferencia, cuándo usar cada uno  
- [ ] **Decisión técnica**: Por qué los sub-componentes de una sola vista van en el mismo archivo en lugar de archivos separados (criterio: menos de 3 usos = mismo archivo)

---

## Concepto — CLAUDE.md
> Plantilla: Concepto PR · `tag: concepto/pr`
> Listo para pegar en Obsidian

**¿Qué es?**
`CLAUDE.md` es un archivo de texto que se coloca en la raíz del proyecto. Claude Code lo lee automáticamente al inicio de cada sesión. Contiene instrucciones, contexto del proyecto y convenciones que de otra forma habría que explicar de nuevo cada vez.

**¿Para qué sirve?**
Para que Claude arranque cada conversación ya sabiendo cómo está armado el proyecto: qué comandos usar, cómo está organizado el código, qué patrones seguir. Sin él, cada sesión empieza desde cero.

**Analogía**
Es el manual de incorporación que le dejás a un empleado nuevo antes de su primer día. No lo reemplaza a él, pero evita que tenga que preguntar todo desde el principio.

**Ejemplo concreto**
En este proyecto, `CLAUDE.md` le dice a Claude que el API usa ElysiaJS (no Next.js estándar), que la autenticación pasa por `src/proxy.ts` (no el `middleware.ts` habitual), y que los comandos se corren con `bun` (no `npm`). Son detalles que no son obvios mirando el código por primera vez.

**Cómo se crea**
1. Crear un archivo llamado `CLAUDE.md` en la raíz del proyecto (donde está el `package.json`)
2. Escribirlo en Markdown — Claude lo lee como texto plano
3. Incluir: comandos comunes, arquitectura general, decisiones no obvias
4. No incluir: cosas que ya están en el código o que son genéricas de cualquier proyecto
5. Se puede usar el comando `/init` dentro de Claude Code para que lo genere automáticamente analizando el proyecto

**Cómo se relaciona con**
- `claude.local.md` — mismo concepto pero personal y privado (no se sube a GitHub). Contiene preferencias tuyas, tu perfil de aprendizaje, instrucciones de cómo explicarte las cosas.
- `.gitignore` — `CLAUDE.md` sí va al repositorio (lo comparte todo el equipo). `claude.local.md` va al `.gitignore` porque es solo tuyo.

**Preguntas que me hice**
- ¿Claude realmente lo lee o es solo una convención? → Lo lee automáticamente, es una función nativa de Claude Code.
- ¿Qué pasa si hay cosas contradictorias entre `CLAUDE.md` y `claude.local.md`? → `claude.local.md` tiene prioridad porque se carga después y es más específico.

**Fuente**
Sesión de trabajo 2026-04-11 — creación del CLAUDE.md con el comando `/init`

---

## Sesión 2026-04-11 — Primer ingreso a la app

### Qué hice

1. **Creé el archivo `CLAUDE.md`** — un mapa del proyecto para que yo (Claude) entienda la estructura cada vez que empezamos una sesión nueva.

2. **Creé tu usuario admin** en la base de datos con email y contraseña propios, con rol `account_admin` (acceso total). Lo hice via un script temporal que después borré para no dejar tu contraseña expuesta en el código.

3. **Redirigí la página de inicio (`/`)** al tablero (`/tablero`). Antes mostraba la pantalla genérica de Next.js.

4. **Agregué `LOG.md` y `claude.local.md` al `.gitignore`** para que no se suban a GitHub.

---

### Por qué lo hice así y no de otra forma

- **CLAUDE.md**: Sin este archivo, cada sesión nueva empiezo desde cero sin saber nada del proyecto. Es como dejarle un manual al turno siguiente.

- **Script temporal para el usuario**: La alternativa era modificar el seed (el script de datos de prueba), pero ese archivo sí se sube a GitHub y no es buena idea poner tus credenciales reales ahí. Creé un script separado, lo corrí, y lo borré.

- **Redirect en `/`**: La página que veías es la que viene por defecto cuando creás un proyecto con Next.js. No tiene ninguna lógica nuestra — es solo un placeholder. El redirect es la forma estándar de decirle "cuando alguien entra acá, mandalo al tablero".

- **`.gitignore`**: El `.env` ya estaba ignorado. `LOG.md` y `claude.local.md` son archivos personales tuyos que no tienen sentido en el repositorio compartido con el programador.

---

### Conceptos que aparecieron

- **`.env`**: Archivo donde se guardan "secretos" de la app (contraseñas de base de datos, claves de API). Git lo ignora automáticamente para que no se suban a internet. Analogía: es como la caja fuerte del local, no la vidriera.

- **`.gitignore`**: Lista de archivos que Git ignora al momento de guardar cambios. Lo que está ahí nunca llega al repositorio compartido.

- **Seed**: Script que crea datos de prueba en la base de datos. Es idempotente, es decir, podés correrlo mil veces y no rompe nada — si el dato ya existe, lo saltea.

- **Rol `account_admin`**: El sistema tiene tres niveles de acceso: `visitor` (solo mira), `agent` (puede crear cosas), `account_admin` (acceso completo). Tu usuario tiene el máximo.

- **Redirect**: Instrucción que le dice al navegador "no te quedes acá, andá a esta otra página". Es instantáneo, el usuario ni lo nota.

- **Placeholder**: Página o componente vacío que viene "de fábrica" y hay que reemplazar. En este caso, la pantalla de Next.js con "To get started, edit page.tsx".

---

### Preguntas para reflexionar

1. Si el `.env` nunca se sube a GitHub, ¿cómo hace el programador para configurar la app en su computadora? ¿Cómo se comparte ese archivo de forma segura?
2. ¿Qué pasaría si alguien con rol `visitor` intentara entrar a una ruta de creación de clientes? ¿Quién lo bloquea?

---

### Qué debería anotar en Obsidian

- [ ] **Concepto**: `.env` y `.gitignore` — para qué sirven y cómo se relacionan
- [ ] **Concepto**: Roles de usuario (`visitor`, `agent`, `account_admin`) — qué puede hacer cada uno
- [ ] **Decisión técnica**: Por qué se crea un script temporal para datos sensibles en lugar de modificar el seed
- [ ] **Bug resuelto**: Página de inicio mostraba placeholder de Next.js en vez del tablero — causa: `page.tsx` nunca fue reemplazado, fix: redirect a `/tablero`