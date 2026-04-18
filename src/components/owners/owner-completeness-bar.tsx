"use client";

interface OwnerCompletenessBarProps {
  owner: {
    cbu: string | null;
    dni: string | null;
    cuit: string | null;
    condicionFiscal: string | null;
    birthDate: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    alias: string | null;
    banco: string | null;
    tipoCuenta: string | null;
    nacionalidad: string | null;
    ocupacion: string | null;
    notasInternas: string | null;
  };
  onChipClick?: (fieldId: string) => void;
}

interface FieldDef {
  id: string;
  label: string;
  weight: number;
  value: string | null | undefined;
}

export function OwnerCompletenessBar({
  owner,
  onChipClick,
}: OwnerCompletenessBarProps) {
  const fields: FieldDef[] = [
    { id: "cbu",           label: "CBU / CVU",        weight: 3,   value: owner.cbu },
    { id: "dni",           label: "DNI",              weight: 2,   value: owner.dni },
    { id: "cuit",          label: "CUIT / CUIL",      weight: 2,   value: owner.cuit },
    { id: "condicionFiscal", label: "Condición fiscal", weight: 1.5, value: owner.condicionFiscal },
    { id: "phone",         label: "Teléfono",         weight: 1.5, value: owner.phone },
    { id: "email",         label: "Email",            weight: 1.5, value: owner.email },
    { id: "alias",         label: "Alias CBU",        weight: 1,   value: owner.alias },
    { id: "banco",         label: "Banco",            weight: 1,   value: owner.banco },
    { id: "tipoCuenta",    label: "Tipo de cuenta",   weight: 1,   value: owner.tipoCuenta },
    { id: "address",       label: "Domicilio fiscal", weight: 1,   value: owner.address },
    { id: "birthDate",     label: "Fecha nac.",       weight: 0.5, value: owner.birthDate },
    { id: "nacionalidad",  label: "Nacionalidad",     weight: 0.5, value: owner.nacionalidad },
    { id: "ocupacion",     label: "Ocupación",        weight: 0.5, value: owner.ocupacion },
    { id: "notasInternas", label: "Notas internas",   weight: 0.5, value: owner.notasInternas },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const completedWeight = fields.reduce((sum, f) => sum + (f.value ? f.weight : 0), 0);
  const pct = Math.round((completedWeight / totalWeight) * 100);
  const missing = fields.filter((f) => !f.value);

  return (
    <div className="mt-3">
      {/* Label + porcentaje */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
          Completitud de la ficha
        </span>
        <span className="font-mono font-bold text-[0.72rem] text-on-surface">{pct}%</span>
      </div>

      {/* Track 3px */}
      <div
        className="w-full rounded-[9999px] overflow-hidden"
        style={{ height: "3px", background: "var(--border)" }}
      >
        <div
          className="h-full rounded-[9999px] transition-all duration-500"
          style={{ width: `${pct}%`, background: "var(--primary)" }}
        />
      </div>

      {/* Chips de campos faltantes */}
      {missing.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[0.62rem] text-text-muted flex-shrink-0">Falta:</span>
          {missing.map((f) => (
            <button
              key={f.id}
              onClick={() => onChipClick?.(f.id)}
              className="group flex items-center gap-1 px-2 py-[3px] text-[11px] font-medium text-text-secondary bg-surface-mid border border-dashed border-border rounded-[4px] transition-all hover:border-solid hover:border-primary hover:bg-primary-dim hover:text-on-surface"
            >
              <span className="text-[0.65rem] leading-none">+</span>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
