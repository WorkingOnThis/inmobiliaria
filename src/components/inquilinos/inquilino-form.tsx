"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function InquilinoForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [profession, setProfession] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async (data: Record<string, string | null>) => {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || "Error al crear el inquilino");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Inquilino creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["clients", "inquilino"] });
      router.push("/inquilinos");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = "El nombre es requerido";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    mutation.mutate({
      type: "inquilino",
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      dni: dni.trim() || null,
      birthDate: birthDate || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      address: address.trim() || null,
      profession: profession.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-2xl">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Datos personales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Clara"
              aria-invalid={!!fieldErrors.firstName}
            />
            {fieldErrors.firstName && (
              <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Nieto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: 38456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Fecha de nacimiento</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: 1133445566"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: 1133445566"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: clara.nieto@ejemplo.com"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Domicilio actual</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Av. Santa Fe 500, CABA"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="profession">Profesión / Ocupación</Label>
            <Input
              id="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Diseñadora gráfica"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inquilinos")}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando..." : "Crear Inquilino"}
        </Button>
      </div>
    </form>
  );
}
