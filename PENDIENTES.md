# Pendientes — Arce Administración

Trabajar de arriba hacia abajo dentro de cada grupo.
Items completados → [HISTORIAL.md](HISTORIAL.md)
Decisiones y contexto → [docs/decisions/](docs/decisions/)

---

## 🔴 Prioridad alta


- [x] **PDF del recibo** — implementado como mejora de estilos de impresión (`@media print`): sidebar y header ocultos, fondo blanco, tamaño A4, `print-color-adjust: exact`. Sin dependencias nuevas.

- [x] **`db:migrate` falla** — historial de `__drizzle_migrations` desincronizado con `db:push`. Workaround: seguir usando `db:push` en dev. Revisar antes de ir a producción.

- [x] **Eliminar tabla `tenant_charge`** — confirmar que nada la usa antes de borrar

---

## 🟡 Prioridad media

- [x] **Cuenta corriente de propietarios** — dejarla similar a la de inquilinos: misma estructura de tabla, mismo menú `···` con "Ver detalle", misma lógica de flags contables. El `EntryDetailDialog` ya existe como componente reutilizable · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Rango de fechas en cargo manual** — reemplazar el campo "Período (opcional)" por fecha inicio + fecha fin, con posibilidad de setear el fin especificando días desde el inicio (igual que en generación de contratos). Útil para calcular punitorios sobre cargos manuales · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Pago parcial y descuento desde dialog de detalle** — al modificar el monto de un alquiler o punitorio en el dialog, mostrar un campo adicional para indicar si es pago parcial. Incluye un flag: si NO es pago parcial, registrarlo como descuento automáticamente · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Descuentos y bonificaciones — distinción contable** — dos tipos diferenciados: `descuento` (no reduce base de honorarios, el propietario asume la diferencia) y `bonificacion` (reduce base de honorarios, la inmobiliaria también asume). Verificar que los flags `incluirEnBaseComision` e `impactaPropietario` reflejen correctamente esta distinción y que sea claro en la UI cuál es cuál · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Score de cliente** — métrica que refleja qué tanto trabajo da un inquilino. Schema: tabla `client_interaction` con `clientId`, `tipo` (reclamo/consulta/incidente), `descripcion`, `humorScore` (1–5). Score compuesto: frecuencia de reclamos + promedio humorScore + días promedio de pago. UI en ficha del inquilino · [inquilinos](docs/decisions/inquilinos.md)

- [ ] **Alert de próximo ajuste para propietarios multi-contrato** — el componente de inquilinos muestra un alert cuando se acerca un ajuste de índice. Para propietario con varias propiedades, requiere agregación: "Tienes 3 ajustes próximos en X mes" con link a detalle, o un alert por contrato. Necesita diseño · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Notificación post-recibo al propietario** — cuando se emite un recibo (modalidad split), enviar mensaje automático al propietario preguntando si recibió la transferencia. Empezar por mail o link a WhatsApp Web; en el futuro integración WhatsApp directa · [contabilidad](docs/decisions/contabilidad.md)

- [x] **Comprobante de liquidación al propietario (PDF)** — al emitir un recibo, generar también un PDF que el propietario pueda guardar/imprimir con: bruto cobrado, % comisión, neto recibido, datos del contrato y propiedad. Página `/comprobantes/[id]`, link desde cada entry conciliado en la CC · [contabilidad](docs/decisions/contabilidad.md)

---

## 🟢 Prioridad baja

- [ ] **Pool de motivos de cancelación (V2)** — reemplazar el campo de texto libre del dialog de cancelación por un `CreatableCombobox` que guarde y reutilice motivos frecuentes ("Error de carga", "No corresponde cobrar", etc.). Incluye: tabla en DB para los motivos, toggle de obligatorio/opcional por agencia desde un módulo de configuración · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Selector de mes en "Primer mes a cobrar"** — hoy muestra "1 de marzo de 2026" o "23 de marzo de 2026". Debería mostrar solo "Marzo 2026" independientemente del día seleccionado, ya que la granularidad es mensual · [contratos](docs/decisions/contratos.md)

- [ ] **Conectar/deprecar página `/propietarios/[id]/liquidacion`** — existe una página vieja con honorarios fijos en 7%, desconectada de la CC. Decidir: integrarla con la nueva CC, deprecarla, o reescribirla cuando se diseñe el flujo formal de liquidación · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Resumen de liquidaciones del año (CC propietario)** — botón global arriba de la tabla de la CC del propietario que liste todos los comprobantes emitidos en un período (mes/año). Permite imprimir o exportar la serie completa. Diferido del MVP de comprobantes de liquidación · [contabilidad](docs/decisions/contabilidad.md)

- [ ] **Generación servidor de PDFs (puppeteer/react-pdf)** — evaluar reemplazo del enfoque `@media print` por generación PDF en servidor. Habilitaría adjuntar PDFs al email (recibos del inquilino + comprobantes del propietario) y generación masiva. Costo: dependencia nueva pesada (Chromium si puppeteer). Revisar cuando el flujo de envío por email se vuelva el principal · [contabilidad](docs/decisions/contabilidad.md)

---

## 🔵 Backlog / Futuro

- [ ] **Pago dividido — punitorios con destino configurable por tipo** — hoy todos los punitorios van al propietario; en V2 permitir configurar por tipo de cargo qué destino aplica en contratos split · [contratos](docs/decisions/contratos.md)

- [ ] **Pago dividido — notificación al inquilino con datos de transferencia** — enviar automáticamente al inquilino los CBU/alias y montos de cada destinatario al generar el recibo en modalidad split · [contratos](docs/decisions/contratos.md)

- [ ] **Pago dividido — confirmación bancaria** — registrar qué CBU recibió efectivamente el dinero (comprobante de transferencia), hoy solo se registra el desglose esperado · [contratos](docs/decisions/contratos.md)

- [ ] **Marcar movimiento como "ya cobrado" sin emitir recibo** — postergado hasta tener login de inquilinos y carga de comprobantes; el flujo completo tiene más valor que el botón solo · ver [contabilidad](docs/decisions/contabilidad.md#conciliación-manual-marcar-como-ya-cobrado-sin-emitir-recibo)

- [ ] **Login de inquilinos** — acceso diferenciado para que los inquilinos vean su cuenta corriente y suban comprobantes de pago · ver [inquilinos](docs/decisions/inquilinos.md) · [usuarios-y-acceso](docs/decisions/usuarios-y-acceso.md)

---

## ✅ Completados → ver [HISTORIAL.md](HISTORIAL.md)

- [x] **Modalidad de pago dividido (honorarios por contrato)** — `paymentModality = "split"`, columna `beneficiario` en ledger, desglose en CobroPanel, cobro directo en cuenta del propietario
- [x] **Eliminar movimiento pendiente desde la UI de cuenta corriente** — soft cancel con menú `...` y dialog de confirmación con motivo opcional
