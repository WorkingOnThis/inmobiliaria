import type { ComprobanteData } from "./load";
import { formatMonto, formatFecha, formatPeriodo, agencyDisplayName } from "@/lib/receipts/format";

export function buildComprobanteEmailHTML(data: ComprobanteData, baseUrl: string): string {
  const { movimiento, contrato, propiedad, propietario, totales, agency } = data;

  const isSplit = movimiento.paymentModality === "split";
  const tituloDoc = isSplit
    ? "Constancia de cobro distribuido"
    : "Comprobante de liquidación";

  const agencyName = agencyDisplayName(agency);
  const nombrePropietario = [propietario.firstName, propietario.lastName]
    .filter(Boolean)
    .join(" ");
  const periodoLabel = movimiento.period ? formatPeriodo(movimiento.period) : "";
  const direccion = `${propiedad.address}${propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""}`;

  const link = `${baseUrl}/comprobantes/${movimiento.id}`;

  const BG = "#f7f5ef";
  const TEXT = "#1a1614";
  const MUTED = "#5a514c";
  const BORDER = "#d9d1c3";
  const SANS = "Arial, Helvetica, sans-serif";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${tituloDoc} ${movimiento.reciboNumero}</title></head>
<body style="margin:0;padding:0;background:#1a1614;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1614;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:${BG};border-radius:8px;overflow:hidden;font-family:${SANS};color:${TEXT};">

  <tr>
    <td style="padding:32px 40px 16px;border-bottom:2px solid ${TEXT};">
      <div style="font-size:20px;font-weight:700;letter-spacing:-.01em;">${agencyName}</div>
      <div style="font-size:13px;color:${MUTED};margin-top:4px;text-transform:uppercase;letter-spacing:.05em;">
        ${tituloDoc}
      </div>
      <div style="font-size:14px;font-family:Courier New,monospace;margin-top:2px;">
        ${movimiento.reciboNumero}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 40px 8px;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px;">Hola ${nombrePropietario},</p>
      <p style="margin:0 0 12px;">
        Te enviamos el ${tituloDoc.toLowerCase()} correspondiente al
        contrato <strong>${contrato.contractNumber}</strong> sobre la propiedad
        <strong>${direccion}</strong>${periodoLabel ? `, período <strong>${periodoLabel}</strong>` : ""}.
      </p>
      <p style="margin:0 0 12px;">
        <strong>Neto ${isSplit ? "recibido" : "liquidado"}:</strong> ${formatMonto(totales.neto)}<br>
        <span style="color:${MUTED};font-size:12px;">Fecha del cobro: ${formatFecha(movimiento.date)}</span>
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:8px 40px 32px;text-align:center;">
      <a href="${link}"
         style="display:inline-block;background:${TEXT};color:${BG};text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.02em;">
        Ver comprobante completo
      </a>
      <div style="margin-top:8px;font-size:11px;color:${MUTED};">
        ${link}
      </div>
    </td>
  </tr>

  <tr>
    <td style="padding:16px 40px 32px;border-top:1px solid ${BORDER};font-size:11px;color:${MUTED};">
      Este mail fue enviado por ${agencyName}. Si tenés dudas, respondé directamente a este mensaje.
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
