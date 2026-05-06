import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadReceiptData } from "@/lib/receipts/load";
import { buildReceiptEmailHTML } from "@/lib/receipts/email-template";
import { agencyDisplayName } from "@/lib/receipts/format";
import { sendEmail } from "@/lib/auth/email";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { cajaMovimiento } from "@/db/schema/caja";
import { z } from "zod";

const sendSchema = z.object({
  to: z.array(z.string().email()).min(1, "Seleccioná al menos un destinatario"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    // Validar que el cash_movement pertenece a la agency antes de enviar nada por email.
    await requireAgencyResource(cajaMovimiento, id, agencyId);

    const data = await loadReceiptData(id, agencyId);
    if (!data) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
    }

    const agencyName = agencyDisplayName(data.agency);
    const subject = `Recibo ${data.movimiento.reciboNumero} — ${agencyName}`;
    const html = buildReceiptEmailHTML(data);

    const results = await Promise.allSettled(
      parsed.data.to.map((email) => sendEmail({ to: email, subject, html }))
    );

    const failed = parsed.data.to.filter((_, i) => results[i].status === "rejected");
    const sent = parsed.data.to.length - failed.length;

    if (sent === 0) {
      const reasons = results.map((r) => r.status === "rejected" ? String(r.reason) : "ok");
      console.error("Send failed for all recipients:", reasons);
      return NextResponse.json({ error: "No se pudo enviar el recibo", failed }, { status: 500 });
    }

    return NextResponse.json({ sent, failed });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error POST /api/receipts/:id/send:", error);
    return NextResponse.json({ error: "Error al enviar el recibo" }, { status: 500 });
  }
}
