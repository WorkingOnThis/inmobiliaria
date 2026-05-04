"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { defaultFlagsForTipo } from "@/lib/ledger/flags";

const TIPOS_MANUAL = [
  { value: "gasto",        label: "Gasto" },
  { value: "servicio",     label: "Servicio" },
  { value: "bonificacion", label: "Bonificación" },
  { value: "descuento",    label: "Descuento" },
] as const;

export type ManualChargeData = {
  tipo: "gasto" | "servicio" | "bonificacion" | "descuento";
  descripcion: string;
  monto: number;
  period?: string;
  impactaPropietario: boolean;
  incluirEnBaseComision: boolean;
  impactaCaja: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ManualChargeData) => Promise<void>;
};

export function AddManualChargeDialog({ open, onOpenChange, onSave }: Props) {
  const initialFlags = defaultFlagsForTipo("gasto");
  const [tipo, setTipo] = useState<ManualChargeData["tipo"]>("gasto");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [period, setPeriod] = useState("");
  const [impactaPropietario, setImpactaPropietario] = useState(initialFlags.impactaPropietario);
  const [incluirEnBaseComision, setIncluirEnBaseComision] = useState(initialFlags.incluirEnBaseComision);
  const [impactaCaja, setImpactaCaja] = useState(initialFlags.impactaCaja);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleTipoChange(value: ManualChargeData["tipo"]) {
    setTipo(value);
    const f = defaultFlagsForTipo(value);
    setImpactaPropietario(f.impactaPropietario);
    setIncluirEnBaseComision(f.incluirEnBaseComision);
    setImpactaCaja(f.impactaCaja);
  }

  function reset() {
    setTipo("gasto");
    setDescripcion("");
    setMonto("");
    setPeriod("");
    const f = defaultFlagsForTipo("gasto");
    setImpactaPropietario(f.impactaPropietario);
    setIncluirEnBaseComision(f.incluirEnBaseComision);
    setImpactaCaja(f.impactaCaja);
    setError(null);
    setSaving(false);
  }

  async function handleSave() {
    const montoNum = parseFloat(monto.replace(/\./g, "").replace(",", "."));
    if (isNaN(montoNum) || montoNum <= 0) { setError("El monto debe ser un número positivo"); return; }
    if (!descripcion.trim()) { setError("La descripción es obligatoria"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        tipo,
        descripcion: descripcion.trim(),
        monto: montoNum,
        ...(period ? { period } : {}),
        impactaPropietario,
        incluirEnBaseComision,
        impactaCaja,
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cargo manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_MANUAL.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Descripción</label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: arreglo de cañería"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Monto ($)</label>
            <Input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              type="number"
              min="0"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período (opcional)</label>
            <Input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              className="h-9"
            />
          </div>
          <div className="border-t border-border pt-3 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contabilidad</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="m-flag-propietario" className="text-xs font-normal cursor-pointer">
                Impacta liquidación del propietario
              </Label>
              <Switch
                id="m-flag-propietario"
                checked={impactaPropietario}
                onCheckedChange={setImpactaPropietario}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="m-flag-comision" className="text-xs font-normal cursor-pointer">
                Incluir en base de honorarios
              </Label>
              <Switch
                id="m-flag-comision"
                checked={incluirEnBaseComision}
                onCheckedChange={setIncluirEnBaseComision}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="m-flag-caja" className="text-xs font-normal cursor-pointer">
                Impacta caja
              </Label>
              <Switch
                id="m-flag-caja"
                checked={impactaCaja}
                onCheckedChange={setImpactaCaja}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Agregar cargo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
