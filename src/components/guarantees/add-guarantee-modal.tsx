"use client";

import { useState, useEffect, useRef } from "react";
import { Building2, Banknote, User, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GUARANTEE_KIND_LABELS, type GuaranteeKind } from "@/lib/guarantees/constants";

const inputCls =
  "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[0.82rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-muted-foreground";
const labelCls =
  "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5 block";

type KindStep = "select" | GuaranteeKind;

interface PropertyResult {
  id: string;
  address: string;
  floorUnit: string | null;
  type: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

interface ClientResult {
  id: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
}

interface AddGuaranteeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  tenantClientId: string;
  onSuccess: () => void;
}

const KIND_OPTIONS: { kind: GuaranteeKind; icon: React.ReactNode; description: string }[] = [
  {
    kind: "propertyOwner",
    icon: <Building2 size={18} />,
    description: "Un inmueble cuyo dueño legal actúa como garante",
  },
  {
    kind: "salaryReceipt",
    icon: <User size={18} />,
    description: "Una persona que acredita ingresos con recibo de sueldo",
  },
  {
    kind: "deposit",
    icon: <Banknote size={18} />,
    description: "Depósito en dinero retenido como garantía",
  },
];

const TIPO_PROPIEDAD: Record<string, string> = {
  departamento: "Departamento",
  casa: "Casa",
  local: "Local comercial",
  oficina: "Oficina",
  terreno: "Terreno",
  otro: "Otro",
};

export function AddGuaranteeModal({
  open,
  onOpenChange,
  contractId,
  tenantClientId,
  onSuccess,
}: AddGuaranteeModalProps) {
  const [step, setStep] = useState<KindStep>("select");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- propertyOwner state ---
  const [propSearch, setPropSearch] = useState("");
  const [propResults, setPropResults] = useState<PropertyResult[]>([]);
  const [propLoading, setPropLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyResult | null>(null);
  const propDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- salaryReceipt state ---
  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState<ClientResult[]>([]);
  const [personLoading, setPersonLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<ClientResult | null>(null);
  const personDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- deposit state ---
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<"ARS" | "USD">("ARS");
  const [depositHeldBy, setDepositHeldBy] = useState("");
  const [depositNotes, setDepositNotes] = useState("");

  function reset() {
    setStep("select");
    setSaving(false);
    setErrorMsg(null);
    setPropSearch("");
    setPropResults([]);
    setSelectedProperty(null);
    setPersonSearch("");
    setPersonResults([]);
    setSelectedPerson(null);
    setDepositAmount("");
    setDepositCurrency("ARS");
    setDepositHeldBy("");
    setDepositNotes("");
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Property search
  useEffect(() => {
    if (step !== "propertyOwner") return;
    if (propDebounce.current) clearTimeout(propDebounce.current);
    if (!propSearch.trim()) { setPropResults([]); return; }
    propDebounce.current = setTimeout(async () => {
      setPropLoading(true);
      try {
        const res = await fetch(`/api/properties?search=${encodeURIComponent(propSearch)}&limit=8`);
        const data = await res.json();
        setPropResults(data.properties ?? []);
      } catch { setPropResults([]); }
      finally { setPropLoading(false); }
    }, 300);
  }, [propSearch, step]);

  // Person search
  useEffect(() => {
    if (step !== "salaryReceipt") return;
    if (personDebounce.current) clearTimeout(personDebounce.current);
    if (!personSearch.trim()) { setPersonResults([]); return; }
    personDebounce.current = setTimeout(async () => {
      setPersonLoading(true);
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(personSearch)}&limit=8`);
        const data = await res.json();
        setPersonResults(data.clients ?? []);
      } catch { setPersonResults([]); }
      finally { setPersonLoading(false); }
    }, 300);
  }, [personSearch, step]);

  async function handleSave() {
    setErrorMsg(null);

    let body: Record<string, unknown>;

    if (step === "propertyOwner") {
      if (!selectedProperty) { setErrorMsg("Seleccioná una propiedad."); return; }
      body = { kind: "propertyOwner", contractId, tenantClientId, propertyId: selectedProperty.id };
    } else if (step === "salaryReceipt") {
      if (!selectedPerson) { setErrorMsg("Seleccioná una persona garante."); return; }
      body = { kind: "salaryReceipt", contractId, tenantClientId, personClientId: selectedPerson.id };
    } else if (step === "deposit") {
      if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
        setErrorMsg("Ingresá un monto válido."); return;
      }
      body = {
        kind: "deposit",
        contractId,
        tenantClientId,
        depositAmount,
        depositCurrency,
        depositHeldBy: depositHeldBy || null,
        depositNotes: depositNotes || null,
      };
    } else {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/guarantees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const title =
    step === "select"
      ? "Agregar garantía"
      : GUARANTEE_KIND_LABELS[step as GuaranteeKind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {step === "select" && (
            <DialogDescription>
              Seleccioná el tipo de garantía para este contrato
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ── Selección de tipo ── */}
        {step === "select" && (
          <div className="flex flex-col gap-2 py-2">
            {KIND_OPTIONS.map(({ kind, icon, description }) => (
              <button
                key={kind}
                onClick={() => setStep(kind)}
                className="flex items-center gap-4 px-4 py-3.5 rounded-[10px] border border-border bg-surface hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
              >
                <div className="size-9 rounded-[8px] bg-surface-mid flex items-center justify-center flex-shrink-0 text-muted-foreground">
                  {icon}
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-on-surface">
                    {GUARANTEE_KIND_LABELS[kind]}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    {description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Propiedad en garantía ── */}
        {step === "propertyOwner" && (
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className={labelCls}>Buscar propiedad</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={propSearch}
                  onChange={(e) => { setPropSearch(e.target.value); setSelectedProperty(null); }}
                  placeholder="Dirección, zona, propietario..."
                  className={cn(inputCls, "pl-8")}
                  autoFocus
                />
              </div>
              {propLoading && (
                <div className="flex items-center gap-2 mt-2 text-[12px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> Buscando...
                </div>
              )}
              {propResults.length > 0 && !selectedProperty && (
                <div className="mt-1.5 border border-border rounded-[8px] overflow-hidden bg-surface">
                  {propResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProperty(p); setPropSearch(""); setPropResults([]); }}
                      className="w-full flex flex-col px-3.5 py-2.5 hover:bg-surface-mid text-left border-b border-border last:border-b-0 transition-colors"
                    >
                      <span className="text-[13px] font-medium text-on-surface">
                        {p.floorUnit ? `${p.address}, ${p.floorUnit}` : p.address}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {TIPO_PROPIEDAD[p.type] ?? p.type}
                        {(p.ownerFirstName || p.ownerLastName) && ` · ${[p.ownerFirstName, p.ownerLastName].filter(Boolean).join(" ")}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProperty && (
              <div className="rounded-[10px] border border-primary/30 bg-primary/5 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/70">Propiedad seleccionada</span>
                  <button onClick={() => setSelectedProperty(null)} className="text-[11px] text-muted-foreground hover:text-on-surface">
                    Cambiar
                  </button>
                </div>
                <div className="text-[13.5px] font-semibold text-on-surface">
                  {selectedProperty.floorUnit
                    ? `${selectedProperty.address}, ${selectedProperty.floorUnit}`
                    : selectedProperty.address}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {TIPO_PROPIEDAD[selectedProperty.type] ?? selectedProperty.type}
                </div>
                {(selectedProperty.ownerFirstName || selectedProperty.ownerLastName) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground">
                    <User size={12} />
                    <span>
                      Garante legal: <span className="font-semibold text-on-surface">
                        {[selectedProperty.ownerFirstName, selectedProperty.ownerLastName].filter(Boolean).join(" ")}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="text-[11.5px] text-muted-foreground bg-surface-mid rounded-[8px] px-3 py-2.5">
              El garante que firma el contrato será el <strong>dueño legal actual</strong> de la propiedad seleccionada. Si el dueño cambia, los documentos se actualizan automáticamente.
            </div>
          </div>
        )}

        {/* ── Recibo de sueldo ── */}
        {step === "salaryReceipt" && (
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className={labelCls}>Buscar persona garante</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={personSearch}
                  onChange={(e) => { setPersonSearch(e.target.value); setSelectedPerson(null); }}
                  placeholder="Nombre, DNI..."
                  className={cn(inputCls, "pl-8")}
                  autoFocus
                />
              </div>
              {personLoading && (
                <div className="flex items-center gap-2 mt-2 text-[12px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> Buscando...
                </div>
              )}
              {personResults.length > 0 && !selectedPerson && (
                <div className="mt-1.5 border border-border rounded-[8px] overflow-hidden bg-surface">
                  {personResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPerson(p); setPersonSearch(""); setPersonResults([]); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-mid text-left border-b border-border last:border-b-0 transition-colors"
                    >
                      <div className="size-7 rounded-full bg-surface-mid flex items-center justify-center text-[11px] font-bold text-muted-foreground flex-shrink-0">
                        {p.firstName[0]}{p.lastName?.[0] ?? ""}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-on-surface">
                          {p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName}
                        </div>
                        {p.dni && <div className="text-[11px] text-muted-foreground">DNI {p.dni}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPerson && (
              <div className="rounded-[10px] border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-[13px] font-bold text-primary flex-shrink-0">
                  {selectedPerson.firstName[0]}{selectedPerson.lastName?.[0] ?? ""}
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-on-surface">
                    {selectedPerson.lastName
                      ? `${selectedPerson.firstName} ${selectedPerson.lastName}`
                      : selectedPerson.firstName}
                  </div>
                  {selectedPerson.dni && (
                    <div className="text-[11.5px] text-muted-foreground">DNI {selectedPerson.dni}</div>
                  )}
                </div>
                <button onClick={() => setSelectedPerson(null)} className="text-[11px] text-muted-foreground hover:text-on-surface">
                  Cambiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Depósito ── */}
        {step === "deposit" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Monto <span className="text-error">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[0.82rem]">
                    {depositCurrency === "ARS" ? "$" : "US$"}
                  </span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    className={cn(inputCls, "pl-9")}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Moneda</label>
                <div className="flex rounded-[7px] p-[2px] border border-border" style={{ background: "var(--surface-mid)" }}>
                  {(["ARS", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setDepositCurrency(c)}
                      className={cn(
                        "flex-1 py-1.5 text-[0.75rem] font-semibold rounded-[5px] transition-all border",
                        depositCurrency === c
                          ? "bg-primary-dim border-primary text-on-surface"
                          : "border-transparent text-text-secondary hover:text-on-surface"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Retenido por (opcional)</label>
              <input
                type="text"
                value={depositHeldBy}
                onChange={(e) => setDepositHeldBy(e.target.value)}
                placeholder="Ej: Inmobiliaria, propietario..."
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Notas (opcional)</label>
              <input
                type="text"
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                placeholder="Condiciones de devolución, etc."
                className={inputCls}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="text-[0.78rem] text-error bg-error/5 border border-error/20 rounded-[8px] px-3 py-2">
            {errorMsg}
          </div>
        )}

        <DialogFooter>
          {step !== "select" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setStep("select"); setErrorMsg(null); }} disabled={saving}>
                Volver
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
                {saving && <Loader2 size={12} className="animate-spin mr-1" />}
                Guardar garantía
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
