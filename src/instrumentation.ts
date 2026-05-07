export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // En Vercel (serverless), las funciones son short-lived y `node-cron` no se mantiene
  // corriendo. La cleanup se dispara vía Vercel Cron Jobs (configurado en vercel.json),
  // que llama al endpoint HTTP `/api/cron/cleanup-files` con CRON_SECRET.
  // En servidores long-running (Railway, VPS, dev local) usamos el cron interno.
  if (process.env.VERCEL) return;

  const { schedule } = await import("node-cron");
  const { cleanupExpiredFiles } = await import("@/lib/cron/cleanup-files");

  // Every day at 02:00 AM
  schedule("0 2 * * *", async () => {
    try {
      await cleanupExpiredFiles();
    } catch (err) {
      console.error("[cron] cleanup-files failed:", err);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[cron] Cleanup job registered (02:00 AM)");
  }
}
