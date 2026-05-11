import type { ReceiptData } from "./load";
import { formatMonto as fmt, formatFecha as fecha, formatPeriodo as periodo, montoEnLetras, agencyDisplayName } from "./format";
import { formatAddress } from "@/lib/properties/format-address";

export function buildReceiptEmailHTML(data: ReceiptData): string {
  const { movimiento, inquilino, propiedad, contrato, ledgerItems, serviceItems, agency } = data;

  const agencyName = agencyDisplayName(agency);
  const tipoRecibo = (agency?.receiptType || "Recibo X").toUpperCase();
  const montoNum = Number(movimiento.amount);

  const nombreInquilino = inquilino
    ? [inquilino.firstName, inquilino.lastName].filter(Boolean).join(" ")
    : "—";

  const periodoLabel = periodo(movimiento.period) ?? "";
  const direccion = propiedad
    ? formatAddress({ addressStreet: propiedad.addressStreet ?? "", addressNumber: propiedad.addressNumber, floorUnit: propiedad.floorUnit })
    : "";

  const tableRows: { concepto: string; per: string | null; monto: string }[] =
    (ledgerItems ?? []).length > 0
      ? (ledgerItems ?? []).map((l) => ({ concepto: l.descripcion, per: l.period, monto: fmt(l.monto) }))
      : [{ concepto: movimiento.description, per: movimiento.period, monto: fmt(movimiento.amount) }];

  const serviciosCobrados = (serviceItems ?? []).filter((s) => s.monto != null && Number(s.monto) > 0);

  const BG = "#f7f5ef";
  const TEXT = "#1a1614";
  const MUTED = "#5a514c";
  const BORDER = "#d9d1c3";
  const MONO = "Courier New, monospace";
  const SANS = "Arial, Helvetica, sans-serif";

  const tableRowsHTML = [
    ...tableRows.map((r) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px dashed ${BORDER};font-family:${MONO};font-size:12px;color:${TEXT};">
          ${r.concepto}${r.per ? ` <span style="color:${MUTED}">· ${periodo(r.per)}</span>` : ""}
        </td>
        <td style="padding:8px 6px;border-bottom:1px dashed ${BORDER};text-align:right;font-family:${MONO};font-size:12px;color:${TEXT};">${r.monto}</td>
      </tr>`),
    ...serviciosCobrados.map((s) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px dashed ${BORDER};font-family:${MONO};font-size:12px;color:${TEXT};">
          ${s.etiqueta} <span style="color:${MUTED}">· ${periodo(s.period)}</span>
        </td>
        <td style="padding:8px 6px;border-bottom:1px dashed ${BORDER};text-align:right;font-family:${MONO};font-size:12px;color:${TEXT};">${fmt(s.monto!)}</td>
      </tr>`),
  ].join("");

  const clausulasHTML = agency?.clauses?.length
    ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid ${BORDER};font-size:11px;color:${MUTED};font-family:${SANS};">
        <ol style="margin:0;padding-left:18px;line-height:1.6;">
          ${agency.clauses.map((c) => `<li style="margin-bottom:4px;">${c.texto}</li>`).join("")}
        </ol>
       </div>`
    : "";

  const signatoryLine = agency?.signatory
    ? `${agency.signatory}${agency.signatoryTitle ? ` · ${agency.signatoryTitle}` : ""}`
    : agencyName;

  const firmaHTML = `
    <div style="margin-top:40px;text-align:right;">
      <div style="display:inline-block;width:200px;text-align:center;">
        <div style="border-top:1px solid ${TEXT};padding-top:6px;font-size:11px;color:${MUTED};font-family:${SANS};text-transform:uppercase;letter-spacing:.05em;">
          ${signatoryLine}
        </div>
      </div>
    </div>`;

  const cbualias = [
    agency?.bancoCBU ? `CBU: <span style="font-family:${MONO}">${agency.bancoCBU}</span>` : "",
    agency?.bancoAlias ? `Alias: <span style="font-family:${MONO}">${agency.bancoAlias}</span>` : "",
  ].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo ${movimiento.reciboNumero}</title></head>
<body style="margin:0;padding:0;background:#1a1614;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1614;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:${BG};border-radius:8px;overflow:hidden;font-family:${SANS};color:${TEXT};">

  <!-- Header -->
  <tr>
    <td style="padding:32px 40px 20px;border-bottom:2px solid ${TEXT};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            ${agency?.logoUrl ? `<img src="${agency.logoUrl}" alt="${agencyName}" style="display:block;max-height:56px;max-width:160px;object-fit:contain;margin-bottom:8px;" />` : ""}
            <div style="font-size:20px;font-weight:700;letter-spacing:-.01em;">${agencyName}</div>
            ${agency?.cuit || agency?.vatStatus
              ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;">${[agency?.cuit ? `CUIT ${agency.cuit}` : "", agency?.vatStatus || ""].filter(Boolean).join(" · ")}</div>`
              : ""}
            ${[agency?.fiscalAddress, agency?.city].filter(Boolean).length
              ? `<div style="font-size:12px;color:${MUTED};">${[agency?.fiscalAddress, agency?.city].filter(Boolean).join(", ")}</div>`
              : ""}
            ${[agency?.phone ? `Tel. ${agency.phone}` : "", agency?.contactEmail || ""].filter(Boolean).length
              ? `<div style="font-size:12px;color:${MUTED};">${[agency?.phone ? `Tel. ${agency.phone}` : "", agency?.contactEmail || ""].filter(Boolean).join(" · ")}</div>`
              : ""}
            ${agency?.licenseNumber ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">Mat. ${agency.licenseNumber}</div>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right;font-family:${MONO};">
            <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.05em;">${tipoRecibo}</div>
            <div style="font-size:16px;font-weight:600;">${movimiento.reciboNumero}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Recibí de -->
  <tr>
    <td style="padding:20px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:55%;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${MUTED};margin-bottom:4px;">Recibí de</div>
            <div style="font-size:15px;font-weight:500;">${nombreInquilino}</div>
            ${inquilino?.dni ? `<div style="font-size:12px;color:${MUTED};">DNI ${inquilino.dni}</div>` : ""}
            ${direccion ? `<div style="font-size:12px;color:${MUTED};">${direccion}</div>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${MUTED};margin-bottom:4px;">Fecha</div>
            <div style="font-size:15px;font-weight:500;">${fecha(movimiento.date)}</div>
            ${periodoLabel ? `
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${MUTED};margin-top:8px;margin-bottom:4px;">Período</div>
              <div style="font-size:15px;font-weight:500;">${periodoLabel}</div>` : ""}
            ${contrato ? `
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${MUTED};margin-top:8px;margin-bottom:4px;">Contrato</div>
              <div style="font-size:13px;font-family:${MONO};">${contrato.contractNumber}</div>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Tabla conceptos -->
  <tr>
    <td style="padding:20px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 6px;border-bottom:1px solid ${TEXT};font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:${MUTED};font-weight:600;">Concepto</th>
            <th style="text-align:right;padding:8px 6px;border-bottom:1px solid ${TEXT};font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:${MUTED};font-weight:600;">Importe</th>
          </tr>
        </thead>
        <tbody>${tableRowsHTML}</tbody>
      </table>
    </td>
  </tr>

  <!-- Total -->
  <tr>
    <td style="padding:16px 40px 0;">
      <div style="border-top:2px solid ${TEXT};padding-top:12px;text-align:right;font-size:15px;font-weight:700;font-family:${MONO};">
        Total recibido: ${fmt(montoNum)}
      </div>
      <div style="text-align:right;font-size:11px;font-style:italic;color:${MUTED};margin-top:4px;">
        Son: ${montoEnLetras(montoNum)}
      </div>
    </td>
  </tr>

  <!-- CBU/Alias -->
  ${cbualias ? `<tr><td style="padding:12px 40px 0;font-size:11px;color:${MUTED};">${cbualias}</td></tr>` : ""}

  <!-- Cláusulas -->
  ${clausulasHTML ? `<tr><td style="padding:0 40px;">${clausulasHTML}</td></tr>` : ""}

  <!-- Firma -->
  <tr><td style="padding:0 40px 32px;">${firmaHTML}</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
