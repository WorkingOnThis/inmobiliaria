# Spec: Resumen de cliente multi-rol

**Fecha:** 2026-04-30  
**Estado:** Aprobado  
**Alcance:** Sub-proyecto A — Doble rol de cliente

---

## Problema

Un cliente puede ser propietario de una propiedad e inquilino de otra. Hoy el sistema trata ambos roles como fichas separadas con URL separada pero sin conexión explícita entre ellas. No existe una vista unificada de la situación financiera de esa persona.

---

## Decisión de modelado

**No se modifica el schema de `client`.** El campo `client.type` queda como valor único (`owner | tenant | guarantor | contact`) y funciona como pista inicial, no como fuente de verdad de los roles activos.

Los roles se calculan dinámicamente desde las relaciones reales:
- Es **inquilino** si aparece en `contract_tenant`
- Es **propietario** si es `property.ownerId` o `contract.ownerId` de algún contrato
- Es **garante** si aparece en la tabla `guarantee`

Este cálculo ya existe en `GET /api/clients/[id]/roles` — no hay cambio de DB ni migración.

---

## Nueva pantalla: `/clientes/[id]`

Ruta: `src/app/(dashboard)/clientes/[id]/page.tsx`

Es el **hub de persona**: muestra todos los roles y su situación financiera en un período seleccionado.

### Selector de período

Opciones preconfiguradas: último mes, últimos 3 meses, últimos 6 meses, último año.  
También: rango personalizado (mes inicio → mes fin, en formato `YYYY-MM`).  
El período se pasa como query params: `?from=2025-06&to=2025-08`.

### Layout

```
┌─────────────────────────────────────────────┐
│  [Avatar] Nombre Apellido                   │
│  [Inquilino] [Propietario] [Resumen] ← toggle│
│                                             │
│  Período: [Último mes ▾]                    │
└─────────────────────────────────────────────┘

┌── COMO INQUILINO ───────────────────── $X total ┐
│  Contrato #001 · Av. Corrientes 1234            │
│    Jun 2025  Pagado    $150.000                 │
│    Jul 2025  Pendiente $160.000                 │
│                         Subtotal: $310.000      │
│                                                 │
│  Contrato #002 · San Martín 456                 │
│    Jun 2025  En mora   $200.000                 │
│                         Subtotal: $200.000      │
└─────────────────────────────────────────────────┘

┌── COMO PROPIETARIO ─────────────────── $Y total ┐
│  Contrato #003 · Belgrano 789 (inq: López)      │
│    Jun 2025  Liquidado $140.000                 │
│    Jul 2025  Pendiente $148.000                 │
│                         Subtotal: $288.000      │
└─────────────────────────────────────────────────┘

┌── TOTAL NETO ───────────────────────────────────┐
│  Cobró como propietario:  +$Y                   │
│  Debe como inquilino:     -$X                   │
│  Resultado:               $Y - $X               │
└─────────────────────────────────────────────────┘
```

Cada grupo (inquilino / propietario) aparece solo si el cliente tiene ese rol activo.  
Si solo tiene un rol, se muestra igual — sin total neto (no tiene sentido combinarlo).

### Datos por período dentro de cada contrato

- **Como inquilino**: filas del `tenant_ledger` donde `period` está dentro del rango seleccionado. Cada fila muestra: período, estado (pagado / pendiente / en mora), monto.
- **Como propietario**: entradas del ledger de propietario (`owner_ledger` o equivalente) filtradas por período. Cada fila muestra: período, estado (liquidado / pendiente), monto neto al propietario.

---

## Nuevo endpoint: `GET /api/clients/[id]/resumen`

Query params: `from` (YYYY-MM), `to` (YYYY-MM).

Respuesta:

```ts
{
  client: { id, firstName, lastName, ... },
  roles: string[],                // ["tenant", "owner"]
  asTenant: {
    contracts: Array<{
      contractId: string,
      contractNumber: string,
      propertyAddress: string,
      periods: Array<{
        period: string,           // "YYYY-MM"
        estado: string,           // "pagado" | "pendiente" | "en_mora"
        amount: number,
      }>,
      subtotal: number,
    }>,
    total: number,
  } | null,
  asOwner: {
    contracts: Array<{
      contractId: string,
      contractNumber: string,
      propertyAddress: string,
      tenantName: string,
      periods: Array<{
        period: string,
        estado: string,           // "liquidado" | "pendiente"
        amount: number,
      }>,
      subtotal: number,
    }>,
    total: number,
  } | null,
  net: number | null,             // asOwner.total - asTenant.total; null si solo hay un rol
}
```

---

## Cambios en componentes existentes

### `RoleToggle`

Agrega opción "Resumen" (`/clientes/{id}`) cuando el cliente tiene 2 o más roles activos.  
Las tres opciones posibles: `inquilino` | `propietario` | `resumen`.  
El toggle ya está montado en las fichas de inquilino y propietario — solo cambia la lógica interna.

### Creación de contratos

La búsqueda de inquilino al crear un contrato debe buscar en **todos los clientes**, sin filtrar por `client.type = "tenant"`. Esto permite asignar como inquilino a alguien que el sistema conoce solo como propietario.

---

## Fuera de alcance (V1)

- Lista global de clientes con buscador (`/clientes`)
- Edición de datos del cliente desde `/clientes/[id]` (se edita desde las fichas de rol)
- Notificaciones ni alertas desde el hub
- Score de cliente (Sub-proyecto E)

---

## Orden de implementación

1. Nuevo endpoint `GET /api/clients/[id]/resumen`
2. Nueva página `src/app/(dashboard)/clientes/[id]/page.tsx`
3. Actualizar `RoleToggle` para incluir opción "Resumen"
4. Fix en creación de contratos: buscar inquilino en todos los clientes
