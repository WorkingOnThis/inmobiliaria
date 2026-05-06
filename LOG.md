# LOG.md — Arce Administración

Registro de sesiones de trabajo. Más nueva arriba.

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