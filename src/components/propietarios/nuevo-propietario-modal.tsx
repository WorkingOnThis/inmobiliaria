"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";

interface NuevoPropietarioModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (propietario: CreatedPropietario) => void;
}

interface CreatedPropietario {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  dni: string | null;
  cbu: string | null;
  status: string;
}

interface FormState {
  // Datos personales
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
  email: string;
  // Datos bancarios
  cbu: string;
  alias: string;
  banco: string;
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  dni: "",
  phone: "",
  email: "",
  cbu: "",
  alias: "",
  banco: "",
};

export function NuevoPropietarioModal({
  open,
  onClose,
  onCreated,
}: NuevoPropietarioModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleClose = () => {
    setForm(emptyForm);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/propietarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          dni: form.dni.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          cbu: form.cbu.trim() || null,
          alias: form.alias.trim() || null,
          banco: form.banco.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear propietario");
      }

      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["propietarios"] });
      toast.success(`${form.firstName} fue agregado como propietario`);
      onCreated?.(data.propietario);
      handleClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[3px] flex items-start justify-center px-4 py-8 overflow-y-auto">
      <div
        className="bg-[#191c1e] border border-white/[0.07] rounded-[24px] w-full max-w-[640px] overflow-hidden my-auto flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-start gap-3">
          <div>
            <div className="font-bold text-[1.1rem] text-[#e1e2e4] font-[Space_Grotesk] tracking-[-0.02em]">
              Nuevo propietario
            </div>
            <div className="text-[0.71rem] text-[#a8a9ac] mt-0.5 leading-relaxed">
              Completá los datos esenciales. El resto puede cargarse desde la ficha.
            </div>
          </div>
          <button
            onClick={handleClose}
            className="ml-auto flex-shrink-0 text-[#6b6d70] hover:text-[#e1e2e4] hover:bg-[#282a2c] rounded-[6px] w-8 h-8 flex items-center justify-center transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 flex flex-col gap-5 max-h-[72vh] overflow-y-auto">
            {/* Datos personales */}
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-3.5 h-0.5 bg-[#ffb4a2] rounded-sm block" />
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#6b6d70]">
                  Datos personales
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    Nombre <span className="text-[#ffb4ab]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={set("firstName")}
                    placeholder="Carlos"
                    required
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={set("lastName")}
                    placeholder="Mendoza"
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    DNI
                  </label>
                  <input
                    type="text"
                    value={form.dni}
                    onChange={set("dni")}
                    placeholder="28441100"
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="351 612-4400"
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="cmendoza@gmail.com"
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
              </div>
            </div>

            {/* Datos bancarios */}
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-3.5 h-0.5 bg-[#ffb4a2] rounded-sm block" />
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#6b6d70]">
                  Datos bancarios{" "}
                  <span className="font-normal text-[0.6rem] tracking-normal lowercase text-[#6b6d70]">
                    — opcionales, necesarios para liquidar
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    CBU / CVU
                  </label>
                  <input
                    type="text"
                    value={form.cbu}
                    onChange={set("cbu")}
                    placeholder="0000003100012345678900"
                    maxLength={22}
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70] font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    Alias
                  </label>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={set("alias")}
                    placeholder="carlos.mendoza.mp"
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#a8a9ac]">
                    Banco
                  </label>
                  <input
                    type="text"
                    value={form.banco}
                    onChange={set("banco")}
                    placeholder="Banco Nación"
                    className="w-full bg-[#222527] border border-white/[0.07] rounded-[12px] text-[#e1e2e4] text-[0.82rem] px-3 py-2 outline-none focus:border-[rgba(255,180,162,0.2)] focus:bg-[#282a2c] transition-all placeholder:text-[#6b6d70]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/[0.07] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-3.5 py-2 text-[0.72rem] font-semibold text-[#a8a9ac] bg-[#333537] border border-white/[0.07] rounded-[12px] hover:bg-[#282a2c] transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-2 text-[0.72rem] font-semibold bg-[#ffb4a2] text-[#561100] rounded-[12px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Guardar propietario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
