"use client";

import { CAMPOS_SERVICIO, type ServicioTipo } from "@/lib/servicios/constants";

type Props = {
  tipo: ServicioTipo;
  valores: Record<string, string>;
  onChange: (valores: Record<string, string>) => void;
  inputClassName?: string;
};

export function CamposServicio({ tipo, valores, onChange, inputClassName }: Props) {
  const campos = CAMPOS_SERVICIO[tipo] ?? [];

  const baseInputClass =
    inputClassName ??
    "w-full rounded-lg border border-border bg-surface-mid px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40";

  function handleChange(key: string, value: string) {
    onChange({ ...valores, [key]: value });
  }

  if (campos.length === 0) return null;

  return (
    <div className={campos.length > 1 ? "grid grid-cols-2 gap-3" : ""}>
      {campos.map((campo) => (
        <div key={campo.key}>
          <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            {campo.label}
          </label>
          <input
            type="text"
            value={valores[campo.key] ?? ""}
            onChange={(e) => handleChange(campo.key, e.target.value)}
            placeholder={campo.placeholder ?? ""}
            className={`${baseInputClass}${campo.mono ? " font-mono" : ""}`}
          />
        </div>
      ))}
    </div>
  );
}
