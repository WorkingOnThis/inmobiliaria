# Diseño — Comprobante de liquidación al propietario (PDF)

**Fecha:** 2026-05-06
**Estado:** Aprobado
**Scope:** Página HTML imprimible (`@media print` → PDF) accesible desde la cuenta corriente del propietario, una por recibo de cobro.

---

## Contexto

Cuando se emite un recibo al inquilino (modalidad A o split), no existe ningún
documento equivalente que la administradora le pueda dar al propietario para
acreditar qué se cobró, qué se descontó por honorarios y qué se transfirió.
El propietario lo necesita para sus registros, AFIP y eventuales reclamos.

El recibo del inquilino ya funciona con `@media print` (zero deps): pantalla A4
en `/recibos/[id]`, botón Imprimir que abre el diálogo nativo del navegador
("Guardar como PDF") y botón "Enviar por email" que manda link.

Este documento espeja ese módulo en `/comprobantes/[id]`, pero el contenido
está orientado al propietario (no al inquilino) y el lenguaje cambia según
modalidad de pago.

---

## Decisiones tomadas en brainstorming

1. **URL:** `/comprobantes/[id]` donde `[id]` es el UUID del `cajaMovimiento`
   (mismo patrón que `/recibos/[id]`). El número de recibo (`R-XXXX-NNNN`)
   se muestra dentro del documento, no en la URL.
2. **Documento por recibo, no por entry.** Un recibo cubre N cargos
   (alquiler + expensas + servicios + punitorios). El comprobante muestra el
   recibo entero como unidad.
3. **Punto de entrada:** menú `···` de cada fila real conciliada en la cuenta
   corriente del propietario (`isOwnerView` + `entry.estado === "conciliado"`
   + `entry.reciboNumero` + `!isSynthetic`). Las filas sintéticas (honorarios)
   no exponen acceso propio: comparten el mismo recibo con su entry padre.
4. **Email manual incluido en MVP** (botón "Enviar por email" → mail con link
   al propietario, mismo patrón del recibo del inquilino). La notificación
   automática post-recibo queda como ítem aparte en PENDIENTES.
5. **Lenguaje según modalidad:**
   - Modalidad A → título **"COMPROBANTE DE LIQUIDACIÓN"**, texto
     introductorio *"procedimos a cobrar y liquidar los siguientes
     conceptos..."*. Pie: "Neto transferido a CBU XXX · Alias YYY".
   - Modalidad split → título **"CONSTANCIA DE COBRO DISTRIBUIDO"**, texto
     *"el inquilino transfirió directamente los siguientes conceptos
     conforme al desglose..."*. Pie: distribución entre CBU propietario y
     CBU administradora.

   Razón: en split la administradora nunca tuvo el dinero del propietario, por
   lo que afirmar "liquidación" es contablemente incorrecto.
6. **Generación PDF con `@media print`** (no puppeteer/react-pdf). El navegador
   produce un PDF idéntico en calidad. Email manda link, no adjunto.
   Generación servidor → ítem en PENDIENTES baja prioridad.
7. **Refactor mínimo necesario:** la función `computeNetAndCommission()` que
   hoy vive embebida en `src/app/api/owners/[id]/cuenta-corriente/route.ts` se
   extrae a `src/lib/owners/commission.ts` para que la API del comprobante la
   reuse sin duplicar lógica contable.

---

## Qué entra en este scope

- Nueva página `/comprobantes/[id]/page.tsx` (cliente, A4, `@media print`)
- Nueva API `GET /api/comprobantes/[id]` (devuelve `ComprobanteData`)
- Nueva API `POST /api/comprobantes/[id]/send` (envío por email manual)
- Nuevo loader `src/lib/comprobantes/load.ts` con `loadComprobanteData()`
- Nueva plantilla de email `src/lib/comprobantes/email-template.ts`
- Refactor de `computeNetAndCommission()` a `src/lib/owners/commission.ts`
- Modificar `src/components/tenants/ledger-table.tsx`: agregar ítem
  "Ver comprobante de liquidación" al `DropdownMenuContent` cuando
  `isOwnerView` + entry conciliada + tiene `reciboNumero` + no es sintética.

---

## Qué NO está en scope (anotado o por anotar en PENDIENTES)

- **Botón global "Liquidaciones del año"** que liste todos los comprobantes
  del propietario (resumen de períodos) — feature aparte, prioridad baja.
- **Login del propietario** que le dé acceso directo al comprobante — ya
  existe ítem en PENDIENTES.
- **Comprobante multi-propietario** con porcentajes cuando hay co-owners
  legales múltiples — V2.
- **Notificación automática post-recibo** al propietario — ya existe ítem
  separado en PENDIENTES.
- **Generación servidor de PDF** (puppeteer/react-pdf) para adjuntar al
  email — agregar a PENDIENTES baja prioridad.
- **Generación masiva** de comprobantes ("imprimí todos los de marzo").

---

## Arquitectura — archivos

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── comprobantes/
│   │       └── [id]/
│   │           └── page.tsx                       NUEVO
│   └── api/
│       └── comprobantes/
│           └── [id]/
│               ├── route.ts                       NUEVO
│               └── send/
│                   └── route.ts                   NUEVO
├── lib/
│   ├── comprobantes/
│   │   ├── load.ts                                NUEVO
│   │   └── email-template.ts                     NUEVO
│   └── owners/
│       └── commission.ts                          NUEVO (refactor)
└── components/
    └── tenants/
        └── ledger-table.tsx                       MODIFY
```

`src/app/api/owners/[id]/cuenta-corriente/route.ts` se modifica para
importar `computeNetAndCommission` desde el nuevo `src/lib/owners/commission.ts`
en vez de tenerlo embebido — sin cambio de comportamiento.

Reusos sin tocar: `src/lib/receipts/format.ts` (`formatMonto`, `formatFecha`,
`formatPeriodo`, `montoEnLetras`, `agencyDisplayName`), infraestructura Resend
en `src/lib/auth/email.ts`.

---

## Datos — `ComprobanteData`

```ts
export type ComprobanteData = {
  movimiento: {
    id: string;
    reciboNumero: string;          // "R-0001-0023"
    date: string;                  // "YYYY-MM-DD"
    period: string;                // "YYYY-MM"
    amount: string;                // bruto total cobrado
    paymentModality: "A" | "split";
    anuladoAt: string | null;
  };
  contrato: {
    contractNumber: string;
    paymentModality: "A" | "split";
    managementCommissionPct: number;
  };
  propiedad: {
    address: string;
    floorUnit: string | null;
  };
  inquilino: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
  };
  propietario: {                   // legal owner = Parte Locadora
    firstName: string;
    lastName: string | null;
    dni: string | null;
    email: string | null;
    cbu: string | null;             // campo `client.cbu`
    alias: string | null;           // campo `client.alias`
  };
  items: {
    id: string;                    // tenantLedger.id
    descripcion: string;
    period: string | null;
    bruto: number;
    comisionPct: number;
    comision: number;
    neto: number;
  }[];
  totales: {
    bruto: number;
    comision: number;
    neto: number;
  };
  agency: {
    /* mismo shape que ReceiptData["agency"] en src/lib/receipts/load.ts */
  };
};
```

### Construcción

`loadComprobanteData(movimientoId, agencyOwnerId)`:

1. `db.select()` del `cajaMovimiento` por `id`. Si no existe o no tiene
   `reciboNumero` → `null` → 404.
2. `db.select()` de `receiptAllocation` filtrando por `reciboNumero` para
   obtener todos los `ledgerEntryId` saldados por ese recibo.
3. `db.select()` de `tenantLedger` con `inArray(id, ledgerEntryIds)`,
   joineado con `contract` para obtener `managementCommissionPct`.
4. Para cada entry, llamar `computeNetAndCommission(entry, pct)` (función
   ya existente, movida a `src/lib/owners/commission.ts`). Construir
   array `items` y sumar `totales`.
5. Resolver `propietario` desde el **legal owner actual** de la propiedad
   (consistente con `document-template/resolve` que usa esa misma lógica).
   Construir una lista de candidatos:
   - Si `property.ownerRole IN ("legal", "ambos")` → sumar `property.ownerId`
     a la lista (rol del propietario primario).
   - Sumar todos los `property_co_owner.clientId` con
     `role IN ("legal", "ambos")`.
   Si la lista está vacía → 404 con mensaje
   *"La propiedad no tiene propietario legal asignado"*.
   Si tiene 1 o más → V1 toma el primero por `createdAt` ascendente. V2
   soportará comprobante multi-propietario con porcentajes.
6. `agency` se carga igual que en `loadReceiptData` (por `ownerId`).

### Sentencia única en JS, no SQL avanzado

El cálculo de neto/comisión se hace en JavaScript después de la query, igual
que ya se hace hoy en la cuenta corriente. No introducimos SQL nuevo más allá
de los joins existentes.

---

## UI — página `/comprobantes/[id]`

Estructura visual espeja `/recibos/[id]/page.tsx`:

- **Barra superior** (`print:hidden`, h-14): botón "Volver", botón "Enviar por
  email" (deshabilitado si propietario sin email), botón "Imprimir".
- **Bloque A4** (760px de ancho útil, paleta `#f7f5ef` / `#1a1614`, tipografía
  Inter + JetBrains Mono).

### Header

- Logo + nombre administradora + datos fiscales (idéntico al recibo).
- Bloque derecho: tipo de documento (cambia según modalidad), número de
  recibo, matrícula.

### Identificación

- Grid 2 columnas:
  - Izquierda: "LIQUIDADO A" / nombre completo del propietario / DNI/CUIT /
    dirección de la propiedad.
  - Derecha: fecha del movimiento, período (`MMMM YYYY`), número de
    contrato, modalidad ("A" o "Pago dividido").
- Línea aclaratoria: "Inquilino: [nombre] · DNI [dni]".

### Texto introductorio (varía según modalidad)

- **Modalidad A**:
  > "Comprobamos haber percibido del inquilino los siguientes conceptos
  > correspondientes al contrato indicado, y procedido a su liquidación
  > según el detalle adjunto."

- **Modalidad split**:
  > "Dejamos constancia de que el inquilino transfirió directamente los
  > siguientes conceptos conforme al desglose adjunto, correspondientes al
  > contrato indicado."

### Tabla de detalle

Columnas: `Concepto · Período · Bruto · % · Honorarios · Neto`.

Cuando un ítem no genera comisión (`comisionPct = 0`), las celdas `%` y
`Honorarios` quedan en blanco/`—` y `Neto = Bruto`.

### Totales

- Línea de totales: bruto / comisión / neto.
- Bloque destacado al pie de la tabla:
  > **Neto al propietario: $XXX**
  > Son: [monto en letras]

### Bloque de distribución (varía según modalidad)

- **Modalidad A**:
  > "Neto transferido a CBU [propietario.cbu] · Alias
  > [propietario.alias]"

  Si `propietario.cbu` y `propietario.alias` son ambos null, se omite el
  bloque sin mensaje de error.

- **Modalidad split**:
  > "Distribución del cobro:
  >  · Propietario: $[neto] → CBU [propietario.cbu] · Alias [propietario.alias]
  >  · Administración: $[comisión] → CBU [agency.bancoCBU] · Alias [agency.bancoAlias]"

### Cláusulas y firma

- Cláusulas de la administradora (mismo bloque del recibo, si tiene).
- Firma: imagen `agency.signatureUrl` o nombre del `agency.signatory` con
  tipografía manuscrita.
- Pie firma: "Por [agencia.name] · [agency.signatoryTitle || 'Administrador']"

### Sello "ANULADO"

Si `movimiento.anuladoAt != null`, superpuesto al bloque A4 hay un `<div>`
posicionado absoluto, rotado ~35°, fondo rojo translúcido (`rgba(220,38,38,.1)`),
borde rojo, texto "ANULADO" grande. Visible en pantalla y en print.

### Modal "Enviar por email"

Mismo patrón del recibo del inquilino:

- Lista de destinatarios (V1: solo `propietario.email` si existe).
- Botón "Enviar" → llama `POST /api/comprobantes/[id]/send` con `{ to: [email] }`.
- Estado de éxito/error igual al modal del recibo.

---

## API endpoints

### `GET /api/comprobantes/[id]`

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadComprobanteData } from "@/lib/comprobantes/load";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManageClients(session.user.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const data = await loadComprobanteData(id, session.user.id);
  if (!data) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });

  return NextResponse.json(data);
}
```

### `POST /api/comprobantes/[id]/send`

Body: `{ to: string[] }`. Valida con Zod, carga el comprobante, manda mail con
plantilla `comprobantes/email-template.ts`, devuelve `{ sent: number, failed: string[] }`.

---

## Email template

Sigue el mismo formato del recibo del inquilino (`src/lib/receipts/email-template.ts`):

- Asunto: `Comprobante de liquidación – Recibo R-XXXX-NNNN` (modalidad A) o
  `Constancia de cobro – Recibo R-XXXX-NNNN` (split).
- Cuerpo HTML simple: saludo, breve descripción del documento, link a
  `/comprobantes/[id]`, despedida con datos de la administradora.

---

## Errores y casos borde

| Caso | Comportamiento |
|---|---|
| Movimiento no existe | 404, página muestra "Comprobante no encontrado" |
| Movimiento sin `reciboNumero` | 404, mensaje "Comprobante no encontrado" |
| Movimiento sin `propiedadId` o `contratoId` | 404 |
| Sesión inexistente | middleware redirige a `/login` |
| Rol `visitor` | 403 |
| Falla DB | 500 con log |
| Recibo anulado (`anuladoAt != null`) | Comprobante igual se renderiza con sello diagonal "ANULADO" |
| Propiedad sin propietario legal | 404 con mensaje claro |
| Co-owners legales múltiples | V1: usa el primero por orden de creación; V2: multi-propietario con porcentajes |
| Comisión 0% | Tabla muestra columnas `%` y `Honorarios` vacías; neto = bruto |
| `splitBreakdown` JSON malformado | Fallback al cálculo por porcentaje (igual que hoy en `computeNetAndCommission`) |
| Propietario sin CBU/alias | Bloque "Datos bancarios" se omite |
| Propietario sin email | Botón "Enviar por email" deshabilitado con tooltip |
| Falla envío de email | Modal muestra error, permite reintentar |

---

## Testing manual

Tras implementar, abrir la app en el browser y validar:

### Flujo feliz — modalidad A
1. Propietario con cobro modalidad A → tab Cuenta corriente → fila conciliada → menú `···` → "Ver comprobante de liquidación".
2. ✓ Página abre con título **"COMPROBANTE DE LIQUIDACIÓN"**.
3. ✓ Inquilino con DNI, contrato, propiedad, modalidad visibles.
4. ✓ Tabla con cada cargo y bruto/%/honorarios/neto.
5. ✓ Totales coinciden con suma de filas.
6. ✓ Pie: "Neto transferido a CBU XXX · Alias YYY".
7. ✓ Firma de la administradora visible.
8. ✓ `Ctrl+P` → preview muestra solo el comprobante.

### Flujo feliz — modalidad split
1. Propietario con cobro split → entry conciliada → menú `···` → "Ver comprobante de liquidación".
2. ✓ Título **"CONSTANCIA DE COBRO DISTRIBUIDO"**.
3. ✓ Texto introductorio dice "el inquilino transfirió directamente...".
4. ✓ Pie muestra distribución a dos CBUs.

### Edge cases
- Comisión 0% → columnas `%` y `Honorarios` vacías, neto = bruto.
- Recibo anulado → sello "ANULADO" diagonal visible en pantalla y print.
- URL inválida `/comprobantes/aaaa-bbbb` → "Comprobante no encontrado".
- Movimiento de caja general → 404.
- Propietario sin email → botón "Enviar por email" deshabilitado.
- Propietario sin CBU → sección bancaria omitida.

### Email
1. Click "Enviar por email" → modal con email del propietario preseleccionado.
2. Click "Enviar" → ✓ Resend confirma envío (`{ sent: 1, failed: [] }`).
3. Bandeja de entrada → ✓ llega mail con link a `/comprobantes/[id]`.

### Regresión
- `/recibos/[id]` sigue funcionando idéntico.
- Cuenta corriente del propietario: KPIs, filtros, accordion, sin cambios visibles.
- Filas pendientes/futuras del propietario → menú `···` no muestra "Ver comprobante".
- Filas sintéticas (honorarios) → tampoco muestra "Ver comprobante".

---

## PENDIENTES — items a sumar tras este spec

- **Prioridad baja** — *"Botón global 'Liquidaciones del año' en CC propietario"*: arriba de la tabla, lista todos los comprobantes del propietario por período. Vincula con `[contabilidad](docs/decisions/contabilidad.md)`.
- **Prioridad baja** — *"Generación servidor de PDFs (puppeteer/react-pdf)"*: evaluar para envío como adjuntos en mails y generación masiva. Cubrir recibo del inquilino + comprobante del propietario en una pasada.
