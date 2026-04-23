"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Home, User, Plus, ChevronRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuaranteeCard } from "@/components/guarantees/guarantee-card";
import { AddGuaranteeModal } from "@/components/guarantees/add-guarantee-modal";
import type { GuaranteeKind } from "@/lib/guarantees/constants";

interface Contrato {
  id: string;
  contractNumber: string;
  propertyId: string;
  ownerId: string;
  status: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyAmount: string;
  depositAmount: string | null;
  agencyCommission: string | null;
  paymentDay: number;
  paymentModality: string;
  adjustmentIndex: string;
  adjustmentFrequency: number;
}

interface PropiedadData {
  id: string;
  address: string;
  type: string;
  rentalStatus: string;
  saleStatus: string | null;
  floorUnit: string | null;
  zone: string | null;
}

interface OwnerData {
  id: string;
  firstName: string;
  lastName: string | null;
}

interface GuaranteeRow {
  guarantee: {
    id: string;
    kind: GuaranteeKind;
    status: string;
    contractId: string;
    tenantClientId: string;
    propertyId: string | null;
    personClientId: string | null;
    depositAmount: string | null;
    depositCurrency: string | null;
    depositHeldBy: string | null;
    depositNotes: string | null;
  };
  property: { id: string; address: string; type: string } | null;
  personClient: { id: string; firstName: string; lastName: string | null; dni: string | null; phone: string | null; email: string | null } | null;
  salaryInfo: { employerName: string | null; jobTitle: string | null } | null;
}

interface Props {
  contrato: Contrato | null;
  contratos: Contrato[];
  property: PropiedadData | null;
  owner: OwnerData | null;
  tenantId: string;
  guarantees: GuaranteeRow[];
}

const contractStatusMap: Record<string, { label: string; variant: "active" | "expiring" | "baja" | "draft" | "reserved" }> = {
  active:            { label: "Vigente",          variant: "active" },
  expiring_soon:     { label: "Por vencer",       variant: "expiring" },
  expired:           { label: "Vencido",          variant: "baja" },
  terminated:        { label: "Rescindido",       variant: "baja" },
  draft:             { label: "Borrador",         variant: "draft" },
  pending_signature: { label: "Pendiente firma",  variant: "reserved" },
};

const tipoLabel: Record<string, string> = {
  departamento: "Departamento", casa: "Casa", local: "Local comercial",
  oficina: "Oficina", terreno: "Terreno", otro: "Otro",
};

function formatFecha(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-[6px] bg-surface-mid flex items-center justify-center text-muted-foreground flex-shrink-0">
          {icon}
        </div>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export function TenantTabContract({ contrato, contratos, property, owner, tenantId, guarantees }: Props) {
  const queryClient = useQueryClient();
  const [addGuaranteeOpen, setAddGuaranteeOpen] = useState(false);

  // If multiple contracts exist, allow switching which one is displayed
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    contrato?.id ?? null
  );

  const activeContrato = contratos.find((c) => c.id === selectedContractId) ?? contrato;

  // Guarantees for the currently displayed contract
  const contractGuarantees = activeContrato
    ? guarantees.filter((g) => g.guarantee.contractId === activeContrato.id && g.guarantee.status === "active")
    : [];

  const handleDeleteGuarantee = async (guaranteeId: string) => {
    try {
      const res = await fetch(`/api/guarantees/${guaranteeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      await queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
      toast.success("Garantía eliminada");
    } catch {
      toast.error("No se pudo eliminar la garantía");
    }
  };

  if (!activeContrato) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[300px] text-center gap-3">
        <div className="size-12 rounded-full bg-surface-mid flex items-center justify-center">
          <FileText size={22} className="text-muted-foreground" />
        </div>
        <div className="text-[0.85rem] text-muted-foreground">Sin contrato activo</div>
        <div className="text-[0.75rem] text-muted-foreground/60">
          Creá un contrato para ver las partes y las garantías
        </div>
      </div>
    );
  }

  const statusInfo = contractStatusMap[activeContrato.status] ?? { label: activeContrato.status, variant: "draft" as const };

  return (
    <div className="p-7 flex flex-col gap-6">
      {/* Selector de contrato si hay más de uno */}
      {contratos.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Contrato:</span>
          {contratos.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedContractId(c.id)}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium border transition-all ${
                c.id === selectedContractId
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {c.contractNumber}
            </button>
          ))}
        </div>
      )}

      {/* Mini-card del contrato */}
      <Link
        href={`/contratos/${activeContrato.id}`}
        className="flex items-center gap-3 bg-surface border border-border rounded-[10px] px-4 py-3.5 hover:border-primary/40 transition-colors group"
      >
        <div className="size-9 rounded-[8px] bg-surface-mid flex items-center justify-center flex-shrink-0">
          <FileText size={17} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-on-surface">
            {activeContrato.contractNumber}
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {formatFecha(activeContrato.startDate)} — {formatFecha(activeContrato.endDate)}
          </div>
        </div>
        <Badge
          variant={statusInfo.variant}
          className="normal-case font-medium text-[0.72rem] tracking-normal"
        >
          {statusInfo.label}
        </Badge>
        <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </Link>

      {/* Parte locadora */}
      {owner && (
        <div>
          <SectionHeader icon={<User size={13} />} title="Parte locadora" />
          <Link
            href={`/propietarios/${owner.id}`}
            className="flex items-center gap-3 bg-surface border border-border rounded-[10px] px-4 py-3.5 hover:border-primary/40 transition-colors group"
          >
            <div className="size-8 rounded-full bg-surface-mid flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-muted-foreground">
              {[owner.firstName, owner.lastName].filter(Boolean).map((s) => s![0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium text-on-surface">
                {owner.lastName ? `${owner.firstName} ${owner.lastName}` : owner.firstName}
              </div>
            </div>
            <Badge className="text-[10px] px-[7px] py-[2px] h-auto rounded-[4px] bg-surface-mid border-border normal-case tracking-normal font-normal leading-none">
              Parte Locadora
            </Badge>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </Link>
        </div>
      )}

      {/* Propiedad */}
      {property && (
        <div>
          <SectionHeader icon={<Home size={13} />} title="Propiedad" />
          <Link
            href={`/propiedades/${property.id}`}
            className="flex items-center gap-3 bg-surface border border-border rounded-[10px] px-4 py-3.5 hover:border-primary/40 transition-colors group"
          >
            <div className="size-8 rounded-[8px] bg-surface-mid flex items-center justify-center flex-shrink-0">
              <Home size={14} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium text-on-surface truncate">
                {property.floorUnit ? `${property.address}, ${property.floorUnit}` : property.address}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                {tipoLabel[property.type] ?? property.type}
                {property.zone ? ` · ${property.zone}` : ""}
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </Link>
        </div>
      )}

      {/* Garantías del contrato */}
      <div>
        <SectionHeader icon={<Shield size={13} />} title={`Garantías${contractGuarantees.length > 0 ? ` (${contractGuarantees.length})` : ""}`}>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[12px] h-7"
            onClick={() => setAddGuaranteeOpen(true)}
          >
            <Plus size={12} /> Agregar garantía
          </Button>
        </SectionHeader>

        {contractGuarantees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 bg-surface border border-dashed border-border rounded-[10px]">
            <Shield size={20} className="text-muted-foreground/40" />
            <div className="text-[12.5px] text-muted-foreground">Sin garantías registradas para este contrato</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {contractGuarantees.map((row) => (
              <GuaranteeCard
                key={row.guarantee.id}
                guarantee={row.guarantee}
                property={row.property}
                personClient={row.personClient}
                salaryInfo={row.salaryInfo}
                onDelete={handleDeleteGuarantee}
              />
            ))}
          </div>
        )}
      </div>

      {activeContrato && (
        <AddGuaranteeModal
          open={addGuaranteeOpen}
          onOpenChange={setAddGuaranteeOpen}
          contractId={activeContrato.id}
          tenantClientId={tenantId}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] })}
        />
      )}
    </div>
  );
}
