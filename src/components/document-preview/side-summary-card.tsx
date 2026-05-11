import { cn } from "@/lib/utils";

export type SummaryRow = { label: string; value: string; mono?: boolean; cls?: string; bold?: boolean };

type Props = { title?: string; rows: SummaryRow[]; total: SummaryRow };

export function SideSummaryCard({ title = "Resumen", rows, total }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">{title}</h3>
      <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
        {rows.map((r, i) => <KVRow key={i} {...r} />)}
        <KVRow {...total} bold />
      </div>
    </div>
  );
}

function KVRow({ label, value, mono, cls, bold }: SummaryRow) {
  return (
    <div className={cn("flex justify-between py-1.5 text-[12.5px] border-b border-border/50 last:border-b-0", bold && "font-semibold pt-2.5 mt-1 border-t border-border border-b-0")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(mono && "font-mono tabular-nums", cls)}>{value}</span>
    </div>
  );
}
