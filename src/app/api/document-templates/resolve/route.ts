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
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { canManageDocumentTemplates } from "@/lib/permissions";
import { formatAddress } from "@/lib/properties/format-address";
import { eq, and, inArray, or } from "drizzle-orm";
import {
  VARIABLES_CATALOG,
  type TemplateContext,
  type GuaranteeResolvedInfo,
} from "@/lib/document-templates/variables-catalog";

const isLegalRole = (role: string) => role === "legal" || role === "ambos";

// Maps list item keys to GuaranteeResolvedInfo fields — single source of truth for the mapping.
const GUARANTEE_KEY_MAP: [string, keyof GuaranteeResolvedInfo][] = [
  ["apellido_fiador_propietario",  "ownerLastName"],
  ["nombres_fiador_propietario",   "ownerFirstName"],
  ["dni_fiador_propietario",       "ownerDni"],
  ["cuil_fiador_propietario",      "ownerCuit"],
  ["domicilio_fiador_propietario", "ownerAddress"],
  ["email_fiador_propietario",     "ownerEmail"],
  ["telefono_fiador_propietario",  "ownerPhone"],
  ["matricula_inmueble_garantia",  "propertyRegistryNumber"],
  ["catastro_inmueble_garantia",   "propertyCadastralRef"],
  ["domicilio_inmueble_garantia",  "propertyAddress"],
  ["superficie_terreno_garantia",  "propertySurfaceLand"],
  ["superficie_cubierta_garantia", "propertySurfaceBuilt"],
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);
    if (!canManageDocumentTemplates(session!.user.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const contractId = request.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return NextResponse.json(
        { error: "contractId es requerido" },
        { status: 400 }
      );
    }

    const contractRow = (await requireAgencyResource(contract, contractId, agencyId)) as typeof contract.$inferSelect;

    // Round 1 — fetch everything in parallel, including the primary owner (contractRow.ownerId).
    // In the common case the primary owner IS the legal owner, so this avoids a second round-trip.
    const [
      propertyRow,
      primaryOwnerRow,
      coOwnerRows,
      agencyRow,
      tenantParticipants,
      guarantorParticipants,
      guaranteeRows,
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
        .where(eq(agency.id, agencyId))
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
      db
        .select({
          kind: guarantee.kind,
          propertyId: guarantee.propertyId,
          externalOwnerName: guarantee.externalOwnerName,
          externalOwnerDni: guarantee.externalOwnerDni,
          externalOwnerCuit: guarantee.externalOwnerCuit,
          externalOwnerAddress: guarantee.externalOwnerAddress,
          externalOwnerEmail: guarantee.externalOwnerEmail,
          externalOwnerPhone: guarantee.externalOwnerPhone,
          externalAddress: guarantee.externalAddress,
          externalCadastralRef: guarantee.externalCadastralRef,
          externalRegistryNumber: guarantee.externalRegistryNumber,
          externalSurfaceLand: guarantee.externalSurfaceLand,
          externalSurfaceBuilt: guarantee.externalSurfaceBuilt,
        })
        .from(guarantee)
        .where(eq(guarantee.contractId, contractId)),
    ]);

    // Determine the legal owner (Parte Locadora): whoever has role "legal" or "ambos".
    // Primary owner is already fetched; only fetch a co-owner client when the primary is "real".
    let legalOwnerId = contractRow.ownerId;
    if (propertyRow && !isLegalRole(propertyRow.ownerRole)) {
      const legalCo = coOwnerRows.find((co) => isLegalRole(co.role));
      if (legalCo) legalOwnerId = legalCo.clientId;
    }

    // Compute guarantee property IDs so their fetches can join Round 2.
    const realGuarantees = guaranteeRows.filter((g) => g.kind === "propertyOwner");
    const internalGuaranteePropertyIds = [
      ...new Set(realGuarantees.filter((g) => g.propertyId).map((g) => g.propertyId!)),
    ];

    // Round 2 — tenants, guarantors, legal co-owner (if needed), guarantee property data (if any).
    const needsCoOwnerFetch = legalOwnerId !== contractRow.ownerId;
    const [tenantRows, guarantorRows, coOwnerRow, linkedProperties, linkedCoOwners, roomRows, featureRows] =
      await Promise.all([
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
        internalGuaranteePropertyIds.length > 0
          ? db
              .select({
                id: property.id,
                ownerId: property.ownerId,
                ownerRole: property.ownerRole,
                addressStreet: property.addressStreet,
                addressNumber: property.addressNumber,
                floorUnit: property.floorUnit,
                cadastralRef: property.cadastralRef,
                registryNumber: property.registryNumber,
                surfaceLand: property.surfaceLand,
                surfaceBuilt: property.surfaceBuilt,
              })
              .from(property)
              .where(inArray(property.id, internalGuaranteePropertyIds))
          : Promise.resolve([] as {
              id: string; ownerId: string; ownerRole: string;
              addressStreet: string | null; addressNumber: string | null; floorUnit: string | null; cadastralRef: string | null;
              registryNumber: string | null; surfaceLand: string | null;
              surfaceBuilt: string | null;
            }[]),
        internalGuaranteePropertyIds.length > 0
          ? db
              .select({ propertyId: propertyCoOwner.propertyId, clientId: propertyCoOwner.clientId, role: propertyCoOwner.role })
              .from(propertyCoOwner)
              .where(
                and(
                  inArray(propertyCoOwner.propertyId, internalGuaranteePropertyIds),
                  or(eq(propertyCoOwner.role, "legal"), eq(propertyCoOwner.role, "ambos"))
                )
              )
          : Promise.resolve([] as { propertyId: string; clientId: string; role: string }[]),
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

    const ownerRow = needsCoOwnerFetch ? coOwnerRow : primaryOwnerRow;

    // Resolve real (propertyOwner) guarantees into GuaranteeResolvedInfo objects.
    let firstRealGuarantee: GuaranteeResolvedInfo | null = null;
    const garantiasRealesItems: Record<string, string | null>[] = [];

    if (realGuarantees.length > 0) {
      // Determine legal owner clientId per guarantee property
      const legalOwnerIdByPropertyId = new Map<string, string>();
      for (const p of linkedProperties) {
        if (isLegalRole(p.ownerRole)) {
          legalOwnerIdByPropertyId.set(p.id, p.ownerId);
        }
      }
      for (const co of linkedCoOwners) {
        if (!legalOwnerIdByPropertyId.has(co.propertyId)) {
          legalOwnerIdByPropertyId.set(co.propertyId, co.clientId);
        }
      }
      for (const p of linkedProperties) {
        if (!legalOwnerIdByPropertyId.has(p.id)) {
          legalOwnerIdByPropertyId.set(p.id, p.ownerId);
        }
      }

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
            propertyAddress: formatAddress({ addressStreet: prop.addressStreet ?? "", addressNumber: prop.addressNumber, floorUnit: prop.floorUnit }),
            propertyCadastralRef: prop.cadastralRef,
            propertyRegistryNumber: prop.registryNumber,
            propertySurfaceLand: prop.surfaceLand,
            propertySurfaceBuilt: prop.surfaceBuilt,
          };
        } else {
          // External guarantee — split name on last space to separate nombres from apellido.
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
        garantiasRealesItems.push(
          Object.fromEntries(GUARANTEE_KEY_MAP.map(([key, field]) => [key, info[field]]))
        );
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
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
