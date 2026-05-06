import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";

// NOTE: stub con datos hardcodeados. Cuando se implemente el cálculo real
// (cruzar property + contract + tenant_ledger + servicio), cada subquery
// debe filtrar por agencyId. Por ahora, solo gateamos por sesión + agencyId.
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    requireAgencyId(session);

    return NextResponse.json({
      total: 47,
      propiedades: [
        {
          id: "prop-001",
          nombre: "Tucumán 445, 3°A",
          direccion: "Córdoba Capital",
          semaforo: "red",
          inquilino: "Jorge Paz",
          alertas: [{ tipo: "mora", detalle: "Mora · 17 días" }],
          vtoContrato: "31/12/2025",
          vtoProximo: false,
          ultimoCobro: "20 Feb",
        },
        {
          id: "prop-002",
          nombre: "Mitre 80, PB",
          direccion: "Villa Carlos Paz",
          semaforo: "red",
          inquilino: "Laura Suárez",
          alertas: [{ tipo: "mora", detalle: "Mora · 32 días" }],
          vtoContrato: "30/06/2025",
          vtoProximo: true,
          ultimoCobro: "5 Feb",
        },
        {
          id: "prop-003",
          nombre: "Pueyrredón 3, 1°B",
          direccion: "Córdoba Capital",
          semaforo: "yellow",
          inquilino: "Federico Molina",
          alertas: [{ tipo: "vence", detalle: "Vence · 28 días" }],
          vtoContrato: "27 Jul 2025",
          vtoProximo: true,
          ultimoCobro: "1 Jun",
        },
        {
          id: "prop-004",
          nombre: "Av. Colón 1280, 4°C",
          direccion: "Córdoba Capital",
          semaforo: "yellow",
          inquilino: "Sofía Ramírez",
          alertas: [{ tipo: "servicio", detalle: "Gas · 38 días" }],
          vtoContrato: "15/03/2026",
          vtoProximo: false,
          ultimoCobro: "3 Jun",
        },
        {
          id: "prop-005",
          nombre: "San Juan 88, 2°A",
          direccion: "Alta Córdoba",
          semaforo: "yellow",
          inquilino: "Martín López",
          alertas: [{ tipo: "icl", detalle: "ICL pendiente" }],
          vtoContrato: "30/09/2025",
          vtoProximo: false,
          ultimoCobro: "1 Jun",
        },
        {
          id: "prop-006",
          nombre: "Bv. San Juan 450, 1°D",
          direccion: "Nueva Córdoba",
          semaforo: "green",
          inquilino: "Ana Torres",
          alertas: [{ tipo: "ok", detalle: "Al día" }],
          vtoContrato: "01/02/2026",
          vtoProximo: false,
          ultimoCobro: "2 Jun",
        },
        {
          id: "prop-007",
          nombre: "Chacabuco 220, 3°B",
          direccion: "Güemes",
          semaforo: "green",
          inquilino: "Roberto Soria",
          alertas: [{ tipo: "ok", detalle: "Al día" }],
          vtoContrato: "15/11/2025",
          vtoProximo: false,
          ultimoCobro: "1 Jun",
        },
      ],
    });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/dashboard/portfolio:", error);
    return NextResponse.json({ error: "Error al obtener portfolio" }, { status: 500 });
  }
}
