import { ToWords } from "to-words";

const toWords = new ToWords({ localeCode: "es-AR" });

export function numeroEnLetras(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  try {
    return toWords.convert(n);
  } catch {
    return null;
  }
}

export function montoEnLetras(amount: string | number | null | undefined): string | null {
  if (amount == null) return null;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return null;
  try {
    return toWords.convert(n, { currency: true });
  } catch {
    return null;
  }
}
