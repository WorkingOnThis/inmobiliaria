"use client";

import { useState } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CreatedOwner {
  id: string;
  firstName: string;
  lastName?: string | null;
}

interface CreateOwnerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (owner: CreatedOwner) => void;
  /** Pre-rellena el nombre desde lo que escribió en el buscador */
  initialName?: string;
}

/**
 * CreateOwnerPopup
 *
 * Mini-formulario que aparece POR ENCIMA del modal/drawer de nueva propiedad.
 * Sólo pide nombre (obligatorio), DNI y WhatsApp (opcionales).
 * Al guardar, hace POST /api/clients y llama onCreated con el nuevo propietario.
 */
export function CreateOwnerPopup({ isOpen, onClose, onCreated, initialName = "" }: CreateOwnerPopupProps) {
  const [nombre, setNombre] = useState(initialName);
  const [dni, setDni] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: nombre.trim(),
          dni: dni.trim() || null,
          whatsapp: whatsapp.trim() || null,
          type: "propietario",
          createAsUser: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el propietario");
      }

      const data = await res.json();
      toast.success("Propietario creado");
      onCreated(data.client);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    /* Overlay por encima del modal/drawer — z-[200] para superar el z-50 del drawer */
    <div
      className="fixed inset-0 flex items-center justify-center z-[200]"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#1a1d1e", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2">
            <UserPlus size={16} style={{ color: "#ffb4a2" }} />
            <span className="text-[13px] font-bold text-white uppercase tracking-wider">
              Nuevo propietario
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-[11px] text-gray-500 -mt-1">
            Los campos con <span style={{ color: "#ffb4a2" }}>*</span> son obligatorios.
            El resto se completa en la ficha del propietario.
          </p>

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Nombre <span style={{ color: "#ffb4a2" }}>*</span>
            </Label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Roberto Suárez"
              className="bg-[#242729] border-none text-white h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
            />
          </div>

          {/* DNI */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              DNI
            </Label>
            <Input
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 28.456.789"
              className="bg-[#242729] border-none text-white h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              WhatsApp / Celular
            </Label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 351 456 7890"
              className="bg-[#242729] border-none text-white h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-[#ffb4a2] placeholder:text-gray-600"
            />
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-3 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-10 rounded-xl text-[12px] font-semibold text-gray-400 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 h-10 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all"
              style={{
                background: "#ffdad2",
                color: "#3c0800",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Crear propietario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
