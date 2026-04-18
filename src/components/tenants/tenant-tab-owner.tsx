"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PropietarioData {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  email: string | null;
  phone: string | null;
  cbu: string | null;
  alias: string | null;
  bank: string | null;
  cuit: string | null;
  accountType: string | null;
}

interface ContratoData {
  paymentModality: string;
  agencyCommission: string | null;
}

interface Props {
  owner: PropietarioData | null;
  contrato: ContratoData | null;
}

const modalidadLabel: Record<string, string> = {
  A: "Modalidad A — CBU Inmobiliaria",
  B: "Modalidad B — Pago directo al owner",
};

export function TenantTabOwner({ owner, contrato }: Props) {
  if (!owner) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <div className="text-2xl opacity-40">🏠</div>
        <div className="text-[0.85rem] text-muted-foreground">Sin owner vinculado</div>
      </div>
    );
  }

  const nombre = owner.lastName
    ? `${owner.firstName} ${owner.lastName}`
    : owner.firstName;

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Mini card — clickeable */}
      <Link
        href={`/propietarios/${owner.id}`}
        className="bg-surface-mid border border-border rounded-[8px] px-4 py-3.5 flex items-center gap-4 hover:border-primary/30 hover:bg-primary-dark/5 transition-all"
      >
        <div className="size-9 bg-primary-dark/10 rounded-[8px] flex items-center justify-center text-base flex-shrink-0">
          🏠
        </div>
        <div className="flex-1">
          <div className="text-[0.85rem] font-semibold text-on-bg">{nombre}</div>
          <div className="text-[0.75rem] text-muted-foreground mt-0.5">
            {owner.dni ? `DNI ${owner.dni}` : ""}
            {owner.email ? ` · ${owner.email}` : ""}
            {owner.phone ? ` · ${owner.phone}` : ""}
          </div>
        </div>
        <Badge variant="secondary">Propietario</Badge>
        <span className="text-muted-foreground text-lg ml-1">›</span>
      </Link>

      {/* Datos de liquidación */}
      <Card className="gap-0 p-0 rounded-[10px] overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0">
          <CardTitle className="text-[0.82rem] font-semibold">Datos de liquidación</CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
          {owner.cbu && (
            <div className="col-span-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">CBU</div>
              <div className="text-[0.85rem] font-medium text-on-bg font-mono tracking-wide">{owner.cbu}</div>
            </div>
          )}
          {owner.alias && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Alias</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{owner.alias}</div>
            </div>
          )}
          {owner.bank && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Banco</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{owner.bank}</div>
            </div>
          )}
          {owner.cuit && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">CUIT</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{owner.cuit}</div>
            </div>
          )}
          {contrato?.paymentModality && (
            <div className="col-span-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Modalidad acordada</div>
              <div className="text-[0.85rem] font-medium text-on-bg">
                {modalidadLabel[contrato.paymentModality] ?? contrato.paymentModality}
              </div>
            </div>
          )}
          {contrato?.agencyCommission && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Honorarios inmobiliaria</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{contrato.agencyCommission}%</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
