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
 * Rental Statuses (occupancy)
 */
export const RENTAL_STATUSES = [
  "available",
  "rented",
  "reserved",
  "maintenance",
] as const;

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  available: "Disponible",
  rented: "Alquilada",
  reserved: "Reservada",
  maintenance: "En mantenimiento",
};

/**
 * Sale Statuses (null = not for sale)
 */
export const SALE_STATUSES = ["for_sale", "sold"] as const;

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  for_sale: "En venta",
  sold: "Vendida",
};

export const PRICE_CURRENCIES = ["ARS", "USD"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type RentalStatus = (typeof RENTAL_STATUSES)[number];
export type SaleStatus = (typeof SALE_STATUSES)[number];
export type PriceCurrency = (typeof PRICE_CURRENCIES)[number];

// Legacy alias kept for any callers not yet migrated
export const PROPERTY_STATUSES = RENTAL_STATUSES;
export type PropertyStatus = RentalStatus;
export const PROPERTY_STATUS_LABELS = RENTAL_STATUS_LABELS;
