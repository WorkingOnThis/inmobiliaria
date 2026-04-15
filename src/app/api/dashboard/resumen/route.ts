import { NextResponse } from "next/server";

export async function GET() {
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
}
