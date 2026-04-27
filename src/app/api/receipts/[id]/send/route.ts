import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadReceiptData } from "@/lib/receipts/load";
import { buildReceiptEmailHTML } from "@/lib/receipts/email-template";
import { sendEmail } from "@/lib/auth/email";
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
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = await loadReceiptData(id, session.user.id);
    if (!data) {
      return NextResponse.json({ error: "Recibo no encontrado" }, { status: 404 });
    }

    const agencyName = data.agency?.legalName || data.agency?.tradeName || data.agency?.name || "Arce Administración";
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
    console.error("Error POST /api/receipts/:id/send:", error);
    return NextResponse.json({ error: "Error al enviar el recibo" }, { status: 500 });
  }
}
