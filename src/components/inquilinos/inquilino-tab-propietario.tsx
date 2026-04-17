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
  banco: string | null;
  cuit: string | null;
  tipoCuenta: string | null;
}

interface ContratoData {
  paymentModality: string;
  agencyCommission: string | null;
}

interface Props {
  propietario: PropietarioData | null;
  contrato: ContratoData | null;
}

const modalidadLabel: Record<string, string> = {
  A: "Modalidad A — CBU Inmobiliaria",
  B: "Modalidad B — Pago directo al propietario",
};

export function InquilinoTabPropietario({ propietario, contrato }: Props) {
  if (!propietario) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[200px] text-center gap-2">
        <div className="text-2xl opacity-40">🏠</div>
        <div className="text-[0.85rem] text-text-muted">Sin propietario vinculado</div>
      </div>
    );
  }

  const nombre = propietario.lastName
    ? `${propietario.firstName} ${propietario.lastName}`
    : propietario.firstName;

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Mini card — clickeable */}
      <Link
        href={`/propietarios/${propietario.id}`}
        className="bg-surface-mid border border-border rounded-[8px] px-4 py-3.5 flex items-center gap-4 hover:border-primary/30 hover:bg-primary-dark/5 transition-all"
      >
        <div className="size-9 bg-primary-dark/10 rounded-[8px] flex items-center justify-center text-base flex-shrink-0">
          🏠
        </div>
        <div className="flex-1">
          <div className="text-[0.85rem] font-semibold text-on-bg">{nombre}</div>
          <div className="text-[0.75rem] text-text-muted mt-0.5">
            {propietario.dni ? `DNI ${propietario.dni}` : ""}
            {propietario.email ? ` · ${propietario.email}` : ""}
            {propietario.phone ? ` · ${propietario.phone}` : ""}
          </div>
        </div>
        <Badge variant="secondary">Propietario</Badge>
        <span className="text-text-muted text-lg ml-1">›</span>
      </Link>

      {/* Datos de liquidación */}
      <Card className="gap-0 p-0 rounded-[10px] overflow-hidden">
        <CardHeader className="px-5 py-3.5 border-b border-border gap-0">
          <CardTitle className="text-[0.82rem] font-semibold">Datos de liquidación</CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
          {propietario.cbu && (
            <div className="col-span-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">CBU</div>
              <div className="text-[0.85rem] font-medium text-on-bg font-mono tracking-wide">{propietario.cbu}</div>
            </div>
          )}
          {propietario.alias && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Alias</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propietario.alias}</div>
            </div>
          )}
          {propietario.banco && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Banco</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propietario.banco}</div>
            </div>
          )}
          {propietario.cuit && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">CUIT</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{propietario.cuit}</div>
            </div>
          )}
          {contrato?.paymentModality && (
            <div className="col-span-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Modalidad acordada</div>
              <div className="text-[0.85rem] font-medium text-on-bg">
                {modalidadLabel[contrato.paymentModality] ?? contrato.paymentModality}
              </div>
            </div>
          )}
          {contrato?.agencyCommission && (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1">Honorarios inmobiliaria</div>
              <div className="text-[0.85rem] font-medium text-on-bg">{contrato.agencyCommission}%</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
