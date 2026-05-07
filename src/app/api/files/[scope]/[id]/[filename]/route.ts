import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import path from "path";
import { auth } from "@/lib/auth";
import { tarea } from "@/db/schema/tarea";
import { contract } from "@/db/schema/contract";
import { cajaMovimiento } from "@/db/schema/caja";
import {
  requireAgencyId,
  requireAgencyResource,
  handleAgencyError,
  AgencyAccessError,
} from "@/lib/auth/agency";
import { readUpload, type UploadScope } from "@/lib/uploads/storage";

const SCOPE_TABLES = {
  tasks: tarea,
  contracts: contract,
  movimientos: cajaMovimiento,
} as const;

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serve a private uploaded file. Validates session + agency + ownership of
 * the parent resource (scope+id) before reading. Always returns the file
 * with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`
 * so the browser cannot render it inline as HTML/JS regardless of contents.
 *
 * Read access is intentionally permissive: any user with a valid session
 * who can READ the parent resource (task / contract / movement) can download
 * its files. Mutations are still gated by `canManage*` on the upload routes.
 */
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ scope: string; id: string; filename: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { scope, id, filename } = await params;
    const decodedFilename = decodeURIComponent(filename);

    if (!(scope in SCOPE_TABLES)) {
      throw new AgencyAccessError(404, "Recurso no encontrado");
    }
    const table = SCOPE_TABLES[scope as UploadScope];
    await requireAgencyResource(table, id, agencyId);

    const buffer = await readUpload(
      scope as UploadScope,
      id,
      decodedFilename
    );

    const ext = path.extname(decodedFilename).slice(1).toLowerCase();
    // Only return a known image/PDF MIME from our whitelist; default to
    // octet-stream for anything unexpected. This prevents the file from
    // being interpreted as HTML or any executable type even if it slipped
    // past upload validation.
    const mime = EXT_TO_MIME[ext] ?? "application/octet-stream";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${decodedFilename.replace(
          /[^A-Za-z0-9._-]/g,
          "_"
        )}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const resp = handleAgencyError(err);
    if (resp) return resp;
    if (err instanceof Error && /ENOENT/.test(err.message)) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }
    console.error("Error serving file:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
