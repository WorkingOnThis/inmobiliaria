"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = { name: string; email: string | null };

export function SideRecipients({ name, email }: Props) {
  return (
    <div>
      <h3 className="text-[12px] text-muted-foreground uppercase tracking-[.08em] font-semibold mb-3">Destinatarios</h3>
      <div className="bg-surface-mid border border-border rounded-[10px] p-3.5">
        <div className="text-[12.5px] font-medium text-on-surface mb-1">{name}</div>
        {email
          ? <div className="font-mono text-[11.5px] text-muted-foreground">{email}</div>
          : <div className="text-[11px] text-muted-foreground italic">Sin email registrado</div>}
        <Button variant="outline" size="sm" className="mt-2.5 w-full justify-center gap-1.5" onClick={() => toast.info("Próximamente")}>
          <Mail size={13} /> + Agregar copia (CC)
        </Button>
      </div>
    </div>
  );
}
