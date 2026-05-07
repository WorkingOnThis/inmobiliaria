# Decisiones — Contratos

Módulo de contratos: creación, ajustes de índice, honorarios, cláusulas.

---

## SEC-5 · Render on-demand del documento de modificación (anti-XSS) — 2026-05-07 — confirmada

**La decisión:** el documento de cada `contract_amendment` se renderea on-demand desde datos vía JSX en una page route server-side (`/contratos/[id]/modificaciones/[aid]`). Ya no se almacena HTML. La columna `contract_amendment.documentContent` queda nullable y deprecada.

**El contexto:** auditoría detectó Stored XSS — el endpoint POST `/document` interpolaba `description`, `fieldsChanged.before/.after` y nombres de partes en HTML sin escapar, lo guardaba en la DB y lo servía con `Content-Type: text/html`. Un `agent` malicioso podía inyectar `<script>` que robara sesiones de usuarios al abrir el instrumento.

**Las alternativas que existían:**
- **Helper `escapeHtml()` + CSP restrictivo**: la fix mínima — wrap cada interpolación, agregar Content-Security-Policy. Descartada como solución principal: es anti-fragile (cualquier interpolación nueva que olvides envolver reintroduce el XSS), y mantiene el problema de stale data (HTML guardado vs datos actuales del contrato).
- **`react-dom/server.renderToString()` desde el endpoint API**: usar React server-side dentro del API endpoint para generar HTML escapado. Descartada: sumaba dependencia y mantenía el "store HTML" pattern. La page route nativa de Next.js es más idiomática.

**Por qué elegí render-on-demand vía JSX:**
1. **Auto-escape como propiedad del framework**: React no permite "interpolar como HTML" salvo que escribas explícitamente `dangerouslySetInnerHTML`. La sintaxis hace imposible olvidar la seguridad — todo `{value}` siempre escapa. Comparado con `escapeHtml()`, traslada la responsabilidad del developer al framework.
2. **Freshness gratis**: el documento siempre refleja el estado actual del contrato. Si cambia el nombre del propietario, el próximo render lo muestra. Con HTML almacenado, hubieras tenido que regenerar manualmente.
3. **Sin migración destructiva**: la columna `documentContent` queda en DB con datos legacy, sin servirse jamás. Cuando se confirme que ningún consumer la lee, se puede dropear con `ALTER TABLE`.

**Estructura de archivos:**
- `src/components/contracts/amendment-document.tsx` — componente JSX (server-friendly), todas las strings user-supplied como text nodes
- `src/app/(dashboard)/contratos/[id]/modificaciones/[aid]/page.tsx` — server component, fetchea data scoped por agencyId, renderea el componente
- `src/app/api/contracts/[id]/amendments/[aid]/document/route.ts` — POST simplificado (solo transiciona status), GET redirige (307) al page route
- `src/components/contracts/contract-tab-amendments.tsx` — UI actualizada al nuevo URL
- `src/db/schema/contract-amendment.ts` — comentario `// DEPRECATED post-SEC-5` en `documentContent`

**Cambios de comportamiento:**
- `hasDocument` flag en el listing de amendments ahora se deriva de `status !== "registered"` (era `!!documentContent`). Necesario porque post-SEC-5 ningún amendment nuevo escribe `documentContent`.
- Documentos legacy (con `documentContent` poblado) ya no son servidos. El page route renderea desde datos sin importar el campo viejo.
- El POST endpoint ya no acepta el efecto colateral de generar HTML — ahora solo transiciona estado. La UI ya llamaba al POST antes de mostrar "Ver documento", ese flow se preserva.

**Desventajas de lo elegido:**
- **Performance**: cada vista del documento dispara queries a la DB (contract + amendment + owner + tenant + agency + same-type amendments para typeSeqNumber). Antes era un SELECT del HTML guardado. Para un documento que se ve 1-3 veces por amendment, irrelevante; si en V2 hay alta concurrencia, considerar caching.
- **Datos legacy en `documentContent`**: la columna sigue conteniendo HTML potencialmente malicioso de amendments viejos. No se sirve, pero está. Si una feature futura lo lee sin pensar, el XSS vuelve. **Mitigación aplicada (2026-05-07):** ejecutado `UPDATE contract_amendment SET "documentContent" = NULL WHERE "documentContent" IS NOT NULL` en la DB de dev (0 filas afectadas — no había amendments todavía). En producción cuando llegue, misma operación.

**Cuándo revisarla:** cuando se confirme que ningún caller usa la URL `/api/.../document` (el redirect 307 puede dropearse), o cuando se decida hacer `UPDATE` de neutralización + `ALTER TABLE DROP COLUMN documentContent`.

**Fuente:**
- Implementación: commits `83ced80` (refactor principal) y `44d1a9a` (fix de hasDocument)
- Auditoría: `LOG.md` 2026-05-07

---

## Modalidad de pago dividido (`paymentModality = "split"`)

**Estado:** confirmada · Spec: `docs/superpowers/specs/2026-05-05-honorarios-pago-dividido-design.md`

### Qué es
Una tercera modalidad de pago (junto a A y B) donde el inquilino paga en dos transferencias separadas: una parte al propietario y otra a la administración. La división se calcula desde `managementCommissionPct` del contrato.

### Por qué
Razones impositivas: la administración necesita facturar su parte por separado. No puede cobrar todo y luego liquidar — el fisco requiere que cada parte reciba directamente lo que le corresponde.

### Decisiones de diseño
- Cada entrada del ledger lleva `beneficiario`: `"propietario"` | `"administracion"` | `"split"`
- El alquiler es siempre `"split"`; los punitorios van al propietario; los cargos manuales permiten elegir
- El override de destino es efímero (solo para esa sesión de cobro); queda registrado en `splitBreakdown` al conciliar
- En la cuenta del propietario: fondo azul + badge "Cobro directo desde inquilino"; sigue requiriendo liquidación manual

### Fuera de scope en V1
- Punitorios con destino configurable por tipo
- Notificación automática al inquilino con CBU/alias
- Confirmación bancaria de qué cuenta recibió el dinero
