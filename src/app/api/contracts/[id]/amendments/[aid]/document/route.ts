import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { client } from "@/db/schema/client";
import { contractParticipant } from "@/db/schema/contract-participant";
import { auth } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError, AgencyAccessError } from "@/lib/auth/agency";
import { eq, and } from "drizzle-orm";
import { AMENDMENT_TYPE_LABELS, FIELD_LABELS, type AmendmentType } from "@/lib/contracts/amendments";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value) + "T00:00:00");
  return format(d, "dd/MM/yyyy", { locale: es });
}

function fmtValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (field === "monthlyAmount") return `$${Number(value).toLocaleString("es-AR")}`;
  if (field === "paymentModality") return value === "A" ? "Modalidad A (inmobiliaria)" : "Pago dividido (split)";
  if (field === "startDate" || field === "endDate") return fmtDate(value);
  return String(value);
}

function buildBody(
  type: AmendmentType,
  description: string | null,
  effectiveDate: string | null,
  fieldsChanged: Record<string, { before: unknown; after: unknown }>
): string {
  const efDate = effectiveDate ? fmtDate(effectiveDate) : "";

  switch (type) {
    case "erratum": {
      const lines = Object.entries(fieldsChanged).map(([field, { before, after }]) =>
        `<p>En cuanto a <strong>${FIELD_LABELS[field] ?? field}</strong>:<br>
        Donde dice: <em>"${fmtValue(field, before)}"</em><br>
        Debe leerse: <em>"${fmtValue(field, after)}"</em></p>`
      ).join("");
      return `${lines}<p>Las demás cláusulas del contrato permanecen inalteradas.</p>`;
    }
    case "modification": {
      const lines = Object.entries(fieldsChanged).map(([field, { before, after }]) =>
        `<li><strong>${FIELD_LABELS[field] ?? field}:</strong> ${fmtValue(field, before)} → ${fmtValue(field, after)}</li>`
      ).join("");
      return `<p>Las partes acuerdan modificar las siguientes condiciones, con vigencia a partir del <strong>${efDate}</strong>:</p>
              <ul>${lines}</ul>
              <p>Las demás cláusulas permanecen inalteradas.</p>`;
    }
    case "extension": {
      const newEnd = fieldsChanged["endDate"] ? fmtValue("endDate", fieldsChanged["endDate"].after) : "—";
      const newAmt = fieldsChanged["monthlyAmount"]
        ? `, con un canon mensual de <strong>$${Number(fieldsChanged["monthlyAmount"].after).toLocaleString("es-AR")}</strong>`
        : "";
      return `<p>Las partes acuerdan prorrogar el contrato hasta el <strong>${newEnd}</strong>${newAmt}, a partir del <strong>${efDate}</strong>.</p>
              <p>Las demás condiciones permanecen inalteradas.</p>`;
    }
    case "termination":
      return `<p>Las partes acuerdan dar por rescindido el contrato a partir del <strong>${efDate}</strong>, comprometiéndose la parte locataria a la entrega del inmueble en dicha fecha.</p>
              ${description ? `<p>${description}</p>` : ""}`;
    case "guarantee_substitution":
      return `<p>Las partes acuerdan sustituir la garantía original conforme lo siguiente:</p>
              <p>${description ?? ""}</p>`;
    case "index_change": {
      const oldIdx = fmtValue("adjustmentIndex", fieldsChanged["adjustmentIndex"]?.before);
      const newIdx = fmtValue("adjustmentIndex", fieldsChanged["adjustmentIndex"]?.after);
      return `<p>Las partes acuerdan reemplazar el índice de ajuste <strong>${oldIdx}</strong> por <strong>${newIdx}</strong>, con vigencia a partir del <strong>${efDate}</strong>.</p>`;
    }
    default:
      return `<p>${description ?? ""}</p>`;
  }
}

// POST: generate document HTML, save it, transition to document_generated
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageContracts(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: contractId, aid } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [amendment] = await db
      .select()
      .from(contractAmendment)
      .where(and(
        eq(contractAmendment.id, aid),
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.agencyId, agencyId),
      ))
      .limit(1);

    if (!amendment) return NextResponse.json({ error: "Instrumento no encontrado" }, { status: 404 });

    const [currentContract] = await db
      .select()
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)))
      .limit(1);

    if (!currentContract) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });

    // Owner data
    const [ownerRow] = await db
      .select({ firstName: client.firstName, lastName: client.lastName, dni: client.dni })
      .from(client)
      .where(and(eq(client.id, currentContract.ownerId), eq(client.agencyId, agencyId)))
      .limit(1);
    const ownerName = ownerRow ? `${ownerRow.firstName} ${ownerRow.lastName ?? ""}`.trim() : "—";
    const ownerDni = ownerRow?.dni ?? "—";

    // Primary tenant
    const [tenantLink] = await db
      .select({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(and(eq(contractParticipant.contractId, contractId), eq(contractParticipant.role, "tenant")))
      .limit(1);

    let tenantName = "—";
    if (tenantLink?.clientId) {
      const [tenantRow] = await db
        .select({ firstName: client.firstName, lastName: client.lastName })
        .from(client)
        .where(and(eq(client.id, tenantLink.clientId), eq(client.agencyId, agencyId)))
        .limit(1);
      if (tenantRow) tenantName = `${tenantRow.firstName} ${tenantRow.lastName ?? ""}`.trim();
    }

    // typeSequenceNumber
    const allOfSameType = await db
      .select({ seq: contractAmendment.sequenceNumber })
      .from(contractAmendment)
      .where(and(eq(contractAmendment.contractId, contractId), eq(contractAmendment.type, amendment.type)));
    const typeSeqNumber = allOfSameType.filter((r) => r.seq <= amendment.sequenceNumber).length;

    const typeLabel = AMENDMENT_TYPE_LABELS[amendment.type as AmendmentType] ?? amendment.type;
    const fc = (amendment.fieldsChanged ?? {}) as Record<string, { before: unknown; after: unknown }>;
    const body = buildBody(amendment.type as AmendmentType, amendment.description, amendment.effectiveDate, fc);
    const startFormatted = fmtDate(currentContract.startDate);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${typeLabel} N°${typeSeqNumber} — ${currentContract.contractNumber}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #111; line-height: 1.7; font-size: 14px; }
    h1 { font-size: 1rem; text-align: center; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.2rem; }
    .subtitle { text-align: center; font-size: 0.85rem; color: #555; margin-bottom: 2rem; }
    .parties { border: 1px solid #ccc; padding: 1rem 1.25rem; margin-bottom: 2rem; border-radius: 4px; font-size: 0.88rem; }
    .parties p { margin: 0.3rem 0; }
    .body-text { margin-bottom: 2.5rem; font-size: 0.9rem; }
    .body-text ul { padding-left: 1.5rem; }
    .body-text li { margin: 0.4rem 0; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2rem; margin-top: 5rem; }
    .sig-block { border-top: 1px solid #111; padding-top: 0.5rem; font-size: 0.8rem; text-align: center; }
    .sig-block .name { font-weight: bold; margin-top: 0.3rem; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${typeLabel} N°${typeSeqNumber}</h1>
  <p class="subtitle">Contrato ${currentContract.contractNumber} — Celebrado el ${startFormatted}</p>

  <div class="parties">
    <p><strong>Parte Locadora:</strong> ${ownerName} · DNI ${ownerDni}</p>
    <p><strong>Parte Locataria:</strong> ${tenantName}</p>
    <p><strong>Administradora:</strong> Arce Administración</p>
  </div>

  <div class="body-text">
    ${body}
  </div>

  <p style="font-size:0.82rem;color:#666;margin-top:3rem;">
    Lugar y fecha: _________________, ___ de _________ de _____
  </p>

  <div class="signatures">
    <div class="sig-block">
      <br><br><br>
      <div class="name">PARTE LOCADORA</div>
      <div>${ownerName}</div>
    </div>
    <div class="sig-block">
      <br><br><br>
      <div class="name">PARTE LOCATARIA</div>
      <div>${tenantName}</div>
    </div>
    <div class="sig-block">
      <br><br><br>
      <div class="name">ARCE ADMINISTRACIÓN</div>
    </div>
  </div>
</body>
</html>`;

    await db
      .update(contractAmendment)
      .set({ documentContent: html, status: "document_generated", updatedAt: new Date() })
      .where(and(eq(contractAmendment.id, aid), eq(contractAmendment.agencyId, agencyId)));

    return NextResponse.json({ ok: true, status: "document_generated" });
  } catch (e) {
    const resp = handleAgencyError(e);
    if (resp) return resp;
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET: serve the stored HTML document
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    const { id: contractId, aid } = await params;
    await requireAgencyResource(contract, contractId, agencyId);

    const [amendment] = await db
      .select({ documentContent: contractAmendment.documentContent })
      .from(contractAmendment)
      .where(and(
        eq(contractAmendment.id, aid),
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.agencyId, agencyId),
      ))
      .limit(1);

    if (!amendment?.documentContent) {
      return new NextResponse("Documento no generado", { status: 404 });
    }

    return new NextResponse(amendment.documentContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof AgencyAccessError) {
      return new NextResponse(e.message, { status: e.status });
    }
    console.error(e);
    return new NextResponse("Error interno", { status: 500 });
  }
}
