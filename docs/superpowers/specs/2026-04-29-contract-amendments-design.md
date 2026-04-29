# Instrumentos Post-Firma de Contratos

**Fecha:** 2026-04-29  
**Estado:** Aprobado  
**Rama:** gaston/mvp-semana

---

## Contexto y motivación

El sistema ya permite generar contratos desde cero. Una vez firmado un contrato, pueden surgir dos tipos de situaciones jurídicamente distintas que requieren instrumentos adicionales:

- **Errores de hecho** (datos incorrectos en el texto original) → se corrigen con una nota de salvedad
- **Cambios de condiciones acordados** (modificaciones, prórrogas, rescisiones, etc.) → se documentan con el instrumento correspondiente

El sistema debe registrar estos eventos, actualizar los datos del contrato de forma inmediata (afectando cuenta corriente al instante), y opcionalmente generar el documento formal y registrar su firma.

---

## Casos cubiertos

| Tipo | Instrumento generado | Cuándo aplica |
|---|---|---|
| `erratum` | Nota de salvedad | Error de dato en el contrato firmado |
| `modification` | Acuerdo modificatorio | Cambio acordado de una condición |
| `extension` | Acuerdo de prórroga | Extensión del plazo del contrato |
| `termination` | Acta de rescisión consensuada | Terminación anticipada acordada |
| `guarantee_substitution` | Acuerdo de sustitución de garantía | Cambio de garante o garantía |
| `index_change` | Acuerdo de cambio de índice | Nuevo índice de ajuste acordado |

---

## Decisión de arquitectura: Opción C

Cuando se registra un instrumento:

1. Los campos de la tabla `contract` se actualizan directamente (igual que hoy).
2. El instrumento guarda un `contractSnapshot` — copia completa de la fila `contract` antes del cambio.
3. Cuenta corriente sigue leyendo `contract` sin ningún cambio. El efecto es inmediato al registrar.

**Por qué:** Simpler que layering (Opción B), pero con auditoría histórica completa. El snapshot permite reconstruir el estado del contrato en cualquier fecha, y permite revertir el instrumento de forma determinista si se borra.

**Regla de negocio central:** registrar = aplicar. No se requiere documento ni firma para que el cambio surta efecto en cuenta corriente.

---

## Schema de base de datos

### Tabla nueva: `contract_amendment`

```typescript
export const contractAmendment = pgTable("contract_amendment", {
  id:               text("id").primaryKey(),
  contractId:       text("contractId").notNull().references(() => contract.id, { onDelete: "restrict" }),
  type:             text("type").notNull(),
  // erratum | modification | extension | termination | guarantee_substitution | index_change

  sequenceNumber:   integer("sequenceNumber").notNull(),
  // correlativo global por contrato (1, 2, 3…)
  // el número por tipo ("Modificación N°2") se deriva en query: COUNT de mismo type anterior + 1

  status:           text("status").notNull().default("registered"),
  // registered | document_generated | signed

  title:            text("title").notNull(),
  description:      text("description"),

  fieldsChanged:    jsonb("fieldsChanged").notNull(),
  // { [fieldName]: { before: unknown, after: unknown } }

  contractSnapshot: jsonb("contractSnapshot").notNull(),
  // copia completa de la fila contract justo antes de este instrumento

  effectiveDate:    text("effectiveDate"),
  // ISO "YYYY-MM-DD" — obligatorio para modification, extension, termination, index_change

  documentUrl:      text("documentUrl"),
  signedAt:         timestamp("signedAt"),

  createdBy:        text("createdBy").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt:        timestamp("createdAt").notNull().defaultNow(),
  updatedAt:        timestamp("updatedAt").notNull().defaultNow(),
});
```

### Sin cambios a la tabla `contract`

No se agregan columnas. Los campos existentes se actualizan en el PATCH que ocurre al registrar el instrumento. Los datos derivados (¿tiene salvedades? ¿tiene modificaciones pendientes?) se calculan con joins a `contract_amendment` en las queries que los necesiten.

---

## API

### Rutas

```
GET    /api/contracts/[id]/amendments
POST   /api/contracts/[id]/amendments
GET    /api/contracts/[id]/amendments/[aid]
PATCH  /api/contracts/[id]/amendments/[aid]
POST   /api/contracts/[id]/amendments/[aid]/generate-document
DELETE /api/contracts/[id]/amendments/[aid]
```

### POST — Registrar instrumento

Ejecuta cuatro pasos en una sola transacción de base de datos:

1. Lee el contrato actual → guarda como `contractSnapshot`
2. Calcula `sequenceNumber` = MAX(sequenceNumber) + 1 para este `contractId`
3. Aplica `fieldsChanged` al contrato (`UPDATE contract SET ...`)
4. Inserta el `contract_amendment` con `status: "registered"`

Si cualquier paso falla, la transacción completa se revierte.

### Whitelist de campos por tipo

```typescript
const ALLOWED_FIELDS: Record<string, string[]> = {
  erratum:                ["contractType", "startDate", "endDate"],
  // Nota: correcciones de dirección del inmueble se registran solo en description
  // (propertyAddress pertenece a la tabla property, no a contract)
  modification:           ["monthlyAmount", "graceDays", "electronicPaymentFeePct",
                           "lateInterestPct", "paymentDay", "paymentModality",
                           "managementCommissionPct"],
  extension:              ["endDate", "monthlyAmount"],
  termination:            ["status"],
  guarantee_substitution: [],
  index_change:           ["adjustmentIndex", "adjustmentFrequency"],
}
```

Solo se permiten cambios a los campos listados para cada tipo. Cualquier campo fuera de la whitelist devuelve 400.

Para correcciones que afectan datos fuera de la tabla `contract` (ej: dirección del inmueble en `property`), el campo `description` documenta la corrección pero no se actualiza ningún campo en la BD — el usuario debe corregir el dato en la ficha de la propiedad por separado.

### Validaciones por tipo

| Tipo | Validaciones |
|---|---|
| `erratum` | Al menos un campo en `fieldsChanged` |
| `modification` | Al menos un campo + `effectiveDate` requerida |
| `extension` | `endDate.after > endDate.before` + `effectiveDate` requerida |
| `termination` | `effectiveDate` requerida · Status del contrato debe ser `active` o `expiring_soon` |
| `guarantee_substitution` | `description` requerida |
| `index_change` | `adjustmentIndex` distinto al actual + `effectiveDate` requerida |

### PATCH — Transiciones de estado

Transiciones válidas únicamente:

```
registered         → document_generated   (vía generate-document)
registered         → signed               (acuerdo verbal sin documento)
document_generated → signed               (se firmó el documento)
```

Al transicionar a `signed`: guarda `signedAt = now()`.  
Cualquier otra transición devuelve 400.

### DELETE — Borrar instrumento

Solo permitido si `status === "registered"` y `documentUrl` es null.  
Al borrar: **revierte `contract` al `contractSnapshot`** guardado en el instrumento.  
Si ya tiene documento generado: devuelve 409 con mensaje explícito.

### Respuesta del GET lista

```typescript
{
  id, type, status, title, description,
  sequenceNumber,
  typeSequenceNumber,  // calculado: COUNT de mismo type para este contrato hasta esta fila
  fieldsChanged: {
    [fieldName]: { before: unknown, after: unknown, label: string }
    // label en español, resuelto server-side
  },
  effectiveDate, documentUrl, signedAt, createdAt
}
```

---

## Generación de documentos

### Ruta

```
POST /api/contracts/[id]/amendments/[aid]/generate-document
```

Pasos:
1. Lee el `contract_amendment` + el contrato completo
2. Resuelve variables del contrato (igual que `/api/document-templates/resolve`)
3. Renderiza el template del tipo correspondiente (boilerplate fijo en V1)
4. Genera el PDF
5. Guarda la URL en `documentUrl`
6. Transiciona status a `document_generated`

### Estructura de los documentos

**Cabecera común** (todos los tipos):
```
[TIPO DE INSTRUMENTO] N°[typeSequenceNumber]

Contrato de locación N° [contractNumber]
Celebrado el [startDate] entre:
  Parte locadora:  [owner.name] · DNI [owner.dni]
  Parte locataria: [tenant.name] · DNI [tenant.dni]
  Administradora:  Arce Administración
```

**Cuerpo por tipo:**

`erratum`:
```
Las partes acuerdan que en el texto del contrato referido,
donde dice:   "[before]"
debe leerse:  "[after]"
Las demás cláusulas permanecen inalteradas.
```

`modification`:
```
Las partes acuerdan modificar las siguientes condiciones,
con vigencia a partir del [effectiveDate]:
  [label del campo]: [before] → [after]
Las demás cláusulas permanecen inalteradas.
```

`extension`:
```
Las partes acuerdan prorrogar el contrato hasta el [endDate.after],
con un canon mensual de $[monthlyAmount.after] a partir del [effectiveDate].
Las demás condiciones permanecen inalteradas.
```

`termination`:
```
Las partes acuerdan dar por rescindido el contrato a partir del [effectiveDate],
comprometiéndose la parte locataria a la entrega del inmueble en dicha fecha.
[description]
```

`guarantee_substitution`:
```
Las partes acuerdan sustituir la garantía original conforme lo siguiente:
[description]
```

`index_change`:
```
Las partes acuerdan reemplazar el índice de ajuste [adjustmentIndex.before]
por [adjustmentIndex.after], con vigencia a partir del [effectiveDate].
```

**Pie común** (todos los tipos):
```
Lugar y fecha: _________________, ___ de _________ de _____

___________________        ___________________
PARTE LOCADORA             PARTE LOCATARIA
[owner.name]               [tenant.name]

___________________
ARCE ADMINISTRACIÓN
```

### V2: integración con el sistema de templates existente

En V2, se pueden crear templates de tipo `amendment_erratum`, `amendment_modification`, etc. en el sistema de generador de documentos existente, permitiendo que la agencia personalice el texto. Para V1, el boilerplate fijo es suficiente.

---

## UX

### Nuevo tab "Instrumentos" en la ficha de contrato

Tabs actuales: Partes · Operativo · Documentos · Datos para documentos  
Tabs nuevos: Partes · Operativo · **Instrumentos** · Documentos · Datos para documentos

### Panel de instrumentos

**Header:** título "Instrumentos post-firma" + botón "Nuevo instrumento" (solo para `agent` y `account_admin`).

**Lista** (más nuevo arriba): para cada instrumento muestra:
- Tipo + número: "Acuerdo Modificatorio N°1" · "Salvedad N°2"
- Título libre
- Fecha de registro · Fecha efectiva
- Campos cambiados: `Días de gracia: 3 → 7`
- Badge de estado: `Registrado` · `Documento generado` · `Firmado`
- Acciones según estado:
  - `registered`: "Generar documento" + "Marcar como firmado" + "Eliminar"
  - `document_generated`: "Descargar PDF" + "Marcar como firmado"
  - `signed`: "Descargar PDF"

### Modal de creación — 2 pasos

**Paso 1 — Tipo de instrumento**

Seis opciones con ícono y descripción:

| Opción | Descripción corta |
|---|---|
| Salvedad | Corregir un error de dato en el texto |
| Modificación | Cambiar una condición acordada |
| Prórroga | Extender el plazo del contrato |
| Rescisión consensuada | Acordar la terminación anticipada |
| Sustitución de garantía | Reemplazar un garante o garantía |
| Cambio de índice | Acordar un nuevo índice de ajuste |

**Paso 2 — Datos del instrumento**

Campos comunes a todos los tipos:
- Título (texto libre, requerido)
- Descripción / motivo (texto libre, opcional)
- Fecha efectiva (según tipo)

Campos específicos por tipo: los campos del contrato que pueden cambiar, mostrando el valor actual como punto de partida.

Acción final: **"Registrar instrumento"** — sin documento obligatorio. El cambio aplica inmediatamente.

### Indicadores visuales en el tab Operativo

Campos modificados post-firma muestran un indicador junto al valor:

| Estado | Indicador |
|---|---|
| `registered` | Punto ámbar ● (cambio registrado, sin documento) |
| `document_generated` | Punto ámbar + ícono de documento |
| `signed` | Punto verde ● (formalizado) |

Hover sobre el indicador muestra tooltip:
> *"Modificado el 15/05/2024 · Acuerdo Modificatorio N°1 · Valor anterior: 3 días"*

### Header de la ficha

Badges adicionales junto al status del contrato:

```
CON-0001  [Activo ●]  [1 salvedad]  [2 modificaciones]
```

- Badge con borde punteado ámbar = instrumento en `registered` (sin documento)
- Badge sólido verde = todos los instrumentos de ese tipo en `signed`

---

## Permisos

| Rol | Leer | Crear / modificar | Eliminar |
|---|---|---|---|
| `visitor` | ✓ | ✗ | ✗ |
| `agent` | ✓ | ✓ | ✓ (solo `registered` sin doc) |
| `account_admin` | ✓ | ✓ | ✓ (solo `registered` sin doc) |

---

## Efecto sobre cuenta corriente

Ningún cambio en el código de cuenta corriente. Al registrar cualquier instrumento, los campos de `contract` ya tienen los nuevos valores. Cuenta corriente los lee como siempre.

---

## Fuera de alcance (V1)

- Firma electrónica per-parte (se rastrea una única fecha de firma del instrumento)
- Personalización del texto de los documentos vía el sistema de templates
- Notificaciones automáticas a las partes al registrar un instrumento
- Historial de reversiones de instrumentos eliminados
