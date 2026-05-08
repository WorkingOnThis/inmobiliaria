import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { agency } from "@/db/schema/agency";
import { receiptAllocation } from "@/db/schema/receipt-allocation";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { and, eq, inArray, or } from "drizzle-orm";
import { computeNetAndCommission, round2 } from "@/lib/owners/commission";

export type ComprobanteData = {
  movimiento: {
    id: string;
    reciboNumero: string;
    date: string;
    period: string | null;
    amount: string;
    paymentModality: "A" | "split";
    anuladoAt: string | null;
  };
  contrato: {
    contractNumber: string;
    paymentModality: "A" | "split";
    managementCommissionPct: number;
  };
  propiedad: {
    address: string;
    floorUnit: string | null;
  };
  inquilino: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
  } | null;
  propietario: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
    email: string | null;
    cbu: string | null;
    alias: string | null;
  };
  items: {
    id: string;
    descripcion: string;
    period: string | null;
    tipo: string;
    bruto: number;
    comisionPct: number;
    comision: number;
    neto: number;
  }[];
  totales: {
    bruto: number;
    comision: number;
    neto: number;
  };
  agency: {
    name: string;
    tradeName: string | null;
    legalName: string | null;
    cuit: string | null;
    vatStatus: string | null;
    logoUrl: string | null;
    fiscalAddress: string | null;
    city: string | null;
    phone: string | null;
    contactEmail: string | null;
    licenseNumber: string | null;
    signatory: string | null;
    signatoryTitle: string | null;
    signatureUrl: string | null;
    bancoCBU: string | null;
    bancoAlias: string | null;
    clauses: { id: string; texto: string }[];
  } | null;
};

export async function loadComprobanteData(
  movimientoId: string,
  agencyId: string
): Promise<ComprobanteData | null> {
  // 1. Get cash movement (scoped por agency)
  const [movimiento] = await db
    .select()
    .from(cajaMovimiento)
    .where(and(eq(cajaMovimiento.id, movimientoId), eq(cajaMovimiento.agencyId, agencyId)))
    .limit(1);

  if (
    !movimiento ||
    !movimiento.reciboNumero ||
    !movimiento.propiedadId ||
    !movimiento.contratoId
  ) {
    return null;
  }

  // 2. Get all ledger entries saldadas por este recibo, joineadas con contract
  const allocations = await db
    .select({ ledgerEntryId: receiptAllocation.ledgerEntryId })
    .from(receiptAllocation)
    .where(eq(receiptAllocation.reciboNumero, movimiento.reciboNumero));

  const ledgerEntryIds = allocations.map((a) => a.ledgerEntryId);

  if (ledgerEntryIds.length === 0) return null;

  const ledgerRows = await db
    .select({
      entry: tenantLedger,
      managementCommissionPct: contract.managementCommissionPct,
    })
    .from(tenantLedger)
    .innerJoin(contract, eq(tenantLedger.contratoId, contract.id))
    .where(and(inArray(tenantLedger.id, ledgerEntryIds), eq(tenantLedger.agencyId, agencyId)));

  // 3. Build items + totales
  const items: ComprobanteData["items"] = [];
  let brutoTotal = 0;
  let comisionTotal = 0;
  let netoTotal = 0;

  for (const { entry, managementCommissionPct } of ledgerRows) {
    const pct = Number(managementCommissionPct ?? 10);
    const { net: rawNet, commission: rawCommission, effectivePct } = computeNetAndCommission(entry, pct);
    const rawBruto = Number(entry.monto ?? 0);
    const sign = (entry.tipo === "descuento" || entry.tipo === "bonificacion") ? -1 : 1;
    const bruto = rawBruto * sign;
    const commission = rawCommission * sign;
    const net = rawNet * sign;

    items.push({
      id: entry.id,
      descripcion: entry.descripcion,
      period: entry.period,
      tipo: entry.tipo,
      bruto,
      comisionPct: effectivePct,
      comision: commission,
      neto: net,
    });

    brutoTotal += bruto;
    comisionTotal += commission;
    netoTotal += net;
  }

  // 4. Resolve legal owner from property + property_co_owner
  const [propRow] = await db
    .select()
    .from(property)
    .where(and(eq(property.id, movimiento.propiedadId), eq(property.agencyId, agencyId)))
    .limit(1);

  if (!propRow) return null;

  const candidates: { clientId: string; createdAt: Date }[] = [];

  if (propRow.ownerRole === "legal" || propRow.ownerRole === "ambos") {
    candidates.push({ clientId: propRow.ownerId, createdAt: propRow.createdAt });
  }

  const coOwners = await db
    .select({ clientId: propertyCoOwner.clientId, createdAt: propertyCoOwner.createdAt })
    .from(propertyCoOwner)
    .where(
      and(
        eq(propertyCoOwner.propertyId, movimiento.propiedadId),
        eq(propertyCoOwner.agencyId, agencyId),
        or(eq(propertyCoOwner.role, "legal"), eq(propertyCoOwner.role, "ambos"))
      )
    );
  candidates.push(...coOwners);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const legalOwnerId = candidates[0].clientId;

  // 5. Get owner client data
  const [propietarioRow] = await db
    .select({
      firstName: client.firstName,
      lastName: client.lastName,
      dni: client.dni,
      email: client.email,
      cbu: client.cbu,
      alias: client.alias,
    })
    .from(client)
    .where(and(eq(client.id, legalOwnerId), eq(client.agencyId, agencyId)))
    .limit(1);

  if (!propietarioRow) return null;

  // 6. Get inquilino data (if linked)
  const inqRows = movimiento.inquilinoId
    ? await db
        .select({
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
        })
        .from(client)
        .where(and(eq(client.id, movimiento.inquilinoId), eq(client.agencyId, agencyId)))
        .limit(1)
    : [];
  const inqRow = inqRows[0] ?? null;

  // 7. Get contrato data
  const [contratoRow] = await db
    .select({
      contractNumber: contract.contractNumber,
      paymentModality: contract.paymentModality,
      managementCommissionPct: contract.managementCommissionPct,
    })
    .from(contract)
    .where(and(eq(contract.id, movimiento.contratoId), eq(contract.agencyId, agencyId)))
    .limit(1);

  if (!contratoRow) return null;

  // 8. Get agency
  const [agencyRow] = await db
    .select()
    .from(agency)
    .where(eq(agency.id, agencyId))
    .limit(1);

  const agencyData: ComprobanteData["agency"] = agencyRow
    ? {
        name: agencyRow.name,
        tradeName: agencyRow.tradeName,
        legalName: agencyRow.legalName,
        cuit: agencyRow.cuit,
        vatStatus: agencyRow.vatStatus,
        logoUrl: agencyRow.logoUrl,
        fiscalAddress: agencyRow.fiscalAddress,
        city: agencyRow.city,
        phone: agencyRow.phone,
        contactEmail: agencyRow.contactEmail,
        licenseNumber: agencyRow.licenseNumber,
        signatory: agencyRow.signatory,
        signatoryTitle: agencyRow.signatoryTitle,
        signatureUrl: agencyRow.signatureUrl,
        bancoCBU: agencyRow.bancoCBU,
        bancoAlias: agencyRow.bancoAlias,
        clauses: (() => {
          try {
            const p = JSON.parse(agencyRow.clauses ?? "[]");
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })(),
      }
    : null;

  return {
    movimiento: {
      id: movimiento.id,
      reciboNumero: movimiento.reciboNumero,
      date: movimiento.date,
      period: movimiento.period,
      amount: movimiento.amount,
      paymentModality: (movimiento.paymentModality ?? contratoRow.paymentModality) as
        | "A"
        | "split",
      anuladoAt: movimiento.anuladoAt ? movimiento.anuladoAt.toISOString() : null,
    },
    contrato: {
      contractNumber: contratoRow.contractNumber,
      paymentModality: contratoRow.paymentModality as "A" | "split",
      managementCommissionPct: Number(contratoRow.managementCommissionPct ?? 10),
    },
    propiedad: {
      address: propRow.address,
      floorUnit: propRow.floorUnit,
    },
    inquilino: inqRow ?? null,
    propietario: propietarioRow,
    items,
    totales: {
      bruto: round2(brutoTotal),
      comision: round2(comisionTotal),
      neto: round2(netoTotal),
    },
    agency: agencyData,
  };
}
