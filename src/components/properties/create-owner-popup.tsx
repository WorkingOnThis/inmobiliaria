"use client";

import { useState } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    /* Overlay por encima del modal/drawer — z-[200] para superar el z-50 del drawer */
    <div
      className="fixed inset-0 flex items-center justify-center z-[200] bg-black/65 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden bg-surface border border-white/8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-primary" />
            <span className="text-[13px] font-bold text-on-surface uppercase tracking-wider">
              Nuevo propietario
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 text-muted-foreground hover:text-on-surface"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[11px] text-muted-foreground -mt-1">
            Los campos con <span className="text-primary">*</span> son obligatorios.
            El resto se completa en la ficha del propietario.
          </p>

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Nombre <span className="text-primary">*</span>
            </Label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Roberto Suárez"
              className="bg-surface-mid border-none text-on-surface h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* DNI */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              DNI
            </Label>
            <Input
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 28.456.789"
              className="bg-surface-mid border-none text-on-surface h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              WhatsApp / Celular
            </Label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 351 456 7890"
              className="bg-surface-mid border-none text-on-surface h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Crear propietario"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
