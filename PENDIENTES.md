# Pendientes — Arce Administración

Trabajar de arriba hacia abajo dentro de cada grupo.

---

## 🔴 Prioridad alta

- [ ] **Migrar `contract_tenant` → `contract_participant` y borrar tabla vieja** — 14 archivos todavía usan la tabla vieja (roles "primary"/"co-tenant"). La nueva es `contractParticipant` (roles "owner"/"tenant"/"guarantor"). Actualizar todos los routes (recibos, ledger, servicios, garantías) y borrar la tabla. Los recibos ya emitidos son todos de prueba, no importa perderlos.

- [ ] **Eliminar movimiento pendiente desde la UI de cuenta corriente**

- [ ] **Marcar movimiento como "ya cobrado" sin emitir recibo** — conciliación manual

- [ ] **Flags contables en cargo manual** — al agregar cargo manual, poder togglear `impactaPropietario`, `incluirEnBaseComision`, `impactaCaja`

- [ ] **Configurar honorarios por contrato** — cobrar sí/no, a quién le llega qué parte; opción de que el pago vaya todo a la inmobiliaria sin trasladar al propietario

- [ ] **PDF del recibo** — requiere librería tipo `@react-pdf/renderer` o similar

- [ ] **Dominio verificado para envío de emails** — hoy solo funciona para `arce.guillermo.gaston@gmail.com`; resolver acceso a Cloudflare para `latellafrias.com.ar`

- [ ] **`db:migrate` falla** — historial de `__drizzle_migrations` desincronizado con `db:push`. Workaround: seguir usando `db:push` en dev. Revisar antes de ir a producción.

- [ ] **Eliminar tabla `tenant_charge`** — confirmar que nada la usa antes de borrar

---

## 🟡 Prioridad media

- [ ] **Score de cliente** — métrica que refleja qué tanto trabajo da un inquilino. Schema: tabla `client_interaction` con `clientId`, `tipo` (reclamo/consulta/incidente), `descripcion`, `humorScore` (1–5). Score compuesto: frecuencia de reclamos + promedio humorScore + días promedio de pago. UI en ficha del inquilino.

---

## 🟢 Prioridad baja

- [ ] **Selector de mes en "Primer mes a cobrar"** — hoy muestra "1 de marzo de 2026" o "23 de marzo de 2026". Debería mostrar solo "Marzo 2026" independientemente del día seleccionado, ya que la granularidad es mensual.
