/**
 * Server-side upload validation: checks both extension whitelist AND
 * magic-byte signature. Never trust `file.type` (the client controls it).
 *
 * The whitelist below is the *only* surface that decides what file types
 * we accept. Adding a new type means: extend `ALLOWED`, then update the
 * caller's `allowedExts` option to include it.
 */

const ALLOWED = {
  pdf: { mimes: ["application/pdf"], magic: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  jpg: { mimes: ["image/jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mimes: ["image/jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  png: {
    mimes: ["image/png"],
    magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  webp: { mimes: ["image/webp"], magic: [[0x52, 0x49, 0x46, 0x46]] }, // "RIFF" + extra "WEBP" check below
} as const satisfies Record<string, { mimes: string[]; magic: number[][] }>;

export type AllowedExt = keyof typeof ALLOWED;

export type ValidatedUpload = {
  /** Normalized extension WITHOUT dot, lowercased. */
  ext: AllowedExt;
  /** Canonical mime from our whitelist (NOT the client's claim). */
  mime: string;
  /** The file bytes. */
  buffer: Buffer;
  /** File size in bytes. */
  size: number;
};

export interface ValidateOptions {
  /** Allowed extensions for this scope. Subset of: pdf, jpg, jpeg, png, webp. */
  allowedExts: ReadonlyArray<AllowedExt>;
  /** Max size in bytes. */
  maxBytes: number;
}

/**
 * Result shape is a single object (not a discriminated union) so it works
 * cleanly under `strict: false` where TS narrowing on `if (!result.ok)` is
 * unreliable. Callers check `result.ok` and read either `data` (success)
 * or `error`/`status` (failure).
 */
export type ValidateResult = {
  ok: boolean;
  data?: ValidatedUpload;
  error?: string;
  status?: 400;
};

export async function validateUpload(
  file: File,
  opts: ValidateOptions
): Promise<ValidateResult> {
  // Extract and normalize extension
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";

  if (!ext || !opts.allowedExts.includes(ext as AllowedExt)) {
    return {
      ok: false,
      status: 400,
      error: `Tipo de archivo no permitido. Permitidos: ${opts.allowedExts.join(", ")}`,
    };
  }

  if (file.size === 0) {
    return { ok: false, status: 400, error: "El archivo está vacío" };
  }
  if (file.size > opts.maxBytes) {
    return {
      ok: false,
      status: 400,
      error: `El archivo excede el límite de ${Math.round(
        opts.maxBytes / (1024 * 1024)
      )} MB`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic byte verification — trust server-read bytes, NOT file.type
  const expected = ALLOWED[ext as AllowedExt];
  const matches = expected.magic.some((sig) =>
    sig.every((b, i) => buffer[i] === b)
  );
  if (!matches) {
    return {
      ok: false,
      status: 400,
      error: "El contenido del archivo no coincide con su extensión",
    };
  }

  // Extra check for WebP: bytes 0..3 must be "RIFF" AND bytes 8..11 must be "WEBP"
  if (ext === "webp") {
    const isWebP =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
    if (!isWebP) {
      return {
        ok: false,
        status: 400,
        error: "El contenido del archivo no coincide con su extensión",
      };
    }
  }

  return {
    ok: true,
    data: {
      ext: ext as AllowedExt,
      mime: expected.mimes[0]!,
      buffer,
      size: file.size,
    },
  };
}
