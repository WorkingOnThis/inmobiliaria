# Handoff — Sub-proyectos pendientes tras Cuenta Corriente v2

> Última sesión: 2026-04-26  
> Rama de trabajo: `test-security` (mover a `gaston/mvp-semana` para nuevas features)  
> Plan original implementado: `docs/superpowers/plans/2026-04-26-cuenta-corriente.md` (19/19 tasks completas)

---

## Estado actual del sistema

El módulo de Cuenta Corriente v2 está implementado y funcionando. Lo que existe:

- `tenant_ledger` — tabla central que reemplaza `tenant_charge`
- Auto-generación de períodos desde el contrato (`POST /api/contracts/[id]/generate-ledger`)
- UI interactiva: `LedgerTable`, `PunitorioPopover`, `TenantTabCurrentAccount` reescrito
- Cobro con honorarios y segregación de fondos (`tipoFondo` en `cash_movement`)
- Toggle de doble rol en fichas de inquilino/propietario (`RoleToggle`)
- Cuenta corriente del propietario (`OwnerTabCurrentAccount`) leyendo desde `tenant_ledger`
- Script de migración `tenant_charge → tenant_ledger` (one-time, ya ejecutado en dev)
- `tenant_charge` todavía existe en DB — pendiente de eliminar cuando esté verificado en prod

### Datos de prueba en dev
- 2 contratos en DB, IDs:
  - `6965ecee-af4f-4313-96a2-9718c68c92d0` (sin inquilino vinculado en contract_tenant)
  - `18e4d423-3426-4e82-a9b1-75186bd4ea4a` (inquilino: `3f0a0978`, propietario: `eff7ff6b`) — tiene 24 entradas en tenant_ledger
- Se usó `scripts/fix-and-generate.ts` para poblar `contract_tenant` y generar el ledger manualmente

### Bugs conocidos (no bloqueantes, para sesión de bugfix)
1. **KPI "Próximo pago" muestra "—"** — la query solo busca `period >= hoy`. Los meses atrasados pendientes no aparecen. Fix: quitar el filtro de fecha y ordenar por period ASC.
2. **Comisión se calcula sobre gastos manuales** — el flag `incluirEnBaseComision` debería ser `false` para tipo `gasto` y `servicio`. Ver `src/lib/ledger/flags.ts`.
3. **`db:migrate` falla** — las migraciones se aplicaron con `db:push`, el historial de `__drizzle_migrations` está desincronizado. Workaround actual: seguir usando `db:push` en dev.
4. **`contract_tenant` vacía para contrato `6965ecee`** — falta vincular el inquilino manualmente.

---

## Sub-proyectos identificados (en orden de prioridad)

### Sub-proyecto A — Doble rol de cliente ⬅ EMPEZAR ACÁ

**Problema:** Un cliente puede ser propietario de una propiedad e inquilino de otra. Hoy el sistema no soporta esto limpiamente:
- La tabla `client` tiene `type: owner | tenant | guarantor | contact` — un solo valor
- Al crear un contrato, el selector de inquilino filtra por `type = "tenant"` (o similar), entonces un propietario no aparece aunque pueda serlo
- No hay UI para agregar roles adicionales a un cliente existente

**Lo que se quiere:**
1. En la ficha de un cliente (ej: Gastón Guillermo Arce, propietario), poder agregar el rol "inquilino" sin perder el rol actual
2. Al crear un contrato, el campo de inquilino busca en TODOS los clientes (no solo los tipo tenant)
3. El campo de propietario en el contrato sigue mostrando solo propietarios

**Decisiones técnicas a tomar en el diseño:**
- ¿Extender `client.type` a un array? ¿O tabla separada `client_role`?
- ¿Cómo afecta esto a los filtros existentes en listados de inquilinos y propietarios?
- ¿Qué pasa con el `RoleToggle` ya implementado que lee roles desde `/api/clients/[id]/roles`?

**Archivos probablemente afectados:**
- `src/db/schema/client.ts`
- `src/app/api/clients/[id]/roles/route.ts` (existe, ver qué devuelve)
- Formulario de creación/edición de contratos
- API de contratos
- Listados de inquilinos y propietarios

---

### Sub-proyecto B — Gestión de movimientos pendientes

**Problema:** Cuando se carga un contrato que ya empezó (ej: lleva 1 año activo), el sistema genera todos los alquileres desde el `startDate`. El usuario necesita poder limpiar o marcar como pagados los meses históricos que ya se cobraron antes de usar el sistema.

**Lo que se quiere:**
1. Al crear el contrato, elegir desde qué mes generar los alquileres en `tenant_ledger` (no siempre desde `startDate`)
2. Poder eliminar un movimiento pendiente desde la UI de cuenta corriente
3. Poder marcar un movimiento como "ya cobrado" sin emitir recibo formal (conciliar manualmente)
4. Pago parcial: registrar un pago menor al monto de la cuota

**Archivos probablemente afectados:**
- Formulario de creación de contrato
- `src/app/api/contracts/[id]/generate-ledger/route.ts`
- `src/app/api/tenants/[id]/ledger/[entryId]/route.ts` (PATCH/DELETE ya existe)
- `src/components/tenants/ledger-table.tsx` (agregar acciones de eliminar/conciliar manual)
- `src/components/tenants/tenant-tab-current-account.tsx`

---

### Sub-proyecto C — Flags avanzados y división de cobro

**Problema:** La UI de cuenta corriente no expone los flags contables (`impactaPropietario`, `incluirEnBaseComision`, `impactaCaja`) ni permite configurar si el pago va todo a la inmobiliaria o se divide.

**Lo que se quiere:**
1. Al agregar un cargo manual, poder togglear los flags contables
2. Configurar por contrato: "cobrar honorarios" sí/no, y a quién le llega qué parte
3. Opción de que el pago vaya todo a la inmobiliaria (sin trasladar al propietario)

**Archivos probablemente afectados:**
- Diálogo de cargo manual en `TenantTabCurrentAccount`
- Diálogo de confirmación de recibo (emit)
- `src/app/api/receipts/emit/route.ts`

---

### Sub-proyecto D — Recibo en PDF y envío por mail

**Problema:** Al emitir un recibo, no se genera un PDF ni se envía por email al inquilino.

**Lo que se quiere:**
1. Generar PDF del recibo usando el generador de documentos existente (ver `src/app/(dashboard)/generador-documentos/`)
2. Enviar el PDF por email al inquilino (ya hay infraestructura de email via Resend en `src/lib/auth/email.ts`)

**Dependencias:** Requiere tener una plantilla de recibo configurada en el generador de documentos. Es el sub-proyecto más independiente — puede hacerse en cualquier orden después de A y B.

---

## Cómo arrancar la próxima sesión

1. Decile a Claude: **"Quiero empezar el sub-proyecto A — doble rol de cliente"**
2. Claude va a leer este archivo + las memorias + el código actual
3. Se hace brainstorming → spec → plan → implementación

El plan detallado de la sesión anterior está en:
`docs/superpowers/plans/2026-04-26-cuenta-corriente.md`
