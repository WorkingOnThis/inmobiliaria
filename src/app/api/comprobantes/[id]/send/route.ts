import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { loadComprobanteData } from "@/lib/comprobantes/load";
import { buildComprobanteEmailHTML } from "@/lib/comprobantes/email-template";
import { agencyDisplayName } from "@/lib/receipts/format";
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
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = await loadComprobanteData(id, session.user.id);
    if (!data) {
      return NextResponse.json(
        { error: "Comprobante no encontrado" },
        { status: 404 }
      );
    }

    const isSplit = data.movimiento.paymentModality === "split";
    const tituloDoc = isSplit ? "Constancia de cobro" : "Comprobante de liquidación";
    const agencyName = agencyDisplayName(data.agency);
    const subject = `${tituloDoc} ${data.movimiento.reciboNumero} — ${agencyName}`;

    const baseUrl =
      request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "";
    const html = buildComprobanteEmailHTML(data, baseUrl);

    const results = await Promise.allSettled(
      parsed.data.to.map((email) => sendEmail({ to: email, subject, html }))
    );

    const failed = parsed.data.to.filter(
      (_, i) => results[i].status === "rejected"
    );
    const sent = parsed.data.to.length - failed.length;

    if (sent === 0) {
      const reasons = results.map((r) =>
        r.status === "rejected" ? String(r.reason) : "ok"
      );
      console.error("Send failed for all recipients:", reasons);
      return NextResponse.json(
        { error: "No se pudo enviar el comprobante", failed },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("Error POST /api/comprobantes/:id/send:", error);
    return NextResponse.json(
      { error: "Error al enviar el comprobante" },
      { status: 500 }
    );
  }
}
