import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { adjustmentApplication } from "@/db/schema/adjustment-application";
import { contract } from "@/db/schema/contract";
import { property } from "@/db/schema/property";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { eq, and, desc } from "drizzle-orm";
import { formatAddress } from "@/lib/properties/format-address";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const contractId = request.nextUrl.searchParams.get("contractId");

    const conditions = [eq(adjustmentApplication.agencyId, agencyId)];
    if (contractId) {
      conditions.push(eq(adjustmentApplication.contratoId, contractId));
    }

    const rows = await db
      .select({
        id: adjustmentApplication.id,
        contratoId: adjustmentApplication.contratoId,
        contractNumber: contract.contractNumber,
        propertyAddressStreet: property.addressStreet,
        propertyAddressNumber: property.addressNumber,
        propertyFloorUnit: property.floorUnit,
        adjustmentPeriod: adjustmentApplication.adjustmentPeriod,
        previousAmount: adjustmentApplication.previousAmount,
        newAmount: adjustmentApplication.newAmount,
        factor: adjustmentApplication.factor,
        periodsUsed: adjustmentApplication.periodsUsed,
        valuesUsed: adjustmentApplication.valuesUsed,
        isProvisional: adjustmentApplication.isProvisional,
        appliedAt: adjustmentApplication.appliedAt,
      })
      .from(adjustmentApplication)
      .innerJoin(contract, eq(contract.id, adjustmentApplication.contratoId))
      .leftJoin(property, eq(property.id, contract.propertyId))
      .where(and(...conditions))
      .orderBy(desc(adjustmentApplication.appliedAt));

    const result = rows.map((r) => ({
      ...r,
      propertyAddress: r.propertyAddressStreet
        ? formatAddress({ addressStreet: r.propertyAddressStreet, addressNumber: r.propertyAddressNumber, floorUnit: r.propertyFloorUnit })
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error al listar ajustes" }, { status: 500 });
  }
}
