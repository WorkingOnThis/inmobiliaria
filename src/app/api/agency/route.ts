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

  // Auto-increment proximoNumero when confirming a liquidación
  if (body.incrementarNumero === true) {
    const [existing] = await db
      .select({ id: agency.id, proximoNumero: agency.proximoNumero })
      .from(agency)
      .where(eq(agency.ownerId, session.user.id))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

    const current = parseInt(existing.proximoNumero ?? "0", 10) + 1;
    const next = String(current).padStart(8, "0");
    await db
      .update(agency)
      .set({ proximoNumero: next, updatedAt: new Date() })
      .where(eq(agency.ownerId, session.user.id));

    return NextResponse.json({ proximoNumero: next });
  }

  const data = {
    razonSocial:        body.razonSocial        ?? null,
    nombreFantasia:     body.nombreFantasia     ?? null,
    cuit:               body.cuit               ?? null,
    condicionIVA:       body.condicionIVA       ?? null,
    ingresosBrutos:     body.ingresosBrutos     ?? null,
    inicioActividades:  body.inicioActividades  ?? null,
    logoUrl:            body.logoUrl            ?? null,
    domicilioFiscal:    body.domicilioFiscal    ?? null,
    localidad:          body.localidad          ?? null,
    codigoPostal:       body.codigoPostal       ?? null,
    provincia:          body.provincia          ?? null,
    pais:               body.pais               ?? null,
    telefono:           body.telefono           ?? null,
    emailContacto:      body.emailContacto      ?? null,
    sitioWeb:           body.sitioWeb           ?? null,
    colegio:            body.colegio            ?? null,
    matricula:          body.matricula          ?? null,
    firmante:           body.firmante           ?? null,
    firmanteCargo:      body.firmanteCargo      ?? null,
    firmaUrl:           body.firmaUrl           ?? null,
    puntoVenta:         body.puntoVenta         ?? null,
    proximoNumero:      body.proximoNumero      ?? null,
    tipoComprobante:    body.tipoComprobante    ?? null,
    prefijoLiquidacion: body.prefijoLiquidacion ?? null,
    moneda:             body.moneda             ?? null,
    decimales:          body.decimales != null ? Number(body.decimales) : null,
    bancoNombre:        body.bancoNombre        ?? null,
    bancoTitular:       body.bancoTitular       ?? null,
    bancoCBU:           body.bancoCBU           ?? null,
    bancoAlias:         body.bancoAlias         ?? null,
    clausulas:          body.clausulas          ?? null,
    prefShowQR:         body.prefShowQR         ?? null,
    prefShowDetalle:    body.prefShowDetalle    ?? null,
    prefEmailAuto:      body.prefEmailAuto      ?? null,
    prefFirma:          body.prefFirma          ?? null,
    prefBorrador:       body.prefBorrador       ?? null,
    updatedAt:          new Date(),
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
      name:    body.razonSocial ?? "Arce Administración",
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
