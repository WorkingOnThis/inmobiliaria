import path from "path";
import fs from "fs/promises";

/**
 * Storage helpers for uploaded files. Files live OUTSIDE `public/` in
 * `<projectRoot>/private-uploads/` and are served only by the authenticated
 * GET /api/files/<scope>/<id>/<filename> route.
 *
 * Path traversal protection: every read/write/delete validates components
 * with regex AND verifies the resolved path stays under the scope root.
 */

export type UploadScope = "tasks" | "contracts" | "movimientos";

const ROOT = path.join(process.cwd(), "private-uploads");

function isSafeFilename(name: string): boolean {
  // No path separators, no `..`, no leading dot, only safe chars
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes("..");
}

function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

function resolveSafe(
  scope: UploadScope,
  id: string,
  filename: string
): string {
  if (!isSafeId(id) || !isSafeFilename(filename)) {
    throw new Error("Invalid storage path component");
  }
  const candidate = path.resolve(ROOT, scope, id, filename);
  const expectedPrefix = path.resolve(ROOT, scope, id) + path.sep;
  if (!candidate.startsWith(expectedPrefix)) {
    throw new Error("Path traversal detected");
  }
  return candidate;
}

export async function saveUpload(
  scope: UploadScope,
  id: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const target = resolveSafe(scope, id, filename);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return target;
}

export async function readUpload(
  scope: UploadScope,
  id: string,
  filename: string
): Promise<Buffer> {
  const target = resolveSafe(scope, id, filename);
  return fs.readFile(target);
}

export async function deleteUpload(
  scope: UploadScope,
  id: string,
  filename: string
): Promise<void> {
  const target = resolveSafe(scope, id, filename);
  await fs.unlink(target).catch(() => {}); // best-effort
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
