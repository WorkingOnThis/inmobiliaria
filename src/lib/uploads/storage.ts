import path from "path";
import fs from "fs/promises";
import { put, head, del } from "@vercel/blob";

/**
 * Storage helpers for uploaded files. Two backends behind a single API:
 *
 * - LocalStorageAdapter: writes to `<projectRoot>/private-uploads/<scope>/<id>/<filename>`.
 *   Used in development and on hosts with a writable filesystem (Railway, VPS, etc.).
 *
 * - BlobStorageAdapter: stores blobs at pathname `<scope>/<id>/<filename>` via @vercel/blob.
 *   Used on Vercel where the runtime filesystem is read-only. Activated when
 *   `BLOB_READ_WRITE_TOKEN` is set (auto-injected by Vercel after creating a Blob store).
 *
 * Files are NEVER served directly. The authenticated GET
 * /api/files/<scope>/<id>/<filename> route is the only way to read a stored file.
 *
 * Path traversal protection: every read/write/delete validates components with
 * regex. The local adapter additionally verifies the resolved path stays under
 * the scope root.
 */

export type UploadScope = "tasks" | "contracts" | "movimientos";

// --- Path component safety (shared by both adapters) ---

function isSafeFilename(name: string): boolean {
  // No path separators, no `..`, no leading dot, only safe chars
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes("..");
}

function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

// --- Adapter interface ---

interface StorageAdapter {
  save(
    scope: UploadScope,
    id: string,
    filename: string,
    buffer: Buffer
  ): Promise<void>;
  read(scope: UploadScope, id: string, filename: string): Promise<Buffer>;
  delete(scope: UploadScope, id: string, filename: string): Promise<void>;
}

// --- Local filesystem adapter ---

class LocalStorageAdapter implements StorageAdapter {
  private readonly root = path.join(process.cwd(), "private-uploads");

  private resolveSafe(
    scope: UploadScope,
    id: string,
    filename: string
  ): string {
    if (!isSafeId(id) || !isSafeFilename(filename)) {
      throw new Error("Invalid storage path component");
    }
    const candidate = path.resolve(this.root, scope, id, filename);
    const expectedPrefix = path.resolve(this.root, scope, id) + path.sep;
    if (!candidate.startsWith(expectedPrefix)) {
      throw new Error("Path traversal detected");
    }
    return candidate;
  }

  async save(
    scope: UploadScope,
    id: string,
    filename: string,
    buffer: Buffer
  ): Promise<void> {
    const target = this.resolveSafe(scope, id, filename);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  }

  async read(
    scope: UploadScope,
    id: string,
    filename: string
  ): Promise<Buffer> {
    const target = this.resolveSafe(scope, id, filename);
    return fs.readFile(target);
  }

  async delete(
    scope: UploadScope,
    id: string,
    filename: string
  ): Promise<void> {
    const target = this.resolveSafe(scope, id, filename);
    await fs.unlink(target).catch(() => {}); // best-effort
  }
}

// --- Vercel Blob adapter ---

class BlobStorageAdapter implements StorageAdapter {
  private path(scope: UploadScope, id: string, filename: string): string {
    if (!isSafeId(id) || !isSafeFilename(filename)) {
      throw new Error("Invalid storage path component");
    }
    return `${scope}/${id}/${filename}`;
  }

  async save(
    scope: UploadScope,
    id: string,
    filename: string,
    buffer: Buffer
  ): Promise<void> {
    await put(this.path(scope, id, filename), buffer, {
      access: "public",
      addRandomSuffix: false,
      // Token is read from BLOB_READ_WRITE_TOKEN env var by the SDK.
    });
  }

  async read(
    scope: UploadScope,
    id: string,
    filename: string
  ): Promise<Buffer> {
    // TODO(perf): for large files this loads the whole blob into memory before
    // streaming it back. Alternative: return a ReadableStream from this adapter
    // and have the route handler pipe it directly. Out of scope for SEC-7.
    const meta = await head(this.path(scope, id, filename));
    const res = await fetch(meta.downloadUrl);
    if (!res.ok) {
      throw new Error(`ENOENT: blob fetch failed (${res.status})`);
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }

  async delete(
    scope: UploadScope,
    id: string,
    filename: string
  ): Promise<void> {
    try {
      await del(this.path(scope, id, filename));
    } catch {
      // best-effort, same as filesystem unlink
    }
  }
}

// --- Adapter selection (at module load) ---

function selectAdapter(): StorageAdapter {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new BlobStorageAdapter();
  }
  return new LocalStorageAdapter();
}

const adapter: StorageAdapter = selectAdapter();

// --- Public API ---

export async function saveUpload(
  scope: UploadScope,
  id: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  await adapter.save(scope, id, filename, buffer);
}

export async function readUpload(
  scope: UploadScope,
  id: string,
  filename: string
): Promise<Buffer> {
  return adapter.read(scope, id, filename);
}

export async function deleteUpload(
  scope: UploadScope,
  id: string,
  filename: string
): Promise<void> {
  await adapter.delete(scope, id, filename);
}

/**
 * Build the public URL stored in DB. The actual file is served by
 * GET /api/files/<scope>/<id>/<filename> after auth checks.
 */
export function buildFileUrl(
  scope: UploadScope,
  id: string,
  filename: string
): string {
  return `/api/files/${scope}/${id}/${encodeURIComponent(filename)}`;
}

/**
 * Parse a stored URL back into (scope, id, filename). Returns null if invalid.
 */
export function parseFileUrl(
  url: string
): { scope: UploadScope; id: string; filename: string } | null {
  const m = url.match(
    /^\/api\/files\/(tasks|contracts|movimientos)\/([^/]+)\/(.+)$/
  );
  if (!m) return null;
  return {
    scope: m[1] as UploadScope,
    id: m[2]!,
    filename: decodeURIComponent(m[3]!),
  };
}
