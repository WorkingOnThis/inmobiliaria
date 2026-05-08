// src/lib/tenants/grouping.ts

export type EstadoInquilino =
  | "activo"
  | "pendiente"
  | "en_mora"
  | "por_vencer"
  | "sin_contrato"
  | "pendiente_firma"
  | "historico";

export interface TenantRow {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date | string;
  contrato: {
    id: string;
    numero: string;
    status: string;
    endDate: string;
    completitud: number | null;
  } | null;
  property: string | null;
  ultimoPago: string | null;
  estado: EstadoInquilino;
  diasMora: number;
}

export interface TenantGroup {
  contractId: string | null;
  primary: TenantRow;
  coTenants: TenantRow[];
  groupEstado: EstadoInquilino;
  diasMora: number;
  ultimoPago: string | null;
}

const ESTADO_SEVERITY: Record<EstadoInquilino, number> = {
  en_mora:        6,
  pendiente:      5,
  por_vencer:     4,
  activo:         3,
  sin_contrato:   2,
  pendiente_firma: 1,
  historico:      0,
};

export function resolveGroupEstado(members: TenantRow[]): EstadoInquilino {
  return members.reduce<EstadoInquilino>((worst, m) => {
    return (ESTADO_SEVERITY[m.estado] ?? 0) > (ESTADO_SEVERITY[worst] ?? 0)
      ? m.estado
      : worst;
  }, "historico");
}

export function groupTenants(
  enriched: TenantRow[],
  participantOrder: Map<string, Date | null>
): TenantGroup[] {
  const byContract = new Map<string, TenantRow[]>();
  const noContract: TenantRow[] = [];

  for (const tenant of enriched) {
    const cid = tenant.contrato?.id ?? null;
    if (cid === null) {
      noContract.push(tenant);
    } else {
      const existing = byContract.get(cid) ?? [];
      existing.push(tenant);
      byContract.set(cid, existing);
    }
  }

  const groups: TenantGroup[] = [];

  for (const [contractId, members] of byContract) {
    const sorted = [...members].sort((a, b) => {
      const aDate = participantOrder.get(a.id);
      const bDate = participantOrder.get(b.id);
      if (aDate && bDate) {
        const diff = aDate.getTime() - bDate.getTime();
        if (diff !== 0) return diff;
        // Tiebreak by client.createdAt when participant timestamps are equal
        const aClient = new Date(a.createdAt).getTime();
        const bClient = new Date(b.createdAt).getTime();
        if (!isNaN(aClient) && !isNaN(bClient)) return aClient - bClient;
      }
      if (aDate) return -1;
      if (bDate) return 1;
      return a.firstName.localeCompare(b.firstName);
    });

    const [primary, ...coTenants] = sorted;
    const groupEstado = resolveGroupEstado(sorted);
    const diasMora = Math.max(0, ...sorted.map((m) => m.diasMora));
    const ultimoPago =
      sorted
        .map((m) => m.ultimoPago)
        .filter((d): d is string => d !== null)
        .sort()
        .at(-1) ?? null;

    groups.push({ contractId, primary, coTenants, groupEstado, diasMora, ultimoPago });
  }

  for (const tenant of noContract) {
    groups.push({
      contractId: null,
      primary: tenant,
      coTenants: [],
      groupEstado: tenant.estado,
      diasMora: tenant.diasMora,
      ultimoPago: tenant.ultimoPago,
    });
  }

  return groups;
}
