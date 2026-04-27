"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcDaysMora } from "@/lib/ledger/mora";

type Props = {
  parentId: string;
  alquilerMonto: number;
  dueDate: string | null;
  lateInterestPct: string | null;
  onConfirm: (monto: number, descripcion: string) => void;
  montoPagado?: number | null;    // nuevo — saldo ya cobrado
  ultimoPagoAt?: string | null;  // nuevo — fecha del último pago parcial
};

type PunitorioTipo = "contrato" | "tim" | "manual";

// TODO: reemplazar con fetch a API BCRA cuando esté disponible
const TIM_BCRA = 0.04;

const TIPOS: { value: PunitorioTipo; label: string }[] = [
  { value: "contrato", label: "Tasa del contrato" },
  { value: "tim",      label: "TIM (BCRA)" },
  { value: "manual",   label: "Manual" },
];

// lateInterestPct is stored as a daily rate (e.g. "0.6" = 0.6%/día)
// TIM_BCRA is a monthly rate — divide by 30 to get daily equivalent
function dailyRateForTipo(tipo: PunitorioTipo, lateInterestPct: string | null): number | null {
  if (tipo === "contrato") return lateInterestPct !== null ? Number(lateInterestPct) / 100 : null;
  if (tipo === "tim") return TIM_BCRA / 30;
  return null;
}

function calcMonto(alquilerMonto: number, dailyRate: number, days: number): number {
  return alquilerMonto * dailyRate * days;
}

function descripcionForTipo(tipo: PunitorioTipo, days: number, dailyRate: number | null): string {
  const rateStr = dailyRate !== null ? `${(dailyRate * 100).toFixed(2)}%/día` : null;
  const moraStr = days > 0 ? `${days} días mora` : null;
  const detail = [rateStr, moraStr].filter(Boolean).join(", ");
  if (tipo === "tim") return detail ? `Punitorio TIM (${detail})` : "Punitorio TIM";
  if (detail) return `Punitorio (${detail})`;
  return "Punitorio";
}

export function PunitorioPopover({
  parentId,
  alquilerMonto,
  dueDate,
  lateInterestPct,
  onConfirm,
  montoPagado,
  ultimoPagoAt,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tipoPunitorio, setTipoPunitorio] = useState<PunitorioTipo>("contrato");
  const [manualPct, setManualPct] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const hasContractRate = lateInterestPct !== null;

  // Si hay pago parcial previo, los punitorios se calculan sobre el saldo restante
  // desde la fecha del último pago (no desde dueDate original).
  const baseParaPunitorio = montoPagado != null
    ? Math.max(0, alquilerMonto - montoPagado)
    : alquilerMonto;

  const fechaBase: string | null = ultimoPagoAt ?? dueDate;

  const daysMora = calcDaysMora(fechaBase);

  function applyTipo(tipo: PunitorioTipo) {
    setTipoPunitorio(tipo);
    if (tipo === "manual") {
      setManualPct("");
      setMonto("");
      setDescripcion("Punitorio");
      return;
    }
    const dailyRate = dailyRateForTipo(tipo, lateInterestPct);
    const sugerido = dailyRate !== null && daysMora > 0 ? calcMonto(baseParaPunitorio, dailyRate, daysMora) : 0;
    setMonto(sugerido > 0 ? sugerido.toFixed(2) : "");
    setDescripcion(descripcionForTipo(tipo, daysMora, dailyRate));
  }

  function handleManualPctChange(value: string) {
    setManualPct(value);
    const pct = parseFloat(value);
    if (pct > 0 && daysMora > 0) {
      const dailyRate = pct / 100;
      setMonto(calcMonto(baseParaPunitorio, dailyRate, daysMora).toFixed(2));
      setDescripcion(descripcionForTipo("manual", daysMora, dailyRate));
    } else {
      setMonto("");
      setDescripcion("Punitorio");
    }
  }

  function handleMontoChange(value: string) {
    setMonto(value);
    if (tipoPunitorio === "manual" && daysMora > 0 && baseParaPunitorio > 0) {
      const montoNum = parseFloat(value);
      if (montoNum > 0) {
        const dailyRate = montoNum / (baseParaPunitorio * daysMora);
        setManualPct((dailyRate * 100).toFixed(4));
        setDescripcion(descripcionForTipo("manual", daysMora, dailyRate));
      }
    }
  }

  function handleConfirm() {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return;
    onConfirm(montoNum, descripcion);
    setOpen(false);
  }

  const displayRate = tipoPunitorio !== "manual" ? dailyRateForTipo(tipoPunitorio, lateInterestPct) : null;
  const manualPctNum = parseFloat(manualPct);

  return (
    <Popover open={open} onOpenChange={(next) => { if (next) applyTipo("contrato"); setOpen(next); }}>
      <PopoverTrigger asChild>
        <button className="text-xs text-primary hover:underline whitespace-nowrap">
          + Punitorio
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Agregar punitorio</div>

          <div className="text-xs text-muted-foreground">
            {daysMora > 0
              ? `${daysMora} días en mora${displayRate !== null ? ` · ${(displayRate * 100).toFixed(2)}%/día` : ""}`
              : "Sin días en mora — ingresá monto manual"}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tipo de punitorio</Label>
            <Select value={tipoPunitorio} onValueChange={(v) => applyTipo(v as PunitorioTipo)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.value === "contrato" && !hasContractRate
                      ? `${t.label} (sin tasa configurada)`
                      : t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoPunitorio === "manual" && (
            <div className="space-y-1">
              <Label className="text-xs">Tasa (%/día)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={manualPct}
                  onChange={(e) => handleManualPctChange(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="ej: 0.6"
                  min="0"
                  step="0.01"
                />
                {manualPctNum > 0 && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground leading-none">TNA</div>
                    <div className="text-xs font-mono font-semibold text-foreground">
                      {(manualPctNum * 365).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Monto ($)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => handleMontoChange(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={!monto || parseFloat(monto) <= 0}>
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
