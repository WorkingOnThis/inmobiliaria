import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { agency } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [data] = await db
    .select()
    .from(agency)
    .where(eq(agency.ownerId, session.user.id))
    .limit(1);

  return NextResponse.json({ agency: data ?? null });
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Auto-increment nextNumber when confirming a liquidación
  if (body.incrementarNumero === true) {
    const [existing] = await db
      .select({ id: agency.id, nextNumber: agency.nextNumber })
      .from(agency)
      .where(eq(agency.ownerId, session.user.id))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

    const current = parseInt(existing.nextNumber ?? "0", 10) + 1;
    const next = String(current).padStart(8, "0");
    await db
      .update(agency)
      .set({ nextNumber: next, updatedAt: new Date() })
      .where(eq(agency.ownerId, session.user.id));

    return NextResponse.json({ nextNumber: next });
  }

  const data = {
    legalName:            body.legalName            ?? null,
    tradeName:            body.tradeName            ?? null,
    cuit:                 body.cuit                 ?? null,
    vatStatus:            body.vatStatus            ?? null,
    grossIncome:          body.grossIncome          ?? null,
    activityStart:        body.activityStart        ?? null,
    logoUrl:              body.logoUrl              ?? null,
    fiscalAddress:        body.fiscalAddress        ?? null,
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

  const [existing] = await db
    .select({ id: agency.id })
    .from(agency)
    .where(eq(agency.ownerId, session.user.id))
    .limit(1);

  if (existing) {
    await db.update(agency).set(data).where(eq(agency.ownerId, session.user.id));
  } else {
    await db.insert(agency).values({
      id:      randomUUID(),
      name:    body.legalName ?? "Arce Administración",
      ownerId: session.user.id,
      ...data,
    });
  }

  const [result] = await db
    .select()
    .from(agency)
    .where(eq(agency.ownerId, session.user.id))
    .limit(1);

  return NextResponse.json({ agency: result });
}
