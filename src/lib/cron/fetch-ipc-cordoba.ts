const IPC_CBA_URL =
  "https://datosestadistica.cba.gov.ar/api/action/datastore_search" +
  "?resource_id=05541347-e05d-4088-a2b8-a802a26f6777&q=NIVEL+GENERAL&limit=20";

const MONTH_ABBR: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
};

export type IPCMonthlyValue = {
  period: string; // "YYYY-MM"
  value: number;  // percentage, e.g. 3.0
};

/** Parsea "3,00" o "3,00%" → 3 | null */
function parseValue(raw: string): number | null {
  const n = parseFloat(raw.replace("%", "").replace(",", ".").trim());
  return isNaN(n) ? null : n;
}

/** Parsea "ene-26" → "2026-01" | null */
function parsePeriodColumn(col: string): string | null {
  const [abbr, yy] = col.split("-");
  const month = MONTH_ABBR[abbr?.toLowerCase() ?? ""];
  if (!month || !yy || yy.length !== 2) return null;
  return `20${yy}-${month}`;
}

/**
 * Llama a la API de Datos Estadística CBA y devuelve los valores mensuales
 * de IPC NIVEL GENERAL, ordenados por período.
 *
 * La API devuelve varias filas con "NIVEL GENERAL": la de variación mensual
 * (~2–10%) y la de variación anual (~30%+). Filtramos por valor < 15 para
 * quedarnos solo con la mensual.
 */
export async function fetchIPCCordobaValues(): Promise<IPCMonthlyValue[]> {
  const res = await fetch(IPC_CBA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`API IPC Córdoba respondió ${res.status}`);

  const json = await res.json();
  const records: Record<string, string>[] = json?.result?.records ?? [];

  const SKIP_KEYS = new Set(["_id", "Código", "Descripción", "_full_text"]);

  // Find the monthly variation row: NIVEL GENERAL + at least one value < 15%
  const monthlyRow = records.find((r) => {
    if (r["Descripción"] !== "NIVEL GENERAL") return false;
    const numericValues = Object.entries(r)
      .filter(([k]) => !SKIP_KEYS.has(k))
      .map(([, v]) => parseValue(v ?? ""))
      .filter((v): v is number => v !== null);
    return numericValues.length > 0 && numericValues.some((v) => v > 0 && v < 15);
  });

  if (!monthlyRow) return [];

  const results: IPCMonthlyValue[] = [];
  for (const [col, raw] of Object.entries(monthlyRow)) {
    if (SKIP_KEYS.has(col)) continue;
    const period = parsePeriodColumn(col);
    if (!period) continue;
    const value = parseValue(raw ?? "");
    if (value === null || value <= 0) continue;
    results.push({ period, value });
  }

  return results.sort((a, b) => a.period.localeCompare(b.period));
}
