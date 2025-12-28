/**
 * Constantes para la gestión de cláusulas de contratos
 */

/**
 * Categorías predefinidas para las plantillas de cláusulas
 */
export const CLAUSE_CATEGORIES = [
  "Pago",
  "Mantenimiento",
  "Terminación",
  "Obligaciones del Inquilino",
  "Obligaciones del Propietario",
  "General",
] as const;

/**
 * Tipo para las categorías de cláusulas
 */
export type ClauseCategory = (typeof CLAUSE_CATEGORIES)[number];

/**
 * Longitud máxima para el título de una cláusula
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * Longitud máxima para el contenido de una cláusula
 */
export const MAX_CONTENT_LENGTH = 50000;

/**
 * Entidades disponibles para uso en cláusulas estructuradas
 */
export const AVAILABLE_ENTITIES = ["propietarios", "inquilinos"] as const;

/**
 * Tipo para las entidades disponibles
 */
export type AvailableEntity = (typeof AVAILABLE_ENTITIES)[number];

