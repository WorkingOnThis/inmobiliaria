/**
 * Property Types
 */
export const PROPERTY_TYPES = [
  "casa",
  "departamento",
  "terreno",
  "local",
  "oficina",
  "cochera",
  "otro",
] as const;

/**
 * Property Type Labels
 */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa: "Casa",
  departamento: "Departamento",
  terreno: "Terreno",
  local: "Local Comercial",
  oficina: "Oficina",
  cochera: "Cochera",
  otro: "Otro",
};

/**
 * Property Statuses
 */
export const PROPERTY_STATUSES = [
  "available",
  "rented",
  "sold",
  "reserved",
] as const;

/**
 * Property Status Labels
 */
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  available: "Disponible",
  rented: "Alquilado",
  sold: "Vendido",
  reserved: "Reservado",
};

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

