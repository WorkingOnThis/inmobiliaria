"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface NewOwnerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (owner: CreatedOwner) => void;
}

interface CreatedOwner {
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

export function NewOwnerModal({
  open,
  onClose,
  onCreated,
}: NewOwnerModalProps) {
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
      const res = await fetch("/api/owners", {
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
      await queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast.success(`${form.firstName} fue agregado como propietario`);
      onCreated?.(data.owner);
      handleClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-[640px] p-0 rounded-[24px] overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="font-bold text-[1.1rem] text-foreground font-headline tracking-[-0.02em]">
            Nuevo propietario
          </DialogTitle>
          <DialogDescription className="text-[0.71rem] text-muted-foreground mt-0.5 leading-relaxed">
            Completá los datos esenciales. El resto puede cargarse desde la ficha.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 flex flex-col gap-5 max-h-[72vh] overflow-y-auto">
            {/* Datos personales */}
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-3.5 h-0.5 bg-primary rounded-sm block" />
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Datos personales
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Nombre <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={set("firstName")}
                    placeholder="Carlos"
                    required
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={set("lastName")}
                    placeholder="Mendoza"
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    DNI
                  </label>
                  <input
                    type="text"
                    value={form.dni}
                    onChange={set("dni")}
                    placeholder="28441100"
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="351 612-4400"
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="cmendoza@gmail.com"
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Datos bancarios */}
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-3.5 h-0.5 bg-primary rounded-sm block" />
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Datos bancarios{" "}
                  <span className="font-normal text-[0.6rem] tracking-normal lowercase text-muted-foreground">
                    — opcionales, necesarios para liquidar
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    CBU / CVU
                  </label>
                  <input
                    type="text"
                    value={form.cbu}
                    onChange={set("cbu")}
                    placeholder="0000003100012345678900"
                    maxLength={22}
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Alias
                  </label>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={set("alias")}
                    placeholder="carlos.mendoza.mp"
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Banco
                  </label>
                  <input
                    type="text"
                    value={form.banco}
                    onChange={set("banco")}
                    placeholder="Banco Nación"
                    className="w-full bg-muted border border-border rounded-[12px] text-foreground text-[0.82rem] px-3 py-2 outline-none focus:border-border-accent focus:bg-muted transition-all placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 size={12} className="animate-spin" />}
              Guardar propietario
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
