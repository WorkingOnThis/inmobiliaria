"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type Recipient = { name: string; email: string | null };

type Props = { recipients: Recipient[] };

export function SideRecipients({ recipients }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Destinatarios</h3>
      <div className="bg-surface-mid border border-border rounded-[10px] p-3.5 flex flex-col gap-2.5">
        {recipients.length === 0 && <div className="text-[11px] text-muted-foreground italic">Sin destinatarios</div>}
        {recipients.map((r, i) => (
          <div key={i} className={i > 0 ? "pt-2.5 border-t border-border/50" : ""}>
            <div className="text-[12.5px] font-medium text-on-surface mb-1">{r.name}</div>
            {r.email
              ? <div className="font-mono text-[11.5px] text-muted-foreground">{r.email}</div>
              : <div className="text-[11px] text-muted-foreground italic">Sin email registrado</div>}
          </div>
        ))}
        <Button variant="outline" size="sm" className="mt-1 w-full justify-center gap-1.5" onClick={() => toast.info("Próximamente")}>
          <Mail size={13} /> + Agregar copia (CC)
        </Button>
      </div>
    </div>
  );
}
