import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { tenantLedger } from "@/db/schema/tenant-ledger";
import { servicio } from "@/db/schema/servicio";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { buildLedgerEntries } from "@/lib/ledger/generate-contract-ledger";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageClients(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId } = await params;
    const force = request.nextUrl.searchParams.get("force") === "true";

    const [contractRow] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    // Check existing entries
    const existingEntries = await db
      .select({ id: tenantLedger.id, estado: tenantLedger.estado })
      .from(tenantLedger)
      .where(eq(tenantLedger.contratoId, contractId));

    if (existingEntries.length > 0) {
      if (!force) {
        return NextResponse.json(
          { error: "Este contrato ya tiene entradas generadas. Usá force=true para regenerar." },
          { status: 409 }
        );
      }

      // Only delete non-paid entries
      const deletableIds = existingEntries
        .filter((e) => e.estado !== "cobrado")
        .map((e) => e.id);

      if (deletableIds.length > 0) {
        await db
          .delete(tenantLedger)
          .where(inArray(tenantLedger.id, deletableIds));
      }

      // If force=true but every existing entry was cobrado, nothing was deleted.
      // Re-generating would create duplicates — abort safely.
      if (deletableIds.length === 0) {
        return NextResponse.json(
          { error: "Todas las entradas ya están cobradas. No se puede regenerar.", inserted: 0 },
          { status: 409 }
        );
      }
    }

    const [primaryTenant] = await db
      .select({ clientId: contractTenant.clientId })
      .from(contractTenant)
      .where(
        and(
          eq(contractTenant.contractId, contractId),
          eq(contractTenant.role, "primary")
        )
      )
      .limit(1);

    if (!primaryTenant) {
      return NextResponse.json({ error: "El contrato no tiene inquilino principal" }, { status: 422 });
    }

    const services = await db
      .select({
        id: servicio.id,
        tipo: servicio.tipo,
        company: servicio.company,
        tipoGestion: servicio.tipoGestion,
        propietarioResponsable: servicio.propietarioResponsable,
      })
      .from(servicio)
      .where(eq(servicio.propertyId, contractRow.propertyId));

    const entries = buildLedgerEntries(
      {
        id: contractRow.id,
        propertyId: contractRow.propertyId,
        ownerId: contractRow.ownerId,
        startDate: contractRow.startDate,
        endDate: contractRow.endDate,
        ledgerStartDate: contractRow.ledgerStartDate,
        monthlyAmount: contractRow.monthlyAmount,
        paymentDay: contractRow.paymentDay,
        adjustmentIndex: contractRow.adjustmentIndex,
        adjustmentFrequency: contractRow.adjustmentFrequency,
      },
      primaryTenant.clientId,
      services,
    );

    if (entries.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      await db.insert(tenantLedger).values(batch);
      inserted += batch.length;
    }

    return NextResponse.json({ inserted }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/contracts/:id/generate-ledger:", error);
    return NextResponse.json({ error: "Error al generar el ledger" }, { status: 500 });
  }
}
