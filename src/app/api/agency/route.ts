import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { agency } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAgencyId, handleAgencyError } from "@/lib/auth/agency";
import { canManageAgency } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { ensureDefaultTemplate } from "@/lib/document-templates/default-template";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // El user puede no tener agencyId todavía (recién registrado, antes de
    // completar el alta de inmobiliaria). No usamos requireAgencyId acá porque
    // queremos devolver { agency: null } en ese caso, no un 403.
    if (!session.user.agencyId) {
      return NextResponse.json({ agency: null });
    }

    const [data] = await db
      .select()
      .from(agency)
      .where(eq(agency.id, session.user.agencyId))
      .limit(1);

    return NextResponse.json({ agency: data ?? null });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error GET /api/agency:", error);
    return NextResponse.json({ error: "Error al obtener la agencia" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageAgency(session.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const body = await request.json();

    // Auto-increment nextNumber when confirming a liquidación
    if (body.incrementarNumero === true) {
      const agencyId = requireAgencyId(session);
      const [existing] = await db
        .select({ id: agency.id, nextNumber: agency.nextNumber })
        .from(agency)
        .where(eq(agency.id, agencyId))
        .limit(1);

      if (!existing) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

      const current = parseInt(existing.nextNumber ?? "0", 10) + 1;
      const next = String(current).padStart(8, "0");
      await db
        .update(agency)
        .set({ nextNumber: next, updatedAt: new Date() })
        .where(eq(agency.id, agencyId));

      return NextResponse.json({ nextNumber: next });
    }

    // Excluimos id y ownerId del body — no se pueden modificar vía PATCH.
    const data = {
      legalName:            body.legalName            ?? null,
      tradeName:            body.tradeName            ?? null,
      cuit:                 body.cuit                 ?? null,
      vatStatus:            body.vatStatus            ?? null,
      grossIncome:          body.grossIncome          ?? null,
      activityStart:        body.activityStart        ?? null,
      logoUrl:              body.logoUrl              ?? null,
      fiscalAddress:        body.fiscalAddress        ?? null,
      fiscalAddressStreet:  body.fiscalAddressStreet  ?? null,
      fiscalAddressNumber:  body.fiscalAddressNumber  ?? null,
      fiscalAddressZone:    body.fiscalAddressZone    ?? null,
      city:                 body.city                 ?? null,
      zipCode:              body.zipCode              ?? null,
      province:             body.province             ?? null,
      country:              body.country              ?? null,
      phone:                body.phone                ?? null,
      contactEmail:         body.contactEmail         ?? null,
      website:              body.website              ?? null,
      professionalAssociation: body.professionalAssociation ?? null,
      licenseNumber:        body.licenseNumber        ?? null,
      signatory:            body.signatory            ?? null,
      signatoryTitle:       body.signatoryTitle       ?? null,
      signatureUrl:         body.signatureUrl         ?? null,
      invoicePoint:         body.invoicePoint         ?? null,
      nextNumber:           body.nextNumber           ?? null,
      receiptType:          body.receiptType          ?? null,
      settlementPrefix:     body.settlementPrefix     ?? null,
      currency:             body.currency             ?? null,
      decimals:             body.decimals != null ? Number(body.decimals) : null,
      bancoNombre:          body.bancoNombre          ?? null,
      bancoTitular:         body.bancoTitular         ?? null,
      bancoCBU:             body.bancoCBU             ?? null,
      bancoAlias:           body.bancoAlias           ?? null,
      clauses:              body.clauses              ?? null,
      prefShowQR:           body.prefShowQR           ?? null,
      prefShowDetalle:      body.prefShowDetalle      ?? null,
      prefEmailAuto:        body.prefEmailAuto        ?? null,
      prefFirma:            body.prefFirma            ?? null,
      prefBorrador:         body.prefBorrador         ?? null,
      updatedAt:            new Date(),
    };

    // Si el user todavía no tiene agencyId asignado, este es el alta inicial
    // de la inmobiliaria. Creamos la fila usando ownerId = session.user.id.
    // Después del registro de Better Auth, agencyId queda en la sesión la
    // próxima vez que se loguea (o vía updateUser).
    if (!session.user.agencyId) {
      const newAgencyId = randomUUID();
      await db.insert(agency).values({
        id:      newAgencyId,
        name:    body.legalName ?? "Arce Administración",
        ownerId: session.user.id,
        ...data,
      });
      await ensureDefaultTemplate(newAgencyId);

      const [result] = await db
        .select()
        .from(agency)
        .where(eq(agency.id, newAgencyId))
        .limit(1);

      return NextResponse.json({ agency: result });
    }

    const agencyId = session.user.agencyId;
    await db.update(agency).set(data).where(eq(agency.id, agencyId));

    const [result] = await db
      .select()
      .from(agency)
      .where(eq(agency.id, agencyId))
      .limit(1);

    return NextResponse.json({ agency: result });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error PATCH /api/agency:", error);
    return NextResponse.json({ error: "Error al actualizar la agencia" }, { status: 500 });
  }
}
