// src/app/api/clients/[id]/resumen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { client } from "@/db/schema/client";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

function defaultPeriodRange() {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;
  return { from, to };
}

function deriveEstado(estados: string[]): string {
  if (estados.some((e) => e === "en_mora")) return "en_mora";
  if (estados.every((e) => e === "conciliado")) return "pagado";
  if (estados.some((e) => e === "pago_parcial")) return "pago_parcial";
  return "pendiente";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageClients(session!.user.role))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const defaults = defaultPeriodRange();
    const from = sp.get("from") ?? defaults.from;
    const to = sp.get("to") ?? defaults.to;

    await requireAgencyResource(client, id, agencyId);

    const [clientRow] = await db
      .select({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
      })
      .from(client)
      .where(and(eq(client.id, id), eq(client.agencyId, agencyId)))
      .limit(1);

    if (!clientRow)
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // ── AS TENANT ────────────────────────────────────────────────────────────
    const tenantContractLinks = await db
      .select({ contractId: contractParticipant.contractId })
      .from(contractParticipant)
      .where(and(
        eq(contractParticipant.agencyId, agencyId),
        eq(contractParticipant.clientId, id),
        eq(contractParticipant.role, "tenant"),
      ));

    const tenantContractIds = tenantContractLinks.map((r) => r.contractId);

    let asTenant: {
      contracts: Array<{
        contractId: string;
        contractNumber: string;
        propertyAddress: string;
        periods: Array<{ period: string; estado: string; amount: number }>;
        subtotal: number;
      }>;
      total: number;
    } | null = null;

    if (tenantContractIds.length > 0) {
      const [contractDetails, ledgerEntries] = await Promise.all([
        db
          .select({
            id: contract.id,
            contractNumber: contract.contractNumber,
            propertyAddress: property.address,
          })
          .from(contract)
          .leftJoin(property, eq(contract.propertyId, property.id))
          .where(and(
            eq(contract.agencyId, agencyId),
            inArray(contract.id, tenantContractIds),
          )),

        db
          .select({
            contratoId: tenantLedger.contratoId,
            period: tenantLedger.period,
            monto: tenantLedger.monto,
            estado: tenantLedger.estado,
          })
          .from(tenantLedger)
          .where(
            and(
              eq(tenantLedger.agencyId, agencyId),
              eq(tenantLedger.inquilinoId, id),
              inArray(tenantLedger.contratoId, tenantContractIds),
              isNotNull(tenantLedger.period),
              gte(tenantLedger.period, from),
              lte(tenantLedger.period, to)
            )
          )
          .orderBy(tenantLedger.period),
      ]);

      const contracts = contractDetails
        .map((c) => {
          const entries = ledgerEntries.filter((e) => e.contratoId === c.id);
          const periodMap = new Map<string, { amount: number; estados: string[] }>();
          for (const e of entries) {
            const p = e.period!;
            const existing = periodMap.get(p) ?? { amount: 0, estados: [] };
            existing.amount += Number(e.monto ?? 0);
            existing.estados.push(e.estado);
            periodMap.set(p, existing);
          }
          const periods = Array.from(periodMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, { amount, estados }]) => ({
              period,
              estado: deriveEstado(estados),
              amount,
            }));
          const subtotal = periods.reduce((s, p) => s + p.amount, 0);
          return {
            contractId: c.id,
            contractNumber: c.contractNumber,
            propertyAddress: c.propertyAddress ?? "",
            periods,
            subtotal,
          };
        })
        .filter((c) => c.periods.length > 0);

      const total = contracts.reduce((s, c) => s + c.subtotal, 0);
      if (contracts.length > 0) asTenant = { contracts, total };
    }

    // ── AS OWNER ──────────────────────────────────────────────────────────────
    const ownerContractDetails = await db
      .select({
        id: contract.id,
        contractNumber: contract.contractNumber,
        propertyAddress: property.address,
      })
      .from(contract)
      .leftJoin(property, eq(contract.propertyId, property.id))
      .where(and(eq(contract.agencyId, agencyId), eq(contract.ownerId, id)));

    let asOwner: {
      contracts: Array<{
        contractId: string;
        contractNumber: string;
        propertyAddress: string;
        tenantName: string;
        periods: Array<{ period: string; estado: string; amount: number }>;
        subtotal: number;
      }>;
      total: number;
    } | null = null;

    if (ownerContractDetails.length > 0) {
      const ownerContractIds = ownerContractDetails.map((c) => c.id);

      const [ledgerEntries, tenantRows] = await Promise.all([
        db
          .select({
            contratoId: tenantLedger.contratoId,
            period: tenantLedger.period,
            monto: tenantLedger.monto,
            estado: tenantLedger.estado,
          })
          .from(tenantLedger)
          .where(
            and(
              eq(tenantLedger.agencyId, agencyId),
              eq(tenantLedger.propietarioId, id),
              eq(tenantLedger.impactaPropietario, true),
              inArray(tenantLedger.contratoId, ownerContractIds),
              isNotNull(tenantLedger.period),
              gte(tenantLedger.period, from),
              lte(tenantLedger.period, to)
            )
          )
          .orderBy(tenantLedger.period),

        db
          .select({
            contractId: contractParticipant.contractId,
            firstName: client.firstName,
            lastName: client.lastName,
          })
          .from(contractParticipant)
          .leftJoin(client, eq(contractParticipant.clientId, client.id))
          .where(and(
            eq(contractParticipant.agencyId, agencyId),
            inArray(contractParticipant.contractId, ownerContractIds),
            eq(contractParticipant.role, "tenant")
          )),
      ]);

      const contracts = ownerContractDetails
        .map((c) => {
          const entries = ledgerEntries.filter((e) => e.contratoId === c.id);
          const periodMap = new Map<string, { amount: number; estados: string[] }>();
          for (const e of entries) {
            const p = e.period!;
            const existing = periodMap.get(p) ?? { amount: 0, estados: [] };
            existing.amount += Number(e.monto ?? 0);
            existing.estados.push(e.estado);
            periodMap.set(p, existing);
          }
          const periods = Array.from(periodMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, { amount, estados }]) => ({
              period,
              estado: deriveEstado(estados),
              amount,
            }));
          const subtotal = periods.reduce((s, p) => s + p.amount, 0);

          const tenant = tenantRows.find((t) => t.contractId === c.id);
          const tenantName = tenant
            ? [tenant.firstName, tenant.lastName].filter(Boolean).join(" ")
            : "";

          return {
            contractId: c.id,
            contractNumber: c.contractNumber,
            propertyAddress: c.propertyAddress ?? "",
            tenantName,
            periods,
            subtotal,
          };
        })
        .filter((c) => c.periods.length > 0);

      const total = contracts.reduce((s, c) => s + c.subtotal, 0);
      if (contracts.length > 0) asOwner = { contracts, total };
    }

    const net =
      asTenant !== null && asOwner !== null
        ? asOwner.total - asTenant.total
        : null;

    return NextResponse.json({ client: clientRow, from, to, asTenant, asOwner, net });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/clients/:id/resumen:", error);
    return NextResponse.json({ error: "Error al obtener el resumen" }, { status: 500 });
  }
}
