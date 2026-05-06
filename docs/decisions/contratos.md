# Decisiones — Contratos

Módulo de contratos: creación, ajustes de índice, honorarios, cláusulas.

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
