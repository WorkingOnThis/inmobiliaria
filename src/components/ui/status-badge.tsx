import React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Variantes semánticas del StatusBadge.
 *
 * Estado de entidad (propietarios, inquilinos, clientes):
 *   active     → verde   (activo / vigente)
 *   suspended  → mostaza (suspendido / en alerta)
 *   baja       → rojo    (baja / bloqueado / rescindido / en mora)
 *
 * Estado de propiedad:
 *   rented      → verde propiedad (alquilada)
 *   available   → mostaza         (disponible)
 *   reserved    → azul            (reservada)
 *   maintenance → naranja         (en mantenimiento)
 *
 * Estado de contrato / genérico:
 *   expiring → azul  (por vencer)
 *   draft    → gris  (borrador / pendiente / sin contrato)
 *
 * Dominio financiero:
 *   income → verde ingresos (al día, positivo)
 */
export type StatusBadgeVariant =
  | "active"
  | "suspended"
  | "baja"
  | "rented"
  | "available"
  | "reserved"
  | "maintenance"
  | "expiring"
  | "draft"
  | "income";

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <Badge variant={variant}>
      <span className="size-1.5 rounded-full bg-current block flex-shrink-0" />
      {children}
    </Badge>
  );
}
