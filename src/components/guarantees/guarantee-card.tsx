"use client";

import Link from "next/link";
import { Building2, Banknote, User, Trash2, ExternalLink } from "lucide-react";
import { GUARANTEE_KIND_LABELS, type GuaranteeKind } from "@/lib/guarantees/constants";
import { Badge } from "@/components/ui/badge";
import { formatAddress } from "@/lib/properties/format-address";
import { Button } from "@/components/ui/button";

interface GuaranteeCardProps {
  guarantee: {
    id: string;
    kind: GuaranteeKind;
    status: string;
    propertyId: string | null;
    personClientId: string | null;
    depositAmount: string | null;
    depositCurrency: string | null;
    depositHeldBy: string | null;
  };
  property?: { addressStreet: string; addressNumber: string | null; type: string } | null;
  personClient?: { id: string; firstName: string; lastName: string | null; dni: string | null } | null;
  salaryInfo?: { employerName: string | null; jobTitle: string | null } | null;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

function formatDeposit(amount: string | null, currency: string | null) {
  if (!amount) return "—";
  const n = Number(amount).toLocaleString("es-AR", { minimumFractionDigits: 0 });
  return currency === "USD" ? `US$ ${n}` : `$ ${n}`;
}

function KindIcon({ kind }: { kind: GuaranteeKind }) {
  if (kind === "propertyOwner") return <Building2 size={16} className="text-muted-foreground" />;
  if (kind === "deposit") return <Banknote size={16} className="text-muted-foreground" />;
  return <User size={16} className="text-muted-foreground" />;
}

export function GuaranteeCard({
  guarantee,
  property,
  personClient,
  salaryInfo,
  onDelete,
  readOnly = false,
}: GuaranteeCardProps) {
  const kindLabel = GUARANTEE_KIND_LABELS[guarantee.kind] ?? guarantee.kind;

  const title = (() => {
    if (guarantee.kind === "propertyOwner" && property) return formatAddress(property);
    if (guarantee.kind === "deposit") return formatDeposit(guarantee.depositAmount, guarantee.depositCurrency);
    if (guarantee.kind === "salaryReceipt" && personClient) {
      return personClient.lastName
        ? `${personClient.firstName} ${personClient.lastName}`
        : personClient.firstName;
    }
    return "Sin datos";
  })();

  const subtitle = (() => {
    if (guarantee.kind === "propertyOwner" && property) return property.type;
    if (guarantee.kind === "deposit" && guarantee.depositHeldBy) return `Retenido por: ${guarantee.depositHeldBy}`;
    if (guarantee.kind === "salaryReceipt") {
      const parts = [];
      if (personClient?.dni) parts.push(`DNI ${personClient.dni}`);
      if (salaryInfo?.employerName) parts.push(salaryInfo.employerName);
      return parts.join(" · ") || null;
    }
    return null;
  })();

  return (
    <div className="bg-surface border border-border rounded-[10px] p-4 flex items-start gap-3">
      <div className="size-8 rounded-[8px] bg-surface-mid flex items-center justify-center flex-shrink-0 mt-0.5">
        <KindIcon kind={guarantee.kind} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge
            variant="secondary"
            className="text-[10px] px-[7px] py-[2px] h-auto rounded-[4px] font-normal normal-case tracking-normal leading-none"
          >
            {kindLabel}
          </Badge>
        </div>
        <div className="text-[13.5px] font-medium text-on-surface truncate">{title}</div>
        {subtitle && (
          <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {guarantee.kind === "propertyOwner" && guarantee.propertyId && (
          <Link href={`/propiedades/${guarantee.propertyId}`}>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" title="Ver propiedad">
              <ExternalLink size={13} />
            </Button>
          </Link>
        )}
        {guarantee.kind === "salaryReceipt" && guarantee.personClientId && (
          <Link href={`/garantes/${guarantee.personClientId}`}>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" title="Ver ficha del garante">
              <ExternalLink size={13} />
            </Button>
          </Link>
        )}
        {!readOnly && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-error"
            onClick={() => onDelete(guarantee.id)}
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
