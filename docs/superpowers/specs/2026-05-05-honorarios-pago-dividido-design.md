# Spec: Modalidad de pago dividido (honorarios por contrato)

**Fecha:** 2026-05-05  
**Estado:** aprobado  
**Área:** contratos · cuenta corriente inquilino · cuenta corriente propietario

---

## Problema

La inmobiliaria necesita, por razones impositivas, poder indicarle al inquilino cuánto transferir al propietario y cuánto a la administración, en lugar de cobrar todo y luego liquidar. Cada tipo de cargo tiene un destinatario natural, y el admin puede overridearlo puntualmente.

---

## Solución

Una nueva modalidad de pago `"split"` en el contrato. Cada entrada del ledger del inquilino lleva un campo `beneficiario` que indica a quién corresponde ese monto. La cuenta corriente del inquilino muestra el desglose al pie al seleccionar ítems. La cuenta del propietario distingue visualmente los cobros que llegaron directo.

---

## Schema

### `contract.paymentModality`

Nuevo valor permitido: `"split"`. Los valores existentes `"A"` y `"B"` no cambian.

| Valor | Significado |
|-------|-------------|
| `"A"` | Inmobiliaria cobra todo y liquida al propietario |
| `"B"` | Pago directo al CBU del propietario |
| `"split"` | Inquilino paga dividido: parte al propietario, parte a la administración |

### `tenant_ledger.beneficiario`

Nueva columna: `text`, nullable, default `null`.

| Valor | Significado |
|-------|-------------|
| `"propietario"` | El monto va 100% al propietario |
| `"administracion"` | El monto va 100% a la administración |
| `"split"` | El monto se divide según `contract.managementCommissionPct` |
| `null` | Contrato no es split — campo ignorado |

**Reglas de asignación automática** (solo para contratos `"split"`):

| Tipo de entrada | `beneficiario` por defecto |
|-----------------|---------------------------|
| `alquiler` | `"split"` |
| `punitorio` | `"propietario"` |
| Cargo manual | Elegido por el admin al crear |

### `tenant_ledger.splitBreakdown`

Nueva columna JSON en `tenant_ledger`, poblada al momento de conciliar el pago (cuando `estado` pasa a `"conciliado"`):

```json
{
  "propietario": 930000,
  "administracion": 145000
}
```

Solo se escribe en entradas de contratos `"split"`. Captura el estado real al momento del cobro, incluyendo cualquier override manual que el admin haya aplicado en esa sesión. Para entradas con `beneficiario = "propietario"` o `"administracion"` puro, el JSON tiene el monto completo en la clave correspondiente y cero en la otra.

---

## UI — Cuenta corriente del inquilino

### Columna "Destino"

Cada fila de la tabla muestra un badge según `beneficiario`:
- `"split"` → dos badges: `↗ Propietario $X` + `↗ Adm. $Y` (calculados desde `managementCommissionPct`)
- `"propietario"` → un badge: `↗ Propietario`
- `"administracion"` → un badge: `↗ Administración`

Solo visible cuando el contrato es modalidad `"split"`.

### Panel de desglose

Al seleccionar uno o más ítems, aparece al pie de la tabla un panel que muestra:
- **Al propietario [Nombre]**: $X — CBU: ... (del propietario del contrato)
- **A Arce Administración**: $Y — alias: ... (de la agencia)
- **Total a pagar**: $X + $Y

Los montos se suman considerando el `beneficiario` de cada ítem seleccionado.

**Fuente de los datos bancarios:**
- CBU del propietario: campo `cbu` del registro `client` del propietario del contrato
- Datos de la administración: tabla `agency` (CBU / alias de la agencia logueada)

### Override de destino (efímero)

En el `EntryDetailDialog` existente, cuando el contrato es `"split"`, se agrega un selector "Destino" con los valores `propietario` / `administracion` / `split`. Al cambiar el valor aparece una advertencia:

> ⚠️ Estás cambiando el destino original de este ítem. Esto afecta el desglose del recibo. El cambio aplica solo para este cobro y no queda guardado en el ítem.

El override vive en estado local del componente. Al salir de la pantalla sin registrar el pago, el ítem vuelve a su `beneficiario` original.

Al confirmar el pago, el override queda registrado en `splitBreakdown` del historial de pagos.

### `AddManualChargeDialog`

Cuando el contrato activo es modalidad `"split"`, se agrega un campo "¿A quién va este cargo?" con un `Select` de dos opciones: `Propietario` / `Administración`. Este valor se persiste como `beneficiario` en la entrada del ledger.

### Recibo

El recibo emitido muestra dos líneas de destino con los montos y datos bancarios de cada destinatario.

---

## UI — Cuenta corriente del propietario

Las entradas generadas a partir de pagos en modalidad `"split"` aparecen con:
- Fondo de fila azulado
- Badge **"↗ Cobro directo desde inquilino"**
- Estado: pendiente de liquidación (igual que cualquier otra entrada)

El admin liquida estas entradas de forma normal. En el resumen de liquidación, estos ítems llevan la nota "Cobrado directamente por el inquilino".

---

## Configuración del contrato

En el formulario de nuevo contrato (Paso 2 — Condiciones), el select de "Modalidad de pago" agrega la opción:

> **Modalidad Split — el inquilino paga dividido**  
> El inquilino recibe instrucciones de transferir una parte al propietario y otra a la administración. La división se calcula según el % de administración configurado.

En la ficha del contrato (vista de detalle), el % de administración aparece junto a la modalidad para que sea visible el criterio de división.

---

## Fuera de scope (V1)

- Punitorios con destino configurable por tipo (hoy siempre van al propietario)
- Notificación automática al inquilino con los datos de transferencia
- Registro de qué CBU recibió efectivamente el dinero (confirmación bancaria)
