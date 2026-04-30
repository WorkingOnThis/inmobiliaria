// src/components/clients/role-toggle.tsx
"use client";

import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery } from "@tanstack/react-query";

type Role = "inquilino" | "propietario" | "resumen";

const LABELS: Record<Role, string> = {
  inquilino: "Inquilino",
  propietario: "Propietario",
  resumen: "Resumen",
};

const URLS: Record<Role, (id: string) => string> = {
  inquilino: (id) => `/inquilinos/${id}`,
  propietario: (id) => `/propietarios/${id}`,
  resumen: (id) => `/clientes/${id}`,
};

type Props = {
  clientId: string;
  currentRole: Role;
};

export function RoleToggle({ clientId, currentRole }: Props) {
  const router = useRouter();

  const { data } = useQuery<{ roles: string[] }>({
    queryKey: ["client-roles", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/roles`);
      if (!res.ok) throw new Error("Error al obtener roles del cliente");
      return res.json();
    },
    staleTime: 60_000,
  });

  const roles = data?.roles ?? [];
  const hasTenant = roles.includes("tenant");
  const hasOwner = roles.includes("owner");
  const hasMultipleRoles = hasTenant && hasOwner;

  const availableRoles: Role[] = [];
  if (hasTenant) availableRoles.push("inquilino");
  if (hasOwner) availableRoles.push("propietario");
  if (hasMultipleRoles) availableRoles.push("resumen");

  if (availableRoles.length === 0) return null;
  if (availableRoles.length <= 1 && currentRole !== "resumen") return null;

  return (
    <ToggleGroup
      type="single"
      value={currentRole}
      onValueChange={(v) => {
        if (!v || v === currentRole) return;
        router.push(URLS[v as Role](clientId));
      }}
    >
      {availableRoles.map((role) => (
        <ToggleGroupItem key={role} value={role} className="text-xs h-8 px-3">
          {LABELS[role]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
