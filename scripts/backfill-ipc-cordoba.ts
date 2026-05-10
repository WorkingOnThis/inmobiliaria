/**
 * Carga histórica de IPC (Córdoba) desde dos CSVs oficiales.
 * Ejecutar una sola vez: bun run scripts/backfill-ipc-cordoba.ts
 *
 * Archivos esperados:
 *   C:\Users\guill\Desktop\ipc-marzo-2026-.xlsx.csv          (nov-25 a mar-26, base jun-nov 2025)
 *   C:\Users\guill\Desktop\ipc-cba-base-2014100-julio-2013-a-noviembre-2025.csv  (jul-13 a nov-25, base 2014)
 */

import { readFileSync } from "fs";
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../src/db";
import { agency } from "../src/db/schema/agency";
import { adjustmentIndexValue } from "../src/db/schema/adjustment-index-value";
import { and, eq } from "drizzle-orm";

const INDEX_TYPE = "IPC (Córdoba)";
// Cargar desde 3 años atrás (necesitamos el mes previo para calcular el primero)
const FROM_PERIOD = "2023-04";

const MONTH_MAP: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
};

function parsePeriodCol(col: string): string | null {
  const parts = col.trim().toLowerCase().split("-");
  if (parts.length !== 2) return null;
  const month = MONTH_MAP[parts[0]];
  if (!month) return null;
  const year = `20${parts[1]}`;
  return `${year}-${month}`;
}

function parseNum(s: string): number | null {
  if (!s?.trim()) return null;
  const n = parseFloat(s.trim().replace(",", "."));
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * Parsea el NIVEL GENERAL de un CSV oficial de estadísticas CBA.
 * descCol: índice de la columna "Descripción"
 * dataStart: índice de la primera columna de datos (después de las de identificación)
 * levelCol: si existe, índice de la columna "NIVEL" (para filtrar nivel=0)
 */
function parseNivelGeneral(
  filePath: string,
  descCol: number,
  dataStart: number,
  levelCol: number | null,
): Map<string, number> {
  const content = readFileSync(filePath, "latin1");
  const lines = content.split(/\r?\n/);

  let headers: string[] = [];
  const result = new Map<string, number>();

  for (const line of lines) {
    const cols = line.split(";");

    // Detectar fila de encabezados (contiene abreviaturas de meses)
    if (cols.some((c) => MONTH_MAP[c.trim().split("-")[0]?.toLowerCase()])) {
      headers = cols;
      continue;
    }

    if (headers.length === 0) continue;

    // Detectar fila NIVEL GENERAL
    const isNivelGeneral = cols[descCol]?.trim() === "NIVEL GENERAL";
    const isTopLevel = levelCol === null || cols[levelCol]?.trim() === "0";
    if (!isNivelGeneral || !isTopLevel) continue;

    // Extraer valores para cada período
    for (let i = dataStart; i < headers.length; i++) {
      const period = parsePeriodCol(headers[i]);
      if (!period) continue;
      const val = parseNum(cols[i] ?? "");
      if (val !== null) result.set(period, val);
    }
    break; // Solo necesitamos la primera fila que coincida
  }

  return result;
}

function calcMonthlyPct(indexValues: Map<string, number>): Map<string, number> {
  const sorted = [...indexValues.entries()].sort(([a], [b]) => a.localeCompare(b));
  const result = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const [period, curr] = sorted[i];
    const [, prev] = sorted[i - 1];
    const pct = (curr / prev - 1) * 100;
    result.set(period, Math.round(pct * 10000) / 10000);
  }
  return result;
}

async function main() {
  const FILE_LONG  = "C:\\Users\\guill\\Desktop\\ipc-cba-base-2014100-julio-2013-a-noviembre-2025.csv";
  const FILE_SHORT = "C:\\Users\\guill\\Desktop\\ipc-marzo-2026-.xlsx.csv";

  // Archivo largo: NIVEL(0), Código(1), Descripción(2), datos desde col 3
  const indexLong  = parseNivelGeneral(FILE_LONG,  2, 3, 0);
  // Archivo corto: Código(0), Descripción(1), datos desde col 2
  const indexShort = parseNivelGeneral(FILE_SHORT, 1, 2, null);

  console.log(`Serie larga: ${indexLong.size} períodos (${[...indexLong.keys()].at(0)} → ${[...indexLong.keys()].at(-1)})`);
  console.log(`Serie corta: ${indexShort.size} períodos (${[...indexShort.keys()].at(0)} → ${[...indexShort.keys()].at(-1)})`);

  // Calcular % mensuales de cada serie por separado (bases distintas)
  const pctLong  = calcMonthlyPct(indexLong);   // ago-13 a nov-25
  const pctShort = calcMonthlyPct(indexShort);  // dic-25 a mar-26

  // Unir: la serie larga cubre hasta nov-25, la corta desde dic-25
  const allPct = new Map([...pctLong, ...pctShort]);

  // Filtrar a los últimos 3 años
  const toInsert = [...allPct.entries()]
    .filter(([p]) => p >= FROM_PERIOD)
    .sort(([a], [b]) => a.localeCompare(b));

  console.log(`\nPeríodos a insertar (${FROM_PERIOD} en adelante): ${toInsert.length}`);
  toInsert.forEach(([p, v]) => console.log(`  ${p}: ${v.toFixed(4)}%`));

  // Obtener todas las agencias
  const agencies = await db.select({ id: agency.id, ownerId: agency.ownerId }).from(agency);
  console.log(`\nAgencias encontradas: ${agencies.length}`);

  let totalInserted = 0;
  let totalSkipped  = 0;

  for (const ag of agencies) {
    for (const [period, value] of toInsert) {
      const existing = await db
        .select({ id: adjustmentIndexValue.id })
        .from(adjustmentIndexValue)
        .where(and(
          eq(adjustmentIndexValue.agencyId, ag.id),
          eq(adjustmentIndexValue.indexType, INDEX_TYPE),
          eq(adjustmentIndexValue.period, period),
        ))
        .limit(1);

      if (existing.length > 0) { totalSkipped++; continue; }

      await db.insert(adjustmentIndexValue).values({
        agencyId:  ag.id,
        indexType: INDEX_TYPE,
        period,
        value:     value.toFixed(4),
        loadedBy:  ag.ownerId,
      });
      totalInserted++;
    }
  }

  console.log(`\nListo. Insertados: ${totalInserted} | Ya existían: ${totalSkipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
