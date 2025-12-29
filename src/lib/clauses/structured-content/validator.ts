/**
 * Funciones para validar contenido estructurado
 */

import type { StructuredContent, ContentPart, VariablePart, IterationPart } from "./types";
import { isVariablePart, isIterationPart } from "./types";
import {
  isValidEntity,
  isValidProperty,
  getEntityProperties,
} from "../entity-definitions";

/**
 * Valida el formato de un path de variable (entity.property)
 * @param path - Path a validar
 * @returns true si el formato es válido, false en caso contrario
 */
export function validateVariablePath(path: string): boolean {
  if (!path || typeof path !== "string") {
    return false;
  }

  const parts = path.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [entity, property] = parts;
  return isValidProperty(entity, property);
}

/**
 * Valida un contenido estructurado completo
 * @param content - Contenido estructurado a validar
 * @returns Objeto con valid: boolean y errors: string[]
 */
export function validateStructuredContent(content: StructuredContent): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar estructura básica
  if (!content || content.type !== "structured") {
    errors.push("El contenido debe tener type: 'structured'");
  }

  if (!Array.isArray(content.parts)) {
    errors.push("El contenido debe tener un array de parts");
    return { valid: false, errors };
  }

  // Validar cada parte
  content.parts.forEach((part: ContentPart, index: number) => {
    // TextPart: solo validar que tenga contenido
    if (part.type === "text") {
      if (typeof part.content !== "string") {
        errors.push(`Parte ${index + 1}: el contenido de texto debe ser un string`);
      }
    }

    // VariablePart: validar path
    if (part.type === "variable") {
      const variablePart = part as VariablePart;
      if (!validateVariablePath(variablePart.path)) {
        errors.push(
          `Parte ${index + 1}: el path de la variable "${variablePart.path}" no es válido`
        );
      }
    }

    // IterationPart: validar entidad, propiedades en template, y que template no esté vacío
    if (part.type === "iteration") {
      const iterationPart = part as IterationPart;

      // Validar entidad
      if (!isValidEntity(iterationPart.entity)) {
        errors.push(
          `Parte ${index + 1}: la entidad "${iterationPart.entity}" no es válida`
        );
      }

      // Validar que template no esté vacío
      if (!iterationPart.template || iterationPart.template.trim().length === 0) {
        errors.push(
          `Parte ${index + 1}: el template de iteración no puede estar vacío`
        );
      } else {
        // Validar propiedades en template (buscar {{property}})
        const propertyRegex = /\{\{(\w+)\}\}/g;
        const matches = iterationPart.template.matchAll(propertyRegex);
        const entityProps = getEntityProperties(iterationPart.entity);

        for (const match of matches) {
          const propertyName = match[1];
          if (entityProps && !isValidProperty(iterationPart.entity, propertyName)) {
            errors.push(
              `Parte ${index + 1}: la propiedad "${propertyName}" no es válida para la entidad "${iterationPart.entity}"`
            );
          }
        }
      }

      // Validar que separator y lastSeparator sean strings
      if (typeof iterationPart.separator !== "string") {
        errors.push(
          `Parte ${index + 1}: el separador debe ser un string`
        );
      }
      if (typeof iterationPart.lastSeparator !== "string") {
        errors.push(
          `Parte ${index + 1}: el separador final debe ser un string`
        );
      }
      if (typeof iterationPart.addPeriod !== "boolean") {
        errors.push(
          `Parte ${index + 1}: addPeriod debe ser un boolean`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}





