type AgencyHeaderData = {
  name: string;
  cuit: string | null;
  vatStatus: string | null;
  fiscalAddress: string | null;
  city: string | null;
  phone: string | null;
  contactEmail: string | null;
  licenseNumber: string | null;
  professionalAssociation: string | null;
  grossIncome: string | null;
  activityStart: string | null;
  logoUrl: string | null;
};

type PaperHeaderProps = {
  agency: AgencyHeaderData;
  receiptType: string; // "RECIBO C", "RECIBO X", "LIQUIDACIÓN"
  numero: string;       // "0001 - 00000241"
  fechaEmision: string; // "30/04/2026"
};

export function PaperHeader({ agency, receiptType, numero, fechaEmision }: PaperHeaderProps) {
  return (
    <div className="relative z-[2] flex gap-[18px] items-start pb-[18px] border-b-2 border-[#1a1614]">
      {agency.logoUrl ? (
        <img src={agency.logoUrl} alt={agency.name} className="size-[60px] rounded-[10px] object-cover flex-none" />
      ) : (
        <div className="size-[60px] rounded-[10px] bg-gradient-to-br from-[#e85a3c] to-[#c03c1f] text-white grid place-items-center font-bold text-[26px] flex-none">
          {agency.name[0]?.toUpperCase() ?? "A"}
        </div>
      )}
      <div className="flex-1">
        <div className="text-[18px] font-bold tracking-[-.01em]">{agency.name}</div>
        {agency.cuit && <div className="text-[11px] text-[#5a514c] mt-[2px] font-mono">CUIT {agency.cuit}{agency.vatStatus ? ` · ${agency.vatStatus}` : ""}</div>}
        {agency.fiscalAddress && <div className="text-[11px] text-[#5a514c] mt-[2px]">{agency.fiscalAddress}{agency.city ? ` · ${agency.city}` : ""}</div>}
        {(agency.phone || agency.contactEmail) && (
          <div className="text-[11px] text-[#5a514c] mt-[2px]">{[agency.phone && `Tel. ${agency.phone}`, agency.contactEmail].filter(Boolean).join(" · ")}</div>
        )}
        {agency.grossIncome && <div className="text-[11px] text-[#5a514c] mt-[2px] font-mono">IIBB {agency.grossIncome}{agency.activityStart ? ` · Inicio ${agency.activityStart}` : ""}</div>}
      </div>
      <div className="text-right">
        <div className="inline-block px-[10px] py-[2px] border-[1.5px] border-[#1a1614] rounded-[4px] text-[10px] font-bold tracking-[.1em] mb-[6px]">{receiptType}</div>
        <div className="font-mono text-[15px] font-bold">{numero}</div>
        {agency.licenseNumber && <>
          <div className="text-[9.5px] text-[#5a514c] uppercase tracking-[.06em] mt-[6px]">Mat. Profesional</div>
          <div className="font-mono text-[11px] font-medium">{agency.professionalAssociation ? `${agency.professionalAssociation} · ` : ""}{agency.licenseNumber}</div>
        </>}
        <div className="text-[9.5px] text-[#5a514c] uppercase tracking-[.06em] mt-[6px]">Fecha emisión</div>
        <div className="font-mono text-[11px] font-medium">{fechaEmision}</div>
      </div>
    </div>
  );
}
