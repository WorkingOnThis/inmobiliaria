/**
 * Funciones para parsear JSON string a contenido estructurado
 */

import type {
  StructuredContent,
  ContentPart,
  TextPart,
  VariablePart,
  IterationPart,
} from "./types";
import {
  isTextPart,
  isVariablePart,
  isIterationPart,
} from "./types";

/**
 * Verifica si un string es contenido estructurado válido
 * @param content - String que puede ser JSON o texto plano
 * @returns true si es contenido estructurado válido, false en caso contrario
 */
export function isStructuredContent(content: string): boolean {
  if (!content || typeof content !== "string") {
    return false;
  }

  try {
    const parsed = JSON.parse(content);
    return (
      parsed &&
      typeof parsed === "object" &&
      parsed.type === "structured" &&
      Array.isArray(parsed.parts)
    );
  } catch {
    return false;
  }
}

/**
 * Parsea un array de partes desconocidas a ContentPart[]
 * Valida cada parte según su tipo
 * @param parts - Array de partes desconocidas
 * @returns Array de ContentPart válidos
 */
export function parseContentParts(parts: unknown[]): ContentPart[] {
  const validParts: ContentPart[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue; // Skip invalid parts
    }

    const partObj = part as Record<string, unknown>;

    // TextPart
    if (partObj.type === "text" && typeof partObj.content === "string") {
      validParts.push({
        type: "text",
        content: partObj.content,
      } as TextPart);
      continue;
    }

    // VariablePart
    if (
      partObj.type === "variable" &&
      typeof partObj.path === "string" &&
      partObj.path.trim().length > 0
    ) {
      validParts.push({
        type: "variable",
        path: partObj.path,
      } as VariablePart);
      continue;
    }

    // IterationPart
    if (
      partObj.type === "iteration" &&
      typeof partObj.entity === "string" &&
      typeof partObj.template === "string" &&
      typeof partObj.separator === "string" &&
      typeof partObj.lastSeparator === "string" &&
      typeof partObj.addPeriod === "boolean" &&
      (partObj.entity === "propietarios" || partObj.entity === "inquilinos")
    ) {
      validParts.push({
        type: "iteration",
        entity: partObj.entity,
        template: partObj.template,
        separator: partObj.separator,
        lastSeparator: partObj.lastSeparator,
        addPeriod: partObj.addPeriod,
      } as IterationPart);
      continue;
    }
  }

  return validParts;
}

/**
 * Parsea un JSON string a StructuredContent
 * @param jsonString - JSON string a parsear
 * @returns StructuredContent parseado o null si no es válido
 */
export function parseStructuredContent(
  jsonString: string
): StructuredContent | null {
  if (!jsonString || typeof jsonString !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Verificar estructura básica
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.type !== "structured" ||
      !Array.isArray(parsed.parts)
    ) {
      return null;
    }

    // Parsear y validar partes
    const parts = parseContentParts(parsed.parts);

    return {
      type: "structured",
      parts,
    };
  } catch {
    return null;
  }
}

/**
 * Detecta el formato del contenido (estructurado vs texto plano)
 * @param content - Contenido a analizar
 * @returns "structured" si es JSON válido con estructura esperada, "plain" en caso contrario
 */
export function detectContentFormat(content: string): "plain" | "structured" {
  return isStructuredContent(content) ? "structured" : "plain";
}




