import { NextResponse } from "next/server";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import type { auth } from "./index";

type Session = typeof auth.$Infer.Session;

/**
 * Tipo para tablas que tienen una columna `agencyId`. Usado por
 * `requireAgencyResource` para garantizar a nivel de tipos que solo
 * podés llamarlo con tablas que estén scoped por agency.
 */
type AgencyScopedTable = PgTable & {
  id: PgColumn;
  agencyId: PgColumn;
};

/**
 * Error que llevás cuando una route no puede acceder a un recurso
 * por razones de tenancy. Se mapea a HTTP status vía `handleAgencyError`.
 */
export class AgencyAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message: string
  ) {
    super(message);
    this.name = "AgencyAccessError";
  }
}

/**
 * Toda route handler que accede a recursos de negocio empieza con esto.
 * Tira:
 *   - 401 si no hay sesión (user no logueado)
 *   - 403 si la sesión no tiene agencyId (visitor sin agency)
 *
 * Devuelve el agencyId del user — ese valor se pasa después a queries
 * y a `requireAgencyResource`.
 */
export function requireAgencyId(session: Session | null): string {
  if (!session?.user) {
    throw new AgencyAccessError(401, "No autenticado");
  }
  if (!session.user.agencyId) {
    throw new AgencyAccessError(
      403,
      "No has completado el registro de inmobiliaria"
    );
  }
  return session.user.agencyId;
}

/**
 * Carga un recurso de una tabla scoped por agency, validando que pertenece
 * a la agency dada. Si no existe O pertenece a otra agency, tira 404
 * con mensaje genérico (no leak de existencia).
 *
 * Uso típico:
 *   const session = await auth.api.getSession({ headers: await headers() });
 *   const agencyId = requireAgencyId(session);
 *   const { id } = await params;
 *   const prop = await requireAgencyResource(property, id, agencyId);
 */
export async function requireAgencyResource<T extends AgencyScopedTable>(
  table: T,
  id: string,
  agencyId: string,
  extraConditions: SQL[] = []
): Promise<Record<string, unknown>> {
  const conditions = [
    eq(table.id, id),
    eq(table.agencyId, agencyId),
    ...extraConditions,
  ];
  const [row] = await db
    .select()
    .from(table as PgTable)
    .where(and(...conditions))
    .limit(1);
  if (!row) {
    throw new AgencyAccessError(404, "Recurso no encontrado");
  }
  return row;
}

/**
 * Helper para usar dentro del catch de cada route handler.
 * Si el error es un AgencyAccessError, devuelve la NextResponse adecuada.
 * Si no, devuelve null para que la route lo re-tire o lo maneje.
 *
 * Uso:
 *   try { ... }
 *   catch (err) {
 *     const resp = handleAgencyError(err);
 *     if (resp) return resp;
 *     // ... manejar otros errores
 *   }
 */
export function handleAgencyError(err: unknown): NextResponse | null {
  if (err instanceof AgencyAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
