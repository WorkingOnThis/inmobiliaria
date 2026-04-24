import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { like, max } from "drizzle-orm";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function nextReciboNumero(tx?: DbOrTx): Promise<string> {
  const executor = tx ?? db;
  const [row] = await executor
    .select({ last: max(cajaMovimiento.reciboNumero) })
    .from(cajaMovimiento)
    .where(like(cajaMovimiento.reciboNumero, "REC-%"));

  let next = 1;
  if (row?.last) {
    const num = parseInt(row.last.replace("REC-", ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `REC-${String(next).padStart(4, "0")}`;
}
