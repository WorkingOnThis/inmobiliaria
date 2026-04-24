import { ToWords } from "to-words";

const toWordsCardinal = new ToWords({ localeCode: "es-AR" });
const toWordsCurrency = new ToWords({ localeCode: "es-AR" });

export function numeroEnLetras(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  try {
    return toWordsCardinal.convert(n);
  } catch {
    return null;
  }
}

export function montoEnLetras(amount: string | number | null | undefined): string | null {
  if (amount == null) return null;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return null;
  try {
    return toWordsCurrency.convert(n, { currency: true });
  } catch {
    return null;
  }
}
