import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/cron/cleanup-files";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await cleanupExpiredFiles();
  return NextResponse.json({ ok: true, ...result });
}
