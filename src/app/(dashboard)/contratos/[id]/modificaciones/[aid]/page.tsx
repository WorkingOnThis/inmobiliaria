import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractAmendment } from "@/db/schema/contract-amendment";
import { client } from "@/db/schema/client";
import { contractParticipant } from "@/db/schema/contract-participant";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { requireAgencyId, AgencyAccessError } from "@/lib/auth/agency";
import {
  AmendmentDocument,
  type AmendmentDocumentProps,
} from "@/components/contracts/amendment-document";
import type { AmendmentType } from "@/lib/contracts/amendments";

export default async function AmendmentDocumentPage({
  params,
}: {
  params: Promise<{ id: string; aid: string }>;
}) {
  const { id: contractId, aid } = await params;

  let agencyId: string;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    agencyId = requireAgencyId(session);
  } catch (e) {
    if (e instanceof AgencyAccessError) notFound();
    throw e;
  }

  const [currentContract] = await db
    .select({
      id: contract.id,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      ownerId: contract.ownerId,
    })
    .from(contract)
    .where(and(eq(contract.id, contractId), eq(contract.agencyId, agencyId)))
    .limit(1);

  if (!currentContract) notFound();

  const [amendment] = await db
    .select()
    .from(contractAmendment)
    .where(
      and(
        eq(contractAmendment.id, aid),
        eq(contractAmendment.contractId, contractId),
        eq(contractAmendment.agencyId, agencyId)
      )
    )
    .limit(1);

  if (!amendment) notFound();

  // Owner, primary tenant, agency name, typeSeqNumber — fetched in parallel
  const [ownerRow, tenantLink, agencyRow, allOfSameType] = await Promise.all([
    db
      .select({
        firstName: client.firstName,
        lastName: client.lastName,
        dni: client.dni,
      })
      .from(client)
      .where(
        and(
          eq(client.id, currentContract.ownerId),
          eq(client.agencyId, agencyId)
        )
      )
      .limit(1),
    db
      .select({ clientId: contractParticipant.clientId })
      .from(contractParticipant)
      .where(
        and(
          eq(contractParticipant.contractId, contractId),
          eq(contractParticipant.role, "tenant")
        )
      )
      .limit(1),
    db
      .select({ name: agency.name })
      .from(agency)
      .where(eq(agency.id, agencyId))
      .limit(1),
    db
      .select({ seq: contractAmendment.sequenceNumber })
      .from(contractAmendment)
      .where(
        and(
          eq(contractAmendment.contractId, contractId),
          eq(contractAmendment.type, amendment.type)
        )
      ),
  ]);

  let tenant: AmendmentDocumentProps["tenant"] = null;
  if (tenantLink[0]?.clientId) {
    const [tenantRow] = await db
      .select({
        firstName: client.firstName,
        lastName: client.lastName,
      })
      .from(client)
      .where(
        and(
          eq(client.id, tenantLink[0].clientId),
          eq(client.agencyId, agencyId)
        )
      )
      .limit(1);
    if (tenantRow) tenant = tenantRow;
  }

  const typeSeqNumber = allOfSameType.filter(
    (r) => r.seq <= amendment.sequenceNumber
  ).length;

  const owner: AmendmentDocumentProps["owner"] = ownerRow[0]
    ? {
        firstName: ownerRow[0].firstName,
        lastName: ownerRow[0].lastName,
        dni: ownerRow[0].dni,
      }
    : null;

  const agencyName = agencyRow[0]?.name ?? "Administradora";

  return (
    <AmendmentDocument
      amendment={{
        type: amendment.type as AmendmentType,
        description: amendment.description,
        effectiveDate: amendment.effectiveDate,
        sequenceNumber: amendment.sequenceNumber,
        typeSeqNumber,
        fieldsChanged:
          (amendment.fieldsChanged ?? {}) as Record<
            string,
            { before: unknown; after: unknown }
          >,
      }}
      contract={{
        contractNumber: currentContract.contractNumber,
        startDate: currentContract.startDate,
      }}
      owner={owner}
      tenant={tenant}
      agencyName={agencyName}
    />
  );
}
