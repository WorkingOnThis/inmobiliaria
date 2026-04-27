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
import { parseTrustedEmails } from "./format";

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

  const [inqRow, propRow, contratoRow, serviceItems, charges, agencyRow] = await Promise.all([
    movimiento.inquilinoId
      ? db.select({
          firstName: client.firstName,
          lastName: client.lastName,
          dni: client.dni,
          email: client.email,
          emailDefault: client.emailDefault,
          trustedEmails: client.trustedEmails,
        }).from(client).where(eq(client.id, movimiento.inquilinoId)).limit(1)
      : Promise.resolve([]),
    movimiento.propiedadId
      ? db.select({ address: property.address, floorUnit: property.floorUnit })
          .from(property).where(eq(property.id, movimiento.propiedadId)).limit(1)
      : Promise.resolve([]),
    movimiento.contratoId
      ? db.select({ contractNumber: contract.contractNumber, paymentModality: contract.paymentModality })
          .from(contract).where(eq(contract.id, movimiento.contratoId)).limit(1)
      : movimiento.inquilinoId
        ? db.select({ contractNumber: contract.contractNumber, paymentModality: contract.paymentModality })
            .from(contractTenant)
            .innerJoin(contract, eq(contract.id, contractTenant.contractId))
            .where(and(eq(contractTenant.clientId, movimiento.inquilinoId), eq(contract.status, "active")))
            .limit(1)
        : Promise.resolve([]),
    db.select({
      id: receiptServiceItem.id,
      etiqueta: receiptServiceItem.etiqueta,
      period: receiptServiceItem.period,
      monto: receiptServiceItem.monto,
      servicioId: receiptServiceItem.servicioId,
    }).from(receiptServiceItem).where(eq(receiptServiceItem.movimientoId, movimientoId)),
    db.select({
      id: tenantCharge.id,
      periodo: tenantCharge.period,
      categoria: tenantCharge.categoria,
      descripcion: tenantCharge.descripcion,
      monto: tenantCharge.monto,
    }).from(tenantCharge).where(eq(tenantCharge.reciboNumero, movimiento.reciboNumero)),
    db.select().from(agency).where(eq(agency.ownerId, agencyOwnerId)).limit(1),
  ]);

  const inq = inqRow[0] ?? null;
  const inquilino: ReceiptData["inquilino"] = inq
    ? { firstName: inq.firstName, lastName: inq.lastName, dni: inq.dni, email: inq.email, emailDefault: inq.emailDefault, trustedEmails: parseTrustedEmails(inq.trustedEmails) }
    : null;

  const propiedad: ReceiptData["propiedad"] = propRow[0] ?? null;
  const contrato: ReceiptData["contrato"] = contratoRow[0] ?? null;
  const agencyRow0 = agencyRow[0] ?? null;

  const agencyData: ReceiptData["agency"] = agencyRow0
    ? {
        name: agencyRow0.name,
        tradeName: agencyRow0.tradeName,
        legalName: agencyRow0.legalName,
        cuit: agencyRow0.cuit,
        vatStatus: agencyRow0.vatStatus,
        grossIncome: agencyRow0.grossIncome,
        activityStart: agencyRow0.activityStart,
        logoUrl: agencyRow0.logoUrl,
        fiscalAddress: agencyRow0.fiscalAddress,
        city: agencyRow0.city,
        zipCode: agencyRow0.zipCode,
        province: agencyRow0.province,
        phone: agencyRow0.phone,
        contactEmail: agencyRow0.contactEmail,
        website: agencyRow0.website,
        professionalAssociation: agencyRow0.professionalAssociation,
        licenseNumber: agencyRow0.licenseNumber,
        signatory: agencyRow0.signatory,
        signatoryTitle: agencyRow0.signatoryTitle,
        signatureUrl: agencyRow0.signatureUrl,
        receiptType: agencyRow0.receiptType,
        invoicePoint: agencyRow0.invoicePoint,
        bancoCBU: agencyRow0.bancoCBU,
        bancoAlias: agencyRow0.bancoAlias,
        clauses: (() => { try { const p = JSON.parse(agencyRow0.clauses ?? "[]"); return Array.isArray(p) ? p : []; } catch { return []; } })(),
      }
    : null;

  return { movimiento, inquilino, propiedad, contrato, serviceItems, charges, agency: agencyData };
}
