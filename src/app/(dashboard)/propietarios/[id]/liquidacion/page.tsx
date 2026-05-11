"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DocumentPreviewShell } from "@/components/document-preview/document-preview-shell";
import { PreviewTopbar } from "@/components/document-preview/topbar";
import { Paper } from "@/components/document-preview/paper";
import { PaperHeader } from "@/components/document-preview/paper-header";
import { PaperMetaBlock } from "@/components/document-preview/paper-meta-block";
import { PaperItemsTable, type PaperItem } from "@/components/document-preview/paper-items-table";
import { PaperTotals } from "@/components/document-preview/paper-totals";
import { PaperFooter } from "@/components/document-preview/paper-footer";
import { SideSummaryCard } from "@/components/document-preview/side-summary-card";
import { SidePrintOptions } from "@/components/document-preview/side-print-options";
import { SideRecipients } from "@/components/document-preview/side-recipients";
import { SideObservations } from "@/components/document-preview/side-observations";
import { formatARS } from "@/components/document-preview/format";

// ── Types ──────────────────────────────────────────────────────────────────

interface AgencyData {
  legalName?: string | null;
  tradeName?: string | null;
  cuit?: string | null;
  vatStatus?: string | null;
  fiscalAddress?: string | null;
  city?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  licenseNumber?: string | null;
  signatory?: string | null;
  signatoryTitle?: string | null;
  signatureUrl?: string | null;
  invoicePoint?: string | null;
  nextNumber?: string | null;
  receiptType?: string | null;
  bancoCBU?: string | null;
  bancoAlias?: string | null;
  bancoNombre?: string | null;
  logoUrl?: string | null;
  clauses?: string | null;
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
  bank: string | null;
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

function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return format(new Date(Number(y), Number(m) - 1, 1), "MMMM yyyy", { locale: es });
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseClauses(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((c) => typeof c === "string" ? c : c.texto).filter(Boolean);
  } catch {
    return [raw];
  }
  return [];
}

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
  const [observations, setObservations] = useState("");
  const [busyAction, setBusyAction] = useState<"print" | "email" | "confirm" | null>(null);
  const [liquidacionNumero, setLiquidacionNumero] = useState<string | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const { data: agencyData } = useQuery<{ agency: AgencyData | null }>({
    queryKey: ["agency"],
    queryFn: async () => {
      const res = await fetch("/api/agency");
      if (!res.ok) return { agency: null };
      return res.json();
    },
  });

  const agency = agencyData?.agency;

  const { data: propData, isLoading: loadingProp } = useQuery<{
    propietario: Propietario;
    propiedades: Propiedad[];
  }>({
    queryKey: ["propietario", id],
    queryFn: async () => {
      const res = await fetch(`/api/owners/${id}`);
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
      const res = await fetch(`/api/owners/${id}/cuenta-corriente?periodo=${periodo}`);
      if (!res.ok) throw new Error("Error al cargar movimientos");
      return res.json();
    },
  });

  const isLoading = loadingProp || loadingCC;
  const propietario = propData?.propietario;
  const propiedades = propData?.propiedades ?? [];
  const movimientos = ccData?.movimientos ?? [];

  const totalIngresos = movimientos.filter((m) => m.tipo === "income").reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresos  = movimientos.filter((m) => m.tipo === "expense").reduce((s, m) => s + Number(m.monto), 0);
  const honorarios    = (totalIngresos - totalEgresos) * 0.07;
  const totalTransferir = (totalIngresos - totalEgresos) * 0.93;

  const propietarioName = propietario
    ? propietario.lastName ? `${propietario.firstName} ${propietario.lastName}` : propietario.firstName
    : "—";

  const today = new Date().toISOString().split("T")[0];

  async function emit(action: "print" | "email" | "confirm") {
    setBusyAction(action);
    try {
      const res = await fetch(`/api/owners/${id}/liquidacion/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo,
          movimientoIds: movimientos.map((m) => m.id),
          honorariosPct: 7,
          fecha: today,
          observaciones: observations || undefined,
          idempotencyKey,
          action,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al emitir liquidación");
      }
      const result = await res.json();
      setIsEmitido(true);
      setShowWatermark(false);
      setLiquidacionNumero(result.liquidacionNumero);
      toast.success(`Liquidación ${result.liquidacionNumero} emitida`);
      if (action === "print") window.print();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items: PaperItem[] = movimientos.map((m) => ({
    fecha: fmtDate(m.fecha),
    concepto: m.descripcion,
    meta: m.propiedadAddress ?? undefined,
    importe: m.tipo === "income" ? Number(m.monto) : -Number(m.monto),
  }));

  const printOptions = [
    { key: "watermark", label: "Marca de agua", desc: 'Mostrar "BORRADOR"', on: showWatermark && !isEmitido, disabled: isEmitido },
    { key: "qr", label: "Incluir QR", desc: "Pie del documento", on: showQR },
    { key: "detalle", label: "Detalle de movimientos", desc: "Tabla completa", on: showDetalle },
    { key: "duplicate", label: "Copia duplicada", desc: "Original + duplicado", on: showDuplicate },
  ];

  function handleToggleOption(key: string) {
    if (key === "watermark") setShowWatermark((v) => !v);
    if (key === "qr") setShowQR((v) => !v);
    if (key === "detalle") setShowDetalle((v) => !v);
    if (key === "duplicate") setShowDuplicate((v) => !v);
  }

  return (
    <DocumentPreviewShell
      topbar={
        <PreviewTopbar
          backHref={`/propietarios/${id}?tab=cuenta-corriente`}
          breadcrumb={{ name: propietarioName, ref: periodo }}
          isEmitido={isEmitido}
          zoom={zoom}
          onZoom={(d) => setZoom((z) => Math.min(1.5, Math.max(0.5, z + d)))}
          onPrint={() => emit("print")}
          onDownloadPdf={() => toast.info("Descarga de PDF próximamente")}
          onSendEmail={() => emit("email")}
          onConfirm={() => emit("confirm")}
          emailDisabled={!propietario?.email}
          busyAction={busyAction}
        />
      }
      paper={
        <Paper watermark={showWatermark && !isEmitido} zoom={zoom}>
          <PaperHeader
            agency={{
              name: agency?.legalName ?? agency?.tradeName ?? "Administradora",
              cuit: agency?.cuit ?? null,
              vatStatus: agency?.vatStatus ?? null,
              fiscalAddress: agency?.fiscalAddress ?? null,
              city: agency?.city ?? null,
              phone: agency?.phone ?? null,
              contactEmail: agency?.contactEmail ?? null,
              licenseNumber: agency?.licenseNumber ?? null,
              professionalAssociation: null,
              grossIncome: null,
              activityStart: null,
              logoUrl: agency?.logoUrl ?? null,
            }}
            receiptType="LIQUIDACIÓN"
            numero={liquidacionNumero ?? `${agency?.invoicePoint ?? "0001"} - ${(agency?.nextNumber ?? "00000001").padStart(8, "0")}`}
            fechaEmision={fmtDate(today)}
          />
          <PaperMetaBlock
            leftLabel="Liquidación a"
            leftValue={propietarioName}
            leftSub={[
              propietario?.dni ? `DNI ${propietario.dni}` : "",
              propietario?.email ?? "",
            ].filter(Boolean)}
            rightLabel="Período"
            rightValue={periodLabel(periodo)}
            rightSub={[`${propiedades.length} ${propiedades.length === 1 ? "propiedad administrada" : "propiedades administradas"}`]}
          />
          {showDetalle && <PaperItemsTable items={items} />}
          <PaperTotals
            lines={[
              { label: "Subtotal ingresos", value: totalIngresos },
              { label: "Subtotal egresos", value: -totalEgresos },
              { label: "Honorarios (7%)", value: -honorarios },
            ]}
            total={{ label: "Total a transferir", value: totalTransferir }}
          />
          <PaperFooter
            bank={{
              nombre: propietario?.bank ?? null,
              titular: propietarioName,
              cbu: propietario?.cbu ?? null,
              alias: propietario?.alias ?? null,
            }}
            signatory={{
              nombre: agency?.signatory ?? null,
              cargo: agency?.signatoryTitle ?? null,
              signatureUrl: agency?.signatureUrl ?? null,
            }}
            clauses={parseClauses(agency?.clauses)}
            showQR={showQR}
          />
        </Paper>
      }
      sidebar={
        <>
          <SideSummaryCard
            rows={[
              { label: "Propietario", value: propietarioName },
              { label: "Período", value: periodLabel(periodo), mono: true },
              { label: "Propiedades", value: String(propiedades.length), mono: true },
              { label: "Movimientos", value: String(movimientos.length), mono: true },
              { label: "Ingresos", value: `+ ${formatARS(totalIngresos)}`, mono: true, cls: "text-success" },
              { label: "Egresos", value: `− ${formatARS(totalEgresos)}`, mono: true, cls: "text-error" },
              { label: "Honorarios", value: `− ${formatARS(honorarios)}`, mono: true, cls: "text-error" },
            ]}
            total={{ label: "Total a transferir", value: `$ ${formatARS(totalTransferir)}`, mono: true, cls: "text-primary" }}
          />
          <SidePrintOptions options={printOptions} onToggle={handleToggleOption} />
          <SideRecipients recipients={[{ name: propietarioName, email: propietario?.email ?? null }]} />
          <SideObservations value={observations} onChange={setObservations} disabled={isEmitido} />
        </>
      }
    />
  );
}
