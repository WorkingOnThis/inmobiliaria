import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadReceiptData } from "@/lib/receipts/load";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const data = await loadReceiptData(id, session.user.id);

    if (!data) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET /api/receipts/:id:", error);
    return NextResponse.json({ error: "Error al obtener el recibo" }, { status: 500 });
  }
}
