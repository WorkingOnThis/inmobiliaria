"use client";

import Link from "next/link";
import { ArrowLeft, Printer, Download, Mail, Check, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  backHref: string;
  breadcrumb: { name: string; ref: string };
  isEmitido: boolean;
  zoom: number;
  onZoom: (delta: number) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onSendEmail: () => void;
  onConfirm: () => void;
  emailDisabled?: boolean;
  busyAction?: "print" | "email" | "confirm" | null;
};

export function PreviewTopbar({
  backHref, breadcrumb, isEmitido, zoom, onZoom,
  onPrint, onDownloadPdf, onSendEmail, onConfirm,
  emailDisabled, busyAction,
}: Props) {
  const lock = isEmitido || busyAction !== null;
  return (
    <div className="print:hidden sticky top-0 z-20 h-14 bg-surface border-b border-border flex items-center gap-3.5 px-6 flex-shrink-0">
      <Link href={backHref} className="size-8 rounded-[7px] border border-border bg-surface-mid flex items-center justify-center text-muted-foreground hover:text-on-surface transition-colors flex-shrink-0">
        <ArrowLeft size={14} />
      </Link>
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="text-on-surface">{breadcrumb.name}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-mono text-[11.5px] px-2 py-[2px] border border-border rounded-[4px] bg-surface-mid text-muted-foreground">{breadcrumb.ref}</span>
      </div>
      {!isEmitido
        ? <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.04em] px-2 py-[3px] rounded-full border ml-2.5 bg-warning/14 text-warning border-warning/25">
            <span className="size-1.5 rounded-full bg-current" />Borrador
          </span>
        : <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.04em] px-2 py-[3px] rounded-full border ml-2.5 bg-success/14 text-success border-success/25">
            <span className="size-1.5 rounded-full bg-current" />Emitida
          </span>}

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center rounded-[7px] border border-border bg-surface-mid overflow-hidden">
          <button onClick={() => onZoom(-0.1)} className="px-2 py-1.5 text-muted-foreground hover:text-on-surface hover:bg-surface transition-colors"><Minus size={13} /></button>
          <span className="px-2.5 py-1 font-mono text-[12px] border-x border-border text-on-surface select-none">{Math.round(zoom * 100)}%</span>
          <button onClick={() => onZoom(0.1)} className="px-2 py-1.5 text-muted-foreground hover:text-on-surface hover:bg-surface transition-colors"><Plus size={13} /></button>
        </div>
        <Button variant="ghost" size="sm" onClick={onPrint} disabled={lock} className="gap-1.5"><Printer size={14} /> Imprimir</Button>
        <Button variant="outline" size="sm" onClick={onDownloadPdf} disabled={lock} className="gap-1.5"><Download size={14} /> Descargar PDF</Button>
        <Button variant="outline" size="sm" onClick={onSendEmail} disabled={lock || emailDisabled} className="gap-1.5"><Mail size={14} /> Enviar por email</Button>
        {!isEmitido && (
          <Button size="sm" onClick={onConfirm} disabled={busyAction !== null} className={cn("gap-1.5 bg-primary text-primary-foreground hover:opacity-90")}>
            <Check size={14} /> Confirmar y emitir
          </Button>
        )}
      </div>
    </div>
  );
}
