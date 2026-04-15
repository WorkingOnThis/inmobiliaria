"use client";

interface PropietarioCompletitudBarProps {
  propietario: {
    cbu: string | null;
    dni: string | null;
    cuit: string | null;
    birthDate: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    banco: string | null;
  };
  onChipClick?: (fieldId: string) => void;
}

interface FieldDef {
  id: string;
  label: string;
  weight: number;
  value: string | null | undefined;
}

export function PropietarioCompletitudBar({
  propietario,
  onChipClick,
}: PropietarioCompletitudBarProps) {
  const fields: FieldDef[] = [
    { id: "cbu", label: "CBU / CVU", weight: 3, value: propietario.cbu },
    { id: "dni", label: "DNI", weight: 2, value: propietario.dni },
    { id: "cuit", label: "CUIT / CUIL", weight: 2, value: propietario.cuit },
    { id: "phone", label: "Teléfono", weight: 1.5, value: propietario.phone },
    { id: "email", label: "Email", weight: 1.5, value: propietario.email },
    { id: "birthDate", label: "Fecha de nacimiento", weight: 1, value: propietario.birthDate },
    { id: "address", label: "Domicilio fiscal", weight: 1, value: propietario.address },
    { id: "banco", label: "Banco", weight: 1, value: propietario.banco },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const completedWeight = fields.reduce(
    (sum, f) => sum + (f.value ? f.weight : 0),
    0
  );
  const pct = Math.round((completedWeight / totalWeight) * 100);

  const missing = fields.filter((f) => !f.value);

  // Gradiente: rojo (≤30%) → amarillo (60%) → verde (100%)
  function getGradient(pct: number) {
    if (pct < 40) return "linear-gradient(90deg, var(--destructive), var(--primary))";
    if (pct < 70) return "linear-gradient(90deg, var(--primary), var(--mustard))";
    return "linear-gradient(90deg, var(--mustard), var(--green))";
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
          Completitud de la ficha
        </span>
        <span className="text-[0.72rem] font-bold text-on-bg">{pct}%</span>
      </div>

      <div className="h-1.5 bg-surface-mid rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: getGradient(pct),
          }}
        />
      </div>

      {missing.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[0.62rem] text-text-muted flex-shrink-0">Falta:</span>
          {missing.map((f) => (
            <button
              key={f.id}
              onClick={() => onChipClick?.(f.id)}
              className="flex items-center gap-1 px-2 py-0.5 text-[0.62rem] font-medium text-text-secondary bg-surface-mid border border-border rounded-full hover:border-border-accent hover:text-primary transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary block flex-shrink-0" />
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
