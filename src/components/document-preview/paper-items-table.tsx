export type PaperItem = {
  fecha: string;       // "01/04/2026"
  concepto: string;
  meta?: string;       // "Av. Rivadavia 4210, 3ºB · Inq. M. Torres"
  importe: number;     // signed
};

import { formatARS } from "./format";

type Props = {
  title?: string;
  items: PaperItem[];
};

export function PaperItemsTable({ title = "Detalle de movimientos", items }: Props) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-[.1em] text-[#5a514c] font-bold mt-[22px] mb-[8px] relative z-[2]">{title}</div>
      <table className="w-full border-collapse mt-[8px] relative z-[2] text-[11px]">
        <thead>
          <tr>
            <th className="text-left p-[8px_6px] text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] font-bold border-b-[1.5px] border-[#1a1614] w-[76px]">Fecha</th>
            <th className="text-left p-[8px_6px] text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] font-bold border-b-[1.5px] border-[#1a1614]">Concepto</th>
            <th className="text-right p-[8px_6px] text-[9.5px] uppercase tracking-[.08em] text-[#5a514c] font-bold border-b-[1.5px] border-[#1a1614] w-[110px]">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="p-[7px_6px] border-b border-dashed border-[#d9d1c3] align-top font-mono text-[#5a514c] text-[10.5px] whitespace-nowrap">{it.fecha}</td>
              <td className="p-[7px_6px] border-b border-dashed border-[#d9d1c3] align-top">
                {it.concepto}
                {it.meta && <div className="text-[10px] text-[#5a514c] mt-[2px]">{it.meta}</div>}
              </td>
              <td className={`p-[7px_6px] border-b border-dashed border-[#d9d1c3] align-top text-right font-mono whitespace-nowrap ${it.importe >= 0 ? "text-[#2a6a3a]" : "text-[#9a2a1a]"}`}>
                {it.importe >= 0 ? "+ " : "− "}{formatARS(it.importe)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
