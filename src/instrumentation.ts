export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
