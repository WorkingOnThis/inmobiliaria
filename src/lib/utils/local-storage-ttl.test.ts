import { describe, expect, test, beforeEach } from "bun:test";
import { setWithTTL, getWithTTL, removeKey } from "./local-storage-ttl";

class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

describe("localStorage TTL helper", () => {
  test("setWithTTL / getWithTTL roundtrip", () => {
    setWithTTL("foo", { hello: "world" }, 60_000);
    expect(getWithTTL("foo")).toEqual({ hello: "world" });
  });

  test("getWithTTL devuelve null si vencido", () => {
    setWithTTL("foo", { x: 1 }, -1);
    expect(getWithTTL("foo")).toBeNull();
  });

  test("getWithTTL devuelve null si key no existe", () => {
    expect(getWithTTL("missing")).toBeNull();
  });

  test("removeKey borra la key", () => {
    setWithTTL("foo", "bar", 60_000);
    removeKey("foo");
    expect(getWithTTL("foo")).toBeNull();
  });

  test("getWithTTL ignora payloads malformados", () => {
    localStorage.setItem("garbage", "{not json");
    expect(getWithTTL("garbage")).toBeNull();
  });
});
