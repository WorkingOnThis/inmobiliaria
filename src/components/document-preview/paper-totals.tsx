import { formatARS } from "./format";

export type TotalLine = { label: string; value: number; sign?: "+" | "−" };

type Props = {
  lines: TotalLine[];
  total: { label: string; value: number };
};

export function PaperTotals({ lines, total }: Props) {
  return (
    <div className="mt-[16px] ml-auto w-[45%] relative z-[2]">
      {lines.map((ln, i) => (
        <div key={i} className="flex justify-between items-center py-[6px] text-[12px] border-b border-dotted border-[#d9d1c3]">
          <span className="text-[#5a514c]">{ln.label}</span>
          <span className="font-mono font-medium">{ln.sign ?? (ln.value >= 0 ? "+ " : "− ")}{formatARS(ln.value)}</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-[12px] mt-[6px] border-t-2 border-[#1a1614] text-[15px] font-bold">
        <span className="text-[#5a514c]">{total.label}</span>
        <span className="font-mono text-[17px] text-[#e85a3c]">$ {formatARS(total.value)}</span>
      </div>
    </div>
  );
}
