type Props = {
  bank: { nombre: string | null; titular: string | null; cbu: string | null; alias: string | null };
  signatory: { nombre: string | null; cargo: string | null; signatureUrl?: string | null };
  clauses: string[];
  showQR?: boolean;
};

export function PaperFooter({ bank, signatory, clauses, showQR = true }: Props) {
  return (
    <>
      {(bank.cbu || bank.alias) && (
        <div className="mt-[24px] flex justify-between items-end relative z-[2]">
          <div className="text-[10px] text-[#5a514c]">
            <div className="text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] mb-[6px]">Transferencia a</div>
            {bank.nombre && <div><b className="text-[#1a1614]">{bank.nombre}</b></div>}
            {bank.titular && <div>Titular: {bank.titular}</div>}
            {bank.cbu && <div>CBU: <b className="text-[#1a1614] font-mono font-medium">{bank.cbu}</b></div>}
            {bank.alias && <div>Alias: <b className="text-[#1a1614] font-mono font-medium">{bank.alias}</b></div>}
          </div>
          {signatory.nombre && (
            <div className="w-[200px] text-center">
              {signatory.signatureUrl
                ? <img src={signatory.signatureUrl} alt="firma" className="max-h-[40px] mx-auto" />
                : <div style={{ fontFamily: '"Brush Script MT", cursive' }} className="text-[26px] -rotate-3 mb-[2px]">{signatory.nombre}</div>}
              <div className="border-t border-[#1a1614] pt-[6px] text-[9.5px] text-[#5a514c] uppercase tracking-[.08em]">{signatory.nombre}{signatory.cargo ? ` · ${signatory.cargo}` : ""}</div>
            </div>
          )}
        </div>
      )}
      <div className="mt-[40px] pt-[18px] border-t border-[#d9d1c3] relative z-[2] grid grid-cols-[1fr_180px] gap-[24px]">
        <div className="text-[9.5px] text-[#5a514c] leading-[1.55]">
          {clauses.map((c, i) => <div key={i} className="py-[3px]">{i + 1}. {c}</div>)}
        </div>
        {showQR && (
          <div>
            <div aria-hidden="true" className="w-[100px] h-[100px] ml-auto border-2 border-[#1a1614] bg-[#f7f5ef] relative" style={{
              backgroundImage: "linear-gradient(90deg, #1a1614 0 2px, transparent 2px 6px), linear-gradient(0deg, #1a1614 0 2px, transparent 2px 6px)",
              backgroundSize: "6px 6px",
            }} />
            <div className="text-[9px] text-center mt-[4px] text-[#5a514c] uppercase tracking-[.08em]">QR transferencia</div>
          </div>
        )}
      </div>
    </>
  );
}
