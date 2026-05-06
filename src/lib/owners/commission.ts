// src/lib/owners/commission.ts

export type SplitBreakdown = { propietario: number; administracion: number };

export type CommissionResult = {
  net: number;
  commission: number;
  effectivePct: number;
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeNetAndCommission(
  entry: {
    monto: string | null;
    splitBreakdown: string | null;
    incluirEnBaseComision: boolean;
  },
  contractCommissionPct: number
): CommissionResult {
  const grossNum = Number(entry.monto ?? 0);

  // Conciliated split: use stored breakdown
  if (entry.splitBreakdown) {
    try {
      const sb = JSON.parse(entry.splitBreakdown) as SplitBreakdown;
      const net = round2(sb.propietario);
      const commission = round2(sb.administracion);
      const effectivePct =
        grossNum > 0 ? round2((commission / grossNum) * 100) : contractCommissionPct;
      return { net, commission, effectivePct };
    } catch {
      // Fall through to default computation if JSON is malformed
    }
  }

  // No commission applies (descuentos, bonificaciones, punitorios sometimes)
  if (!entry.incluirEnBaseComision) {
    return { net: grossNum, commission: 0, effectivePct: 0 };
  }

  // Default: apply contract pct
  const commission = round2((grossNum * contractCommissionPct) / 100);
  const net = round2(grossNum - commission);
  return { net, commission, effectivePct: contractCommissionPct };
}
