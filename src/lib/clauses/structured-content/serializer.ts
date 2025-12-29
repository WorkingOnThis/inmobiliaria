/**
 * Funciones para serializar contenido estructurado a JSON string
 */

import type { StructuredContent } from "./types";

/**
 * Serializa un StructuredContent a JSON string
 * @param content - Contenido estructurado a serializar
 * @returns JSON string del contenido estructurado
 * @throws Error si la serialización falla
 */
export function serializeStructuredContent(
  content: StructuredContent
): string {
  try {
    return JSON.stringify(content);
  } catch (error) {
    throw new Error(
      `Error al serializar contenido estructurado: ${error instanceof Error ? error.message : "Error desconocido"}`
    );
  }
}





