"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function PropietarioForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [profession, setProfession] = useState("");
  // Datos bancarios
  const [cbu, setCbu] = useState("");
  const [alias, setAlias] = useState("");
  const [banco, setBanco] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState("");

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
        throw new Error(res.error || "Error al crear el propietario");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Propietario creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["clients", "propietario"] });
      router.push("/propietarios");
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
      type: "propietario",
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      dni: dni.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      profession: profession.trim() || null,
      cbu: cbu.trim() || null,
      alias: alias.trim() || null,
      banco: banco.trim() || null,
      tipoCuenta: tipoCuenta || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-2xl">
      {/* Datos personales */}
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
              placeholder="Ej: Ricardo"
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
              placeholder="Ej: Díaz"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: 20123456"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: 1122334455"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: 1122334455"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: rdíaz@ejemplo.com"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Domicilio</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Av. Corrientes 1234, CABA"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="profession">Profesión / Ocupación</Label>
            <Input
              id="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Contador"
            />
          </div>
        </div>
      </div>

      {/* Datos bancarios */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Datos bancarios{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (opcionales — para liquidaciones)
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="cbu">CBU / CVU</Label>
            <Input
              id="cbu"
              value={cbu}
              onChange={(e) => setCbu(e.target.value)}
              disabled={mutation.isPending}
              placeholder="22 dígitos"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">Alias</Label>
            <Input
              id="alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: ARBOL.LIMA.SOL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <Input
              id="banco"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              disabled={mutation.isPending}
              placeholder="Ej: Banco Galicia"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoCuenta">Tipo de cuenta</Label>
            <Select
              value={tipoCuenta}
              onValueChange={setTipoCuenta}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="tipoCuenta">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caja_ahorro">Caja de ahorros</SelectItem>
                <SelectItem value="cuenta_corriente">Cuenta corriente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/propietarios")}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando..." : "Crear Propietario"}
        </Button>
      </div>
    </form>
  );
}
