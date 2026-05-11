"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getWithTTL, removeKey } from "@/lib/utils/local-storage-ttl";
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

type Draft = {
  ledgerEntryIds: string[];
  montoOverrides: Record<string, string>;
  beneficiarioOverrides: Record<string, string>;
  honorariosPct: number;
  fecha: string;
  idempotencyKey: string;
};

type LedgerEntry = {
  id: string;
  descripcion: string;
  tipo: string;
  monto: string | null;
  montoManual: string | null;
  period: string | null;
};

type SplitMeta = {
  managementCommissionPct: number;
};

function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
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

export default function CobroPreviewPage() {
  const router = useRouter();
  const { id: tenantId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Toggles + zoom + observaciones
  const [showWatermark, setShowWatermark] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showDetalle, setShowDetalle] = useState(true);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [observations, setObservations] = useState("");

  // Estado de emisión
  const [isEmitido, setIsEmitido] = useState(false);
  const [reciboNumero, setReciboNumero] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"print" | "email" | "confirm" | null>(null);

  // Leer draft de localStorage al montar
  useEffect(() => {
    if (!draftId) {
      setDraftError("Falta el parámetro draft. Volvé a la cuenta corriente y volvé a apretar Cobrar.");
      return;
    }
    const data = getWithTTL<Draft>(`cobro-draft-${draftId}`);
    if (!data) {
      setDraftError("La selección expiró o no se encontró. Volvé a la cuenta corriente y volvé a apretar Cobrar.");
      return;
    }
    setDraft(data);
    // No removemos la key acá: si el usuario refresca, queremos que sobreviva.
    // La sacamos solo cuando se emite.
  }, [draftId]);

  // Datos del inquilino + ledger entries
  const { data: tenantData } = useQuery<{ ledgerEntries: LedgerEntry[]; splitMeta?: SplitMeta }>({
    queryKey: ["tenant-cuenta-corriente", tenantId],
    queryFn: async () => {
      const r = await fetch(`/api/tenants/${tenantId}/cuenta-corriente`);
      if (!r.ok) throw new Error("Error al cargar cuenta corriente");
      return r.json();
    },
    enabled: !!tenantId && !!draft,
  });

  const { data: agencyData } = useQuery<{ agency: Record<string, unknown> | null }>({
    queryKey: ["agency"],
    queryFn: async () => {
      const r = await fetch("/api/agency");
      if (!r.ok) return { agency: null };
      return r.json();
    },
  });

  const { data: tenantInfo } = useQuery<{ tenant?: Record<string, unknown> } | Record<string, unknown>>({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const r = await fetch(`/api/tenants/${tenantId}`);
      if (!r.ok) throw new Error("Error al cargar inquilino");
      return r.json();
    },
    enabled: !!tenantId,
  });

  const agency = agencyData?.agency as Record<string, string | null> | undefined;
  const tenant = (tenantInfo && "tenant" in tenantInfo ? tenantInfo.tenant : tenantInfo) as Record<string, string | null | undefined> | undefined;

  const selectedEntries: LedgerEntry[] = useMemo(() => {
    if (!draft || !tenantData?.ledgerEntries) return [];
    const ids = new Set(draft.ledgerEntryIds);
    return tenantData.ledgerEntries.filter((e) => ids.has(e.id));
  }, [draft, tenantData]);

  const items: PaperItem[] = useMemo(() => selectedEntries.map((e) => {
    const monto = draft?.montoOverrides?.[e.id] !== undefined
      ? Number(draft.montoOverrides[e.id])
      : Number(e.montoManual ?? e.monto ?? 0);
    const sign = e.tipo === "descuento" || e.tipo === "bonificacion" ? -1 : 1;
    return {
      fecha: fmtDate(draft?.fecha ?? new Date().toISOString().slice(0, 10)),
      concepto: e.descripcion,
      meta: e.period ? `Período ${e.period}` : undefined,
      importe: monto * sign,
    };
  }), [selectedEntries, draft]);

  const totalRecibo = items.reduce((s, it) => s + it.importe, 0);
  const honorariosPct = tenantData?.splitMeta?.managementCommissionPct ?? draft?.honorariosPct ?? 0;
  const honorarios = totalRecibo * honorariosPct / 100;
  const propietarioRecibe = totalRecibo - honorarios;

  const tenantFullName = tenant
    ? [tenant.firstName as string | undefined, tenant.lastName as string | undefined].filter(Boolean).join(" ") || "Inquilino"
    : "Inquilino";

  async function emit(action: "print" | "email" | "confirm") {
    if (!draft || !tenantData) return;
    setBusyAction(action);
    try {
      const splitMeta = tenantData.splitMeta;
      const splitBreakdowns: Record<string, { propietario: number; administracion: number }> = {};
      if (splitMeta) {
        for (const e of selectedEntries) {
          const monto = draft.montoOverrides?.[e.id] !== undefined ? Number(draft.montoOverrides[e.id]) : Number(e.montoManual ?? e.monto ?? 0);
          const propietarioPct = 100 - (splitMeta.managementCommissionPct ?? 0);
          splitBreakdowns[e.id] = {
            propietario: Math.round(monto * propietarioPct) / 100,
            administracion: Math.round(monto * (splitMeta.managementCommissionPct ?? 0)) / 100,
          };
        }
      }

      const res = await fetch("/api/receipts/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerEntryIds: draft.ledgerEntryIds,
          fecha: draft.fecha,
          honorariosPct: splitMeta?.managementCommissionPct ?? draft.honorariosPct,
          trasladarAlPropietario: true,
          montoOverrides: draft.montoOverrides,
          ...(Object.keys(splitBreakdowns).length > 0 && { splitBreakdowns }),
          idempotencyKey: draft.idempotencyKey,
          observaciones: observations || undefined,
          action,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al emitir el recibo");
      }
      const result = await res.json();
      setIsEmitido(true);
      setShowWatermark(false);
      setReciboNumero(result.reciboNumero);
      removeKey(`cobro-draft-${draftId}`);
      toast.success(`Recibo ${result.reciboNumero} emitido`);
      if (action === "print") window.print();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  if (draftError) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md text-center">
          <div className="text-lg font-medium mb-2">No se pudo cargar la vista previa</div>
          <div className="text-muted-foreground text-sm mb-4">{draftError}</div>
          <button onClick={() => router.push(`/inquilinos/${tenantId}`)} className="text-primary underline" type="button">
            Volver al inquilino
          </button>
        </div>
      </div>
    );
  }
  if (!draft || !tenantData || !agency || !tenant) {
    return <div className="flex h-screen items-center justify-center bg-bg"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  }

  const printOptions = [
    { key: "watermark", label: "Marca de agua", desc: 'Mostrar "BORRADOR"', on: showWatermark && !isEmitido, disabled: isEmitido },
    { key: "qr", label: "Incluir QR", desc: "Pie del documento", on: showQR },
    { key: "detalle", label: "Detalle de movimientos", desc: "Tabla completa", on: showDetalle },
    { key: "duplicate", label: "Copia duplicada", desc: "Original + duplicado", on: showDuplicate },
  ];
  function toggleOption(k: string) {
    if (k === "watermark") setShowWatermark((v) => !v);
    if (k === "qr") setShowQR((v) => !v);
    if (k === "detalle") setShowDetalle((v) => !v);
    if (k === "duplicate") setShowDuplicate((v) => !v);
  }

  const numero = reciboNumero ?? `${(agency?.invoicePoint as string | null) ?? "0001"} - próximo`;

  return (
    <DocumentPreviewShell
      topbar={
        <PreviewTopbar
          backHref={`/inquilinos/${tenantId}`}
          breadcrumb={{ name: tenantFullName, ref: numero }}
          isEmitido={isEmitido}
          zoom={zoom}
          onZoom={(d) => setZoom((z) => Math.min(1.5, Math.max(0.5, z + d)))}
          onPrint={() => emit("print")}
          onDownloadPdf={() => toast.info("Descarga de PDF próximamente")}
          onSendEmail={() => emit("email")}
          onConfirm={() => emit("confirm")}
          emailDisabled={!tenant?.email}
          busyAction={busyAction}
        />
      }
      paper={
        <Paper watermark={showWatermark && !isEmitido} zoom={zoom}>
          <PaperHeader
            agency={{
              name: (agency?.legalName as string | null) ?? (agency?.tradeName as string | null) ?? "Administradora",
              cuit: (agency?.cuit as string | null) ?? null,
              vatStatus: (agency?.vatStatus as string | null) ?? null,
              fiscalAddress: (agency?.fiscalAddress as string | null) ?? null,
              city: (agency?.city as string | null) ?? null,
              phone: (agency?.phone as string | null) ?? null,
              contactEmail: (agency?.contactEmail as string | null) ?? null,
              licenseNumber: (agency?.licenseNumber as string | null) ?? null,
              professionalAssociation: (agency?.professionalAssociation as string | null) ?? null,
              grossIncome: (agency?.grossIncome as string | null) ?? null,
              activityStart: (agency?.activityStart as string | null) ?? null,
              logoUrl: (agency?.logoUrl as string | null) ?? null,
            }}
            receiptType={(agency?.receiptType as string | null) ?? "RECIBO X"}
            numero={numero}
            fechaEmision={fmtDate(draft.fecha)}
          />
          <PaperMetaBlock
            leftLabel="Recibí de"
            leftValue={tenantFullName}
            leftSub={[
              tenant.dni ? `DNI ${tenant.dni}` : "",
              (tenant.email as string | undefined) ?? "",
            ].filter(Boolean)}
            rightLabel="Concepto"
            rightValue={items.length === 1 ? items[0].concepto : `${items.length} ítems`}
            rightSub={[fmtDate(draft.fecha)]}
          />
          {showDetalle && <PaperItemsTable items={items} />}
          <PaperTotals
            lines={[
              { label: "Subtotal recibo", value: totalRecibo },
              ...(honorariosPct > 0 ? [{ label: `Honorarios (${honorariosPct}%)`, value: -honorarios }] : []),
            ]}
            total={{ label: honorariosPct > 0 ? "Propietario recibe" : "Total recibo", value: propietarioRecibe }}
          />
          <PaperFooter
            bank={{
              nombre: (agency?.bancoNombre as string | null) ?? null,
              titular: (agency?.bancoTitular as string | null) ?? null,
              cbu: (agency?.bancoCBU as string | null) ?? null,
              alias: (agency?.bancoAlias as string | null) ?? null,
            }}
            signatory={{
              nombre: (agency?.signatory as string | null) ?? null,
              cargo: (agency?.signatoryTitle as string | null) ?? null,
              signatureUrl: (agency?.signatureUrl as string | null) ?? null,
            }}
            clauses={parseClauses(agency?.clauses as string | null)}
            showQR={showQR}
          />
        </Paper>
      }
      sidebar={
        <>
          <SideSummaryCard
            rows={[
              { label: "Inquilino", value: tenantFullName },
              { label: "Ítems", value: String(items.length), mono: true },
              { label: "Subtotal", value: `$ ${formatARS(totalRecibo)}`, mono: true },
              ...(honorariosPct > 0 ? [{ label: "Honorarios", value: `− ${formatARS(honorarios)}`, mono: true, cls: "text-error" }] : []),
            ]}
            total={{ label: honorariosPct > 0 ? "Propietario recibe" : "Total recibo", value: `$ ${formatARS(propietarioRecibe)}`, mono: true, cls: "text-primary" }}
          />
          <SidePrintOptions options={printOptions} onToggle={toggleOption} />
          <SideRecipients recipients={[{ name: tenantFullName, email: (tenant.email as string | null | undefined) ?? null }]} />
          <SideObservations value={observations} onChange={setObservations} disabled={isEmitido} />
        </>
      }
    />
  );
}
