import { NextRequest, NextResponse } from "next/server";
import { limpiarArchivosVencidos } from "@/lib/cron/limpiar-archivos";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const resultado = await limpiarArchivosVencidos();
  return NextResponse.json({ ok: true, ...resultado });
}
