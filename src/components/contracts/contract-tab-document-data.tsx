"use client";

import type { ContractParticipant, ContractGuarantee } from "./contract-detail";

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

interface Props {
  data: ContractData;
}

function formatMoney(value: string | null | undefined): string {
  if (!value) return "";
  return `$${parseFloat(value).toLocaleString("es-AR")}`;
}

function PersonSection({
  title,
  firstName,
  lastName,
  dni,
  cuit,
  address,
  phone,
  email,
}: {
  title: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
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

export function ContractTabDocumentData({ data }: Props) {
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
      <p
        className="mb-5"
        style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}
      >
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

        {/* Garantías reales (sin cliente) */}
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
              value={data.paymentModality === "A" ? "A — Inmobiliaria recibe y liquida" : "B — Pago directo al propietario"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
