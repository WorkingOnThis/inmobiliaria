type MetaBlockProps = {
  leftLabel: string;
  leftValue: string;
  leftSub?: string[];
  rightLabel: string;
  rightValue: string;
  rightSub?: string[];
};

export function PaperMetaBlock({ leftLabel, leftValue, leftSub, rightLabel, rightValue, rightSub }: MetaBlockProps) {
  return (
    <div className="grid grid-cols-2 gap-[18px] mt-[20px] relative z-[2]">
      <div>
        <div className="text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] mb-[4px] font-semibold">{leftLabel}</div>
        <div className="text-[16px] font-bold">{leftValue}</div>
        {leftSub?.map((s, i) => <div key={i} className="text-[10.5px] text-[#5a514c] mt-[3px]">{s}</div>)}
      </div>
      <div className="text-right">
        <div className="text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] mb-[4px] font-semibold">{rightLabel}</div>
        <div className="text-[16px] font-bold">{rightValue}</div>
        {rightSub?.map((s, i) => <div key={i} className="text-[10.5px] text-[#5a514c] mt-[3px]">{s}</div>)}
      </div>
    </div>
  );
}
