"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Printer, FileText } from "lucide-react";
import { renderClauseBody } from "@/lib/document-templates/render-segments";
import type { ContractParticipant, ContractGuarantee } from "./contract-detail";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      {value ? (
        <span className="field-value text-[0.85rem]">{value}</span>
      ) : (
        <span className="field-value empty text-[0.85rem]" />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground pt-4 pb-2 border-b border-border">
      {children}
    </p>
  );
}

function PersonSection({
  title, firstName, lastName, dni, cuit, address, phone, email,
}: {
  title: string; firstName: string; lastName: string | null;
  dni: string | null; cuit: string | null; address: string | null;
  phone: string | null; email: string | null;
}) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
        <FieldRow label="Nombre completo" value={`${firstName} ${lastName || ""}`.trim()} />
        <FieldRow label="DNI" value={dni} />
        <FieldRow label="CUIT" value={cuit} />
        <FieldRow label="Domicilio" value={address} />
        <FieldRow label="Teléfono" value={phone} />
        <FieldRow label="Email" value={email} />
      </div>
    </div>
  );
}

function formatMoney(value: string | null | undefined): string {
  if (!value) return "";
  return `$${parseFloat(value).toLocaleString("es-AR")}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContractData {
  propertyAddress: string | null;
  propertyType: string | null;
  propertyFloorUnit: string | null;
  propertyZone: string | null;
  monthlyAmount: string;
  depositAmount: string | null;
  adjustmentIndex: string;
  adjustmentFrequency: number;
  startDate: string;
  endDate: string;
  paymentDay: number;
  paymentModality: string;
  owner: {
    name: string;
    email: string | null;
    phone: string | null;
    dni: string | null;
    cuit: string | null;
    address: string | null;
  } | null;
  participants: ContractParticipant[];
  guarantees: ContractGuarantee[];
}

type Clause = {
  id: string;
  title: string;
  body: string;
  order: number;
  isActive: boolean;
};

type Template = {
  id: string;
  name: string;
  clauseCount: number;
};

interface Props {
  data: ContractData;
  contractId: string;
}

// ─── Document preview section ─────────────────────────────────────────────────

function DocumentPreviewSection({ contractId }: { contractId: string }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: templatesData, isLoading: loadingTemplates } = useQuery<{
    templates: Template[];
  }>({
    queryKey: ["document-templates"],
    queryFn: () => fetch("/api/document-templates").then((r) => r.json()),
  });

  const { data: templateData, isLoading: loadingTemplate } = useQuery<{
    template: { id: string; name: string };
    clauses: Clause[];
  }>({
    queryKey: ["document-template", selectedTemplateId],
    queryFn: () =>
      fetch(`/api/document-templates/${selectedTemplateId}`).then((r) => r.json()),
    enabled: !!selectedTemplateId,
  });

  const {
    data: resolvedData,
    isLoading: loadingResolved,
    refetch: refetchResolved,
  } = useQuery<{ resolved: Record<string, string | null> }>({
    queryKey: ["document-template-resolve", contractId],
    queryFn: () =>
      fetch(`/api/document-templates/resolve?contractId=${contractId}`).then((r) =>
        r.json()
      ),
    enabled: !!selectedTemplateId,
  });

  const templates = templatesData?.templates ?? [];
  const resolved = resolvedData?.resolved ?? {};
  const clauses = templateData?.clauses ?? [];
  const activeClauses = clauses
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);
  const templateName = templateData?.template?.name ?? "";
  const isLoadingPreview = loadingTemplate || loadingResolved;

  function handleRefresh() {
    refetchResolved();
  }

  return (
    <div className="flex flex-col gap-4 pt-6">
      <Separator />

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="mb-1.5 block text-sm">Generar documento</Label>
          {loadingTemplates ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná una plantilla..." />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No hay plantillas
                  </SelectItem>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={!selectedTemplateId || loadingResolved}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Actualizar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          disabled={!selectedTemplateId || activeClauses.length === 0}
          className="shrink-0"
        >
          <Printer className="h-4 w-4 mr-1.5" />
          Imprimir
        </Button>
      </div>

      {selectedTemplateId && (
        <>
          {isLoadingPreview ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2 mx-auto" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : activeClauses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">Esta plantilla no tiene cláusulas activas.</p>
            </div>
          ) : (
            <div
              id="print-preview"
              className="rounded-md border bg-card p-6 text-sm leading-relaxed preview-content"
            >
              <div className="preview-body">
                <h1 className="preview-doc-title">{templateName}</h1>
                {activeClauses.map((clause, i) => (
                  <div key={clause.id} className={i > 0 ? "mt-5" : ""}>
                    {clause.title && (
                      <h3 className="preview-clause-title">{clause.title}</h3>
                    )}
                    <div className="preview-clause-body">
                      {renderClauseBody(clause.body, resolved, true, {})}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoadingPreview && activeClauses.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Variables en{" "}
              <span className="text-destructive font-bold">rojo</span> no tienen
              datos en este contrato.
            </p>
          )}
        </>
      )}

      {/* Screen preview styles + print */}
      <style>{`
        .preview-content { font-family: sans-serif; font-size: 14px; line-height: 1.6; }
        .preview-body { text-align: justify; hyphens: auto; }
        .preview-doc-title { font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 1.2em; text-transform: uppercase; letter-spacing: 0.03em; }
        .preview-clause-title { font-size: 14px; font-weight: 700; text-align: left; margin-bottom: 0.4em; margin-top: 0; }
        .preview-clause-body { margin: 0; white-space: pre-wrap; word-break: break-word; }
        @media print {
          body > * { display: none !important; }
          #print-preview {
            display: block !important;
            position: fixed;
            top: 0; left: 0;
            width: 100%;
            margin: 0;
            padding: 2.5cm 3cm;
            border: none;
            background: #fff;
            box-shadow: none;
            border-radius: 0;
          }
          #print-preview .preview-body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.15;
            text-align: justify;
            color: #000;
          }
          #print-preview .preview-doc-title {
            font-family: Arial, sans-serif;
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 1.2em;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #000;
          }
          #print-preview .preview-clause-title {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            font-weight: bold;
            text-align: left;
            margin-top: 1.2em;
            margin-bottom: 0.4em;
            color: #000;
          }
          #print-preview .preview-clause-body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.15;
            color: #000;
            white-space: pre-wrap;
            word-break: break-word;
          }
          #print-preview .text-destructive {
            color: #000 !important;
            font-weight: bold;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContractTabDocumentData({ data, contractId }: Props) {
  const tenantParticipant = data.participants.find((p) => p.role === "tenant");
  const guarantorParticipants = data.participants.filter((p) => p.role === "guarantor");

  const propertyFullAddress = [
    data.propertyAddress,
    data.propertyFloorUnit && `Unidad ${data.propertyFloorUnit}`,
    data.propertyZone,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col pt-5">
      <p className="mb-5" style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
        Estos datos se actualizan automáticamente desde las fichas de cada persona y propiedad.
      </p>

      <div className="rounded-[18px] border border-border bg-surface overflow-hidden divide-y divide-border">
        {/* Propiedad */}
        <div className="px-[18px] py-2">
          <SectionTitle>Propiedad</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
            <FieldRow label="Dirección" value={propertyFullAddress || data.propertyAddress} />
            <FieldRow label="Zona / Barrio" value={data.propertyZone} />
            <FieldRow label="Tipo de propiedad" value={data.propertyType} />
          </div>
        </div>

        {/* Propietario */}
        {data.owner && (
          <div className="px-[18px] py-2">
            <PersonSection
              title="Propietario"
              firstName={data.owner.name.split(" ")[0]}
              lastName={data.owner.name.split(" ").slice(1).join(" ") || null}
              dni={data.owner.dni}
              cuit={data.owner.cuit}
              address={data.owner.address}
              phone={data.owner.phone}
              email={data.owner.email}
            />
          </div>
        )}

        {/* Inquilino */}
        {tenantParticipant && (
          <div className="px-[18px] py-2">
            <PersonSection
              title="Inquilino"
              firstName={tenantParticipant.client.firstName}
              lastName={tenantParticipant.client.lastName}
              dni={tenantParticipant.client.dni}
              cuit={tenantParticipant.client.cuit}
              address={tenantParticipant.client.address}
              phone={tenantParticipant.client.phone}
              email={tenantParticipant.client.email}
            />
          </div>
        )}

        {/* Garantes */}
        {guarantorParticipants.map((g, i) => (
          <div key={g.id} className="px-[18px] py-2">
            <PersonSection
              title={guarantorParticipants.length > 1 ? `Garante ${i + 1}` : "Garante"}
              firstName={g.client.firstName}
              lastName={g.client.lastName}
              dni={g.client.dni}
              cuit={g.client.cuit}
              address={g.client.address}
              phone={g.client.phone}
              email={g.client.email}
            />
          </div>
        ))}

        {/* Garantías reales */}
        {data.guarantees
          .filter((g) => !g.clientId)
          .map((g, i) => (
            <div key={g.id} className="px-[18px] py-2">
              <SectionTitle>{`Garantía real${data.guarantees.filter((x) => !x.clientId).length > 1 ? ` ${i + 1}` : ""}`}</SectionTitle>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
                <FieldRow label="Domicilio" value={g.externalAddress} />
                <FieldRow label="Ref. catastral" value={g.externalCadastralRef} />
                <FieldRow label="Titular" value={g.externalOwnerName} />
                <FieldRow label="DNI titular" value={g.externalOwnerDni} />
              </div>
            </div>
          ))}

        {/* Condiciones del contrato */}
        <div className="px-[18px] py-2">
          <SectionTitle>Condiciones del contrato</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
            <FieldRow label="Canon mensual" value={formatMoney(data.monthlyAmount)} />
            <FieldRow label="Índice de ajuste" value={data.adjustmentIndex} />
            <FieldRow
              label="Frecuencia de ajuste"
              value={`Cada ${data.adjustmentFrequency} mes${data.adjustmentFrequency === 1 ? "" : "es"}`}
            />
            <FieldRow label="Fecha de inicio" value={data.startDate} />
            <FieldRow label="Fecha de fin" value={data.endDate} />
            <FieldRow label="Día de vencimiento de pago" value={`Día ${data.paymentDay}`} />
            <FieldRow label="Depósito" value={formatMoney(data.depositAmount)} />
            <FieldRow
              label="Modalidad de pago"
              value={
                data.paymentModality === "A"
                  ? "A — Inmobiliaria recibe y liquida"
                  : "B — Pago directo al propietario"
              }
            />
          </div>
        </div>
      </div>

      <DocumentPreviewSection contractId={contractId} />
    </div>
  );
}
