import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { and, inArray, isNotNull, lt } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

export interface ResultadoLimpieza {
  procesados: number;
  eliminados: number;
  fechaLimite: string;
}

/**
 * Elimina comprobantes de movimientos liquidados hace más de 90 días.
 * Borra los archivos del disco y limpia los campos en BD en un solo UPDATE bulk.
 */
export async function limpiarArchivosVencidos(): Promise<ResultadoLimpieza> {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 90);

  const vencidos = await db
    .select({ id: cajaMovimiento.id, comprobanteUrl: cajaMovimiento.comprobanteUrl })
    .from(cajaMovimiento)
    .where(
      and(
        isNotNull(cajaMovimiento.comprobanteUrl),
        isNotNull(cajaMovimiento.liquidadoEn),
        lt(cajaMovimiento.liquidadoEn, fechaLimite)
      )
    );

  const idsLimpiados: string[] = [];
  for (const mov of vencidos) {
    if (!mov.comprobanteUrl) continue;
    await fs.unlink(path.join(process.cwd(), "public", mov.comprobanteUrl)).catch(() => {});
    idsLimpiados.push(mov.id);
  }

  if (idsLimpiados.length > 0) {
    await db
      .update(cajaMovimiento)
      .set({ comprobanteUrl: null, comprobanteMime: null, comprobanteTamano: null, actualizadoEn: new Date() })
      .where(inArray(cajaMovimiento.id, idsLimpiados));
  }

  return { procesados: vencidos.length, eliminados: idsLimpiados.length, fechaLimite: fechaLimite.toISOString() };
}
