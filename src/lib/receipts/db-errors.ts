/**
 * Detecta si un error de la DB es un violación de constraint UNIQUE.
 * Útil para manejar race conditions en endpoints idempotentes.
 *
 * @param indexName - Si se especifica, además verifica que el constraint
 *   coincida con ese nombre. Útil para distinguir entre múltiples índices
 *   únicos en la misma tabla.
 */
export function isUniqueViolation(err: unknown, indexName?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = e.code ?? e.cause?.code;
  const constraint = e.constraint ?? e.cause?.constraint;
  if (code !== "23505") return false;
  return indexName ? constraint === indexName : true;
}
