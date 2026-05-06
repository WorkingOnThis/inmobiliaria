import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";

// NOTE: este endpoint todavía devuelve datos hardcodeados (stub) hasta que
// se implemente el cálculo real de mora cruzando tenant_ledger + contract.
// Por ahora simplemente garantizamos que el caller esté autenticado y tenga
// agency — para no leakear el shape al mundo y para que cuando se conecte
// a la DB, ya esté scoped por agencyId desde el principio.
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    requireAgencyId(session);

    return NextResponse.json({
      total: 3,
      monto_total: 486000,
      items: [
        {
          id: "mora-001",
          iniciales: "LS",
          nombre: "Laura Suárez",
          propiedad: "Mitre 80",
          contrato: "CON-2024-0022",
          monto: 198500,
          dias: 32,
        },
        {
          id: "mora-002",
          iniciales: "JP",
          nombre: "Jorge Paz",
          propiedad: "Tucumán 445",
          contrato: "CON-2024-0029",
          monto: 142000,
          dias: 17,
        },
        {
          id: "mora-003",
          iniciales: "FM",
          nombre: "Federico Molina",
          propiedad: "Pueyrredón 3",
          contrato: "CON-2025-0011",
          monto: 145500,
          dias: 8,
        },
      ],
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/arrears/active:", error);
    return NextResponse.json({ error: "Error al obtener mora activa" }, { status: 500 });
  }
}
