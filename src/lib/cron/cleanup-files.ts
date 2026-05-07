import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { deleteUpload, parseFileUrl } from "@/lib/uploads/storage";

export interface CleanupResult {
  processed: number;
  deleted: number;
  cutoffDate: string;
}

export async function cleanupExpiredFiles(): Promise<CleanupResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const expired = await db
    .select({ id: cajaMovimiento.id, comprobanteUrl: cajaMovimiento.comprobanteUrl })
    .from(cajaMovimiento)
    .where(
      and(
        isNotNull(cajaMovimiento.comprobanteUrl),
        isNotNull(cajaMovimiento.settledAt),
        lt(cajaMovimiento.settledAt, cutoffDate)
      )
    );

  const cleanedIds: string[] = [];
  for (const mov of expired) {
    if (!mov.comprobanteUrl) continue;
    const parsed = parseFileUrl(mov.comprobanteUrl);
    if (parsed) {
      await deleteUpload(parsed.scope, parsed.id, parsed.filename);
    }
    cleanedIds.push(mov.id);
  }

  if (cleanedIds.length > 0) {
    await db
      .update(cajaMovimiento)
      .set({ comprobanteUrl: null, comprobanteMime: null, comprobanteTamano: null, updatedAt: new Date() })
      .where(inArray(cajaMovimiento.id, cleanedIds));
  }

  return { processed: expired.length, deleted: cleanedIds.length, cutoffDate: cutoffDate.toISOString() };
}
