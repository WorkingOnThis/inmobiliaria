import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";

// NOTE: stub con datos hardcodeados. Cuando se implemente el cálculo real
// (agregaciones sobre property + contract + tenant_ledger), cada subquery
// debe filtrar por agencyId. Por ahora, solo gateamos por sesión + agencyId.
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    requireAgencyId(session);

    return NextResponse.json({
      salud: {
        valor: 84,
        alertas: 7,
        tendencia: "↓ −3pts vs semana anterior",
        dir: "down",
      },
      activas: {
        valor: 47,
        vacantes: 3,
        captacion: 2,
        tendencia: "→ Sin cambio vs mes anterior",
        dir: "neutral",
      },
      mora: {
        contratos: 3,
        monto: 486000,
        variacion: "↑ +1 desde ayer",
        dir: "down",
      },
      vencen: {
        contratos: 5,
        menos30: 2,
        entre30y60: 3,
        tendencia: "→ Igual que la semana pasada",
        dir: "neutral",
      },
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/dashboard/summary:", error);
    return NextResponse.json({ error: "Error al obtener resumen" }, { status: 500 });
  }
}
