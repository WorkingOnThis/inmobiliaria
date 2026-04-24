import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { contract } from "@/db/schema/contract";
import { contractParticipant } from "@/db/schema/contract-participant";
import { client } from "@/db/schema/client";
import { property } from "@/db/schema/property";
import { propertyCoOwner } from "@/db/schema/property-co-owner";
import { propertyRoom } from "@/db/schema/property-room";
import { propertyFeature } from "@/db/schema/property-feature";
import { propertyToFeature } from "@/db/schema/property-to-feature";
import { guarantee } from "@/db/schema/guarantee";
import { agency } from "@/db/schema/agency";
import { auth } from "@/lib/auth";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { eq, and, inArray, or } from "drizzle-orm";
import {
  VARIABLES_CATALOG,
  type TemplateContext,
  type GuaranteeResolvedInfo,
} from "@/lib/document-templates/variables-catalog";

const isLegalRole = (role: string) => role === "legal" || role === "ambos";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!canManageDocumentTemplates(session.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const contractId = request.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return NextResponse.json(
        { error: "contractId es requerido" },
        { status: 400 }
      );
    }

    const [contractRow] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    if (!contractRow) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    // Round 1 — fetch everything in parallel, including the primary owner (contractRow.ownerId).
    // In the common case the primary owner IS the legal owner, so this avoids a second round-trip.
    const [
      propertyRow,
      primaryOwnerRow,
      coOwnerRows,
      agencyRow,
      tenantParticipants,
      guarantorParticipants,
    ] = await Promise.all([
      db
        .select()
        .from(property)
        .where(eq(property.id, contractRow.propertyId))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select()
        .from(client)
        .where(eq(client.id, contractRow.ownerId))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({ clientId: propertyCoOwner.clientId, role: propertyCoOwner.role })
        .from(propertyCoOwner)
        .where(eq(propertyCoOwner.propertyId, contractRow.propertyId)),
      db
        .select()
        .from(agency)
        .where(eq(agency.ownerId, session.user.id))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({ clientId: contractParticipant.clientId })
        .from(contractParticipant)
        .where(
          and(
            eq(contractParticipant.contractId, contractId),
            eq(contractParticipant.role, "tenant")
          )
        ),
      db
        .select({ clientId: contractParticipant.clientId })
        .from(contractParticipant)
        .where(
          and(
            eq(contractParticipant.contractId, contractId),
            eq(contractParticipant.role, "guarantor")
          )
        ),
    ]);

    // Determine the legal owner (Parte Locadora): whoever has role "legal" or "ambos".
    // Primary owner is already fetched; only fetch a co-owner client when the primary is "real".
    let legalOwnerId = contractRow.ownerId;
    if (propertyRow && !isLegalRole(propertyRow.ownerRole)) {
      const legalCo = coOwnerRows.find((co) => isLegalRole(co.role));
      if (legalCo) legalOwnerId = legalCo.clientId;
    }

    // Round 2 — tenants, guarantors, and (only if needed) the legal co-owner client
    const needsCoOwnerFetch = legalOwnerId !== contractRow.ownerId;
    const [tenantRows, guarantorRows, coOwnerRow] = await Promise.all([
      tenantParticipants.length > 0
        ? db
            .select()
            .from(client)
            .where(inArray(client.id, tenantParticipants.map((p) => p.clientId)))
        : Promise.resolve([]),
      guarantorParticipants.length > 0
        ? db
            .select()
            .from(client)
            .where(inArray(client.id, guarantorParticipants.map((p) => p.clientId)))
        : Promise.resolve([]),
      needsCoOwnerFetch
        ? db
            .select()
            .from(client)
            .where(eq(client.id, legalOwnerId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
    ]);

    const ownerRow = needsCoOwnerFetch ? coOwnerRow : primaryOwnerRow;

    // Round 3 — guarantees, rooms, features (all in parallel)
    const [guaranteeRows, roomRows, featureRows] = await Promise.all([
      db.select().from(guarantee).where(eq(guarantee.contractId, contractId)),
      propertyRow
        ? db
            .select({ id: propertyRoom.id, name: propertyRoom.name, description: propertyRoom.description })
            .from(propertyRoom)
            .where(eq(propertyRoom.propertyId, propertyRow.id))
            .orderBy(propertyRoom.position)
        : Promise.resolve([] as { id: string; name: string; description: string }[]),
      propertyRow
        ? db
            .select({ name: propertyFeature.name })
            .from(propertyFeature)
            .innerJoin(propertyToFeature, eq(propertyToFeature.featureId, propertyFeature.id))
            .where(eq(propertyToFeature.propertyId, propertyRow.id))
        : Promise.resolve([] as { name: string }[]),
    ]);

    // Resolve first real (propertyOwner) guarantee into GuaranteeResolvedInfo
    const realGuarantees = guaranteeRows.filter((g) => g.kind === "propertyOwner");
    let firstRealGuarantee: GuaranteeResolvedInfo | null = null;

    type GuaranteeListItem = Record<string, string | null>;
    const garantiasRealesItems: GuaranteeListItem[] = [];

    if (realGuarantees.length > 0) {
      // Fetch linked properties and their legal owners in parallel
      const internalIds = [...new Set(realGuarantees.filter((g) => g.propertyId).map((g) => g.propertyId!))];

      const [linkedProperties, linkedCoOwners] = await Promise.all([
        internalIds.length > 0
          ? db
              .select({
                id: property.id,
                ownerId: property.ownerId,
                ownerRole: property.ownerRole,
                address: property.address,
                cadastralRef: property.cadastralRef,
                registryNumber: property.registryNumber,
                surfaceLand: property.surfaceLand,
                surfaceBuilt: property.surfaceBuilt,
              })
              .from(property)
              .where(inArray(property.id, internalIds))
          : Promise.resolve([] as {
              id: string; ownerId: string; ownerRole: string;
              address: string | null; cadastralRef: string | null;
              registryNumber: string | null; surfaceLand: string | null;
              surfaceBuilt: string | null;
            }[]),
        internalIds.length > 0
          ? db
              .select({ propertyId: propertyCoOwner.propertyId, clientId: propertyCoOwner.clientId, role: propertyCoOwner.role })
              .from(propertyCoOwner)
              .where(
                and(
                  inArray(propertyCoOwner.propertyId, internalIds),
                  or(eq(propertyCoOwner.role, "legal"), eq(propertyCoOwner.role, "ambos"))
                )
              )
          : Promise.resolve([] as { propertyId: string; clientId: string; role: string }[]),
      ]);

      // Determine legal owner clientId per property
      const legalOwnerIdByPropertyId = new Map<string, string>();
      for (const p of linkedProperties) {
        if (p.ownerRole === "legal" || p.ownerRole === "ambos") {
          legalOwnerIdByPropertyId.set(p.id, p.ownerId);
        }
      }
      for (const co of linkedCoOwners) {
        if (!legalOwnerIdByPropertyId.has(co.propertyId)) {
          legalOwnerIdByPropertyId.set(co.propertyId, co.clientId);
        }
      }
      // Fallback to primary owner if still missing
      for (const p of linkedProperties) {
        if (!legalOwnerIdByPropertyId.has(p.id)) {
          legalOwnerIdByPropertyId.set(p.id, p.ownerId);
        }
      }

      // Fetch all needed clients in one query
      const ownerClientIds = [...new Set([...legalOwnerIdByPropertyId.values()])];
      const linkedOwnerClients = ownerClientIds.length > 0
        ? await db
            .select({ id: client.id, firstName: client.firstName, lastName: client.lastName, dni: client.dni, cuit: client.cuit, address: client.address, email: client.email, phone: client.phone })
            .from(client)
            .where(inArray(client.id, ownerClientIds))
        : [];

      const clientById = new Map(linkedOwnerClients.map((c) => [c.id, c]));
      const propertyById = new Map(linkedProperties.map((p) => [p.id, p]));

      for (const g of realGuarantees) {
        let info: GuaranteeResolvedInfo;

        if (g.propertyId && propertyById.has(g.propertyId)) {
          const prop = propertyById.get(g.propertyId)!;
          const ownerId = legalOwnerIdByPropertyId.get(g.propertyId);
          const owner = ownerId ? clientById.get(ownerId) : undefined;
          info = {
            ownerFirstName: owner?.firstName ?? null,
            ownerLastName: owner?.lastName ?? null,
            ownerDni: owner?.dni ?? null,
            ownerCuit: owner?.cuit ?? null,
            ownerAddress: owner?.address ?? null,
            ownerEmail: owner?.email ?? null,
            ownerPhone: owner?.phone ?? null,
            propertyAddress: prop.address,
            propertyCadastralRef: prop.cadastralRef,
            propertyRegistryNumber: prop.registryNumber,
            propertySurfaceLand: prop.surfaceLand,
            propertySurfaceBuilt: prop.surfaceBuilt,
          };
        } else {
          // External guarantee — split name heuristically on last space
          const extName = g.externalOwnerName ?? "";
          const lastSpace = extName.lastIndexOf(" ");
          info = {
            ownerFirstName: lastSpace > 0 ? extName.slice(0, lastSpace) : extName || null,
            ownerLastName: lastSpace > 0 ? extName.slice(lastSpace + 1) : null,
            ownerDni: g.externalOwnerDni,
            ownerCuit: g.externalOwnerCuit,
            ownerAddress: g.externalOwnerAddress,
            ownerEmail: g.externalOwnerEmail,
            ownerPhone: g.externalOwnerPhone,
            propertyAddress: g.externalAddress,
            propertyCadastralRef: g.externalCadastralRef,
            propertyRegistryNumber: g.externalRegistryNumber,
            propertySurfaceLand: g.externalSurfaceLand,
            propertySurfaceBuilt: g.externalSurfaceBuilt,
          };
        }

        if (!firstRealGuarantee) firstRealGuarantee = info;

        garantiasRealesItems.push({
          apellido_fiador_propietario: info.ownerLastName,
          nombres_fiador_propietario: info.ownerFirstName,
          dni_fiador_propietario: info.ownerDni,
          cuil_fiador_propietario: info.ownerCuit,
          domicilio_fiador_propietario: info.ownerAddress,
          email_fiador_propietario: info.ownerEmail,
          telefono_fiador_propietario: info.ownerPhone,
          matricula_inmueble_garantia: info.propertyRegistryNumber,
          catastro_inmueble_garantia: info.propertyCadastralRef,
          domicilio_inmueble_garantia: info.propertyAddress,
          superficie_terreno_garantia: info.propertySurfaceLand,
          superficie_cubierta_garantia: info.propertySurfaceBuilt,
        });
      }
    }

    // Build iterable lists for [[for:entidad]] blocks
    const lists: Record<string, Record<string, string | null>[]> = {
      ambientes: roomRows.map((r) => ({ nombre: r.name, descripcion: r.description })),
      artefactos: featureRows.map((f) => ({ nombre: f.name })),
      fiadores: guarantorRows.map((g) => ({
        apellido_fiador: g.lastName ?? null,
        nombres_fiador: g.firstName ?? null,
        dni_fiador: g.dni ?? null,
        cuil_fiador: g.cuit ?? null,
        domicilio_fiador: g.address ?? null,
        email_fiador: g.email ?? null,
        telefono_fiador: g.phone ?? null,
      })),
      inquilinos: tenantRows.map((t) => ({
        apellido_locatario: t.lastName ?? null,
        nombres_locatario: t.firstName ?? null,
        dni_locatario: t.dni ?? null,
        cuit_locatario: t.cuit ?? null,
        domicilio_locatario: t.address ?? null,
        email_locatario: t.email ?? null,
        telefono_locatario: t.phone ?? null,
      })),
      garantias_reales: garantiasRealesItems,
    };

    const ctx: TemplateContext = {
      property: propertyRow,
      owner: ownerRow,
      tenants: tenantRows,
      guarantors: guarantorRows,
      contract: contractRow,
      agency: agencyRow,
      firstRealGuarantee,
    };

    const resolved: Record<string, string | null> = {};
    for (const variable of VARIABLES_CATALOG) {
      resolved[variable.path] = variable.resolver(ctx);
    }

    return NextResponse.json({ resolved, lists });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
