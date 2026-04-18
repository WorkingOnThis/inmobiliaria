export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { schedule } = await import("node-cron");
  const { limpiarArchivosVencidos } = await import("@/lib/cron/limpiar-archivos");

  // Todos los días a las 02:00 AM
  schedule("0 2 * * *", async () => {
    try {
      await limpiarArchivosVencidos();
    } catch (err) {
      console.error("[cron] limpiar-archivos falló:", err);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[cron] Job de limpieza registrado (02:00 AM)");
  }
}
