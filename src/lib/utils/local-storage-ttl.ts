type Wrapped<T> = { v: T; exp: number };

export function setWithTTL<T>(key: string, value: T, ttlMs: number): void {
  if (typeof localStorage === "undefined") return;
  const wrapped: Wrapped<T> = { v: value, exp: Date.now() + ttlMs };
  localStorage.setItem(key, JSON.stringify(wrapped));
}

export function getWithTTL<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const wrapped = JSON.parse(raw) as Wrapped<T>;
    if (typeof wrapped.exp !== "number" || Date.now() > wrapped.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return wrapped.v;
  } catch {
    return null;
  }
}

export function removeKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}
