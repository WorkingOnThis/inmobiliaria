/**
 * Client Constants
 */

export const CLIENT_TYPES = [
  "vendedor",
  "comprador",
  "locador",
  "dueño",
  "inquilino",
  "interesado",
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  vendedor: "Vendedor",
  comprador: "Comprador",
  locador: "Locador",
  dueño: "Dueño",
  inquilino: "Inquilino",
  interesado: "Interesado",
};

