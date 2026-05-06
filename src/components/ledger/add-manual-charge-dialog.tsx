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

const INITIAL_FLAGS = defaultFlagsForTipo("gasto");

export type ManualChargeData = {
  tipo: "gasto" | "servicio" | "bonificacion" | "descuento";
  descripcion: string;
  monto: number;
  period?: string;
  impactaPropietario: boolean;
  incluirEnBaseComision: boolean;
  impactaCaja: boolean;
  beneficiario?: "propietario" | "administracion";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ManualChargeData) => Promise<void>;
  isSplitContract?: boolean;
};

export function AddManualChargeDialog({ open, onOpenChange, onSave, isSplitContract }: Props) {
  const [tipo, setTipo] = useState<ManualChargeData["tipo"]>("gasto");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [period, setPeriod] = useState("");
  const [impactaPropietario, setImpactaPropietario] = useState(INITIAL_FLAGS.impactaPropietario);
  const [incluirEnBaseComision, setIncluirEnBaseComision] = useState(INITIAL_FLAGS.incluirEnBaseComision);
  const [impactaCaja, setImpactaCaja] = useState(INITIAL_FLAGS.impactaCaja);
  const [beneficiario, setBeneficiario] = useState<"propietario" | "administracion">("propietario");
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
    setImpactaPropietario(INITIAL_FLAGS.impactaPropietario);
    setIncluirEnBaseComision(INITIAL_FLAGS.incluirEnBaseComision);
    setImpactaCaja(INITIAL_FLAGS.impactaCaja);
    setBeneficiario("propietario");
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
        ...(isSplitContract && { beneficiario }),
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
            <Label className="text-xs text-muted-foreground">Tipo</Label>
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
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: arreglo de cañería"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Monto ($)</Label>
            <Input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              type="text"
              inputMode="decimal"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Período (opcional)</Label>
            <Input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              className="h-9"
            />
          </div>
          {isSplitContract && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">¿A quién va este cargo?</Label>
              <Select
                value={beneficiario}
                onValueChange={(v) => setBeneficiario(v as "propietario" | "administracion")}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="propietario">↗ Propietario</SelectItem>
                  <SelectItem value="administracion">↗ Administración</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
