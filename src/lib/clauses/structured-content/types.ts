/**
 * Tipos TypeScript para contenido estructurado de cláusulas
 */

/**
 * Tipo de una parte del contenido
 */
export type ContentPartType = "text" | "variable" | "iteration";

/**
 * Parte del contenido que representa texto plano
 */
export interface TextPart {
  type: "text";
  content: string;
}

/**
 * Parte del contenido que representa una variable simple
 * El path sigue el formato "entity.property" (ej: "propiedad.direccion")
 */
export interface VariablePart {
  type: "variable";
  path: string; // Formato: "entity.property"
}

/**
 * Parte del contenido que representa una iteración sobre una entidad
 */
export interface IterationPart {
  type: "iteration";
  entity: "propietarios" | "inquilinos";
  template: string; // Template que se aplicará a cada item (puede contener {{property}})
  separator: string; // Separador entre items (default: ", ")
  lastSeparator: string; // Separador antes del último item (default: " y ")
  addPeriod: boolean; // Si agregar punto final (default: true)
}

/**
 * Una parte del contenido estructurado puede ser texto, variable o iteración
 */
export type ContentPart = TextPart | VariablePart | IterationPart;

/**
 * Contenido estructurado completo
 */
export interface StructuredContent {
  type: "structured";
  parts: ContentPart[];
}

/**
 * Type guard para verificar si una parte es TextPart
 */
export function isTextPart(part: ContentPart): part is TextPart {
  return part.type === "text";
}

/**
 * Type guard para verificar si una parte es VariablePart
 */
export function isVariablePart(part: ContentPart): part is VariablePart {
  return part.type === "variable";
}

/**
 * Type guard para verificar si una parte es IterationPart
 */
export function isIterationPart(part: ContentPart): part is IterationPart {
  return part.type === "iteration";
}





