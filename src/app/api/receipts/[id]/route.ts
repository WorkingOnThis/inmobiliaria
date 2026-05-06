import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadReceiptData } from "@/lib/receipts/load";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { cajaMovimiento } from "@/db/schema/caja";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    // Validar que el cash_movement pertenece a la agency antes de cargar.
    await requireAgencyResource(cajaMovimiento, id, agencyId);

    const data = await loadReceiptData(id, agencyId);

    if (!data) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/receipts/:id:", error);
    return NextResponse.json({ error: "Error al obtener el recibo" }, { status: 500 });
  }
}
