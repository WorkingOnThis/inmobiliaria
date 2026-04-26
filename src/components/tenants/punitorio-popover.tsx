"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  parentId: string;
  alquilerMonto: number;
  dueDate: string | null;
  onConfirm: (monto: number, descripcion: string) => void;
};

const TIM_MENSUAL = 0.04;

function calcDaysMora(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function PunitorioPopover({ parentId, alquilerMonto, dueDate, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const daysMora = calcDaysMora(dueDate);
  const suggested = alquilerMonto * (TIM_MENSUAL / 30) * daysMora;

  function handleOpen() {
    setMonto(suggested > 0 ? suggested.toFixed(2) : "");
    setDescripcion(`Punitorio TIM (${daysMora} días mora)`);
    setOpen(true);
  }

  function handleConfirm() {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return;
    onConfirm(montoNum, descripcion);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleOpen}
          className="text-xs text-primary hover:underline whitespace-nowrap"
        >
          + Punitorio
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Agregar punitorio</div>
          <div className="text-xs text-muted-foreground">
            {daysMora > 0
              ? `${daysMora} días en mora · TIM ${(TIM_MENSUAL * 100).toFixed(1)}%/mes`
              : "Sin días en mora — ingresá monto manual"}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto ($)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={suggested > 0 ? suggested.toFixed(2) : "0.00"}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
