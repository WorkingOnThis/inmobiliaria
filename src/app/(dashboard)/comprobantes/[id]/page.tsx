"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Printer, ArrowLeft, Mail, Check } from "lucide-react";
import type { ComprobanteData } from "@/lib/comprobantes/load";
import {
  formatMonto,
  formatFecha,
  formatPeriodo,
  montoEnLetras,
  agencyDisplayName,
} from "@/lib/receipts/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PALETTE = {
  bg: "var(--paper-bg)",
  text: "var(--paper-text)",
  muted: "var(--paper-muted)",
  border: "var(--paper-border)",
  mono: "var(--paper-mono)",
};

export default function ComprobantePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: string[] } | null>(
    null
  );

  const { data, isLoading, error } = useQuery<ComprobanteData>({
    queryKey: ["comprobante", id],
    queryFn: async () => {
      const res = await fetch(`/api/comprobantes/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el comprobante");
      }
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!data?.propietario.email) throw new Error("Sin email del propietario");
      const res = await fetch(`/api/comprobantes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: [data.propietario.email] }),
      });
      if (!res.ok) {
        let errorMsg = "Error al enviar";
        try {
          const d = await res.json();
          errorMsg = d.error ?? errorMsg;
        } catch {}
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
        <div className="text-sm">
          {(error as Error)?.message ?? "Comprobante no encontrado"}
        </div>
        <Button variant="link" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft size={12} aria-hidden="true" /> Volver
        </Button>
      </div>
    );
  }

  const { movimiento, contrato, propiedad, inquilino, propietario, items, totales, agency } =
    data;

  const isSplit = movimiento.paymentModality === "split";
  const tituloDoc = isSplit
    ? "CONSTANCIA DE COBRO DISTRIBUIDO"
    : "COMPROBANTE DE LIQUIDACIÓN";
  const textoIntro = isSplit
    ? "Dejamos constancia de que el inquilino transfirió directamente los siguientes conceptos conforme al desglose adjunto, correspondientes al contrato indicado."
    : "Comprobamos haber percibido del inquilino los siguientes conceptos correspondientes al contrato indicado, y procedido a su liquidación según el detalle adjunto.";

  const agencyName = agencyDisplayName(agency);
  const agencyInitial = (agencyName[0] ?? "A").toUpperCase();
  const cityLine = [agency?.fiscalAddress, agency?.city].filter(Boolean).join(", ");
  const contactLine = [
    agency?.phone ? `Tel. ${agency.phone}` : null,
    agency?.contactEmail,
  ]
    .filter(Boolean)
    .join(" · ");

  const nombrePropietario = [propietario.firstName, propietario.lastName]
    .filter(Boolean)
    .join(" ");
  const nombreInquilino = inquilino
    ? [inquilino.firstName, inquilino.lastName].filter(Boolean).join(" ")
    : null;

  const periodoLabel = movimiento.period ? formatPeriodo(movimiento.period) : null;
  const direccionPropiedad = `${propiedad.address}${
    propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""
  }`;

  const signatoryName = agency?.signatory;
  const signatoryTitle = agency?.signatoryTitle || "Administrador";

  const isAnulado = movimiento.anuladoAt !== null;
  const propietarioEmail = propietario.email;

  return (
    <div className="min-h-screen bg-bg print:bg-white relative">
      {/* Top action bar — print:hidden */}
      <div className="print:hidden h-14 bg-surface border-b border-border flex items-center justify-between px-7">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft size={13} aria-hidden="true" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSendResult(null);
              setShowEmailDialog(true);
            }}
            disabled={!propietarioEmail}
            title={
              !propietarioEmail
                ? "El propietario no tiene email cargado"
                : `Enviar a ${propietarioEmail}`
            }
            className="gap-2"
          >
            <Mail size={14} aria-hidden="true" /> Enviar por email
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-2">
            <Printer size={14} aria-hidden="true" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Email dialog */}
      <Dialog
        open={showEmailDialog && !!propietarioEmail}
        onOpenChange={setShowEmailDialog}
      >
        <DialogContent className="sm:max-w-sm print:hidden">
          <DialogHeader>
            <DialogTitle>Enviar comprobante por email</DialogTitle>
            <DialogDescription>
              {sendResult
                ? "Resultado del envío."
                : "Se enviará el comprobante con un link al propietario."}
            </DialogDescription>
          </DialogHeader>

          {sendResult ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="size-10 rounded-full bg-income-dim flex items-center justify-center">
                <Check size={20} className="text-income" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-on-bg">
                {sendResult.sent === 1
                  ? "Comprobante enviado"
                  : `${sendResult.sent} comprobantes enviados`}
              </p>
              {sendResult.failed.length > 0 && (
                <p className="text-xs text-destructive">
                  No se pudo enviar a: {sendResult.failed.join(", ")}
                </p>
              )}
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowEmailDialog(false)}
              >
                Cerrar
              </Button>
            </div>
          ) : (
            <>
              <div className="text-sm text-on-bg border border-border rounded-md px-3 py-2 bg-muted/20 break-all">
                {propietarioEmail}
              </div>
              {sendMutation.isError && (
                <p className="text-xs text-destructive">
                  {(sendMutation.error as Error).message}
                </p>
              )}
              <DialogFooter className="sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  className="gap-1.5"
                >
                  <Mail size={13} aria-hidden="true" />
                  {sendMutation.isPending ? "Enviando..." : "Enviar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Semantic page heading for screen readers — visual title is rendered
          in the document header below as a stylized div. */}
      <h1 className="sr-only">
        {tituloDoc} {movimiento.reciboNumero}
        {isAnulado ? " (anulado)" : ""}
      </h1>

      {/* Comprobante — A4 centered */}
      <div className="mx-auto max-w-[760px] p-8 print:p-0 print:max-w-none">
        <div
          style={{
            background: PALETTE.bg,
            color: PALETTE.text,
            fontFamily: "Inter, -apple-system, sans-serif",
            padding: "44px 48px",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            lineHeight: 1.5,
            position: "relative",
          }}
          className="print:rounded-none print:shadow-none print:!bg-white shadow-[0_8px_24px_rgba(0,0,0,.3)]"
        >
          {/* ANULADO stamp */}
          {isAnulado && (
            <div
              role="img"
              aria-label="Comprobante anulado"
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-25deg)",
                fontSize: "72px",
                fontWeight: 800,
                color: "rgba(220, 38, 38, 0.3)",
                border: "6px solid rgba(220, 38, 38, 0.3)",
                padding: "12px 36px",
                borderRadius: "var(--radius-md)",
                letterSpacing: ".1em",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              ANULADO
            </div>
          )}

          {/* Header */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              alignItems: "flex-start",
              paddingBottom: "18px",
              borderBottom: `1.5px solid ${PALETTE.text}`,
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "12px",
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                ...(agency?.logoUrl
                  ? {}
                  : {
                      background: "linear-gradient(135deg, #e85a3c, #c03c1f)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "26px",
                    }),
              }}
            >
              {agency?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agency.logoUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                agencyInitial
              )}
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
              <div
                style={{
                  fontSize: "11px",
                  color: PALETTE.muted,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                }}
              >
                {tituloDoc}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>
                {movimiento.reciboNumero}
              </div>
              {agency?.licenseNumber && (
                <div
                  style={{ fontSize: "11px", color: PALETTE.muted, marginTop: "4px" }}
                >
                  Mat. {agency.licenseNumber}
                </div>
              )}
            </div>
          </div>

          {/* Identificación */}
          <div style={{ marginTop: "22px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginBottom: "4px",
                  }}
                >
                  Liquidado a
                </div>
                <div style={{ fontSize: "15px", fontWeight: 500 }}>
                  {nombrePropietario}
                </div>
                {propietario.dni && (
                  <div style={{ fontSize: "12px", color: PALETTE.muted }}>
                    DNI {propietario.dni}
                  </div>
                )}
                <div style={{ fontSize: "12px", color: PALETTE.muted }}>
                  {direccionPropiedad}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginBottom: "4px",
                  }}
                >
                  Fecha
                </div>
                <div style={{ fontSize: "15px", fontWeight: 500 }}>
                  {formatFecha(movimiento.date)}
                </div>
                {periodoLabel && (
                  <>
                    <div
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        color: PALETTE.muted,
                        marginTop: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      Período
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 500 }}>
                      {periodoLabel}
                    </div>
                  </>
                )}
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginTop: "8px",
                    marginBottom: "4px",
                  }}
                >
                  Contrato
                </div>
                <div style={{ fontSize: "13px", fontFamily: PALETTE.mono }}>
                  {contrato.contractNumber}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: PALETTE.muted,
                    marginTop: "8px",
                    marginBottom: "4px",
                  }}
                >
                  Modalidad
                </div>
                <div style={{ fontSize: "13px" }}>
                  {isSplit ? "Pago dividido" : "Cobro por administradora"}
                </div>
              </div>
            </div>

            {/* Inquilino tagline */}
            {nombreInquilino && (
              <div
                style={{
                  fontSize: "12px",
                  color: PALETTE.muted,
                  paddingBottom: "14px",
                  borderBottom: `1px dashed ${PALETTE.border}`,
                }}
              >
                Inquilino: <strong style={{ color: PALETTE.text }}>{nombreInquilino}</strong>
                {inquilino?.dni && ` · DNI ${inquilino.dni}`}
              </div>
            )}

            {/* Texto introductorio */}
            <div style={{ marginTop: "16px", fontSize: "12.5px", lineHeight: 1.6 }}>
              {textoIntro}
            </div>

            {/* Tabla detalle */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12.5px",
                marginTop: "16px",
              }}
            >
              <caption className="sr-only">
                Detalle de conceptos cobrados con bruto, porcentaje de honorarios, honorarios y neto al propietario.
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{
                      textAlign: "left",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Concepto
                  </th>
                  <th
                    scope="col"
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Bruto
                  </th>
                  <th
                    scope="col"
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                      width: "50px",
                    }}
                  >
                    %
                  </th>
                  <th
                    scope="col"
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Honorarios
                  </th>
                  <th
                    scope="col"
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${PALETTE.text}`,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Neto
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        fontFamily: PALETTE.mono,
                      }}
                    >
                      {it.descripcion}
                      {it.period && (
                        <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>
                          · {formatPeriodo(it.period)}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                      }}
                    >
                      {formatMonto(it.bruto)}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                        color: PALETTE.muted,
                      }}
                    >
                      {it.comisionPct > 0 ? `${it.comisionPct}%` : "—"}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                        color: PALETTE.muted,
                      }}
                    >
                      {it.comision > 0 ? formatMonto(it.comision) : "—"}
                    </td>
                    <td
                      style={{
                        padding: "9px 6px",
                        borderBottom: `1px dashed ${PALETTE.border}`,
                        textAlign: "right",
                        fontFamily: PALETTE.mono,
                      }}
                    >
                      {formatMonto(it.neto)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    style={{
                      padding: "10px 6px",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      fontWeight: 600,
                    }}
                  >
                    Totales
                  </td>
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontFamily: PALETTE.mono,
                      fontWeight: 600,
                    }}
                  >
                    {formatMonto(totales.bruto)}
                  </td>
                  <td />
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontFamily: PALETTE.mono,
                      fontWeight: 600,
                      color: PALETTE.muted,
                    }}
                  >
                    {totales.comision > 0 ? formatMonto(totales.comision) : "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "right",
                      fontFamily: PALETTE.mono,
                      fontWeight: 600,
                    }}
                  >
                    {formatMonto(totales.neto)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total destacado */}
            <div
              style={{
                marginTop: "16px",
                textAlign: "right",
                fontSize: "15px",
                fontWeight: 700,
                paddingTop: "10px",
                borderTop: `1.5px solid ${PALETTE.text}`,
                fontFamily: PALETTE.mono,
              }}
            >
              Neto al propietario: {formatMonto(totales.neto)}
            </div>
            <div
              style={{
                textAlign: "right",
                marginTop: "4px",
                fontSize: "11px",
                fontStyle: "italic",
                color: PALETTE.muted,
              }}
            >
              Son: {montoEnLetras(totales.neto)}
            </div>

            {/* Distribución según modalidad */}
            <div
              style={{
                marginTop: "20px",
                paddingTop: "12px",
                borderTop: `1px solid ${PALETTE.border}`,
                fontSize: "12px",
              }}
            >
              {isSplit ? (
                <>
                  <div
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: PALETTE.muted,
                      marginBottom: "6px",
                    }}
                  >
                    Distribución del cobro
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    <strong>Propietario:</strong> {formatMonto(totales.neto)}
                    {(propietario.cbu || propietario.alias) && (
                      <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>
                        →{propietario.cbu ? ` CBU ${propietario.cbu}` : ""}
                        {propietario.cbu && propietario.alias ? " · " : " "}
                        {propietario.alias ? `Alias ${propietario.alias}` : ""}
                      </span>
                    )}
                  </div>
                  {totales.comision > 0 && (
                    <div>
                      <strong>Administración:</strong> {formatMonto(totales.comision)}
                      {(agency?.bancoCBU || agency?.bancoAlias) && (
                        <span style={{ color: PALETTE.muted, marginLeft: "6px" }}>
                          →{agency?.bancoCBU ? ` CBU ${agency.bancoCBU}` : ""}
                          {agency?.bancoCBU && agency?.bancoAlias ? " · " : " "}
                          {agency?.bancoAlias ? `Alias ${agency.bancoAlias}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                (propietario.cbu || propietario.alias) && (
                  <div style={{ color: PALETTE.muted }}>
                    Neto transferido a
                    {propietario.cbu ? ` CBU ${propietario.cbu}` : ""}
                    {propietario.cbu && propietario.alias ? " · " : " "}
                    {propietario.alias ? `Alias ${propietario.alias}` : ""}
                  </div>
                )
              )}
            </div>

            {/* Cláusulas */}
            {agency?.clauses && agency.clauses.length > 0 && (
              <div
                style={{
                  marginTop: "20px",
                  fontSize: "11px",
                  color: PALETTE.muted,
                  borderTop: `1px solid ${PALETTE.border}`,
                  paddingTop: "12px",
                }}
              >
                <ol style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.6 }}>
                  {agency.clauses.map((c) => (
                    <li key={c.id} style={{ marginBottom: "4px" }}>
                      {c.texto}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Firma */}
            <div
              style={{
                marginTop: "44px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <div style={{ width: "220px", textAlign: "center" }}>
                {agency?.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agency.signatureUrl}
                    alt="Firma"
                    style={{
                      height: "50px",
                      objectFit: "contain",
                      margin: "0 auto 6px",
                    }}
                  />
                ) : signatoryName ? (
                  <div
                    style={{
                      fontFamily: '"Brush Script MT", cursive',
                      fontSize: "22px",
                      transform: "rotate(-3deg)",
                      marginBottom: "6px",
                    }}
                  >
                    {signatoryName}
                  </div>
                ) : null}
                <div
                  style={{
                    borderTop: `1px solid ${PALETTE.text}`,
                    paddingTop: "6px",
                    fontSize: "11px",
                    color: PALETTE.muted,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  {signatoryName
                    ? `${signatoryName} · ${signatoryTitle}`
                    : `${agencyName} · ${signatoryTitle}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
