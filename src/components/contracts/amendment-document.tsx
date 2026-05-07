import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AMENDMENT_TYPE_LABELS,
  FIELD_LABELS,
  type AmendmentType,
} from "@/lib/contracts/amendments";

function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value) + "T00:00:00");
  return format(d, "dd/MM/yyyy", { locale: es });
}

function fmtValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (field === "monthlyAmount") return `$${Number(value).toLocaleString("es-AR")}`;
  if (field === "paymentModality")
    return value === "A" ? "Modalidad A (inmobiliaria)" : "Pago dividido (split)";
  if (field === "startDate" || field === "endDate") return fmtDate(value);
  return String(value);
}

export interface AmendmentDocumentProps {
  amendment: {
    type: AmendmentType;
    description: string | null;
    effectiveDate: string | null;
    sequenceNumber: number;
    typeSeqNumber: number;
    fieldsChanged: Record<string, { before: unknown; after: unknown }>;
  };
  contract: {
    contractNumber: string;
    startDate: string;
  };
  owner: {
    firstName: string;
    lastName: string | null;
    dni: string | null;
  } | null;
  tenant: {
    firstName: string;
    lastName: string | null;
  } | null;
  agencyName: string;
}

const STYLES = `
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #111; line-height: 1.7; font-size: 14px; background: #fff; }
  .amendment-doc h1 { font-size: 1rem; text-align: center; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.2rem; }
  .amendment-doc .subtitle { text-align: center; font-size: 0.85rem; color: #555; margin-bottom: 2rem; }
  .amendment-doc .parties { border: 1px solid #ccc; padding: 1rem 1.25rem; margin-bottom: 2rem; border-radius: 4px; font-size: 0.88rem; }
  .amendment-doc .parties p { margin: 0.3rem 0; }
  .amendment-doc .body-text { margin-bottom: 2.5rem; font-size: 0.9rem; }
  .amendment-doc .body-text ul { padding-left: 1.5rem; }
  .amendment-doc .body-text li { margin: 0.4rem 0; }
  .amendment-doc .body-text p { margin: 0.6rem 0; }
  .amendment-doc .lugar-fecha { font-size: 0.82rem; color: #666; margin-top: 3rem; }
  .amendment-doc .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2rem; margin-top: 5rem; }
  .amendment-doc .sig-block { border-top: 1px solid #111; padding-top: 0.5rem; font-size: 0.8rem; text-align: center; }
  .amendment-doc .sig-block .name { font-weight: bold; margin-top: 0.3rem; }
  @media print { body { margin: 20px; } }
`;

function ownerFullName(
  owner: AmendmentDocumentProps["owner"]
): string {
  if (!owner) return "—";
  return `${owner.firstName} ${owner.lastName ?? ""}`.trim() || "—";
}

function tenantFullName(
  tenant: AmendmentDocumentProps["tenant"]
): string {
  if (!tenant) return "—";
  return `${tenant.firstName} ${tenant.lastName ?? ""}`.trim() || "—";
}

function AmendmentBody({
  type,
  description,
  effectiveDate,
  fieldsChanged,
}: {
  type: AmendmentType;
  description: string | null;
  effectiveDate: string | null;
  fieldsChanged: Record<string, { before: unknown; after: unknown }>;
}) {
  const efDate = effectiveDate ? fmtDate(effectiveDate) : "";

  switch (type) {
    case "erratum":
      return (
        <>
          {Object.entries(fieldsChanged).map(([field, { before, after }]) => (
            <p key={field}>
              En cuanto a <strong>{FIELD_LABELS[field] ?? field}</strong>:
              <br />
              Donde dice: <em>&quot;{fmtValue(field, before)}&quot;</em>
              <br />
              Debe leerse: <em>&quot;{fmtValue(field, after)}&quot;</em>
            </p>
          ))}
          <p>Las demás cláusulas del contrato permanecen inalteradas.</p>
        </>
      );

    case "modification":
      return (
        <>
          <p>
            Las partes acuerdan modificar las siguientes condiciones, con
            vigencia a partir del <strong>{efDate}</strong>:
          </p>
          <ul>
            {Object.entries(fieldsChanged).map(([field, { before, after }]) => (
              <li key={field}>
                <strong>{FIELD_LABELS[field] ?? field}:</strong>{" "}
                {fmtValue(field, before)} → {fmtValue(field, after)}
              </li>
            ))}
          </ul>
          <p>Las demás cláusulas permanecen inalteradas.</p>
        </>
      );

    case "extension": {
      const newEnd = fieldsChanged["endDate"]
        ? fmtValue("endDate", fieldsChanged["endDate"].after)
        : "—";
      const newAmtRaw = fieldsChanged["monthlyAmount"]?.after;
      const hasNewAmt = newAmtRaw !== undefined && newAmtRaw !== null;
      return (
        <>
          <p>
            Las partes acuerdan prorrogar el contrato hasta el{" "}
            <strong>{newEnd}</strong>
            {hasNewAmt && (
              <>
                , con un canon mensual de{" "}
                <strong>
                  ${Number(newAmtRaw).toLocaleString("es-AR")}
                </strong>
              </>
            )}
            , a partir del <strong>{efDate}</strong>.
          </p>
          <p>Las demás condiciones permanecen inalteradas.</p>
        </>
      );
    }

    case "termination":
      return (
        <>
          <p>
            Las partes acuerdan dar por rescindido el contrato a partir del{" "}
            <strong>{efDate}</strong>, comprometiéndose la parte locataria a la
            entrega del inmueble en dicha fecha.
          </p>
          {description && <p>{description}</p>}
        </>
      );

    case "guarantee_substitution":
      return (
        <>
          <p>
            Las partes acuerdan sustituir la garantía original conforme lo
            siguiente:
          </p>
          <p>{description ?? ""}</p>
        </>
      );

    case "index_change": {
      const oldIdx = fmtValue(
        "adjustmentIndex",
        fieldsChanged["adjustmentIndex"]?.before
      );
      const newIdx = fmtValue(
        "adjustmentIndex",
        fieldsChanged["adjustmentIndex"]?.after
      );
      return (
        <p>
          Las partes acuerdan reemplazar el índice de ajuste{" "}
          <strong>{oldIdx}</strong> por <strong>{newIdx}</strong>, con vigencia
          a partir del <strong>{efDate}</strong>.
        </p>
      );
    }

    default:
      return <p>{description ?? ""}</p>;
  }
}

export function AmendmentDocument({
  amendment,
  contract,
  owner,
  tenant,
  agencyName,
}: AmendmentDocumentProps) {
  const typeLabel =
    AMENDMENT_TYPE_LABELS[amendment.type] ?? amendment.type;
  const ownerName = ownerFullName(owner);
  const ownerDni = owner?.dni ?? "—";
  const tenantName = tenantFullName(tenant);
  const startFormatted = fmtDate(contract.startDate);

  return (
    <>
      <style>{STYLES}</style>
      <div className="amendment-doc">
        <h1>
          {typeLabel} N°{amendment.typeSeqNumber}
        </h1>
        <p className="subtitle">
          Contrato {contract.contractNumber} — Celebrado el {startFormatted}
        </p>

        <div className="parties">
          <p>
            <strong>Parte Locadora:</strong> {ownerName} · DNI {ownerDni}
          </p>
          <p>
            <strong>Parte Locataria:</strong> {tenantName}
          </p>
          <p>
            <strong>Administradora:</strong> {agencyName}
          </p>
        </div>

        <div className="body-text">
          <AmendmentBody
            type={amendment.type}
            description={amendment.description}
            effectiveDate={amendment.effectiveDate}
            fieldsChanged={amendment.fieldsChanged}
          />
        </div>

        <p className="lugar-fecha">
          Lugar y fecha: _________________, ___ de _________ de _____
        </p>

        <div className="signatures">
          <div className="sig-block">
            <br />
            <br />
            <br />
            <div className="name">PARTE LOCADORA</div>
            <div>{ownerName}</div>
          </div>
          <div className="sig-block">
            <br />
            <br />
            <br />
            <div className="name">PARTE LOCATARIA</div>
            <div>{tenantName}</div>
          </div>
          <div className="sig-block">
            <br />
            <br />
            <br />
            <div className="name">{agencyName.toUpperCase()}</div>
          </div>
        </div>
      </div>
    </>
  );
}
