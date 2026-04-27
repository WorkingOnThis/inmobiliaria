import { db } from "@/db";
import { cajaMovimiento } from "@/db/schema/caja";
import { client } from "@/db/schema/client";
import { contract } from "@/db/schema/contract";
import { contractTenant } from "@/db/schema/contract-tenant";
import { property } from "@/db/schema/property";
import { agency } from "@/db/schema/agency";
import { receiptServiceItem } from "@/db/schema/receipt-service-item";
import { tenantCharge } from "@/db/schema/tenant-charge";
import { and, eq } from "drizzle-orm";

export type TrustedEmail = { email: string; label?: string; sendDefault: boolean };

export type ReceiptData = {
  movimiento: typeof cajaMovimiento.$inferSelect;
  inquilino: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
    email: string | null;
    emailDefault: boolean;
    trustedEmails: TrustedEmail[];
  } | null;
  propiedad: { address: string; floorUnit: string | null } | null;
  contrato: { contractNumber: string; paymentModality: string | null } | null;
  serviceItems: {
    id: string;
    etiqueta: string;
    period: string;
    monto: string | null;
    servicioId: string | null;
  }[];
  charges: {
    id: string;
    periodo: string | null;
    categoria: string;
    descripcion: string;
    monto: string;
  }[];
  agency: {
    name: string;
    tradeName: string | null;
    legalName: string | null;
    cuit: string | null;
    vatStatus: string | null;
    grossIncome: string | null;
    activityStart: string | null;
    logoUrl: string | null;
    fiscalAddress: string | null;
    city: string | null;
    zipCode: string | null;
    province: string | null;
    phone: string | null;
    contactEmail: string | null;
    website: string | null;
    professionalAssociation: string | null;
    licenseNumber: string | null;
    signatory: string | null;
    signatoryTitle: string | null;
    signatureUrl: string | null;
    receiptType: string | null;
    invoicePoint: string | null;
    bancoCBU: string | null;
    bancoAlias: string | null;
    clauses: { id: string; texto: string }[];
  } | null;
};

export async function loadReceiptData(
  movimientoId: string,
  agencyOwnerId: string
): Promise<ReceiptData | null> {
  const [movimiento] = await db
    .select()
    .from(cajaMovimiento)
    .where(eq(cajaMovimiento.id, movimientoId))
    .limit(1);

  if (!movimiento || !movimiento.reciboNumero) return null;

  let inquilino: ReceiptData["inquilino"] = null;
  if (movimiento.inquilinoId) {
    const [inq] = await db
      .select({
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
        email: client.email,
        emailDefault: client.emailDefault,
        trustedEmails: client.trustedEmails,
      })
      .from(client)
      .where(eq(client.id, movimiento.inquilinoId))
      .limit(1);

    if (inq) {
      let trustedEmails: TrustedEmail[] = [];
      if (inq.trustedEmails) {
        try {
          const parsed = JSON.parse(inq.trustedEmails);
          if (Array.isArray(parsed)) trustedEmails = parsed;
        } catch {
          trustedEmails = [];
        }
      }
      inquilino = {
        firstName: inq.firstName,
        lastName: inq.lastName,
        dni: inq.dni,
        email: inq.email,
        emailDefault: inq.emailDefault,
        trustedEmails,
      };
    }
  }

  let propiedad: ReceiptData["propiedad"] = null;
  if (movimiento.propiedadId) {
    const [prop] = await db
      .select({ address: property.address, floorUnit: property.floorUnit })
      .from(property)
      .where(eq(property.id, movimiento.propiedadId))
      .limit(1);
    propiedad = prop ?? null;
  }

  let contrato: ReceiptData["contrato"] = null;
  if (movimiento.contratoId) {
    const [con] = await db
      .select({ contractNumber: contract.contractNumber, paymentModality: contract.paymentModality })
      .from(contract)
      .where(eq(contract.id, movimiento.contratoId))
      .limit(1);
    contrato = con ?? null;
  } else if (movimiento.inquilinoId) {
    const [con] = await db
      .select({ contractNumber: contract.contractNumber, paymentModality: contract.paymentModality })
      .from(contractTenant)
      .innerJoin(contract, eq(contract.id, contractTenant.contractId))
      .where(
        and(
          eq(contractTenant.clientId, movimiento.inquilinoId),
          eq(contract.status, "active")
        )
      )
      .limit(1);
    contrato = con ?? null;
  }

  const serviceItems = await db
    .select({
      id: receiptServiceItem.id,
      etiqueta: receiptServiceItem.etiqueta,
      period: receiptServiceItem.period,
      monto: receiptServiceItem.monto,
      servicioId: receiptServiceItem.servicioId,
    })
    .from(receiptServiceItem)
    .where(eq(receiptServiceItem.movimientoId, movimientoId));

  const charges = movimiento.reciboNumero
    ? await db
        .select({
          id: tenantCharge.id,
          periodo: tenantCharge.period,
          categoria: tenantCharge.categoria,
          descripcion: tenantCharge.descripcion,
          monto: tenantCharge.monto,
        })
        .from(tenantCharge)
        .where(eq(tenantCharge.reciboNumero, movimiento.reciboNumero))
    : [];

  const [agencyRow] = await db
    .select()
    .from(agency)
    .where(eq(agency.ownerId, agencyOwnerId))
    .limit(1);

  let agencyClauses: { id: string; texto: string }[] = [];
  if (agencyRow?.clauses) {
    try {
      const parsed = JSON.parse(agencyRow.clauses);
      if (Array.isArray(parsed)) agencyClauses = parsed;
    } catch {
      agencyClauses = [];
    }
  }

  const agencyData: ReceiptData["agency"] = agencyRow
    ? {
        name: agencyRow.name,
        tradeName: agencyRow.tradeName,
        legalName: agencyRow.legalName,
        cuit: agencyRow.cuit,
        vatStatus: agencyRow.vatStatus,
        grossIncome: agencyRow.grossIncome,
        activityStart: agencyRow.activityStart,
        logoUrl: agencyRow.logoUrl,
        fiscalAddress: agencyRow.fiscalAddress,
        city: agencyRow.city,
        zipCode: agencyRow.zipCode,
        province: agencyRow.province,
        phone: agencyRow.phone,
        contactEmail: agencyRow.contactEmail,
        website: agencyRow.website,
        professionalAssociation: agencyRow.professionalAssociation,
        licenseNumber: agencyRow.licenseNumber,
        signatory: agencyRow.signatory,
        signatoryTitle: agencyRow.signatoryTitle,
        signatureUrl: agencyRow.signatureUrl,
        receiptType: agencyRow.receiptType,
        invoicePoint: agencyRow.invoicePoint,
        bancoCBU: agencyRow.bancoCBU,
        bancoAlias: agencyRow.bancoAlias,
        clauses: agencyClauses,
      }
    : null;

  return { movimiento, inquilino, propiedad, contrato, serviceItems, charges, agency: agencyData };
}
