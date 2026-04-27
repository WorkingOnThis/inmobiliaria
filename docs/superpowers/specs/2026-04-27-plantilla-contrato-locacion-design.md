# Diseño: Plantilla de Fábrica — Contrato de Locación

**Fecha:** 2026-04-27
**Estado:** Aprobado

## Objetivo

Crear una plantilla "de fábrica" con las 33 cláusulas del contrato de locación estándar de Arce Administración. La plantilla se genera automáticamente al crear la agencia y queda disponible en el generador de documentos como si la hubiera creado un usuario — editable, sin protección especial.

## Fuente

`docs/superpowers/ejemplo de contrato.md` — contrato real firmado el 25/04/2026.

## Decisiones de diseño

### 1. Campo `source` en `documentTemplate`

Agregar `source: text("source").notNull().default("custom")` al schema.

Valores: `"custom"` (creado por el usuario) | `"factory"` (creado por el sistema).

Sirve como base para un futuro marketplace de plantillas (otras agencias podrían acceder a plantillas `"factory"` mediante un plan pago).

### 2. Función `ensureDefaultTemplate(agencyId)`

Ubicación: `src/lib/document-templates/default-template.ts`

- Verifica si ya existe un template con `source = "factory"` para la agencia.
- Si no existe, crea el template y sus 33 cláusulas en una transacción.
- Idempotente: puede llamarse múltiples veces sin duplicar datos.

### 3. Hook de llamada

Se llama desde el endpoint de creación de agencia (POST /api/agency o equivalente) después de insertar la agencia.

### 4. Contenido de las cláusulas

Cada cláusula usa:
- `[[variable.path]]` — datos del contrato resueltos automáticamente (locador, locatario, propiedad, fechas, montos)
- `{{nombre_variable}}` — texto libre que el agente completa antes de imprimir (estado de ambientes)

Variables de texto libre identificadas:
- `{{ambientes_descripcion}}` — lista de ambientes de la propiedad
- `{{estado_living}}` — descripción del estado del living-comedor
- `{{estado_cocina}}` — descripción del estado de la cocina
- `{{estado_bano}}` — descripción del estado del baño
- `{{estado_dormitorio}}` — descripción del estado del dormitorio
- `{{estado_otros_ambientes}}` — otros ambientes (terraza, cochera, etc.)
- `{{observaciones_estado}}` — observaciones generales del estado

### 5. Cláusulas incluidas

| N° | Título | Variables clave |
|----|--------|----------------|
| 0 | Encabezado — Partes | locador, locatario, domicilios |
| 1 | PRIMERA. Inmueble | propiedad, estado por ambiente |
| 2 | SEGUNDA. Destino | texto fijo |
| 3 | TERCERA. Duración | fecha_inicio, fecha_fin, duracion_texto |
| 4 | CUARTA. Precio | precio_inicial_formato, precio_inicial_letras |
| 5 | QUINTA. Ajuste | tipo_ajuste, periodo_ajuste_meses |
| 6 | SEXTA. Forma de pago | dia_vencimiento, porcentaje_comision_pago_electronico |
| 7 | SÉPTIMA. Lugar de pago | domicilio_administradora, nombre_administradora |
| 8 | OCTAVA. Intransferibilidad | texto fijo |
| 9 | NOVENA. Mora | dia_vencimiento, porcentaje_interes_mora |
| 10 | DÉCIMA. Obligaciones | texto fijo |
| 11 | DÉCIMO PRIMERA. Responsabilidad del locador | texto fijo |
| 12 | DÉCIMO SEGUNDA. Mejoras | texto fijo |
| 13 | DÉCIMO TERCERA. Impuestos y servicios | responsables de servicios |
| 14 | DÉCIMO CUARTA. Expensas | tiene_expensas, responsable_expensas |
| 15 | DÉCIMO QUINTA. Conformación del precio | texto fijo + porcentaje_interes_mora |
| 16 | DÉCIMO SEXTA. Imputación de pagos | texto fijo |
| 17 | DÉCIMO SÉPTIMA. Cedulones | texto fijo |
| 18 | DÉCIMO OCTAVA. Garantes | garantes 1-3, domicilios, matrículas |
| 19 | DÉCIMO NOVENA. Rescisión anticipada | texto fijo |
| 20 | VIGÉSIMA. Renovación | texto fijo |
| 21 | VIGÉSIMO PRIMERA. Resolución culpable | texto fijo |
| 22 | VIGÉSIMO SEGUNDA. Restitución | texto fijo |
| 23 | VIGÉSIMO TERCERA. Domicilios | domicilios de todas las partes |
| 24 | VIGÉSIMO CUARTA. Compensación | texto fijo |
| 25 | VIGÉSIMO QUINTA. Juicio ejecutivo | texto fijo |
| 26 | VIGÉSIMO SEXTA. Actos escritos | texto fijo |
| 27 | VIGÉSIMO SÉPTIMA. Jurisdicción | texto fijo |
| 28 | VIGÉSIMO OCTAVA. Impuesto a los sellos | texto fijo |
| 29 | VIGÉSIMO NOVENA. Abandono y muerte | texto fijo |
| 30 | TRIGÉSIMA. Entrega de llaves | texto fijo |
| 31 | TRIGÉSIMO PRIMERA. Deudores morosos | texto fijo |
| 32 | TRIGÉSIMO SEGUNDA. Depósito en garantía | precio_inicial_formato, precio_inicial_letras |
| 33 | TRIGÉSIMO TERCERA. Sin anexos | fecha de firma |

### 6. Lo que se deja para después

- Texto justificado e impresión con guiones al final de línea (formato notarial) — es una preocupación de presentación, no de datos.
- Marketplace de plantillas para otras agencias (requiere UI + modelo de negocio).

## Rama de trabajo

`feat/plantilla-contrato`
