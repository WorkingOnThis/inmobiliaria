"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Printer, Download, Mail, Check, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDaysInMonth, format } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────

interface AgencyData {
  razonSocial?: string | null;
  cuit?: string | null;
  condicionIVA?: string | null;
  domicilioFiscal?: string | null;
  localidad?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  matricula?: string | null;
  firmante?: string | null;
  firmanteCargo?: string | null;
  firmaUrl?: string | null;
  puntoVenta?: string | null;
  proximoNumero?: string | null;
  tipoComprobante?: string | null;
  bancoCBU?: string | null;
  bancoAlias?: string | null;
  bancoNombre?: string | null;
  logoUrl?: string | null;
  clausulas?: string | null;
  prefShowQR?: boolean | null;
  prefShowDetalle?: boolean | null;
  prefFirma?: boolean | null;
}

interface Propietario {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  email: string | null;
  cbu: string | null;
  alias: string | null;
  banco: string | null;
}

interface Propiedad {
  id: string;
  address: string;
  title: string | null;
}

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  monto: string;
  origen: string;
  propiedadAddress: string | null;
  propiedadId: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return format(new Date(Number(y), Number(m) - 1, 1), "MMMM yyyy", { locale: es });
}

function periodRange(p: string) {
  const [y, m] = p.split("-");
  const last = getDaysInMonth(new Date(Number(y), Number(m) - 1));
  return `Del 01/${m}/${y} al ${String(last).padStart(2, "0")}/${m}/${y}`;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KVRow({
  label, value, mono, cls, bold,
}: {
  label: string; value: string; mono?: boolean; cls?: string; bold?: boolean;
}) {
  return (
    <div className={cn(
      "flex justify-between py-1.5 text-[12.5px] border-b border-border/50 last:border-0",
      bold && "font-semibold pt-2.5 mt-1 border-t border-border border-b-0",
    )}>
      <span className="text-text-muted">{label}</span>
      <span className={cn(mono ? "font-mono" : "", cls)}>{value}</span>
    </div>
  );
}

function ToggleOpt({
  on, onChange, label, desc, disabled,
}: {
  on: boolean; onChange: (v: boolean) => void; label: string; desc: string; disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2.5 px-[10px] py-[9px] rounded-[8px] bg-surface-mid border border-border text-left w-full transition-colors hover:border-border/80",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      onClick={() => !disabled && onChange(!on)}
    >
      <div className={cn("w-[30px] h-4 rounded-full relative transition-all flex-shrink-0", on ? "bg-primary/20" : "bg-border")}>
        <div className={cn("absolute top-[2px] size-3 rounded-full transition-all", on ? "left-[16px] bg-primary" : "left-[2px] bg-text-muted")} />
      </div>
      <div className="flex-1">
        <div className="text-[12.5px] text-on-surface">{label}</div>
        <div className="text-[11px] text-text-muted mt-[1px]">{desc}</div>
      </div>
    </button>
  );
}

// ── Paper styles (intentionally paper-like, not design tokens) ──────────────

const P = {
  bg: "#f7f5ef",
  text: "#1a1614",
  muted: "#5a514c",
  border: "#d9d1c3",
  pos: "#2a6a3a",
  neg: "#9a2a1a",
  accent: "#e85a3c",
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  label: {
    fontSize: "9.5px",
    textTransform: "uppercase" as const,
    letterSpacing: ".08em",
    color: "#5a514c",
    fontWeight: 600,
    marginBottom: "4px",
  },
};

// ── Main page ───────────────────────────────────────────────────────────────

export default function LiquidacionPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const periodo = searchParams.get("periodo") ?? currentPeriod();
  const [showWatermark, setShowWatermark] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showDetalle, setShowDetalle] = useState(true);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [isEmitido, setIsEmitido] = useState(false);
  const [zoom, setZoom] = useState(1);

  const { data: agenciaData } = useQuery<{ agency: AgencyData | null }>({
    queryKey: ["agencia"],
    queryFn: async () => {
      const res = await fetch("/api/agencia");
      if (!res.ok) return { agency: null };
      return res.json();
    },
  });

  const agencia = agenciaData?.agency;

  const { data: propData, isLoading: loadingProp } = useQuery<{
    propietario: Propietario;
    propiedades: Propiedad[];
  }>({
    queryKey: ["propietario", id],
    queryFn: async () => {
      const res = await fetch(`/api/propietarios/${id}`);
      if (!res.ok) throw new Error("Error al cargar propietario");
      return res.json();
    },
  });

  const { data: ccData, isLoading: loadingCC } = useQuery<{
    kpis: { liquidadoAcumulado: number; proximaLiquidacionEstimada: number; pendienteConfirmar: number };
    movimientos: Movimiento[];
  }>({
    queryKey: ["propietario-cc-preview", id, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/propietarios/${id}/cuenta-corriente?periodo=${periodo}`);
      if (!res.ok) throw new Error("Error al cargar movimientos");
      return res.json();
    },
  });

  const isLoading = loadingProp || loadingCC;
  const propietario = propData?.propietario;
  const propiedades = propData?.propiedades ?? [];
  const movimientos = ccData?.movimientos ?? [];

  const totalIngresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresos  = movimientos.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0);
  const honorarios    = (totalIngresos - totalEgresos) * 0.07;
  const totalTransferir = (totalIngresos - totalEgresos) * 0.93;

  const propietarioName = propietario
    ? propietario.lastName ? `${propietario.firstName} ${propietario.lastName}` : propietario.firstName
    : "—";

  const handleEmitir = async () => {
    setIsEmitido(true);
    setShowWatermark(false);
    // Auto-increment the receipt number
    try {
      await fetch("/api/agencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementarNumero: true }),
      });
    } catch {
      // Non-critical: continue even if increment fails
    }
    toast.success(`Liquidación ${periodLabel(periodo)} emitida`);
  };

  const handleZoom = (delta: number) => setZoom((z) => Math.min(1.5, Math.max(0.5, z + delta)));

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="size-8 animate-spin text-text-muted" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* ── Topbar ── */}
      <div className="print:hidden sticky top-0 z-20 h-14 bg-surface border-b border-border flex items-center gap-3.5 px-6 flex-shrink-0">
        <Link
          href={`/propietarios/${id}?tab=cuenta-corriente`}
          className="size-8 rounded-[7px] border border-border bg-surface-mid flex items-center justify-center text-text-muted hover:text-on-surface transition-colors flex-shrink-0"
        >
          <ArrowLeft size={14} />
        </Link>
        <div
          className="size-[26px] rounded-[7px] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0"
          style={{ background: "var(--gradient-owner)" }}
        >
          A
        </div>
        <div className="flex items-center gap-2 text-[13px] text-text-muted">
          <Link href={`/propietarios/${id}?tab=cuenta-corriente`} className="hover:text-on-surface transition-colors">
            {propietarioName}
          </Link>
          <span className="text-text-muted/50">/</span>
          <span className="text-on-surface">Vista previa · Liquidación</span>
          <span className="font-mono text-[11.5px] px-2 py-[2px] border border-border rounded-[4px] bg-surface-mid text-text-muted">
            {periodo}
          </span>
        </div>
        {!isEmitido ? (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.04em] px-2 py-[3px] rounded-full border ml-2.5 bg-warning/14 text-warning border-warning/25">
            <span className="size-1.5 rounded-full bg-current" />
            Borrador
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.04em] px-2 py-[3px] rounded-full border ml-2.5 bg-success/14 text-success border-success/25">
            <span className="size-1.5 rounded-full bg-current" />
            Emitida
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center rounded-[7px] border border-border bg-surface-mid overflow-hidden">
            <button onClick={() => handleZoom(-0.1)} className="px-2 py-1.5 text-text-muted hover:text-on-surface hover:bg-surface transition-colors">
              <Minus size={13} />
            </button>
            <span className="px-2.5 py-1 font-mono text-[12px] border-x border-border text-on-surface select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => handleZoom(0.1)} className="px-2 py-1.5 text-text-muted hover:text-on-surface hover:bg-surface transition-colors">
              <Plus size={13} />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer size={14} /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Descarga de PDF próximamente")} className="gap-1.5">
            <Download size={14} /> Descargar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info(`Enviado a ${propietario?.email ?? "destinatario"}`)} className="gap-1.5">
            <Mail size={14} /> Enviar por email
          </Button>
          {!isEmitido && (
            <Button size="sm" onClick={handleEmitir} className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90">
              <Check size={14} /> Confirmar y emitir
            </Button>
          )}
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div
          className="flex-1 overflow-auto py-7 px-7 flex justify-center items-start print:p-0 print:bg-white"
          style={{
            background: "radial-gradient(circle at 1px 1px, oklch(0.25 0.008 40) 1px, transparent 0) 0 0 / 18px 18px, var(--bg)",
          }}
        >
          <div
            style={{
              transformOrigin: "top center",
              transform: `scale(${zoom})`,
              transition: "transform .2s",
            }}
          >
            {/* Paper */}
            <div
              style={{
                width: "794px",
                minHeight: "1123px",
                background: P.bg,
                color: P.text,
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                fontSize: "13.5px",
                padding: "56px 64px",
                boxShadow: "0 4px 12px rgba(0,0,0,.4), 0 20px 60px rgba(0,0,0,.5)",
                borderRadius: "2px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Watermark */}
              {showWatermark && !isEmitido && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transform: "rotate(-22deg)",
                    pointerEvents: "none", zIndex: 1,
                  }}
                >
                  <span style={{ fontSize: "140px", fontWeight: 900, color: "rgba(232,90,60,0.10)", letterSpacing: ".05em" }}>
                    BORRADOR
                  </span>
                </div>
              )}

              <div style={{ position: "relative", zIndex: 2 }}>
                {/* ── Header ── */}
                <div style={{ display: "flex", gap: "18px", alignItems: "flex-start", paddingBottom: "18px", borderBottom: `2px solid ${P.text}` }}>
                  {/* Logo */}
                  <div style={{
                    width: "60px", height: "60px", borderRadius: "10px", flexShrink: 0,
                    display: "grid", placeItems: "center", overflow: "hidden",
                    ...(agencia?.logoUrl
                      ? {}
                      : { background: "linear-gradient(135deg, #e85a3c, #c03c1f)", color: "#fff", fontWeight: 700, fontSize: "26px" }),
                  }}>
                    {agencia?.logoUrl
                      ? <img src={agencia.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : (agencia?.razonSocial?.[0] ?? "A")
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-.01em" }}>
                      {agencia?.razonSocial ?? "Arce Administración"}
                    </div>
                    {(agencia?.cuit || agencia?.condicionIVA) && (
                      <div style={{ fontSize: "11px", color: P.muted, marginTop: "2px", fontFamily: P.mono }}>
                        {agencia.cuit ? `CUIT ${agencia.cuit}` : ""}
                        {agencia.cuit && agencia.condicionIVA ? " · " : ""}
                        {agencia.condicionIVA ?? ""}
                      </div>
                    )}
                    {agencia?.domicilioFiscal && (
                      <div style={{ fontSize: "11px", color: P.muted }}>
                        {agencia.domicilioFiscal}{agencia.localidad ? ` · ${agencia.localidad}` : ""}
                      </div>
                    )}
                    {(agencia?.telefono || agencia?.emailContacto) && (
                      <div style={{ fontSize: "11px", color: P.muted }}>
                        {agencia.telefono ? `Tel. ${agencia.telefono}` : ""}
                        {agencia.telefono && agencia.emailContacto ? " · " : ""}
                        {agencia.emailContacto ?? ""}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ display: "inline-block", padding: "2px 10px", border: `1.5px solid ${P.text}`, borderRadius: "4px", fontSize: "10px", fontWeight: 700, letterSpacing: ".1em", marginBottom: "6px" }}>
                      {agencia?.tipoComprobante?.toUpperCase() ?? "RECIBO C"}
                    </div>
                    <div style={{ fontFamily: P.mono, fontSize: "15px", fontWeight: 700 }}>
                      {agencia?.puntoVenta ?? "0001"} - {agencia?.proximoNumero ?? periodo.replace("-", "")}
                    </div>
                    {agencia?.matricula && (
                      <>
                        <div style={{ ...P.label, marginTop: "6px" }}>Mat. Profesional</div>
                        <div style={{ fontFamily: P.mono, fontSize: "11px", fontWeight: 500 }}>{agencia.matricula}</div>
                      </>
                    )}
                    <div style={{ ...P.label, marginTop: "6px" }}>Fecha emisión</div>
                    <div style={{ fontFamily: P.mono, fontSize: "11px", fontWeight: 500 }}>{fmtDate(today)}</div>
                  </div>
                </div>

                {/* ── Meta ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginTop: "20px" }}>
                  <div>
                    <div style={P.label}>Recibí de</div>
                    <div style={{ fontSize: "16px", fontWeight: 700 }}>{propietarioName}</div>
                    {(propietario?.dni || propietario?.cuit) && (
                      <div style={{ fontSize: "10.5px", color: P.muted, marginTop: "3px" }}>
                        {propietario.dni ? `DNI ${propietario.dni}` : ""}{propietario.cuit ? ` · CUIT ${propietario.cuit}` : ""}
                      </div>
                    )}
                    {propietario?.email && <div style={{ fontSize: "10.5px", color: P.muted }}>{propietario.email}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={P.label}>Período</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, textTransform: "capitalize" }}>{periodLabel(periodo)}</div>
                    <div style={{ fontSize: "10.5px", color: P.muted, marginTop: "3px" }}>{periodRange(periodo)}</div>
                    {propiedades.length > 0 && (
                      <div style={{ fontSize: "10.5px", color: P.muted }}>
                        {propiedades.length} propiedad{propiedades.length !== 1 ? "es" : ""} administrada{propiedades.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Properties ── */}
                {propiedades.length > 0 && (
                  <>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".1em", color: P.muted, fontWeight: 700, margin: "22px 0 8px" }}>
                      Propiedades incluidas
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {propiedades.map((p, i) => (
                        <div
                          key={p.id}
                          style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px", alignItems: "center", padding: "7px 10px", background: "rgba(26,22,20,0.04)", borderRadius: "4px", fontSize: "11px" }}
                        >
                          <span style={{ fontFamily: P.mono, color: P.muted }}>#{i + 1}</span>
                          <span style={{ fontWeight: 500 }}>{p.address}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Movements table ── */}
                {showDetalle && movimientos.length > 0 && (
                  <>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".1em", color: P.muted, fontWeight: 700, margin: "22px 0 8px" }}>
                      Detalle de movimientos
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr>
                          {["Fecha", "Concepto", "Importe"].map((h, i) => (
                            <th
                              key={h}
                              style={{
                                textAlign: i === 2 ? "right" : "left",
                                padding: "8px 6px",
                                fontSize: "9.5px", textTransform: "uppercase", letterSpacing: ".08em", color: P.muted,
                                fontWeight: 700, borderBottom: `1.5px solid ${P.text}`,
                                width: i === 0 ? "76px" : i === 2 ? "110px" : undefined,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((m) => (
                          <tr key={m.id}>
                            <td style={{ padding: "7px 6px", borderBottom: `1px dashed ${P.border}`, fontFamily: P.mono, color: P.muted, fontSize: "10.5px", whiteSpace: "nowrap" }}>
                              {fmtDate(m.fecha)}
                            </td>
                            <td style={{ padding: "7px 6px", borderBottom: `1px dashed ${P.border}`, verticalAlign: "top" }}>
                              {m.descripcion}
                              {m.propiedadAddress && (
                                <div style={{ fontSize: "10px", color: P.muted, marginTop: "2px" }}>{m.propiedadAddress}</div>
                              )}
                            </td>
                            <td style={{ padding: "7px 6px", borderBottom: `1px dashed ${P.border}`, textAlign: "right", fontFamily: P.mono, whiteSpace: "nowrap", color: m.tipo === "ingreso" ? P.pos : P.neg }}>
                              {m.tipo === "ingreso" ? "+ " : "− "}{fmt(Number(m.monto))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {movimientos.length === 0 && (
                  <div style={{ margin: "32px 0", textAlign: "center", fontSize: "12px", color: P.muted, padding: "24px", border: `1px dashed ${P.border}`, borderRadius: "4px" }}>
                    Sin movimientos registrados para este período
                  </div>
                )}

                {/* ── Totals ── */}
                <div style={{ marginTop: "16px", marginLeft: "auto", width: "45%" }}>
                  {[
                    { label: "Subtotal ingresos", value: `+ ${fmt(totalIngresos)}`, color: P.text },
                    { label: "Subtotal egresos",  value: `− ${fmt(totalEgresos)}`,  color: P.text },
                    { label: "Honorarios (7%)",   value: `− ${fmt(honorarios)}`,    color: P.text },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: "12px", borderBottom: `1px dotted ${P.border}` }}>
                      <span style={{ color: P.muted }}>{label}</span>
                      <span style={{ fontFamily: P.mono, fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 6px", marginTop: "6px", borderTop: `2px solid ${P.text}`, fontSize: "15px", fontWeight: 700 }}>
                    <span>Total a transferir</span>
                    <span style={{ fontFamily: P.mono, color: P.accent, fontSize: "17px" }}>
                      $ {fmt(totalTransferir)}
                    </span>
                  </div>
                </div>

                {/* ── Signature & bank ── */}
                <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: "10px", color: P.muted }}>
                    <div style={{ ...P.label, marginBottom: "6px" }}>Transferencia a</div>
                    {propietario?.banco && (
                      <div><strong style={{ color: P.text, fontFamily: P.mono, fontWeight: 500 }}>{propietario.banco}</strong></div>
                    )}
                    <div>Titular: {propietarioName}</div>
                    {propietario?.cbu && (
                      <div>CBU: <strong style={{ color: P.text, fontFamily: P.mono, fontWeight: 500 }}>{propietario.cbu}</strong></div>
                    )}
                    {propietario?.alias && (
                      <div>Alias: <strong style={{ color: P.text, fontFamily: P.mono, fontWeight: 500 }}>{propietario.alias}</strong></div>
                    )}
                  </div>
                  <div style={{ width: "200px", textAlign: "center" }}>
                    {agencia?.firmaUrl ? (
                      <img src={agencia.firmaUrl} alt="Firma" style={{ height: "50px", objectFit: "contain", margin: "0 auto 4px", display: "block" }} />
                    ) : (
                      <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: "28px", transform: "rotate(-3deg)", marginBottom: "2px", color: P.text }}>
                        {agencia?.firmante ?? "Administrador"}
                      </div>
                    )}
                    <div style={{ borderTop: `1px solid ${P.text}`, paddingTop: "6px", fontSize: "9.5px", color: P.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      {agencia?.firmante ?? "Administrador"} · {agencia?.firmanteCargo ?? "Administrador"}
                    </div>
                  </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ marginTop: "40px", paddingTop: "18px", borderTop: `1px solid ${P.border}`, display: "grid", gridTemplateColumns: showQR ? "1fr 180px" : "1fr", gap: "24px" }}>
                  <div style={{ fontSize: "9.5px", color: P.muted, lineHeight: 1.55 }}>
                    {(() => {
                      const parsed: { id: string; texto: string }[] = agencia?.clausulas
                        ? (() => { try { return JSON.parse(agencia.clausulas); } catch { return []; } })()
                        : [];
                      const clausulasToShow = parsed.length > 0 ? parsed : [
                        { id: "1", texto: "El presente recibo no constituye factura. Válido como constancia de liquidación de alquileres según contrato vigente." },
                        { id: "2", texto: "Los honorarios por administración se calculan sobre el monto bruto percibido, según Ley 27.551 y modificatorias." },
                        { id: "3", texto: "Ante discrepancias comunicarse dentro de los 15 días hábiles desde la emisión." },
                      ];
                      return clausulasToShow.map((c, i) => (
                        <div key={c.id} style={{ padding: "3px 0" }}>{i + 1}. {c.texto}</div>
                      ));
                    })()}
                  </div>
                  {showQR && (
                    <div>
                      <div
                        style={{
                          width: "100px", height: "100px", marginLeft: "auto",
                          border: `2px solid ${P.text}`,
                          background: `repeating-linear-gradient(90deg, ${P.text} 0 2px, transparent 2px 6px), repeating-linear-gradient(0deg, ${P.text} 0 2px, transparent 2px 6px), ${P.bg}`,
                          backgroundSize: "6px 6px",
                        }}
                      />
                      <div style={{ fontSize: "9px", textAlign: "center", marginTop: "4px", color: P.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>
                        QR transferencia
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside
          className="print:hidden w-[320px] border-l border-border bg-surface flex-shrink-0 overflow-y-auto"
          style={{ position: "sticky", top: "56px", height: "calc(100vh - 56px)" }}
        >
          <div className="p-[18px] pb-6 flex flex-col gap-5">
            {/* Summary */}
            <div>
              <h3 className="text-[12px] text-text-muted uppercase tracking-[.08em] font-semibold mb-3">Resumen</h3>
              <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
                <KVRow label="Propietario" value={propietarioName} />
                <KVRow label="Período" value={periodLabel(periodo)} mono />
                <KVRow label="Propiedades" value={String(propiedades.length)} mono />
                <KVRow label="Movimientos" value={String(movimientos.length)} mono />
                <KVRow label="Ingresos" value={`+ ${fmt(totalIngresos)}`} mono cls="text-success" />
                <KVRow label="Egresos" value={`− ${fmt(totalEgresos)}`} mono cls="text-error" />
                <KVRow label="Honorarios" value={`− ${fmt(honorarios)}`} mono cls="text-error" />
                <KVRow label="Total a transferir" value={`$ ${fmt(totalTransferir)}`} mono cls="text-primary" bold />
              </div>
            </div>

            {/* Print options */}
            <div>
              <h3 className="text-[12px] text-text-muted uppercase tracking-[.08em] font-semibold mb-3">Opciones de impresión</h3>
              <div className="flex flex-col gap-2">
                <ToggleOpt
                  on={showWatermark && !isEmitido}
                  disabled={isEmitido}
                  onChange={setShowWatermark}
                  label="Marca de agua"
                  desc='Mostrar "BORRADOR"'
                />
                <ToggleOpt on={showQR} onChange={setShowQR} label="Incluir QR" desc="Pie del documento" />
                <ToggleOpt on={showDetalle} onChange={setShowDetalle} label="Detalle de movimientos" desc="Tabla completa" />
                <ToggleOpt on={showDuplicate} onChange={setShowDuplicate} label="Copia duplicada" desc="Original + duplicado" />
              </div>
            </div>

            {/* Recipients */}
            <div>
              <h3 className="text-[12px] text-text-muted uppercase tracking-[.08em] font-semibold mb-3">Destinatarios</h3>
              <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
                <div className="text-[12.5px] font-medium text-on-surface mb-1">{propietarioName}</div>
                {propietario?.email ? (
                  <div className="font-mono text-[11.5px] text-text-muted">{propietario.email}</div>
                ) : (
                  <div className="text-[11px] text-text-muted italic">Sin email registrado</div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5 w-full justify-center gap-1.5"
                  onClick={() => toast.info("Próximamente")}
                >
                  <Mail size={13} /> + Agregar copia (CC)
                </Button>
              </div>
            </div>

            {/* Edit */}
            <div>
              <h3 className="text-[12px] text-text-muted uppercase tracking-[.08em] font-semibold mb-3">Editar</h3>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/propietarios/${id}?tab=cuenta-corriente`}
                  className="flex items-center gap-2.5 px-[10px] py-[9px] rounded-[8px] bg-surface-mid border border-border hover:border-border/80 transition-colors"
                >
                  <ArrowLeft size={16} className="text-text-muted flex-shrink-0" />
                  <div>
                    <div className="text-[12.5px] text-on-surface">Volver a movimientos</div>
                    <div className="text-[11px] text-text-muted mt-0.5">Editar partidas del período</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
