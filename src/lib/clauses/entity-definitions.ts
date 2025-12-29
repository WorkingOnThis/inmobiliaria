/**
 * Definiciones de entidades y propiedades para contenido estructurado de cláusulas
 */

import { AVAILABLE_ENTITIES, type AvailableEntity } from "./constants";

/**
 * Mapeo de entidades a sus propiedades disponibles
 * Cada propiedad tiene un label legible para mostrar en la UI
 */
export const ENTITY_PROPERTIES = {
  propietario: {
    nombre: "Nombre",
    dni: "DNI",
    domicilio: "Domicilio",
  },
  inquilino: {
    nombre: "Nombre",
    dni: "DNI",
    domicilio: "Domicilio",
  },
  propiedad: {
    direccion: "Dirección",
    ambientes: "Ambientes",
    superficie: "Superficie",
  },
} as const;

/**
 * Tipo para las propiedades de una entidad
 */
export type EntityProperties = typeof ENTITY_PROPERTIES;

/**
 * Obtiene las propiedades disponibles para una entidad
 * @param entity - Nombre de la entidad (singular)
 * @returns Objeto con las propiedades de la entidad o null si no existe
 */
export function getEntityProperties(
  entity: string
): Record<string, string> | null {
  const normalizedEntity = entity.toLowerCase().replace(/s$/, ""); // Remove plural
  const props = ENTITY_PROPERTIES[normalizedEntity as keyof EntityProperties];
  return props ? (props as Record<string, string>) : null;
}

/**
 * Verifica si una entidad es válida
 * @param entity - Nombre de la entidad (puede ser singular o plural)
 * @returns true si la entidad existe, false en caso contrario
 */
export function isValidEntity(entity: string): boolean {
  const normalizedEntity = entity.toLowerCase().replace(/s$/, ""); // Remove plural
  return normalizedEntity in ENTITY_PROPERTIES;
}

/**
 * Verifica si una propiedad es válida para una entidad
 * @param entity - Nombre de la entidad (puede ser singular o plural)
 * @param property - Nombre de la propiedad
 * @returns true si la propiedad existe para la entidad, false en caso contrario
 */
export function isValidProperty(entity: string, property: string): boolean {
  const props = getEntityProperties(entity);
  if (!props) return false;
  return property in props;
}

/**
 * Obtiene el label legible de una propiedad para una entidad
 * @param entity - Nombre de la entidad (puede ser singular o plural)
 * @param property - Nombre de la propiedad
 * @returns El label de la propiedad o null si no existe
 */
export function getPropertyLabel(
  entity: string,
  property: string
): string | null {
  const props = getEntityProperties(entity);
  if (!props) return null;
  return props[property] || null;
}

/**
 * Obtiene todas las entidades disponibles como objeto con labels
 */
export function getAvailableEntitiesWithLabels(): Record<
  AvailableEntity,
  string
> {
  return {
    propietarios: "Propietarios",
    inquilinos: "Inquilinos",
  };
}





