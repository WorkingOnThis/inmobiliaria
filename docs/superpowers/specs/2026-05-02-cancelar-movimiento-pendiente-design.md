# Spec: Cancelar movimiento pendiente desde la UI de cuenta corriente

**Fecha:** 2026-05-02  
**Estado:** Aprobado

---

## Contexto

La tabla de cuenta corriente (`LedgerTable`) muestra movimientos por período. Hoy no existe forma de cancelar un movimiento desde la UI — el endpoint `PATCH /api/tenants/[id]/ledger/[entryId]` ya soporta `estado: "cancelado"` pero no hay botón ni flujo para invocarlo.

---

## Alcance

**Incluido en esta versión:**
- Botón contextual (`...`) por fila que permite cancelar movimientos pendientes
- Dialog de confirmación con campo de motivo opcional (texto libre)
- Columna `cancellationReason` en base de datos para persistir el motivo
- Solo visible en la cuenta corriente del inquilino (read-only en propietario)

**Excluido (V2 futuro, baja prioridad):**
- Pool de motivos predefinidos como combobox creatable
- Toggle de motivo obligatorio/opcional por agencia
- Módulo de configuración de razones

---

## Estados cancelables

| Estado | ¿Cancelable? | Razón |
|--------|-------------|-------|
| `pendiente` | ✓ | No se cobró nada |
| `registrado` | ✓ | El inquilino dice que pagó, pero no conciliado |
| `pago_parcial` | ✓ | Se cobró parcialmente, movimiento sigue abierto |
| `pendiente_revision` | ✓ | Sin monto definido aún |
| `conciliado` | ✗ | Ya tiene recibo emitido — requiere anulación de recibo (feature separada) |
| `cancelado` | ✗ | Ya cancelado |
| `proyectado` | ✗ | No aparece en la UI |

Regla simple: **si no se cobró (sin recibo), se puede cancelar. Si ya se cobró, no.**

---

## Flujo UX

```
Fila cancelable → botón [...] (DropdownMenu)
  → opción "Cancelar movimiento"
    → Dialog de confirmación:
        - Descripción del movimiento (tipo + período + monto)
        - Textarea: "Motivo (opcional)"
        - Botones: [Volver] [Confirmar cancelación] (destructivo)
          → PATCH { estado: "cancelado", cancellationReason: "..." }
            → La fila desaparece de la vista (filtrada por defecto)
            → TanStack Query invalida y refresca la lista
```

---

## Cambios técnicos

### 1. Base de datos — `src/db/schema/tenant-ledger.ts`
- Nueva columna: `cancellationReason: text().nullable()` (sin default)
- Aplicar con `bun run db:push`

### 2. API — `PATCH /api/tenants/[id]/ledger/[entryId]`
- Agregar `cancellationReason: z.string().optional()` al schema Zod
- Persistir el campo junto con el cambio de estado

### 3. UI — `src/components/tenants/ledger-table.tsx`
- Agregar columna de acciones (sin encabezado) al extremo derecho de la tabla
- Renderizar `DropdownMenu` con botón `...` solo en filas con estado cancelable
- Dialog de confirmación inline (shadcn `Dialog` + `Textarea`)
- On confirm: `PATCH` al endpoint, luego `queryClient.invalidateQueries`

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/db/schema/tenant-ledger.ts` | +1 columna `cancellationReason` |
| `src/app/api/tenants/[id]/ledger/[entryId]/route.ts` | Agregar campo al schema Zod y al update |
| `src/components/tenants/ledger-table.tsx` | Agregar menú contextual y dialog |

---

## Comportamiento con punitorios hijos

Un alquiler puede tener punitorios hijos (`installmentOf = alquilerId`). Si se cancela el alquiler padre, los punitorios también se cancelan en la misma operación (no tiene sentido un punitorio por mora de un cargo cancelado).

La API (`PATCH /ledger/[entryId]`) cancela el entry padre y en el mismo request busca y cancela todos los entries con `installmentOf = entryId` que estén en estado cancelable.

---

## Criterios de éxito

1. Las filas cancelables muestran botón `...` con opción "Cancelar movimiento"
2. Las filas no cancelables no muestran el botón
3. El dialog muestra descripción del movimiento y campo de motivo opcional
4. Al confirmar: el estado cambia a `cancelado` en DB, la fila desaparece de la vista
5. El campo `cancellationReason` se persiste cuando se ingresa un motivo
6. Al cancelar un alquiler con punitorios hijos, los punitorios también se cancelan automáticamente
