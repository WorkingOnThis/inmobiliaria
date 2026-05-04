# Pendientes — Arce Administración

Trabajar de arriba hacia abajo dentro de cada grupo.
Items completados → [HISTORIAL.md](HISTORIAL.md)
Decisiones y contexto → [docs/decisions/](docs/decisions/)

---

## 🔴 Prioridad alta

- [ ] **Flags contables en cargo manual** — al agregar cargo manual, poder togglear `impactaPropietario`, `incluirEnBaseComision`, `impactaCaja` · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Configurar honorarios por contrato** — cobrar sí/no, a quién le llega qué parte; opción de que el pago vaya todo a la inmobiliaria sin trasladar al propietario · [contratos](docs/decisions/contratos.md)

- [ ] **PDF del recibo** — requiere librería tipo `@react-pdf/renderer` o similar · [documentos](docs/decisions/documentos.md)

- [ ] **Dominio verificado para envío de emails** — hoy solo funciona para `arce.guillermo.gaston@gmail.com`; resolver acceso a Cloudflare para `latellafrias.com.ar`

- [ ] **`db:migrate` falla** — historial de `__drizzle_migrations` desincronizado con `db:push`. Workaround: seguir usando `db:push` en dev. Revisar antes de ir a producción.

- [ ] **Eliminar tabla `tenant_charge`** — confirmar que nada la usa antes de borrar

---

## 🟡 Prioridad media

- [ ] **Editar movimiento pendiente desde el menú contextual** — agregar opción "Editar" al `...` de la tabla de cuenta corriente; abrir un dialog con campos: descripción, monto, fecha de vencimiento. La API PATCH ya acepta esos campos · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Score de cliente** — métrica que refleja qué tanto trabajo da un inquilino. Schema: tabla `client_interaction` con `clientId`, `tipo` (reclamo/consulta/incidente), `descripcion`, `humorScore` (1–5). Score compuesto: frecuencia de reclamos + promedio humorScore + días promedio de pago. UI en ficha del inquilino · [inquilinos](docs/decisions/inquilinos.md)

---

## 🟢 Prioridad baja

- [ ] **Pool de motivos de cancelación (V2)** — reemplazar el campo de texto libre del dialog de cancelación por un `CreatableCombobox` que guarde y reutilice motivos frecuentes ("Error de carga", "No corresponde cobrar", etc.). Incluye: tabla en DB para los motivos, toggle de obligatorio/opcional por agencia desde un módulo de configuración · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Selector de mes en "Primer mes a cobrar"** — hoy muestra "1 de marzo de 2026" o "23 de marzo de 2026". Debería mostrar solo "Marzo 2026" independientemente del día seleccionado, ya que la granularidad es mensual · [contratos](docs/decisions/contratos.md)

---

## 🔵 Backlog / Futuro

- [ ] **Marcar movimiento como "ya cobrado" sin emitir recibo** — postergado hasta tener login de inquilinos y carga de comprobantes; el flujo completo tiene más valor que el botón solo · ver [contabilidad](docs/decisions/contabilidad.md#conciliación-manual-marcar-como-ya-cobrado-sin-emitir-recibo)

- [ ] **Login de inquilinos** — acceso diferenciado para que los inquilinos vean su cuenta corriente y suban comprobantes de pago · ver [inquilinos](docs/decisions/inquilinos.md) · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)

---

## ✅ Completados → ver [HISTORIAL.md](HISTORIAL.md)

- [x] **Eliminar movimiento pendiente desde la UI de cuenta corriente** — soft cancel con menú `...` y dialog de confirmación con motivo opcional
