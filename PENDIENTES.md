# Pendientes — Caja y Cuenta Corriente

Checklist de mejoras, bugs y features pendientes.
Trabajar de arriba hacia abajo. Tachar con `[x]` cuando esté listo.

---

## 🏗 Sub-proyecto F — Motor de documentos en el contrato

**Spec:** `docs/superpowers/specs/2026-04-28-contract-document-engine-design.md`
**Plan:** `docs/superpowers/plans/2026-04-28-contract-document-engine.md` ← a generar

El motor del generador de documentos se integra dentro de la ficha del contrato. Las cláusulas pasan a ser propias de cada contrato (editables, reordenables, activables). El mismo sistema sirve para múltiples tipos de documento (contrato, acta de entrega, etc.).

Piezas a implementar en orden:

- [ ] **DB:** Migración — nueva tabla `contract_clause`, nueva tabla `contract_document_config`, campo `isDefault` en `documentTemplate`
- [ ] **API:** Routes `/api/contracts/[id]/documents/[documentType]/` — apply, clauses CRUD, reorder
- [ ] **UI — Lista de cláusulas:** Sección en ficha del contrato, drag & drop, toggle activa/inactiva, numeración automática, lock según estado
- [ ] **UI — Modal de edición:** Título + textarea con highlighting + preview compacto + popover Ctrl+Click integrado
- [ ] **UI — Print/preview:** Botón "Vista previa / Imprimir" con numeración ordinal ("CLÁUSULA PRIMERA")
- [ ] **Acta de entrega (documentType `delivery_act`):** Misma UI, diferente plantilla, paso 04 del stepper

---

## 🐛 Bugs conocidos (empezar acá — son rápidos)

- [x] **KPI "Próximo pago" muestra "—"** — la query filtra `period >= hoy` entonces los meses atrasados pendientes no aparecen. Fix: quitar el filtro de fecha, ordenar por `period ASC` y tomar el primero pendiente sin importar si es pasado o futuro.
  - Archivo: `src/app/api/tenants/[id]/cuenta-corriente/route.ts` (línea ~683)

- [x] **Comisión se calcula sobre gastos manuales** — `incluirEnBaseComision` está en `true` para tipos `gasto` y `servicio` cuando debería ser `false`.
  - Archivo: `src/lib/ledger/flags.ts`

- [x] **Contrato `6965ecee` sin inquilino vinculado** — Matias Konstantinides vinculado como `primary` en `contract_tenant`.

- [x] **Modalidad de pago no se guarda en el movimiento de caja** — el recibo muestra la modalidad del contrato al momento de consultarlo, no la que tenía cuando se emitió. Si el contrato cambia de modalidad, los recibos viejos mostrarán la nueva.
  - Archivos: `src/app/api/receipts/emit/route.ts`, `src/db/schema/caja.ts`
  - Fix: agregar columna `paymentModality` a `cajaMovimiento` y guardarla al emitir.

---

## 👁 Auditoría visual — wireframes vs app real

Abrir el wireframe en el browser y comparar contra la app. Anotar diferencias.

- [ ] **`cuenta-corriente-tabla.html`** — KPIs (Estado / Próximo pago / Cobrado 2026), alerta de ajuste ICL, tabla de proyección con controles de filtro
- [ ] **`cobro-workspace.html`** — selección de ítems, edición de montos inline, botón punitorio por fila, panel sticky de cobro al fondo con desglose
- [ ] **`contract-projection-layout.html`** — tabla de meses, estados Pagado/Pendiente/Proyectado, mes actual destacado con borde izquierdo

Los wireframes están en: `.superpowers/brainstorm/56-1777183142/content/`

---

## 🔧 Sub-proyecto A — Doble rol de cliente

Un cliente puede ser propietario de una propiedad e inquilino de otra. Hoy `client.type` tiene un solo valor.

- [ ] Decidir modelo: ¿array en `client.type`? ¿tabla separada `client_role`?
- [ ] Al crear contrato, el campo inquilino debe buscar en TODOS los clientes (no solo `type = "tenant"`)
- [ ] En la ficha del cliente, poder agregar un segundo rol sin perder el primero
- [ ] El toggle Inquilino/Propietario/Resumen del wireframe `dual-role-skin.html` — implementar

---

## 🔧 Sub-proyecto B — Movimientos pendientes

- [ ] Al crear contrato, elegir desde qué mes generar el ledger (no siempre desde `startDate`)
- [ ] Poder eliminar un movimiento pendiente desde la UI de cuenta corriente
- [ ] Poder marcar un movimiento como "ya cobrado" sin emitir recibo formal (conciliar manual)
- [x] Pago parcial: registrar un pago menor al monto de la cuota

---

## 🔧 Sub-proyecto C — Flags y división de cobro

- [ ] Al agregar cargo manual, poder togglear los flags contables (`impactaPropietario`, `incluirEnBaseComision`, `impactaCaja`)
- [ ] Configurar por contrato: cobrar honorarios sí/no, a quién le llega qué parte
- [ ] Opción de que el pago vaya todo a la inmobiliaria (sin trasladar al propietario)

---

## 🔧 Sub-proyecto D — Recibo en PDF y envío por mail

- [x] Enviar recibo por email al inquilino — implementado via Gmail SMTP (Nodemailer + App Password). Dialog con selección de destinatarios, emails de confianza por inquilino, HTML inline-styled compatible con Gmail/Outlook.
- [ ] Generar PDF del recibo (pendiente — requiere librería tipo `@react-pdf/renderer` o similar)
- [ ] Dominio verificado para enviar a cualquier destinatario (hoy funciona solo para `arce.guillermo.gaston@gmail.com`; resolver acceso a Cloudflare para `latellafrias.com.ar`)

---

## 🔧 Sub-proyecto E — Score de cliente (baja prioridad)

Métrica que refleja qué tanto trabajo da un inquilino a la administración.

- [ ] Diseñar schema: tabla `client_interaction` con campos `clientId`, `tipo` (`reclamo` | `consulta` | `incidente`), `descripcion`, `creadoPor`, `creadoAt`
- [ ] Agregar campo `humorScore` (1–5) al modelo de interacción — calificación subjetiva del staff sobre el humor del cliente en ese contacto
- [ ] UI para registrar interacciones desde la ficha del inquilino
- [ ] Calcular score compuesto: frecuencia de reclamos + promedio de humorScore + días promedio de pago
- [ ] Mostrar score en el KPI de "Puntualidad" o en una card propia

---

## 📋 Deuda técnica

- [ ] **`db:migrate` falla** — historial de `__drizzle_migrations` desincronizado con `db:push`. Workaround: seguir usando `db:push` en dev. Revisar antes de ir a producción.
- [ ] Eliminar tabla `tenant_charge` de la DB — todavía existe, pendiente de confirmar que nada la usa en producción antes de borrar
