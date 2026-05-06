"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Printer, ArrowLeft, Mail, Check } from "lucide-react";
import type { ReceiptData } from "@/lib/receipts/load";
import { formatMonto, formatFecha, formatPeriodo, montoEnLetras, agencyDisplayName } from "@/lib/receipts/format";
import { useSession } from "@/lib/auth/hooks";
import { AnnulReceiptModal } from "@/components/caja/annul-receipt-modal";

const PALETTE = {
  bg: "#f7f5ef",
  text: "#1a1614",
  muted: "#5a514c",
  border: "#d9d1c3",
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export default function ReciboPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // All hooks before any early return
  const { session } = useSession();
  const [showAnnulModal, setShowAnnulModal] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [sendResult, setSendResult] = useState<{ sent: number; failed: string[] } | null>(null);

  const { data, isLoading, error } = useQuery<ReceiptData>({
    queryKey: ["receipt", id],
    queryFn: async () => {
      const res = await fetch(`/api/receipts/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el recibo");
      }
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/receipts/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: [...selectedRecipients] }),
      });
      if (!res.ok) {
        let errorMsg = "Error al enviar";
        try { const d = await res.json(); errorMsg = d.error ?? errorMsg; } catch { errorMsg = await res.text().catch(() => errorMsg); }
        throw new Error(errorMsg);
      }
      return res.json() as Promise<{ sent: number; failed: string[] }>;
    },
    onSuccess: (result) => setSendResult(result),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="text-[0.85rem]">{(error as Error)?.message ?? "Recibo no encontrado"}</div>
        <button onClick={() => router.back()} className="text-[0.72rem] text-primary hover:underline flex items-center gap-1">
          <ArrowLeft size={12} /> Volver
        </button>
      </div>
    );
  }

  const { movimiento, inquilino, propiedad, contrato, serviceItems = [], charges = [], ledgerItems = [], agency } = data;

  // Build email recipient list from inquilino data (safe after early returns)
  const allRecipients: { email: string; label: string; key: string }[] = [];
  if (inquilino?.email) {
    allRecipients.push({ email: inquilino.email, label: "Email principal", key: inquilino.email });
  }
  (inquilino?.trustedEmails ?? []).forEach((te) => {
    if (te.email) allRecipients.push({ email: te.email, label: te.label || te.email, key: te.email });
  });

  function openEmailDialog() {
    const defaults = new Set<string>(
      allRecipients
        .filter((r) => {
          if (r.key === inquilino?.email) return inquilino?.emailDefault ?? true;
          return (inquilino?.trustedEmails ?? []).find((te) => te.email === r.email)?.sendDefault ?? false;
        })
        .map((r) => r.email)
    );
    setSelectedRecipients(defaults);
    setSendResult(null);
    setShowEmailDialog(true);
  }

  function toggleRecipient(email: string) {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  const agencyName = agencyDisplayName(agency);
  const agencyInitial = (agencyName[0] ?? "A").toUpperCase();
  const cityLine = [agency?.fiscalAddress, agency?.city].filter(Boolean).join(", ");
  const contactLine = [
    agency?.phone ? `Tel. ${agency.phone}` : null,
    agency?.contactEmail,
  ].filter(Boolean).join(" · ");
  const tipoRecibo = (agency?.receiptType || "Recibo X").toUpperCase();
  const numeroRecibo = movimiento.reciboNumero;
  const signatoryName = agency?.signatory;
  const signatoryTitle = agency?.signatoryTitle || "Administrador";

  const montoNum = Number(movimiento.amount);
  const totalDisplay = isFinite(montoNum) ? formatMonto(montoNum) : "—";

  const nombreInquilino = inquilino
    ? inquilino.lastName
      ? `${inquilino.firstName} ${inquilino.lastName}`
      : inquilino.firstName
    : "—";

  const periodoLabel = formatPeriodo(movimiento.period);
  const direccionPropiedad = propiedad
    ? `${propiedad.address}${propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""}`
    : null;

  const tableRows: { concepto: string; periodo: string | null; monto: string }[] =
    charges.length > 0
      ? charges.map((c) => ({
          concepto: c.descripcion,
          periodo: c.periodo,
          monto: formatMonto(c.monto),
        }))
      : ledgerItems.length > 0
        ? ledgerItems.map((l) => ({
            concepto: l.descripcion,
            periodo: l.period,
            monto: formatMonto(l.monto),
          }))
        : [{
            concepto: movimiento.description,
            periodo: movimiento.period,
            monto: totalDisplay,
          }];

  const serviciosCobrados = serviceItems.filter((s) => s.monto != null && Number(s.monto) > 0);
  const serviciosConstancia = serviceItems.filter((s) => s.monto == null || Number(s.monto) === 0);

  return (
    <div className="min-h-screen bg-bg">
      {/* Barra de acciones — solo en pantalla, no imprime */}
      <div className="print:hidden h-14 bg-surface border-b border-border flex items-center justify-between px-7">
        <button
          onClick={() => router.back()}
          className="text-[0.8rem] text-text-secondary hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft size={13} /> Volver
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={openEmailDialog}
            disabled={allRecipients.length === 0}
            className="flex items-center gap-2 text-[0.8rem] font-semibold px-4 py-2 rounded-[8px] transition-colors border border-border hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Mail size={14} /> Enviar por email
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-primary text-white text-[0.8rem] font-semibold px-4 py-2 rounded-[8px] hover:bg-primary/90 transition-colors"
          >
            <Printer size={14} /> Imprimir recibo
          </button>
          {movimiento.anuladoAt ? (
            <span className="text-xs text-destructive border border-destructive/30 rounded px-2 py-1 bg-destructive/10">
              Recibo anulado
            </span>
          ) : session?.user?.role === "account_admin" ? (
            <button
              onClick={() => setShowAnnulModal(true)}
              className="text-[0.72rem] text-destructive hover:underline flex items-center gap-1"
            >
              Anular recibo
            </button>
          ) : null}
        </div>
      </div>

      {/* Dialog — enviar por email */}
      {showEmailDialog && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-[12px] shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.95rem] font-semibold text-on-bg">Enviar recibo por email</h3>
              <button onClick={() => setShowEmailDialog(false)} className="text-muted-foreground hover:text-on-bg">
                ✕
              </button>
            </div>

            {sendResult ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="size-10 rounded-full bg-income-dim flex items-center justify-center">
                  <Check size={20} className="text-income" />
                </div>
                <p className="text-[0.9rem] font-semibold text-on-bg">
                  {sendResult.sent === 1 ? "Recibo enviado" : `${sendResult.sent} recibos enviados`}
                </p>
                {sendResult.failed.length > 0 && (
                  <p className="text-[0.78rem] text-destructive">
                    No se pudo enviar a: {sendResult.failed.join(", ")}
                  </p>
                )}
                <button
                  onClick={() => setShowEmailDialog(false)}
                  className="mt-1 text-[0.8rem] text-primary hover:underline"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <p className="text-[0.78rem] text-muted-foreground">Seleccioná los destinatarios:</p>
                <div className="flex flex-col gap-2">
                  {allRecipients.map((r) => (
                    <label key={r.key} className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.has(r.email)}
                        onChange={() => toggleRecipient(r.email)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <div className="text-[0.82rem] text-on-bg group-hover:text-primary transition-colors">{r.email}</div>
                        <div className="text-[0.72rem] text-muted-foreground">{r.label}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {sendMutation.isError && (
                  <p className="text-[0.75rem] text-destructive">{(sendMutation.error as Error).message}</p>
                )}
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    onClick={() => setShowEmailDialog(false)}
                    className="text-[0.8rem] px-3 py-1.5 border border-border rounded-[6px] text-text-secondary hover:bg-muted/30"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={selectedRecipients.size === 0 || sendMutation.isPending}
                    className="flex items-center gap-1.5 text-[0.8rem] font-semibold px-4 py-1.5 rounded-[6px] bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Mail size={13} />
                    {sendMutation.isPending
                      ? "Enviando..."
                      : `Enviar a ${selectedRecipients.size > 0 ? selectedRecipients.size : ""} destinatario${selectedRecipients.size !== 1 ? "s" : ""}`
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de anulación */}
      {data && showAnnulModal && (
        <AnnulReceiptModal
          open
          onClose={() => setShowAnnulModal(false)}
          reciboNumero={movimiento.reciboNumero ?? ""}
          fecha={movimiento.date}
          monto={movimiento.amount}
          inquilinoNombre={
            inquilino
              ? [inquilino.firstName, inquilino.lastName].filter(Boolean).join(" ")
              : null
          }
          teniaPagosLiquidados={movimiento.settledAt !== null}
          queryKeysToInvalidate={[["receipt", id]]}
          onSuccess={() => router.push("/caja")}
        />
      )}

      {/* Recibo — centrado en A4 */}
      <div className="mx-auto max-w-[760px] p-8 print:p-0 print:max-w-none">
        <div
          style={{
            background: PALETTE.bg,
            color: PALETTE.text,
            fontFamily: "Inter, -apple-system, sans-serif",
            padding: "44px 48px",
            borderRadius: "8px",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
          className="print:rounded-none print:shadow-none shadow-[0_8px_24px_rgba(0,0,0,.3)]"
        >
          {/* Header */}
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", paddingBottom: "18px", borderBottom: `1.5px solid ${PALETTE.text}` }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "12px", flexShrink: 0,
              display: "grid", placeItems: "center", overflow: "hidden",
              ...(agency?.logoUrl
                ? {}
                : { background: "linear-gradient(135deg, #e85a3c, #c03c1f)", color: "#fff", fontWeight: 700, fontSize: "26px" }),
            }}>
              {agency?.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={agency.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : agencyInitial
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-.01em" }}>
                {agencyName}
              </div>
              {(agency?.cuit || agency?.vatStatus) && (
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>
                  {agency?.cuit ? `CUIT ${agency.cuit}` : ""}
                  {agency?.cuit && agency?.vatStatus ? " · " : ""}
                  {agency?.vatStatus || ""}
                </div>
              )}
              {cityLine && (
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>{cityLine}</div>
              )}
              {contactLine && (
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>{contactLine}</div>
              )}
            </div>
            <div style={{ textAlign: "right", fontFamily: PALETTE.mono }}>
              <div style={{ fontSize: "11px", color: PALETTE.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{tipoRecibo}</div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>{numeroRecibo}</div>
              {agency?.licenseNumber && (
                <div style={{ fontSize: "11px", color: PALETTE.muted, marginTop: "4px" }}>Mat. {agency.licenseNumber}</div>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ marginTop: "22px" }}>
            {/* Recibí de + Fecha */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", color: PALETTE.muted, marginBottom: "4px" }}>Recibí de</div>
                <div style={{ fontSize: "15px", fontWeight: 500 }}>{nombreInquilino}</div>
                {inquilino?.dni && (
                  <div style={{ fontSize: "12px", color: PALETTE.muted }}>DNI {inquilino.dni}</div>
                )}
                {direccionPropiedad && (
                  <div style={{ fontSize: "12px", color: PALETTE.muted }}>{direccionPropiedad}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", color: PALETTE.muted, marginBottom: "4px" }}>Fecha</div>
                <div style={{ fontSize: "15px", fontWeight: 500 }}>{formatFecha(movimiento.date)}</div>
                {periodoLabel && (
                  <>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", color: PALETTE.muted, marginTop: "8px", marginBottom: "4px" }}>Período</div>
                    <div style={{ fontSize: "15px", fontWeight: 500 }}>{periodoLabel}</div>
                  </>
                )}
                {contrato && (
                  <>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", color: PALETTE.muted, marginTop: "8px", marginBottom: "4px" }}>Contrato</div>
                    <div style={{ fontSize: "13px", fontFamily: PALETTE.mono }}>{contrato.contractNumber}</div>
                  </>
                )}
              </div>
            </div>

            {/* Tabla concepto / importe */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${PALETTE.text}`, fontSize: "11px", textTransform: "uppercase", letterSpacing: ".05em", color: PALETTE.muted, fontWeight: 600 }}>Concepto</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${PALETTE.text}`, fontSize: "11px", textTransform: "uppercase", letterSpacing: ".05em", color: PALETTE.muted, fontWeight: 600 }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "9px 6px", borderBottom: `1px dashed ${PALETTE.border}`, fontFamily: PALETTE.mono }}>
                      {row.concepto}
                      {row.periodo && (
                        <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>· {formatPeriodo(row.periodo)}</span>
                      )}
                    </td>
                    <td style={{ padding: "9px 6px", borderBottom: `1px dashed ${PALETTE.border}`, textAlign: "right", fontFamily: PALETTE.mono }}>
                      {row.monto}
                    </td>
                  </tr>
                ))}
                {serviciosCobrados.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: "9px 6px", borderBottom: `1px dashed ${PALETTE.border}`, fontFamily: PALETTE.mono }}>
                      {s.etiqueta}
                      <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>· {formatPeriodo(s.period)}</span>
                    </td>
                    <td style={{ padding: "9px 6px", borderBottom: `1px dashed ${PALETTE.border}`, textAlign: "right", fontFamily: PALETTE.mono }}>
                      {formatMonto(s.monto!)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div style={{
              marginTop: "16px", textAlign: "right", fontSize: "15px", fontWeight: 700,
              paddingTop: "10px", borderTop: `1.5px solid ${PALETTE.text}`, fontFamily: PALETTE.mono,
            }}>
              Total recibido: {totalDisplay}
            </div>
            <div style={{ textAlign: "right", marginTop: "4px", fontSize: "11px", fontStyle: "italic", color: PALETTE.muted }}>
              Son: {montoEnLetras(montoNum)}
            </div>

            {/* Constancia de servicios pagados directo */}
            {serviciosConstancia.length > 0 && (
              <div style={{ marginTop: "20px", paddingTop: "12px", borderTop: `1px solid ${PALETTE.border}` }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: ".05em", color: PALETTE.muted, marginBottom: "6px" }}>
                  Constancia de servicios abonados directamente por el inquilino
                </div>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: PALETTE.muted }}>
                  {serviciosConstancia.map((s) => (
                    <li key={s.id}>{s.etiqueta} — {formatPeriodo(s.period)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Datos bancarios */}
            {(agency?.bancoCBU || agency?.bancoAlias) && (
              <div style={{ marginTop: "16px", fontSize: "11px", color: PALETTE.muted }}>
                {agency?.bancoCBU && <>CBU: <span style={{ fontFamily: PALETTE.mono }}>{agency.bancoCBU}</span></>}
                {agency?.bancoCBU && agency?.bancoAlias && " · "}
                {agency?.bancoAlias && <>Alias: <span style={{ fontFamily: PALETTE.mono }}>{agency.bancoAlias}</span></>}
              </div>
            )}

            {/* Cláusulas */}
            {agency?.clauses && agency.clauses.length > 0 && (
              <div style={{ marginTop: "20px", fontSize: "11px", color: PALETTE.muted, borderTop: `1px solid ${PALETTE.border}`, paddingTop: "12px" }}>
                <ol style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.6 }}>
                  {agency.clauses.map((c) => (
                    <li key={c.id} style={{ marginBottom: "4px" }}>{c.texto}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Firma */}
            <div style={{ marginTop: "44px", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: "220px", textAlign: "center" }}>
                {agency?.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agency.signatureUrl} alt="Firma" style={{ height: "50px", objectFit: "contain", margin: "0 auto 6px" }} />
                ) : signatoryName ? (
                  <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: "22px", transform: "rotate(-3deg)", marginBottom: "6px" }}>
                    {signatoryName}
                  </div>
                ) : null}
                <div style={{
                  borderTop: `1px solid ${PALETTE.text}`, paddingTop: "6px",
                  fontSize: "11px", color: PALETTE.muted,
                  textTransform: "uppercase", letterSpacing: ".05em",
                }}>
                  {signatoryName ? `${signatoryName} · ${signatoryTitle}` : `${agencyName} · ${signatoryTitle}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
