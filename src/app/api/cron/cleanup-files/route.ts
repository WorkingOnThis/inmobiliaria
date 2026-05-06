import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/cron/cleanup-files";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Cron disabled" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupExpiredFiles();
  return NextResponse.json({ ok: true, ...result });
}
