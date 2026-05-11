# Vista previa antes de emitir — Cobro inquilino y Liquidación propietario

**Fecha**: 2026-05-11
**Estado**: Aprobado para implementación
**Diseño visual de referencia**: `docs/design/vista-previa-recibo/`
- `Vista Previa Recibo.html` — prototipo HTML completo con interacciones
- `README.md` — guía de tokens, layout, componentes
- `VISUAL_SPECS.md` — escala tipográfica, paleta oklch → hex, dimensiones de botones
- `IMPLEMENTATION_GUIDE.md` — mapeo a componentes shadcn/ui

## Problema

Hoy el acto de cobrar al inquilino o liquidar al propietario tiene dos defectos:

1. **Cobro al inquilino**: el botón en `tenant-tab-current-account.tsx` llama directo a `POST /api/receipts/emit` con un dialog de confirmación apretado (ver captura del usuario). El dialog muestra un resumen mínimo, el usuario no ve el papel real que se va a emitir, y los movimientos se materializan al click sin posibilidad de revisar.
2. **Liquidación al propietario**: la pantalla `propietarios/[id]/liquidacion/page.tsx` ya tiene el layout de "vista previa estilo papel" (replica de `Vista Previa Recibo.html`), pero el botón "Confirmar y emitir" es decorativo: solo hace `setIsEmitido(true)` + incrementa el contador. **No crea ningún `cajaMovimiento` ni marca movimientos como liquidados.** El acto de liquidar no existe en backend.

## Solución

Insertar una pantalla de vista previa fiel al diseño de `Vista Previa Recibo.html` entre el origen (botón "Cobrar" / "Liquidar") y la materialización en DB. La pantalla:
- Muestra el papel A4 como se imprimiría, con marca de agua "BORRADOR" hasta confirmar.
- Permite ajustar opciones (mostrar QR, detalle, copia duplicada), agregar observaciones, agregar destinatarios CC.
- Materializa los movimientos solo cuando el usuario presiona Imprimir, Enviar email o Confirmar y emitir. Cualquiera de los tres dispara el mismo endpoint atómico.

## Arquitectura

### Sin draft en DB; idempotencia en el endpoint

La selección (ledger entry IDs, overrides, honorariosPct, fecha, observaciones, idempotencyKey) viaja del origen a la pantalla preview vía **`localStorage` con TTL de 30 minutos** bajo una key tipo `cobro-draft-<uuid>`. La pantalla preview lee la key al montar, descarta TTL vencidos, y borra la key después de leerla.

El endpoint de emit (`POST /api/receipts/emit` y `POST /api/owners/[id]/liquidacion/emit`) recibe un campo nuevo `idempotencyKey: string (uuid)`. El backend persiste esa key en una columna unique-indexed; si llega un segundo POST con la misma key devuelve el resultado anterior sin duplicar movimientos.

**Por qué no draft en DB**: agrega tablas, locks, cleanup jobs y migraciones para resolver casos (multi-usuario, approval workflow, recovery cross-device) que no existen hoy. La idempotencia + transacción atómica + numeración asignada-al-emit ya garantizan correctitud bajo doble click, network blip y reintento.

**Por qué localStorage y no sessionStorage**: sessionStorage no se hereda al abrir tab nueva. localStorage con TTL es el patrón más simple que sobrevive al `window.open(_, '_blank')`.

### Disparadores

**Cobro inquilino** — desde `tenant-tab-current-account.tsx`:
1. Eliminar el `<Dialog>` "Confirmar recibo" actual.
2. El botón "Cobrar" ejecuta:
   ```ts
   const draftId = crypto.randomUUID();
   const idempotencyKey = crypto.randomUUID();
   localStorage.setItem(`cobro-draft-${draftId}`, JSON.stringify({
     ledgerEntryIds, montoOverrides, beneficiarioOverrides,
     honorariosPct, fecha, idempotencyKey, createdAt: Date.now(),
   }));
   window.open(`/inquilinos/${tenantId}/cobro/preview?draft=${draftId}`, "_blank");
   ```

**Liquidación propietario** — sin cambios en el disparador. El link existente desde el tab Cuenta Corriente del propietario (`/propietarios/[id]/liquidacion?periodo=X`) ya funciona. La pantalla genera su propio `idempotencyKey` al montar.

### Endpoints

#### `POST /api/receipts/emit` (modificación)

Schema agregado:
```ts
idempotencyKey: z.string().uuid(),
observaciones: z.string().max(500).optional(),
action: z.enum(["confirm", "print", "email"]).default("confirm"),
```

Flujo:
1. Si existe `cajaMovimiento` con la misma `idempotencyKey` → devolver 200 con el `reciboNumero` ya emitido (no 201).
2. Validación previa: si alguno de los `ledgerEntryIds` ya está en estado `conciliado` → 409 con mensaje claro.
3. Transacción atómica existente, agregando:
   - `cajaMovimiento.idempotencyKey = idempotencyKey` en cada movimiento del recibo.
   - `cajaMovimiento.notas = observaciones` en el movimiento "anchor" (el de tipo income, tipoFondo agencia).
4. Si `action === "email"`: después del commit, disparar mail al inquilino (reutilizar template existente).

#### `POST /api/owners/[id]/liquidacion/emit` (nuevo)

Schema:
```ts
{
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  movimientoIds: z.array(z.string().uuid()).min(1),
  honorariosPct: z.number().min(0).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  action: z.enum(["confirm", "print", "email"]).default("confirm"),
}
```

Flujo:
1. Auth + permission check (`canManageClients`).
2. Si existe liquidación con la misma `idempotencyKey` → devolver 200 con el batchId.
3. Cargar movimientos scoped por agencyId. Validar que todos pertenezcan al `propietarioId = id` y al período declarado.
4. Si alguno tiene `settlementBatchId not null` → 409.
5. Transacción:
   - Generar `settlementBatchId` (uuid) y `liquidacionNumero` (incrementar `agency.liquidacionUltimoNumero`).
   - Marcar movimientos: `settlementBatchId`, `liquidadoAt = now`, `liquidadoPor = userId`.
   - Crear `cajaMovimiento` tipo `expense`, categoria `transferencia_propietario`, monto = total a transferir, tipoFondo `agencia`, propietarioId, idempotencyKey, notas, settlementBatchId.
6. Si `action === "email"`: disparar mail al propietario.

### Migraciones

Nueva migración Drizzle:
- `cajaMovimiento.idempotencyKey: text unique nullable indexed`
- `cajaMovimiento.notas: text nullable`
- `cajaMovimiento.settlementBatchId: uuid nullable indexed`
- `cajaMovimiento.liquidadoAt: timestamp nullable`
- `cajaMovimiento.liquidadoPor: text nullable` (FK a user.id)
- `agency.liquidacionUltimoNumero: integer default 0`

## UI — componentes compartidos

Para evitar duplicar el shell entre cobro inquilino y liquidación propietario:

```
src/components/document-preview/
├── document-preview-shell.tsx    // <Topbar> + <Canvas> + <Sidebar> con slots
├── paper.tsx                     // .paper A4 con noise overlay + marca BORRADOR opcional
├── paper-header.tsx              // logo agencia + datos fiscales + número provisional
├── paper-meta-block.tsx          // bloque "Recibí de" / "Período" (2 col)
├── paper-items-table.tsx         // tabla de items con concepto, fecha, importe
├── paper-totals.tsx              // subtotales + honorarios + total destacado
├── paper-footer.tsx              // QR + cláusulas + bank info + firma
├── side-summary-card.tsx         // KV rows + total
├── side-print-options.tsx        // toggles (BORRADOR, QR, detalle, duplicado)
├── side-recipients.tsx           // destinatarios + CC
└── side-observations.tsx         // textarea persistido en estado local hasta emit
```

Tokens visuales: usar las variables CSS existentes del proyecto (`--bg`, `--surface`, `--surface-mid`, `--border`, `--primary`, `--success`, `--warning`, `--error`, etc.) que ya están alineadas con la paleta oklch del handoff. La pantalla actual de liquidación ya las usa correctamente.

Refactor de `propietarios/[id]/liquidacion/page.tsx`: extraer los pieces inline a los componentes compartidos. No reescribir lógica, solo mover.

## Pantalla de cobro inquilino — contenido del paper

- **Header**: logo + datos agencia + número provisional `<próximo n.°>` + "RECIBO X" + fecha emisión.
- **Recibí de**: nombre inquilino, DNI/CUIT, email.
- **Período**: período de los items cobrados (deducido del más antiguo al más reciente) + dirección de la propiedad + nombre del propietario.
- **Detalle de movimientos**: tabla de los `ledgerEntries` seleccionados con fecha, concepto + meta (mes/año del ítem), importe (con override si aplica).
- **Totales**: subtotal items, honorarios %, propietario recibe (modalidad split) o total recibo (modalidad A).
- **Bank info**: CBU/alias del beneficiario que corresponde a la modalidad.
- **Footer**: cláusulas legales (de `agency.clauses`), QR opcional.

## Errores y casos borde

| Caso | Comportamiento |
|---|---|
| Doble click en Confirmar | idempotencyKey absorbe; segundo POST devuelve 200 con el mismo `reciboNumero`. |
| Cierra tab antes de confirmar | Nada queda en DB. La key de localStorage se autodestruye por TTL. |
| Reabrir preview con mismos items dos veces | Se generan dos idempotencyKey distintos. Mitigación: backend chequea estado `conciliado` previo y devuelve 409. |
| Sin email del destinatario | Botón "Enviar email" deshabilitado con tooltip explicativo. |
| Watermark BORRADOR en print | Visible solo si `!isEmitido && showWatermark`. CSS `@media print` lo respeta. |
| Liquidar movimientos ya liquidados | Backend chequea `settlementBatchId not null` → 409 con mensaje. |
| Items con monto null | Backend rechaza (validación existente en emit). UI deshabilita el botón Confirmar si detecta items inválidos. |
| Network falla mid-POST | Cliente reintenta con la misma idempotencyKey → backend devuelve el mismo recibo. |

## Plan de testing

**Unit**:
- Idempotencia: 2 POST con misma key → 1 inserción, 200 OK la segunda vez.
- Cálculo de totales con `montoOverrides`.
- Parsing de localStorage con TTL vencido descarta correctamente.
- Validación de período / agencyId scoping en liquidación emit.

**Integration**:
- Cobro inquilino full flow: crear ledger entry → abrir preview → confirmar → verificar `cajaMovimiento` + `tenantLedger.estado = conciliado`.
- Liquidación full flow: crear movimientos del período → abrir preview → confirmar → verificar `settlementBatchId` + nuevo `cajaMovimiento` de transferencia.
- Cross-agency isolation: usuario de agencia A no puede emitir contra ledger entries de agencia B.

**Manual UI**:
- Abrir preview, modificar overrides en sidebar, cambiar observaciones, confirmar; verificar que se persistió.
- Cerrar tab antes de confirmar, verificar que nada quedó.
- Imprimir desde la preview con BORRADOR on → revisar que el papel sale con marca; sin marca después de confirmar.
- Doble click rápido en Confirmar.

## División en PRs

1. **PR1 — Backend foundations**: migraciones (idempotencyKey, notas, settlementBatchId, liquidadoAt, liquidadoPor, liquidacionUltimoNumero) + modificación de `POST /api/receipts/emit` para aceptar idempotencyKey y observaciones + tests de idempotencia.
2. **PR2 — Componentes compartidos**: extraer `document-preview/*` desde la pantalla actual de liquidación. Refactor de `propietarios/[id]/liquidacion/page.tsx` para usar los componentes nuevos. Sin cambios funcionales.
3. **PR3 — Cobro inquilino preview**: nueva pantalla `/inquilinos/[id]/cobro/preview`, eliminar dialog "Confirmar recibo", integrar disparador desde `tenant-tab-current-account.tsx`. Wire al endpoint emit modificado.
4. **PR4 — Liquidación propietario backend + wire**: nuevo endpoint `POST /api/owners/[id]/liquidacion/emit`. Reemplazar `handleEmitir` actual de la pantalla de liquidación para llamar al endpoint nuevo. Email opcional en `action: "email"`.

Cada PR independiente, mergeable por separado, con tests verdes.
